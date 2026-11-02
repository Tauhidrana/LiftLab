import { DoorController } from './DoorController'
import { ElevatorStateMachine } from './ElevatorStateMachine'
import { MovementEngine } from './MovementEngine'
import { RequestScheduler, type SchedulingContext } from './RequestScheduler'
import { FAULT_LABELS, SafetySystem } from './SafetySystem'
import { Tracer } from './Tracer'
import { TrafficSimulator, type TrafficHooks } from './TrafficSimulator'
import type {
  Algorithm,
  CarCall,
  Direction,
  EmergencyPhase,
  FaultId,
  HallCall,
  HallDirection,
  OperationMode,
  SimConfig,
  Snapshot,
} from './types'

export interface GroupLink {
  traffic: TrafficSimulator
  callElevator(floor: number, direction: HallDirection): void
  hasHallCall(floor: number, direction: HallDirection): boolean
}

const G = 9.81
const LEVEL_TOLERANCE = 0.005 // m — "level with the floor"
const SENSOR_ZONE = 0.03 // m — floor vane detection zone

/**
 * The main elevator control unit.
 *
 * It receives button presses, keeps the request queue, asks the scheduler
 * where to go, commands the motor, brake and doors, and watches the sensors.
 * The 3D view and every panel only *read* this object.
 */
export class ElevatorController {
  readonly config: SimConfig
  readonly trace: Tracer
  readonly sm: ElevatorStateMachine
  readonly scheduler = new RequestScheduler()
  readonly motion: MovementEngine
  readonly doors: DoorController
  readonly safety = new SafetySystem()
  readonly traffic: TrafficSimulator

  time = 0
  currentFloor = 1
  targetFloor: number | null = null
  direction: Direction = 'NONE'
  carCalls: CarCall[] = []
  hallCalls: HallCall[] = []
  emergency: { reason: string; phase: EmergencyPhase } | null = null
  floorSensor: number | null = 1
  powerW = 0
  metrics = { distance: 0, trips: 0, energyUsedJ: 0, energyRegenJ: 0, floorCalls: [] as number[] }

  private dwell = 0
  private needsDispatch = false
  private recovery = false
  private haltedAt = 0
  private closeRefusedNotified = false
  private readonly hooks: TrafficHooks

  /** Car number inside a group (0 for a single-car simulation). */
  readonly carId: number
  /** When part of a group, passengers and hall calls are handled by the GroupController. */
  private readonly group: GroupLink | null

  constructor(config: SimConfig, opts: { trace?: boolean; carId?: number; group?: GroupLink } = {}) {
    this.carId = opts.carId ?? 0
    this.group = opts.group ?? null
    this.config = { ...config }
    this.trace = new Tracer(() => this.time, () => this.traceContext())
    this.trace.enabled = opts.trace ?? true
    this.sm = new ElevatorStateMachine(this.trace, () => this.time)
    this.motion = new MovementEngine(this.config)
    this.doors = new DoorController(this.config)
    this.traffic = opts.group?.traffic ?? new TrafficSimulator(this.config)
    if (!this.group) this.traffic.enabled = this.config.mode === 'automatic'
    this.metrics.floorCalls = new Array(this.config.floors).fill(0)
    this.hooks = {
      callElevator: (floor, dir) => {
        if (this.group) return this.group.callElevator(floor, dir)
        this.trace.beginChain(`Passenger at floor ${floor}`)
        this.callElevator(floor, dir)
      },
      requestFloor: (floor) => this.requestFloor(floor),
      hasHallCall: (floor, dir) =>
        this.group ? this.group.hasHallCall(floor, dir) : this.hallCalls.some((h) => h.floor === floor && h.direction === dir),
    }
  }

  /* ================================================================ */
  /* Inputs: buttons and switches                                      */
  /* ================================================================ */

  /** A floor button on the car's control panel. */
  pressCarButton(floor: number) {
    this.trace.beginChain(`Car button ${floor}`)
    this.trace.emit('input.carButton', 'ElevatorController.pressCarButton', {
      event: 'FLOOR_BUTTON_PRESSED',
      category: 'input',
      message: `Car panel button ${floor} pressed`,
      explain: 'A passenger inside the car pressed a destination button. The button sends a signal to the controller.',
      inputs: { destinationFloor: floor },
    })
    this.requestFloor(floor)
  }

  /** An UP / DOWN button on a landing. */
  pressHallButton(floor: number, direction: HallDirection) {
    this.trace.beginChain(`Hall call ${floor}${direction === 'UP' ? '▲' : '▼'}`)
    this.trace.emit('input.hallButton', 'ElevatorController.pressHallButton', {
      event: 'HALL_CALL_PRESSED',
      category: 'input',
      message: `Landing button at floor ${floor} pressed (${direction})`,
      explain: 'Someone waiting on a floor called the elevator and told it which way they want to go.',
      inputs: { floor, direction },
    })
    this.callElevator(floor, direction)
  }

  pressDoorOpen() {
    this.trace.beginChain('Door-open button')
    const state = this.sm.state
    this.trace.emit('input.doorOpen', 'ElevatorController.pressDoorOpen', {
      event: 'DOOR_OPEN_BUTTON_PRESSED',
      category: 'input',
      message: `Door-open button pressed in state ${state}`,
    })
    if (state === 'DOOR_CLOSING') return this.openDoors('Door-open button pressed while closing')
    if (state === 'DOOR_OPEN') {
      this.dwell = this.config.doorDwellTime
      return this.trace.emit('door.holdOpen', 'ElevatorController.pressDoorOpen', {
        event: 'DOOR_HOLD',
        category: 'door',
        message: `Dwell timer restarted (${this.config.doorDwellTime}s)`,
      })
    }
    if (state === 'IDLE' && this.isLevelAt(this.currentFloor)) return this.openDoors('Door-open button pressed at rest')
    this.trace.emit('door.openRefused', 'ElevatorController.pressDoorOpen', {
      event: 'COMMAND_IGNORED',
      category: 'safety',
      level: 'warn',
      message: 'Doors cannot open: car is not level with a floor (door interlock)',
      explain: 'Doors only open when the car is level with a landing. Opening between floors would expose the shaft.',
    })
  }

  pressDoorClose() {
    this.trace.beginChain('Door-close button')
    this.trace.emit('input.doorClose', 'ElevatorController.pressDoorClose', {
      event: 'DOOR_CLOSE_BUTTON_PRESSED',
      category: 'input',
      message: `Door-close button pressed in state ${this.sm.state}`,
    })
    if (this.sm.state === 'DOOR_OPEN') this.closeDoors('Door-close button pressed')
  }

  /** The red button: latches until released and the system is reset. */
  pressEmergencyStop() {
    if (this.safety.has('emergencyStop')) this.clearFault('emergencyStop')
    else this.injectFault('emergencyStop')
  }

  injectFault(fault: FaultId) {
    if (this.safety.has(fault)) return
    this.trace.beginChain(`Fault: ${FAULT_LABELS[fault]}`)
    this.safety.faults.add(fault)
    this.trace.emit('fault.inject', 'ElevatorController.injectFault', {
      event: 'FAULT_INJECTED',
      category: 'safety',
      level: 'danger',
      message: FAULT_LABELS[fault],
      inputs: { fault },
    })
    this.monitorSafety()
  }

  clearFault(fault: FaultId) {
    if (!this.safety.has(fault)) return
    this.trace.beginChain(`Clear: ${FAULT_LABELS[fault]}`)
    this.safety.faults.delete(fault)
    this.closeRefusedNotified = false
    this.trace.emit('fault.clear', 'ElevatorController.clearFault', {
      event: 'FAULT_CLEARED',
      category: 'safety',
      message: `${FAULT_LABELS[fault]} cleared${this.sm.state === 'EMERGENCY' ? ' — press RESET to return to service' : ''}`,
      inputs: { fault },
    })
    this.monitorSafety()
    if (this.sm.state === 'IDLE') this.needsDispatch = true
  }

  /** Return to service after an emergency. Only allowed once every fault is cleared. */
  resetSystem() {
    this.trace.beginChain('Reset')
    const blocking = [...this.safety.faults].filter((f) => f !== 'doorObstruction' && f !== 'doorSensorFailure')
    this.trace.emit('reset.request', 'ElevatorController.resetSystem', {
      event: 'RESET_REQUESTED',
      category: 'input',
      message: `Reset requested in state ${this.sm.state}`,
      inputs: { activeFaults: blocking.join(', ') || 'none' },
    })
    if (this.sm.state !== 'EMERGENCY') return
    if (blocking.length > 0 || this.motion.velocity !== 0) {
      return this.trace.emit('reset.refused', 'ElevatorController.resetSystem', {
        event: 'RESET_REFUSED',
        category: 'safety',
        level: 'warn',
        message: `Cannot reset while faults are active: ${blocking.map((f) => FAULT_LABELS[f]).join(', ')}`,
        explain: 'A safe controller never returns to service while the cause of the stop is still present.',
      })
    }
    this.emergency = null
    this.safety.governorTripped = false
    const nearest = this.nearestFloor()
    if (this.isLevelAt(nearest)) {
      this.currentFloor = nearest
      if (this.doors.position > 0) return this.openDoors('Reset at floor level: doors reopen fully')
      this.sm.transition('IDLE', 'Reset complete, car in service')
      this.needsDispatch = true
      return
    }
    this.recovery = true
    this.trace.emit('reset.recovery', 'ElevatorController.resetSystem', {
      event: 'RECOVERY_RUN',
      category: 'controller',
      message: `Car is between floors: recovery run to floor ${nearest} at ${this.config.rescueSpeed} m/s`,
      explain: 'After a stop between floors, the controller creeps to the nearest landing at low speed before resuming normal service.',
    })
    this.startTrip(nearest, 'Recovery run after reset', this.config.rescueSpeed)
  }

  setMode(mode: OperationMode) {
    this.trace.beginChain(`Mode: ${mode}`)
    const from = this.config.mode
    this.config.mode = mode
    this.traffic.enabled = mode === 'automatic'
    if (this.sm.state === 'DOOR_OPEN') this.dwell = this.config.doorDwellTime
    this.trace.emit('config.mode', 'ElevatorController.setMode', {
      event: 'MODE_CHANGED',
      category: 'controller',
      message: `Operation mode ${from} → ${mode}`,
      change: { field: 'mode', from, to: mode },
    })
  }

  setAlgorithm(algorithm: Algorithm) {
    this.trace.beginChain(`Algorithm: ${algorithm}`)
    const from = this.config.algorithm
    this.config.algorithm = algorithm
    this.trace.emit('config.algorithm', 'ElevatorController.setAlgorithm', {
      event: 'ALGORITHM_CHANGED',
      category: 'scheduler',
      message: `Scheduling algorithm ${from} → ${algorithm}`,
      change: { field: 'algorithm', from, to: algorithm },
    })
  }

  /* ================================================================ */
  /* Request queue                                                     */
  /* ================================================================ */

  requestFloor(floor: number) {
    if (this.carCalls.some((c) => c.floor === floor)) {
      return this.trace.emit('queue.duplicate', 'ElevatorController.requestFloor', {
        event: 'REQUEST_ALREADY_QUEUED',
        category: 'queue',
        message: `Floor ${floor} is already in requestQueue`,
        inputs: { floor },
      })
    }
    if (floor === this.currentFloor && this.isLevelAt(floor) && this.holdDoorsAtFloor()) return

    const before = this.queueLabels()
    this.carCalls.push({ floor, time: this.time })
    this.metrics.floorCalls[floor - 1]++
    this.trace.emit('queue.addCar', 'ElevatorController.requestFloor', {
      event: 'REQUEST_QUEUED',
      category: 'queue',
      message: `Adding floor ${floor} to requestQueue`,
      explain: 'The request is stored in a queue so it is not forgotten while the car is busy.',
      inputs: { floor },
      change: { field: 'requestQueue', from: fmtQueue(before), to: fmtQueue(this.queueLabels()) },
    })
    this.updateController()
  }

  callElevator(floor: number, direction: HallDirection) {
    if (this.hallCalls.some((h) => h.floor === floor && h.direction === direction)) {
      return this.trace.emit('queue.duplicateHall', 'ElevatorController.callElevator', {
        event: 'REQUEST_ALREADY_QUEUED',
        category: 'queue',
        message: `Hall call ${floor}${arrow(direction)} is already registered`,
      })
    }
    const goingThatWay = this.direction === direction || this.direction === 'NONE'
    if (floor === this.currentFloor && this.isLevelAt(floor) && goingThatWay && this.holdDoorsAtFloor()) return

    const before = this.queueLabels()
    this.hallCalls.push({ floor, direction, time: this.time })
    this.metrics.floorCalls[floor - 1]++
    this.trace.emit('queue.addHall', 'ElevatorController.callElevator', {
      event: 'REQUEST_QUEUED',
      category: 'queue',
      message: `Adding hall call ${floor}${arrow(direction)} to requestQueue`,
      inputs: { floor, direction },
      change: { field: 'requestQueue', from: fmtQueue(before), to: fmtQueue(this.queueLabels()) },
    })
    this.updateController()
  }

  /** Someone pressed the button of the floor the car is already open at. */
  private holdDoorsAtFloor(): boolean {
    const s = this.sm.state
    if (s === 'DOOR_OPEN') {
      this.dwell = this.config.doorDwellTime
    } else if (s === 'DOOR_CLOSING') {
      this.openDoors('Request for the current floor while doors were closing')
    } else if (s !== 'DOOR_OPENING') {
      return false
    }
    this.trace.emit('queue.atFloor', 'ElevatorController.holdDoorsAtFloor', {
      event: 'REQUEST_AT_CURRENT_FLOOR',
      category: 'queue',
      message: `Car is already at floor ${this.currentFloor} — holding doors open`,
    })
    return true
  }

  /* ================================================================ */
  /* Controller logic                                                  */
  /* ================================================================ */

  private updateController() {
    switch (this.sm.state) {
      case 'IDLE':
        return this.dispatch()
      case 'MOVING_UP':
      case 'MOVING_DOWN':
        return this.reevaluateTarget()
      case 'EMERGENCY':
        return this.trace.emit('controller.held', 'ElevatorController.updateController', {
          event: 'REQUEST_HELD',
          category: 'controller',
          level: 'warn',
          message: 'Request stored, but the car is in EMERGENCY and will not move until reset',
        })
      default:
        return this.trace.emit('controller.deferred', 'ElevatorController.updateController', {
          event: 'REQUEST_DEFERRED',
          category: 'controller',
          message: `Doors busy (${this.sm.state}); request will be scheduled once the doors lock`,
        })
    }
  }

  /** Pick the next destination and start moving, if it is safe. */
  private dispatch() {
    this.needsDispatch = false
    const decision = this.scheduler.selectNext(this.schedulingContext())
    if (this.scheduler.customError) {
      this.trace.emit('scheduler.customError', 'RequestScheduler.runCustom', {
        event: 'CUSTOM_SCHEDULER_ERROR',
        category: 'scheduler',
        level: 'danger',
        message: this.scheduler.customError,
      })
      this.scheduler.customError = null
    }
    if (!decision) {
      this.direction = 'NONE'
      this.targetFloor = null
      if (this.sm.state !== 'IDLE') this.sm.transition('IDLE', 'Request queue empty')
      return
    }
    this.trace.emit('scheduler.decision', 'RequestScheduler.selectNext', {
      event: 'NEXT_DESTINATION_SELECTED',
      category: 'scheduler',
      message: decision.reason,
      explain: `The ${this.config.algorithm} algorithm compared every pending request and chose floor ${decision.floor}.`,
      inputs: {
        algorithm: this.config.algorithm,
        currentFloor: this.currentFloor,
        direction: this.direction,
        candidates: decision.candidates.map((c) => `${c.floor}(${c.kind}, ${c.distance.toFixed(1)})`).join(' '),
      },
    })

    if (decision.floor === this.currentFloor && this.isLevelAt(decision.floor)) {
      this.serveFloor(decision.floor)
      return this.openDoors(`Request at the current floor ${decision.floor}`)
    }

    const check = this.safety.canMove(this.safetyInputs())
    if (!check.ok) {
      this.trace.emit('safety.blocked', 'SafetySystem.canMove', {
        event: 'DISPATCH_BLOCKED',
        category: 'safety',
        level: 'warn',
        message: `Safety chain open: ${check.open.map((l) => l.label).join(', ')}. Request kept in queue.`,
        explain: 'The motor can only start when every switch in the safety chain is closed.',
      })
      this.targetFloor = null
      if (this.sm.state !== 'IDLE') this.sm.transition('IDLE', 'Dispatch blocked by safety chain')
      return
    }
    this.startTrip(decision.floor, decision.reason)
  }

  private startTrip(floor: number, reason: string, speed = this.config.ratedSpeed) {
    const dir: Direction = this.floorPosition(floor) > this.motion.position ? 'UP' : 'DOWN'
    const prevTarget = this.targetFloor
    this.targetFloor = floor
    this.direction = dir
    this.trace.emit('controller.destination', 'ElevatorController.startTrip', {
      event: 'DESTINATION_SET',
      category: 'controller',
      message: `Current floor ${this.currentFloor} → destination ${floor}, direction ${dir}`,
      inputs: { currentFloor: this.currentFloor, destination: floor, direction: dir },
      change: { field: 'targetFloor', from: String(prevTarget ?? '—'), to: String(floor) },
    })

    // 1. Energise the motor first so it holds the load (pre-torque)…
    this.motion.start(this.floorPosition(floor), speed)
    this.trace.emit('motor.start', 'MovementEngine.start', {
      event: 'MOTOR_ACTIVATED',
      category: 'motor',
      message: `Drive energises the traction motor (pre-torque), limit ${speed} m/s`,
      explain: 'The motor builds up torque before the brake lifts, so the car does not jerk or drop.',
    })
    // 2. …then lift the brake.
    this.motion.releaseBrake()
    this.trace.emit('brake.release', 'MovementEngine.releaseBrake', {
      event: 'BRAKE_RELEASED',
      category: 'brake',
      message: 'Brake coil energised: brake shoes lift off the drum',
      change: { field: 'brake', from: 'ENGAGED', to: 'RELEASED' },
    })
    this.metrics.trips++
    this.sm.transition(dir === 'UP' ? 'MOVING_UP' : 'MOVING_DOWN', reason)
  }

  /** A new request arrived while moving: can we stop for it on the way? */
  private reevaluateTarget() {
    if (this.recovery || this.targetFloor === null) return
    const decision = this.scheduler.selectNext(this.schedulingContext())
    if (!decision || decision.floor === this.targetFloor) {
      return this.trace.emit('controller.keepTarget', 'ElevatorController.reevaluateTarget', {
        event: 'TARGET_UNCHANGED',
        category: 'controller',
        message: `Continuing to floor ${this.targetFloor}; new request will be served later`,
      })
    }
    const newPos = this.floorPosition(decision.floor)
    const oldPos = this.floorPosition(this.targetFloor)
    const onTheWay = this.direction === 'UP' ? newPos < oldPos : newPos > oldPos
    if (!onTheWay) return
    if (!this.motion.canStopAt(newPos)) {
      return this.trace.emit('controller.tooLate', 'MovementEngine.canStopAt', {
        event: 'STOP_NOT_POSSIBLE',
        category: 'controller',
        message: `Too close to stop at floor ${decision.floor} (needs ${this.motion.stoppingDistance().toFixed(2)} m) — will return later`,
        explain: 'The car cannot brake harder than its comfortable deceleration, so it passes this floor.',
      })
    }
    this.trace.emit('controller.retarget', 'ElevatorController.reevaluateTarget', {
      event: 'TARGET_UPDATED',
      category: 'controller',
      message: `Intermediate stop: floor ${decision.floor} is on the way to ${this.targetFloor}`,
      change: { field: 'targetFloor', from: String(this.targetFloor), to: String(decision.floor) },
    })
    this.targetFloor = decision.floor
    this.motion.retarget(newPos)
  }

  private onArrival() {
    const floor = this.targetFloor ?? this.nearestFloor()
    this.trace.beginChain(`Arrival at floor ${floor}`)
    this.motion.applyBrake()
    this.trace.emit('brake.apply', 'MovementEngine.applyBrake', {
      event: 'BRAKE_APPLIED',
      category: 'brake',
      message: `Car level at floor ${floor}: motor de-energised, brake springs clamp the drum`,
      explain: 'Elevator brakes are held OPEN by electricity. Cutting power lets springs close them — so a power failure always brakes.',
      change: { field: 'brake', from: 'RELEASED', to: 'ENGAGED' },
    })
    this.currentFloor = floor
    this.targetFloor = null
    this.trace.emit('controller.arrived', 'ElevatorController.onArrival', {
      event: 'ARRIVED',
      category: 'controller',
      message: `Arrived at floor ${floor}`,
      inputs: { floor },
    })

    const requested =
      this.carCalls.some((c) => c.floor === floor) || this.hallCalls.some((h) => h.floor === floor)
    if (requested || this.recovery) {
      this.recovery = false
      this.serveFloor(floor)
      this.openDoors(`Arrived at requested floor ${floor}`)
    } else {
      // e.g. SCAN reached the end of the shaft with no request there.
      this.direction = this.scheduler.directionAfterStop(this.schedulingContext())
      this.sm.transition('IDLE', `Reached floor ${floor} with no request there`)
      this.needsDispatch = true
    }
  }

  /** Remove the requests that this stop satisfies. */
  private serveFloor(floor: number) {
    const before = this.queueLabels()
    this.carCalls = this.carCalls.filter((c) => c.floor !== floor)
    const nextDir = this.scheduler.directionAfterStop(this.schedulingContext())
    this.hallCalls = this.hallCalls.filter(
      (h) => h.floor !== floor || (nextDir !== 'NONE' && h.direction !== nextDir),
    )
    this.direction = nextDir
    this.trace.emit('queue.remove', 'ElevatorController.serveFloor', {
      event: 'REQUEST_SERVED',
      category: 'queue',
      message: `Floor ${floor} removed from requestQueue; continuing ${nextDir}`,
      change: { field: 'requestQueue', from: fmtQueue(before), to: fmtQueue(this.queueLabels()) },
    })
  }

  /* ================================================================ */
  /* Doors                                                             */
  /* ================================================================ */

  private openDoors(reason: string) {
    this.doors.startOpening()
    this.trace.emit('door.open', 'DoorController.startOpening', {
      event: 'DOOR_OPEN_START',
      category: 'door',
      message: 'Door motor drives the car doors open; the vane couples the landing doors',
      change: { field: 'doorStatus', from: 'CLOSED', to: 'OPENING' },
    })
    if (this.emergency) return // battery rescue: doors open but the car stays out of service
    this.sm.transition('DOOR_OPENING', reason)
  }

  private onDoorsOpened() {
    this.dwell = this.config.doorDwellTime
    this.trace.emit('door.opened', 'DoorController.update', {
      event: 'DOORS_OPENED',
      category: 'door',
      message:
        this.config.mode === 'manual'
          ? 'Doors fully open — manual mode: waiting for the door-close button'
          : `Doors fully open — dwell timer ${this.config.doorDwellTime}s started`,
    })
    this.sm.transition('DOOR_OPEN', 'Doors fully open')
    const { out, inn } = this.traffic.exchange(this.time, this.currentFloor, this.direction, this.hooks, this.carId)
    if (out + inn > 0) {
      this.trace.emit('traffic.exchange', 'TrafficSimulator.exchange', {
        event: 'PASSENGER_EXCHANGE',
        category: 'traffic',
        message: `${out} passenger(s) left, ${inn} boarded at floor ${this.currentFloor}`,
      })
    }
  }

  private updateDwell(dt: number) {
    if (this.config.mode === 'manual') return // manual mode: only the close button closes the doors
    if (this.doors.lightCurtain.blocked) {
      this.dwell = this.config.doorDwellTime // someone is in the doorway: keep waiting
      return
    }
    this.dwell -= dt
    if (this.dwell <= 0) {
      this.trace.beginChain('Door timer')
      this.closeDoors('Dwell time elapsed')
    }
  }

  private closeDoors(reason: string) {
    const check = this.safety.canCloseDoors(this.doors.lightCurtain)
    if (!check.ok) {
      this.dwell = this.config.doorDwellTime
      if (this.closeRefusedNotified) return
      this.closeRefusedNotified = true
      return this.trace.emit('door.closeRefused', 'SafetySystem.canCloseDoors', {
        event: 'DOOR_CLOSE_REFUSED',
        category: 'safety',
        level: 'warn',
        message: `${check.reason}. Doors stay open.`,
        explain: 'If the controller cannot prove the doorway is clear, the safe choice is to keep the doors open.',
      })
    }
    this.closeRefusedNotified = false
    this.doors.startClosing()
    this.trace.emit('door.close', 'DoorController.startClosing', {
      event: 'DOOR_CLOSE_START',
      category: 'door',
      message: 'Light curtain clear: door motor drives the doors closed',
      change: { field: 'doorStatus', from: 'OPEN', to: 'CLOSING' },
    })
    this.sm.transition('DOOR_CLOSING', reason)
  }

  private updateClosing(dt: number) {
    const check = this.safety.canCloseDoors(this.doors.lightCurtain)
    if (!check.ok) {
      this.trace.beginChain('Door reversal')
      this.trace.emit('door.reverse', 'ElevatorController.updateClosing', {
        event: 'OBSTRUCTION_DETECTED',
        category: 'sensor',
        level: 'warn',
        message: `${check.reason} — reversing doors`,
        explain: 'Infrared beams cross the doorway. If one is broken while closing, the doors immediately reopen.',
      })
      return this.openDoors('Door reversal (obstruction)')
    }
    if (this.doors.update(dt) !== 'CLOSED') return
    this.trace.beginChain('Doors locked')
    this.trace.emit('door.locked', 'DoorController.update', {
      event: 'DOORS_CLOSED_AND_LOCKED',
      category: 'door',
      message: 'Doors closed; door lock contact made (safety chain link closed)',
      change: { field: 'doorLocked', from: 'false', to: 'true' },
    })
    this.dispatch()
  }

  /* ================================================================ */
  /* Safety                                                            */
  /* ================================================================ */

  /** Runs every tick: compares sensors and faults against what is safe. */
  private monitorSafety() {
    const faults = this.safety.faults
    this.doors.lightCurtain.healthy = !faults.has('doorSensorFailure')
    this.doors.lightCurtain.blocked = faults.has('doorObstruction') && this.doors.position > 0.02
    if (this.sm.state === 'EMERGENCY') return

    const moving = this.sm.state === 'MOVING_UP' || this.sm.state === 'MOVING_DOWN'
    if (faults.has('emergencyStop')) return this.enterEmergency('Emergency stop button pressed')
    if (faults.has('powerLoss')) return this.enterEmergency('Mains power lost — brake drops (fail-safe)')
    if (moving && faults.has('motorUnavailable')) return this.enterEmergency('Drive fault during travel')
    if (moving && faults.has('positionSensorFault'))
      return this.enterEmergency('Position feedback implausible: encoder and floor sensors disagree')
    if (moving && this.safety.checkOverspeed(this.motion.velocity, this.config.ratedSpeed))
      return this.enterEmergency('Overspeed governor tripped')
  }

  private enterEmergency(reason: string) {
    const wasMoving = this.motion.velocity !== 0
    this.motion.applyBrake()
    this.motion.halt()
    this.trace.emit('safety.trip', 'ElevatorController.enterEmergency', {
      event: 'SAFETY_CHAIN_OPENED',
      category: 'safety',
      level: 'danger',
      message: `${reason}. Motor power cut, brake applied.`,
      explain: 'Any safety fault cuts power to the motor and the brake coil. Springs then close the brake.',
      change: { field: 'brake', from: wasMoving ? 'RELEASED' : 'ENGAGED', to: 'ENGAGED' },
    })
    if (this.doors.motorActive) {
      this.doors.motorActive = false
      this.doors.status = this.doors.position > 0 ? 'OPEN' : 'CLOSED'
    }
    this.targetFloor = null
    this.recovery = false
    this.emergency = { reason, phase: wasMoving ? 'BRAKING' : 'HALTED' }
    this.haltedAt = this.time
    this.sm.transition('EMERGENCY', reason)
  }

  private updateEmergency(dt: number) {
    const em = this.emergency
    if (!em) return
    if (this.doors.motorActive) this.doors.update(dt)

    switch (em.phase) {
      case 'BRAKING':
        if (!this.motion.updateBraking(dt)) return
        em.phase = 'HALTED'
        this.haltedAt = this.time
        this.trace.emit('emergency.halted', 'ElevatorController.updateEmergency', {
          event: 'CAR_HALTED',
          category: 'safety',
          level: 'warn',
          message: `Car stopped at ${this.motion.position.toFixed(2)} m${this.isLevelAt(this.nearestFloor()) ? '' : ' (between floors)'}`,
        })
        return
      case 'HALTED':
        // Power loss: after 2 s the battery rescue device brings the car to the nearest floor.
        if (!this.safety.has('powerLoss') || this.time - this.haltedAt < 2) return
        return this.startBatteryRescue()
      case 'RESCUE_MOVING':
        if (this.motion.update(dt) !== 'ARRIVED') return
        this.motion.applyBrake()
        this.currentFloor = this.nearestFloor()
        em.phase = 'SECURED'
        this.trace.emit('rescue.arrived', 'ElevatorController.updateEmergency', {
          event: 'RESCUE_COMPLETE',
          category: 'safety',
          message: `Rescue run reached floor ${this.currentFloor}; brake applied, opening doors`,
        })
        this.openDoors('Battery rescue: let passengers out')
        return
      case 'SECURED':
        return
    }
  }

  private startBatteryRescue() {
    const em = this.emergency!
    const nearest = this.nearestFloor()
    if (this.isLevelAt(nearest)) {
      em.phase = 'SECURED'
      this.trace.emit('rescue.level', 'ElevatorController.startBatteryRescue', {
        event: 'RESCUE_AT_FLOOR',
        category: 'safety',
        message: `Car already level at floor ${nearest}; battery opens the doors`,
      })
      if (this.doors.position < 1) this.openDoors('Battery rescue at floor level')
      return
    }
    em.phase = 'RESCUE_MOVING'
    this.trace.emit('rescue.start', 'ElevatorController.startBatteryRescue', {
      event: 'BATTERY_RESCUE_START',
      category: 'safety',
      message: `Automatic rescue device: battery moves car to floor ${nearest} at ${this.config.rescueSpeed} m/s`,
      explain: 'Many modern lifts carry a battery that, after a power cut, slowly drives the car to the nearest floor so nobody is trapped.',
    })
    this.motion.start(this.floorPosition(nearest), this.config.rescueSpeed)
    this.motion.releaseBrake()
  }

  /* ================================================================ */
  /* Simulation step                                                   */
  /* ================================================================ */

  /** Advance the whole system by one fixed time step `dt` (seconds). */
  tick(dt: number) {
    this.time += dt
    this.updatePositionSensors()
    this.monitorSafety()

    switch (this.sm.state) {
      case 'IDLE':
        if (this.needsDispatch && this.hasRequests()) this.dispatch()
        break
      case 'MOVING_UP':
      case 'MOVING_DOWN':
        this.updateMotion(dt)
        break
      case 'DOOR_OPENING':
        if (this.doors.update(dt) === 'OPENED') this.onDoorsOpened()
        break
      case 'DOOR_OPEN':
        this.updateDwell(dt)
        break
      case 'DOOR_CLOSING':
        this.updateClosing(dt)
        break
      case 'EMERGENCY':
        this.updateEmergency(dt)
        break
    }

    this.updateEnergy(dt)
    if (!this.group) this.traffic.update(this.time, this.hooks, this.doorsBusyAt())
  }

  private updateMotion(dt: number) {
    const before = this.motion.phase
    const result = this.motion.update(dt)
    const after = this.motion.phase
    if (after === 'DECELERATING' && before !== 'DECELERATING' && before !== 'LEVELING') {
      this.trace.beginChain(`Approach floor ${this.targetFloor}`)
      this.trace.emit('motion.decel', 'MovementEngine.update', {
        event: 'DECELERATION_START',
        category: 'motion',
        message: `Remaining distance equals braking distance v²/2a: slowing for floor ${this.targetFloor}`,
        inputs: { velocity: `${Math.abs(this.motion.velocity).toFixed(2)} m/s` },
      })
    } else if (after === 'CRUISING' && before === 'ACCELERATING') {
      this.trace.emit('motion.cruise', 'MovementEngine.update', {
        event: 'RATED_SPEED_REACHED',
        category: 'motion',
        level: 'verbose',
        message: `Cruising at ${Math.abs(this.motion.velocity).toFixed(2)} m/s`,
      })
    }
    if (result === 'ARRIVED') this.onArrival()
  }

  /** Floor vanes on the rail + an encoder on the motor tell the controller where the car is. */
  private updatePositionSensors() {
    if (this.safety.has('positionSensorFault')) {
      this.floorSensor = null
      return
    }
    const nearest = this.nearestFloor()
    const inZone = Math.abs(this.motion.position - this.floorPosition(nearest)) < SENSOR_ZONE
    const sensor = inZone ? nearest : null
    if (sensor !== this.floorSensor && sensor !== null && this.motion.velocity !== 0) {
      this.trace.emit('sensor.vane', 'ElevatorController.updatePositionSensors', {
        event: 'FLOOR_VANE_DETECTED',
        category: 'sensor',
        level: 'verbose',
        message: `Position sensor detects floor ${sensor} vane`,
      })
    }
    this.floorSensor = sensor
    const moving = this.sm.state === 'MOVING_UP' || this.sm.state === 'MOVING_DOWN'
    if (moving && nearest !== this.currentFloor) {
      const from = this.currentFloor
      this.currentFloor = nearest
      this.trace.emit('sensor.floor', 'ElevatorController.updatePositionSensors', {
        event: 'FLOOR_INDICATOR_UPDATED',
        category: 'sensor',
        message: `Car passing floor ${nearest}${nearest === this.targetFloor ? ' (destination)' : ''}`,
        change: { field: 'currentFloor', from: String(from), to: String(nearest) },
      })
    }
  }

  /** Motor power from a simple force balance on the traction sheave. */
  private updateEnergy(dt: number) {
    const { carMass, ratedLoad, counterweightRatio, driveEfficiency } = this.config
    const carSide = carMass + this.loadKg()
    const cwSide = carMass + ratedLoad * counterweightRatio
    const v = this.motion.velocity
    const a = this.motion.acceleration
    const friction = Math.sign(v) * 400 // N, rail and rope friction
    const force = (carSide - cwSide) * G + (carSide + cwSide) * a + friction
    const mechanical = this.motion.motorEnergized ? force * v : 0
    this.powerW = mechanical >= 0 ? mechanical / driveEfficiency : mechanical * driveEfficiency
    if (this.powerW > 0) this.metrics.energyUsedJ += this.powerW * dt
    else this.metrics.energyRegenJ += -this.powerW * dt
    this.metrics.distance += Math.abs(v) * dt
  }

  /* ================================================================ */
  /* Helpers                                                           */
  /* ================================================================ */

  /** Floors where this car's doors are in use (passengers there should not re-press the call button). */
  doorsBusyAt(): number[] {
    return this.sm.state.startsWith('DOOR_') ? [this.currentFloor] : []
  }
  floorPosition(floor: number) {
    return (floor - 1) * this.config.floorHeight
  }
  nearestFloor() {
    const f = Math.round(this.motion.position / this.config.floorHeight) + 1
    return Math.min(this.config.floors, Math.max(1, f))
  }
  isLevelAt(floor: number) {
    return Math.abs(this.motion.position - this.floorPosition(floor)) < LEVEL_TOLERANCE
  }
  hasRequests() {
    return this.carCalls.length > 0 || this.hallCalls.length > 0
  }
  loadKg() {
    return this.traffic.enabled ? this.traffic.riders(this.carId).length * this.config.passengerMass : this.config.manualLoadKg
  }
  private safetyInputs() {
    return { doorsLocked: this.doors.locked, speed: this.motion.velocity, ratedSpeed: this.config.ratedSpeed }
  }
  private schedulingContext(): SchedulingContext {
    return {
      algorithm: this.config.algorithm,
      floors: this.config.floors,
      position: this.motion.position / this.config.floorHeight + 1,
      direction: this.direction,
      carCalls: this.carCalls,
      hallCalls: this.hallCalls,
    }
  }
  queueLabels(): string[] {
    return [
      ...this.carCalls.map((c) => String(c.floor)),
      ...this.hallCalls.map((h) => `${h.floor}${arrow(h.direction)}`),
    ]
  }
  private traceContext() {
    return {
      floor: this.currentFloor,
      position: this.motion?.position ?? 0,
      state: this.sm?.state ?? 'IDLE',
      direction: this.direction,
      target: this.targetFloor,
      queue: this.queueLabels(),
      motor: this.motion?.motorEnergized ? 'ON' : 'OFF',
      brake: this.motion?.brakeEngaged ? 'ENGAGED' : 'RELEASED',
      door: this.doors?.status ?? 'CLOSED',
    }
  }

  getSnapshot(): Snapshot {
    const m = this.motion
    const stats = this.traffic.stats()
    return {
      time: this.time,
      state: this.sm.state,
      direction: this.direction,
      currentFloor: this.currentFloor,
      targetFloor: this.targetFloor,
      position: m.position,
      velocity: m.velocity,
      acceleration: m.acceleration,
      phase: m.phase,
      brakeEngaged: m.brakeEngaged,
      motorEnergized: m.motorEnergized,
      motorRpm: (m.velocity / (2 * Math.PI * this.config.sheaveRadius)) * 60,
      motorPowerKw: this.powerW / 1000,
      doorPosition: this.doors.position,
      doorStatus: this.doors.status,
      doorLocked: this.doors.locked,
      lightCurtainBlocked: this.doors.lightCurtain.blocked,
      lightCurtainHealthy: this.doors.lightCurtain.healthy,
      floorSensor: this.floorSensor,
      carCalls: [...this.carCalls],
      hallCalls: [...this.hallCalls],
      faults: [...this.safety.faults],
      emergency: this.emergency ? { ...this.emergency } : null,
      dwellRemaining: Math.max(0, this.dwell),
      loadKg: this.loadKg(),
      passengers: this.traffic.riders(this.carId).length,
      energyUsedKwh: this.metrics.energyUsedJ / 3.6e6,
      energyRegenKwh: this.metrics.energyRegenJ / 3.6e6,
      distanceTravelled: this.metrics.distance,
      trips: this.metrics.trips,
      servedPassengers: stats.served,
      avgWait: stats.avgWait,
      avgRide: stats.avgRide,
      waiting: this.traffic.waiting.length,
      floorCalls: [...this.metrics.floorCalls],
      safetyChain: this.safety.chain(this.safetyInputs()),
      governorTripped: this.safety.governorTripped,
    }
  }
}

const arrow = (d: HallDirection) => (d === 'UP' ? '▲' : '▼')
const fmtQueue = (q: string[]) => `[${q.join(', ')}]`
