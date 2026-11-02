/**
 * Shared types for the LiftLab simulation engine.
 * The engine is framework-free: no React, no Three.js. The UI only reads it.
 */

export type ElevatorState =
  | 'IDLE'
  | 'MOVING_UP'
  | 'MOVING_DOWN'
  | 'DOOR_OPENING'
  | 'DOOR_OPEN'
  | 'DOOR_CLOSING'
  | 'EMERGENCY'

export type Direction = 'UP' | 'DOWN' | 'NONE'
export type HallDirection = 'UP' | 'DOWN'

export type Algorithm = 'FCFS' | 'SSTF' | 'SCAN' | 'LOOK' | 'CUSTOM'

/** How requests and doors are handled. */
export type OperationMode = 'normal' | 'manual' | 'automatic'

export type MotionPhase =
  | 'STOPPED'
  | 'ACCELERATING'
  | 'CRUISING'
  | 'DECELERATING'
  | 'LEVELING'
  | 'BRAKING'

export type DoorStatus = 'CLOSED' | 'OPENING' | 'OPEN' | 'CLOSING'

export type FaultId =
  | 'doorObstruction'
  | 'doorSensorFailure'
  | 'motorUnavailable'
  | 'positionSensorFault'
  | 'emergencyStop'
  | 'powerLoss'

export type EmergencyPhase =
  | 'BRAKING' // brake applied, car decelerating
  | 'HALTED' // car stopped, waiting
  | 'RESCUE_MOVING' // battery rescue / recovery run to nearest floor
  | 'SECURED' // car at a floor, doors open, out of service

export interface HallCall {
  floor: number
  direction: HallDirection
  time: number
}

export interface CarCall {
  floor: number
  time: number
}

export interface SimConfig {
  floors: number
  floorHeight: number // m
  ratedSpeed: number // m/s
  acceleration: number // m/s²
  jerk: number // m/s³ (s-curve only)
  motionProfile: 'trapezoid' | 's-curve'
  brakeDeceleration: number // m/s² (emergency stop)
  levelingSpeed: number // m/s
  rescueSpeed: number // m/s (battery rescue / recovery run)
  doorTravelTime: number // s (fully closed → fully open)
  doorDwellTime: number // s (how long doors stay open)
  carMass: number // kg
  ratedLoad: number // kg
  counterweightRatio: number // fraction of rated load balanced by the counterweight
  passengerMass: number // kg
  sheaveRadius: number // m
  driveEfficiency: number // 0..1
  algorithm: Algorithm
  mode: OperationMode
  manualLoadKg: number // load used when passenger traffic is off
  trafficProfile: TrafficProfile
  trafficRate: number // passengers per minute
  seed: number
}

export type TrafficProfile = 'uniform' | 'up-peak' | 'down-peak' | 'lunch'

export interface Passenger {
  id: number
  origin: number
  destination: number
  spawnTime: number
  boardTime?: number
  arriveTime?: number
  state: 'WAITING' | 'RIDING' | 'DONE'
  car?: number
}

/* ------------------------------------------------------------------ */
/* Tracing                                                             */
/* ------------------------------------------------------------------ */

export type TraceCategory =
  | 'input'
  | 'queue'
  | 'scheduler'
  | 'controller'
  | 'state'
  | 'motor'
  | 'brake'
  | 'motion'
  | 'sensor'
  | 'door'
  | 'safety'
  | 'traffic'

export type TraceLevel = 'info' | 'verbose' | 'warn' | 'danger'

/** A compact picture of the system attached to every trace event. */
export interface TraceContext {
  floor: number
  position: number
  state: ElevatorState
  direction: Direction
  target: number | null
  queue: string[]
  motor: string
  brake: string
  door: string
}

export interface TraceEvent {
  id: number
  t: number // simulation time (s)
  marker: string // unique string literal at the emit() call site
  fn: string // Class.method that emitted it
  event: string // e.g. FLOOR_BUTTON_PRESSED
  category: TraceCategory
  level: TraceLevel
  message: string
  explain?: string // plain-language explanation for learners
  inputs?: Record<string, unknown>
  change?: { field: string; from: string; to: string }
  chain: number // events sharing a chain were caused by the same trigger
  chainLabel: string
  ctx: TraceContext
}

export interface SchedulerDecision {
  floor: number
  reason: string
  candidates: { floor: number; kind: string; distance: number }[]
}

export interface Snapshot {
  time: number
  state: ElevatorState
  direction: Direction
  currentFloor: number
  targetFloor: number | null
  position: number
  velocity: number
  acceleration: number
  phase: MotionPhase
  brakeEngaged: boolean
  motorEnergized: boolean
  motorRpm: number
  motorPowerKw: number
  doorPosition: number
  doorStatus: DoorStatus
  doorLocked: boolean
  lightCurtainBlocked: boolean
  lightCurtainHealthy: boolean
  floorSensor: number | null // floor whose vane is detected, if any
  carCalls: CarCall[]
  hallCalls: HallCall[]
  faults: FaultId[]
  emergency: { reason: string; phase: EmergencyPhase } | null
  dwellRemaining: number
  loadKg: number
  passengers: number
  energyUsedKwh: number
  energyRegenKwh: number
  distanceTravelled: number
  trips: number
  servedPassengers: number
  avgWait: number
  avgRide: number
  waiting: number
  floorCalls: number[]
  safetyChain: { id: string; label: string; ok: boolean }[]
  governorTripped: boolean
}
