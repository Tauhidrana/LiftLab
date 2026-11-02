# The main elevator control unit.
#
# It gets button presses, keeps the request queue, asks the scheduler
# where to go, switches the motor, brake and doors, and watches the sensors.
# The 3D view and every panel only READ this object.

G = 9.81                 # gravity, m/s^2
LEVEL_TOLERANCE = 0.005  # metres: "level with the floor"
SENSOR_ZONE = 0.03       # metres: floor vane detection zone


class ElevatorController:
    def __init__(self, config):
        self.config = config
        self.trace = Tracer(clock=lambda: self.time)
        self.sm = ElevatorStateMachine(self.trace, clock=lambda: self.time)
        self.scheduler = RequestScheduler()
        self.motion = MovementEngine(config)
        self.doors = DoorController(config)
        self.safety = SafetySystem()
        self.traffic = TrafficSimulator(config)

        self.time = 0.0
        self.current_floor = 1
        self.target_floor = None
        self.direction = "NONE"
        self.car_calls = []      # buttons pressed inside the car
        self.hall_calls = []     # UP / DOWN buttons on the floors
        self.emergency = None
        self.floor_sensor = 1
        self.dwell = 0.0         # seconds the doors stay open
        self.needs_dispatch = False
        self.recovery = False

    # ------------------------------------------------------------------
    # Inputs: buttons and switches
    # ------------------------------------------------------------------

    def press_car_button(self, floor):
        # A floor button on the car's control panel.
        self.trace.begin_chain(f"Car button {floor}")
        self.trace.emit('input.carButton', event="FLOOR_BUTTON_PRESSED",
                        message=f"Car panel button {floor} pressed")
        self.request_floor(floor)

    def press_hall_button(self, floor, direction):
        # An UP / DOWN button on a landing.
        self.trace.begin_chain(f"Hall call {floor} {direction}")
        self.trace.emit('input.hallButton', event="HALL_CALL_PRESSED",
                        message=f"Landing button at floor {floor} pressed ({direction})")
        self.call_elevator(floor, direction)

    def press_door_open(self):
        state = self.sm.state
        self.trace.emit('input.doorOpen', event="DOOR_OPEN_BUTTON_PRESSED",
                        message=f"Door-open button pressed in state {state}")
        if state == "DOOR_CLOSING":
            return self.open_doors("Door-open button pressed while closing")
        if state == "DOOR_OPEN":
            self.dwell = self.config.door_dwell_time
            return self.trace.emit('door.holdOpen', event="DOOR_HOLD",
                                   message="Dwell timer restarted")
        if state == "IDLE" and self.is_level_at(self.current_floor):
            return self.open_doors("Door-open button pressed at rest")
        # Between floors the doors must stay shut.
        self.trace.emit('door.openRefused', event="COMMAND_IGNORED",
                        message="Doors cannot open: car is not level with a floor")

    def press_door_close(self):
        self.trace.emit('input.doorClose', event="DOOR_CLOSE_BUTTON_PRESSED",
                        message=f"Door-close button pressed in state {self.sm.state}")
        if self.sm.state == "DOOR_OPEN":
            self.close_doors("Door-close button pressed")

    def press_emergency_stop(self):
        # The red button: stays pressed until released and reset.
        if self.safety.has("emergencyStop"):
            self.clear_fault("emergencyStop")
        else:
            self.inject_fault("emergencyStop")

    def inject_fault(self, fault):
        if self.safety.has(fault):
            return
        self.safety.faults.add(fault)
        self.trace.emit('fault.inject', event="FAULT_INJECTED",
                        message=FAULT_LABELS[fault])
        self.monitor_safety()

    def clear_fault(self, fault):
        if not self.safety.has(fault):
            return
        self.safety.faults.remove(fault)
        self.trace.emit('fault.clear', event="FAULT_CLEARED",
                        message=f"{FAULT_LABELS[fault]} cleared")
        self.monitor_safety()
        if self.sm.state == "IDLE":
            self.needs_dispatch = True

    def reset_system(self):
        # Back to service after an emergency, only when every fault is gone.
        blocking = [f for f in self.safety.faults
                    if f not in ("doorObstruction", "doorSensorFailure")]
        self.trace.emit('reset.request', event="RESET_REQUESTED",
                        message=f"Reset requested in state {self.sm.state}")
        if self.sm.state != "EMERGENCY":
            return
        if blocking or self.motion.velocity != 0:
            return self.trace.emit('reset.refused', event="RESET_REFUSED",
                                   message="Cannot reset while faults are active")
        self.emergency = None
        self.safety.governor_tripped = False
        nearest = self.nearest_floor()
        if self.is_level_at(nearest):
            self.current_floor = nearest
            if self.doors.position > 0:
                return self.open_doors("Reset at floor level: doors reopen fully")
            self.sm.transition("IDLE", "Reset complete, car in service")
            self.needs_dispatch = True
            return
        # Stuck between floors: creep slowly to the nearest one.
        self.recovery = True
        self.trace.emit('reset.recovery', event="RECOVERY_RUN",
                        message=f"Recovery run to floor {nearest}")
        self.start_trip(nearest, "Recovery run after reset", self.config.rescue_speed)

    def set_mode(self, mode):
        old = self.config.mode
        self.config.mode = mode
        self.traffic.enabled = (mode == "automatic")
        self.trace.emit('config.mode', event="MODE_CHANGED",
                        message=f"Operation mode {old} -> {mode}")

    def set_algorithm(self, algorithm):
        old = self.config.algorithm
        self.config.algorithm = algorithm
        self.trace.emit('config.algorithm', event="ALGORITHM_CHANGED",
                        message=f"Scheduling algorithm {old} -> {algorithm}")

    # ------------------------------------------------------------------
    # Request queue
    # ------------------------------------------------------------------

    def request_floor(self, floor):
        if any(c.floor == floor for c in self.car_calls):
            return self.trace.emit('queue.duplicate', event="REQUEST_ALREADY_QUEUED",
                                   message=f"Floor {floor} is already in the queue")
        if floor == self.current_floor and self.is_level_at(floor) and self.hold_doors_at_floor():
            return
        # Store the request so it is not forgotten while the car is busy.
        self.car_calls.append(Call(floor, time=self.time))
        self.trace.emit('queue.addCar', event="REQUEST_QUEUED",
                        message=f"Adding floor {floor} to the queue")
        self.update_controller()

    def call_elevator(self, floor, direction):
        if any(h.floor == floor and h.direction == direction for h in self.hall_calls):
            return self.trace.emit('queue.duplicateHall', event="REQUEST_ALREADY_QUEUED",
                                   message=f"Hall call {floor} {direction} is already registered")
        going_that_way = self.direction in (direction, "NONE")
        if floor == self.current_floor and self.is_level_at(floor) and going_that_way \
                and self.hold_doors_at_floor():
            return
        self.hall_calls.append(Call(floor, direction, time=self.time))
        self.trace.emit('queue.addHall', event="REQUEST_QUEUED",
                        message=f"Adding hall call {floor} {direction} to the queue")
        self.update_controller()

    def hold_doors_at_floor(self):
        # Someone pressed the floor the car is already open at.
        state = self.sm.state
        if state == "DOOR_OPEN":
            self.dwell = self.config.door_dwell_time
        elif state == "DOOR_CLOSING":
            self.open_doors("Request for the current floor while doors were closing")
        elif state != "DOOR_OPENING":
            return False
        self.trace.emit('queue.atFloor', event="REQUEST_AT_CURRENT_FLOOR",
                        message=f"Car is already at floor {self.current_floor}, holding doors")
        return True

    # ------------------------------------------------------------------
    # Controller logic
    # ------------------------------------------------------------------

    def update_controller(self):
        state = self.sm.state
        if state == "IDLE":
            return self.dispatch()
        if state in ("MOVING_UP", "MOVING_DOWN"):
            return self.reevaluate_target()
        if state == "EMERGENCY":
            return self.trace.emit('controller.held', event="REQUEST_HELD",
                                   message="Request stored, but the car is in EMERGENCY")
        self.trace.emit('controller.deferred', event="REQUEST_DEFERRED",
                        message=f"Doors busy ({state}); request will wait")

    def dispatch(self):
        # Pick the next destination and start moving, if it is safe.
        self.needs_dispatch = False
        floor = self.scheduler.select_next(self.scheduling_context())
        if self.scheduler.custom_error:
            self.trace.emit('scheduler.customError', event="CUSTOM_SCHEDULER_ERROR",
                            message=self.scheduler.custom_error)
            self.scheduler.custom_error = None
        if floor is None:
            self.direction = "NONE"
            self.target_floor = None
            if self.sm.state != "IDLE":
                self.sm.transition("IDLE", "Request queue empty")
            return
        self.trace.emit('scheduler.decision', event="NEXT_DESTINATION_SELECTED",
                        message=f"{self.config.algorithm} chose floor {floor}")

        if floor == self.current_floor and self.is_level_at(floor):
            self.serve_floor(floor)
            return self.open_doors(f"Request at the current floor {floor}")

        ok, open_links = self.safety.can_move(self.doors.locked)
        if not ok:
            # The motor may only start when every safety switch is closed.
            self.trace.emit('safety.blocked', event="DISPATCH_BLOCKED",
                            message=f"Safety chain open: {', '.join(open_links)}")
            self.target_floor = None
            if self.sm.state != "IDLE":
                self.sm.transition("IDLE", "Dispatch blocked by safety chain")
            return
        self.start_trip(floor, "Next destination")

    def start_trip(self, floor, reason, speed=None):
        speed = speed or self.config.rated_speed
        direction = "UP" if self.floor_position(floor) > self.motion.position else "DOWN"
        self.target_floor = floor
        self.direction = direction
        self.trace.emit('controller.destination', event="DESTINATION_SET",
                        message=f"Floor {self.current_floor} -> {floor}, going {direction}")

        # 1. Switch the motor on first so it holds the weight...
        self.motion.start(self.floor_position(floor), speed)
        self.trace.emit('motor.start', event="MOTOR_ACTIVATED",
                        message=f"Motor on (pre-torque), limit {speed} m/s")
        # 2. ...then lift the brake.
        self.motion.release_brake()
        self.trace.emit('brake.release', event="BRAKE_RELEASED",
                        message="Brake coil powered: brake shoes lift off the drum")
        self.sm.transition("MOVING_UP" if direction == "UP" else "MOVING_DOWN", reason)

    def reevaluate_target(self):
        # A new request came while moving: can we stop for it on the way?
        if self.recovery or self.target_floor is None:
            return
        floor = self.scheduler.select_next(self.scheduling_context())
        if floor is None or floor == self.target_floor:
            return self.trace.emit('controller.keepTarget', event="TARGET_UNCHANGED",
                                   message=f"Continuing to floor {self.target_floor}")
        new_pos = self.floor_position(floor)
        old_pos = self.floor_position(self.target_floor)
        on_the_way = new_pos < old_pos if self.direction == "UP" else new_pos > old_pos
        if not on_the_way:
            return
        if not self.motion.can_stop_at(new_pos):
            return self.trace.emit('controller.tooLate', event="STOP_NOT_POSSIBLE",
                                   message=f"Too close to stop at floor {floor}")
        self.trace.emit('controller.retarget', event="TARGET_UPDATED",
                        message=f"Extra stop: floor {floor} is on the way")
        self.target_floor = floor
        self.motion.target = new_pos

    def on_arrival(self):
        floor = self.target_floor or self.nearest_floor()
        self.motion.apply_brake()
        # Brakes are held OPEN by electricity: no power = brake closes.
        self.trace.emit('brake.apply', event="BRAKE_APPLIED",
                        message=f"Car level at floor {floor}: motor off, brake on")
        self.current_floor = floor
        self.target_floor = None
        self.trace.emit('controller.arrived', event="ARRIVED",
                        message=f"Arrived at floor {floor}")

        requested = any(c.floor == floor for c in self.car_calls + self.hall_calls)
        if requested or self.recovery:
            self.recovery = False
            self.serve_floor(floor)
            self.open_doors(f"Arrived at requested floor {floor}")
        else:
            self.direction = self.scheduler.direction_after_stop(self.scheduling_context())
            self.sm.transition("IDLE", f"Reached floor {floor} with no request there")
            self.needs_dispatch = True

    def serve_floor(self, floor):
        # Remove the requests this stop has answered.
        self.car_calls = [c for c in self.car_calls if c.floor != floor]
        next_dir = self.scheduler.direction_after_stop(self.scheduling_context())
        self.hall_calls = [h for h in self.hall_calls
                           if h.floor != floor or (next_dir != "NONE" and h.direction != next_dir)]
        self.direction = next_dir
        self.trace.emit('queue.remove', event="REQUEST_SERVED",
                        message=f"Floor {floor} removed from the queue")

    # ------------------------------------------------------------------
    # Doors
    # ------------------------------------------------------------------

    def open_doors(self, reason):
        self.doors.start_opening()
        self.trace.emit('door.open', event="DOOR_OPEN_START",
                        message="Door motor drives the doors open")
        if self.emergency:
            return   # battery rescue: doors open, car stays out of service
        self.sm.transition("DOOR_OPENING", reason)

    def on_doors_opened(self):
        self.dwell = self.config.door_dwell_time
        self.trace.emit('door.opened', event="DOORS_OPENED",
                        message=f"Doors fully open, waiting {self.dwell} s")
        self.sm.transition("DOOR_OPEN", "Doors fully open")
        out, inn = self.traffic.exchange(self.time, self.current_floor, self.direction, self)
        if out + inn > 0:
            self.trace.emit('traffic.exchange', event="PASSENGER_EXCHANGE",
                            message=f"{out} left, {inn} boarded at floor {self.current_floor}")

    def update_dwell(self, dt):
        if self.config.mode == "manual":
            return    # manual mode: only the close button closes the doors
        if self.doors.light_curtain["blocked"]:
            self.dwell = self.config.door_dwell_time   # someone is in the doorway
            return
        self.dwell -= dt
        if self.dwell <= 0:
            self.close_doors("Dwell time elapsed")

    def close_doors(self, reason):
        ok, why = self.safety.can_close_doors(self.doors.light_curtain)
        if not ok:
            # Cannot prove the doorway is clear -> keep the doors open.
            self.dwell = self.config.door_dwell_time
            return self.trace.emit('door.closeRefused', event="DOOR_CLOSE_REFUSED",
                                   message=f"{why}. Doors stay open.")
        self.doors.start_closing()
        self.trace.emit('door.close', event="DOOR_CLOSE_START",
                        message="Light curtain clear: doors closing")
        self.sm.transition("DOOR_CLOSING", reason)

    def update_closing(self, dt):
        ok, why = self.safety.can_close_doors(self.doors.light_curtain)
        if not ok:
            # A beam was broken while closing: open again at once.
            self.trace.emit('door.reverse', event="OBSTRUCTION_DETECTED",
                            message=f"{why}: reversing doors")
            return self.open_doors("Door reversal (obstruction)")
        if self.doors.update(dt) != "CLOSED":
            return
        self.trace.emit('door.locked', event="DOORS_CLOSED_AND_LOCKED",
                        message="Doors closed and locked")
        self.dispatch()

    # ------------------------------------------------------------------
    # Safety
    # ------------------------------------------------------------------

    def monitor_safety(self):
        # Runs every tick: compare sensors and faults with what is safe.
        faults = self.safety.faults
        self.doors.light_curtain["healthy"] = "doorSensorFailure" not in faults
        self.doors.light_curtain["blocked"] = "doorObstruction" in faults and self.doors.position > 0.02
        if self.sm.state == "EMERGENCY":
            return

        moving = self.sm.state in ("MOVING_UP", "MOVING_DOWN")
        if "emergencyStop" in faults:
            return self.enter_emergency("Emergency stop button pressed")
        if "powerLoss" in faults:
            return self.enter_emergency("Mains power lost, brake drops (fail-safe)")
        if moving and "motorUnavailable" in faults:
            return self.enter_emergency("Drive fault during travel")
        if moving and "positionSensorFault" in faults:
            return self.enter_emergency("Position sensors disagree")
        if moving and self.safety.check_overspeed(self.motion.velocity, self.config.rated_speed):
            return self.enter_emergency("Overspeed governor tripped")

    def enter_emergency(self, reason):
        was_moving = self.motion.velocity != 0
        self.motion.apply_brake()
        self.motion.halt()
        self.trace.emit('safety.trip', event="SAFETY_CHAIN_OPENED",
                        message=f"{reason}. Motor power cut, brake applied.")
        self.target_floor = None
        self.recovery = False
        self.emergency = {"reason": reason, "phase": "BRAKING" if was_moving else "HALTED"}
        self.halted_at = self.time
        self.sm.transition("EMERGENCY", reason)

    def update_emergency(self, dt):
        em = self.emergency
        if em is None:
            return
        phase = em["phase"]

        if phase == "BRAKING":
            if not self.motion.update_braking(dt):
                return
            em["phase"] = "HALTED"
            self.halted_at = self.time
            self.trace.emit('emergency.halted', event="CAR_HALTED",
                            message=f"Car stopped at {self.motion.position:.2f} m")

        elif phase == "HALTED":
            # Power cut: after 2 s a battery brings the car to the nearest floor.
            if self.safety.has("powerLoss") and self.time - self.halted_at >= 2:
                self.start_battery_rescue()

        elif phase == "RESCUE_MOVING":
            if self.motion.update(dt) != "ARRIVED":
                return
            self.motion.apply_brake()
            self.current_floor = self.nearest_floor()
            em["phase"] = "SECURED"
            self.trace.emit('rescue.arrived', event="RESCUE_COMPLETE",
                            message=f"Rescue reached floor {self.current_floor}, opening doors")
            self.open_doors("Battery rescue: let passengers out")

    def start_battery_rescue(self):
        nearest = self.nearest_floor()
        if self.is_level_at(nearest):
            self.emergency["phase"] = "SECURED"
            self.trace.emit('rescue.level', event="RESCUE_AT_FLOOR",
                            message=f"Car already at floor {nearest}; battery opens the doors")
            if self.doors.position < 1:
                self.open_doors("Battery rescue at floor level")
            return
        self.emergency["phase"] = "RESCUE_MOVING"
        self.trace.emit('rescue.start', event="BATTERY_RESCUE_START",
                        message=f"Battery moves the car to floor {nearest}")
        self.motion.start(self.floor_position(nearest), self.config.rescue_speed)
        self.motion.release_brake()

    # ------------------------------------------------------------------
    # One simulation step
    # ------------------------------------------------------------------

    def tick(self, dt):
        # Move the whole system forward by dt seconds.
        self.time += dt
        self.update_position_sensors()
        self.monitor_safety()

        state = self.sm.state
        if state == "IDLE":
            if self.needs_dispatch and self.has_requests():
                self.dispatch()
        elif state in ("MOVING_UP", "MOVING_DOWN"):
            self.update_motion(dt)
        elif state == "DOOR_OPENING":
            if self.doors.update(dt) == "OPENED":
                self.on_doors_opened()
        elif state == "DOOR_OPEN":
            self.update_dwell(dt)
        elif state == "DOOR_CLOSING":
            self.update_closing(dt)
        elif state == "EMERGENCY":
            self.update_emergency(dt)

        self.traffic.update(self.time, self)

    def update_motion(self, dt):
        before = self.motion.phase
        result = self.motion.update(dt)
        after = self.motion.phase
        if after == "DECELERATING" and before not in ("DECELERATING", "LEVELING"):
            # Distance left == braking distance v^2 / 2a: start slowing down.
            self.trace.emit('motion.decel', event="DECELERATION_START",
                            message=f"Slowing down for floor {self.target_floor}")
        elif after == "CRUISING" and before == "ACCELERATING":
            self.trace.emit('motion.cruise', event="RATED_SPEED_REACHED",
                            message=f"Cruising at {abs(self.motion.velocity):.2f} m/s")
        if result == "ARRIVED":
            self.on_arrival()

    def update_position_sensors(self):
        # Floor vanes on the rail tell the controller where the car is.
        if self.safety.has("positionSensorFault"):
            self.floor_sensor = None
            return
        nearest = self.nearest_floor()
        in_zone = abs(self.motion.position - self.floor_position(nearest)) < SENSOR_ZONE
        sensor = nearest if in_zone else None
        if sensor is not None and sensor != self.floor_sensor and self.motion.velocity != 0:
            self.trace.emit('sensor.vane', event="FLOOR_VANE_DETECTED",
                            message=f"Sensor sees the floor {sensor} vane")
        self.floor_sensor = sensor

        moving = self.sm.state in ("MOVING_UP", "MOVING_DOWN")
        if moving and nearest != self.current_floor:
            self.current_floor = nearest
            self.trace.emit('sensor.floor', event="FLOOR_INDICATOR_UPDATED",
                            message=f"Car passing floor {nearest}")

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def floor_position(self, floor):
        return (floor - 1) * self.config.floor_height

    def nearest_floor(self):
        f = round(self.motion.position / self.config.floor_height) + 1
        return min(self.config.floors, max(1, f))

    def is_level_at(self, floor):
        return abs(self.motion.position - self.floor_position(floor)) < LEVEL_TOLERANCE

    def has_requests(self):
        return len(self.car_calls) > 0 or len(self.hall_calls) > 0

    def scheduling_context(self):
        return SchedulingContext(
            algorithm=self.config.algorithm,
            floors=self.config.floors,
            position=self.motion.position / self.config.floor_height + 1,
            direction=self.direction,
            car_calls=self.car_calls,
            hall_calls=self.hall_calls,
        )
