# Vertical motion of the car: a trapezoid speed profile.
#
#   speed
#     |      +----------+   <- cruise at rated speed
#     |     /            \
#     |    /              \  <- slow down so that v^2 = 2 * a * d
#     +---/----------------\----> time
#      speed up          level

import math

LEVEL_ZONE = 0.03  # metres


class MovementEngine:
    def __init__(self, config):
        self.config = config
        self.position = 0.0      # metres above floor 1
        self.velocity = 0.0      # m/s, positive = up
        self.acceleration = 0.0  # m/s^2
        self.phase = "STOPPED"
        self.brake_engaged = True
        self.motor_energized = False
        self.target = None
        self.speed_limit = config.rated_speed

    def stopping_distance(self):
        # Distance needed to stop from the current speed.
        return self.velocity ** 2 / (2 * self.config.acceleration)

    def can_stop_at(self, pos):
        direction = math.copysign(1, self.velocity) if self.velocity else 0
        remaining = (pos - self.position) * direction
        return direction != 0 and remaining >= self.stopping_distance() + 0.05

    def release_brake(self):
        self.brake_engaged = False

    def apply_brake(self):
        self.brake_engaged = True
        self.motor_energized = False

    def start(self, target_pos, speed_limit):
        self.target = target_pos
        self.speed_limit = speed_limit
        self.motor_energized = True

    def update(self, dt):
        # Move the car forward by one small time step.
        if self.target is None or not self.motor_energized or self.brake_engaged:
            return "STOPPED"

        a = self.config.acceleration
        delta = self.target - self.position
        direction = 1 if delta > 0 else -1
        remaining = abs(delta)
        speed = abs(self.velocity)

        # Arrived: within 2 mm of the floor.
        if remaining < 0.002:
            self.position = self.target
            self.velocity = 0.0
            self.phase = "STOPPED"
            self.target = None
            return "ARRIVED"

        # The fastest speed from which we can still stop in time.
        braking_curve = math.sqrt(2 * a * max(0.0, remaining - LEVEL_ZONE))
        desired = max(self.config.leveling_speed, min(self.speed_limit, braking_curve))

        if speed < desired:
            new_speed = min(desired, speed + a * dt)
            self.phase = "ACCELERATING"
        elif speed > desired:
            new_speed = max(desired, speed - a * dt)
            self.phase = "DECELERATING"
        else:
            new_speed = desired
            self.phase = "CRUISING"

        self.acceleration = (new_speed - speed) / dt * direction
        self.velocity = new_speed * direction
        self.position += min(new_speed * dt, remaining) * direction
        return "MOVING"

    def update_braking(self, dt):
        # Emergency: motor off, brake on. Returns True once the car stands still.
        speed = abs(self.velocity)
        if speed == 0:
            self.phase = "STOPPED"
            return True
        direction = 1 if self.velocity > 0 else -1
        new_speed = max(0.0, speed - self.config.brake_deceleration * dt)
        self.position += (speed + new_speed) / 2 * dt * direction
        self.velocity = new_speed * direction
        self.phase = "BRAKING"
        return new_speed == 0

    def halt(self):
        self.target = None
        self.motor_energized = False
