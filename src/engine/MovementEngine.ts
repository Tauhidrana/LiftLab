import type { MotionPhase, SimConfig } from './types'

export type MotionResult = 'MOVING' | 'ARRIVED' | 'STOPPED'

const LEVEL_ZONE = 0.03 // m

/**
 * Vertical motion of the car: a trapezoidal velocity profile.
 *
 *   speed
 *     │      ┌──────────┐  ← cruise at rated speed
 *     │     ╱            ╲
 *     │    ╱              ╲  ← decelerate so that v² = 2·a·d
 *     └───╱────────────────╲──→ time
 *      accelerate          level
 *
 * With motionProfile = 's-curve' the drive also limits jerk (the rate of
 * change of acceleration), which rounds every corner of this graph.
 */
export class MovementEngine {
  position = 0 // m above floor 1
  velocity = 0 // m/s, positive = up
  acceleration = 0 // m/s²
  phase: MotionPhase = 'STOPPED'
  brakeEngaged = true
  motorEnergized = false

  private target: number | null = null
  private speedLimit: number
  /** S-curve only: acceleration along the direction of travel, changed at most `jerk` per second. */
  private accel = 0

  constructor(private config: SimConfig) {
    this.speedLimit = config.ratedSpeed
  }

  get targetPosition() {
    return this.target
  }

  /** Distance needed to stop from the current speed at normal deceleration. */
  stoppingDistance(): number {
    return (this.velocity * this.velocity) / (2 * this.config.acceleration)
  }

  /** Can the car still stop comfortably at `pos` given its current speed and direction? */
  canStopAt(pos: number): boolean {
    const dir = Math.sign(this.velocity)
    const remaining = (pos - this.position) * dir
    return dir !== 0 && remaining >= this.stoppingDistance() + 0.05
  }

  releaseBrake() {
    this.brakeEngaged = false
  }

  applyBrake() {
    this.brakeEngaged = true
    this.motorEnergized = false
  }

  start(targetPos: number, speedLimit = this.config.ratedSpeed) {
    this.target = targetPos
    this.speedLimit = speedLimit
    this.motorEnergized = true
    this.accel = 0
  }

  retarget(targetPos: number) {
    this.target = targetPos
  }

  /** Advance one fixed time step. */
  update(dt: number): MotionResult {
    if (this.target === null || !this.motorEnergized || this.brakeEngaged) return 'STOPPED'

    const { acceleration: a, levelingSpeed } = this.config
    const delta = this.target - this.position
    const dir = Math.sign(delta)
    const remaining = Math.abs(delta)
    const speed = Math.abs(this.velocity)

    // Arrived: within 2 mm and slow enough to stop.
    if (remaining < 0.002 || (remaining < 0.01 && speed <= levelingSpeed)) {
      this.position = this.target
      this.velocity = 0
      this.acceleration = 0
      this.phase = 'STOPPED'
      this.target = null
      this.accel = 0
      return 'ARRIVED'
    }

    if (this.config.motionProfile === 's-curve') return this.updateSCurve(dt, dir, remaining, speed)

    // The fastest speed from which we can still stop at the target. We aim 3 cm
    // short, then "level" the last centimetres at creep speed, as real drives do.
    const brakingCurve = Math.sqrt(2 * a * Math.max(0, remaining - LEVEL_ZONE))
    const desired = Math.max(levelingSpeed, Math.min(this.speedLimit, brakingCurve))

    let next: number
    if (speed < desired - 1e-6) {
      next = Math.min(desired, speed + a * dt)
      this.phase = 'ACCELERATING'
    } else if (speed > desired + 1e-6) {
      next = Math.max(desired, speed - a * dt)
      this.phase = remaining < 0.15 ? 'LEVELING' : 'DECELERATING'
    } else {
      next = desired
      this.phase = remaining < 0.15 ? 'LEVELING' : desired >= this.speedLimit - 1e-6 ? 'CRUISING' : 'DECELERATING'
    }

    const step = Math.min(next * dt, remaining)
    this.acceleration = ((next - speed) / dt) * dir
    this.velocity = next * dir
    this.position += step * dir
    return 'MOVING'
  }

  /**
   * Jerk-limited "S-curve" profile. Acceleration itself may only change by
   * `jerk` m/s³, so the car eases into and out of every speed change — this is
   * what makes a modern lift feel smooth.
   *
   * Stopping now needs extra distance while the deceleration ramps up:
   *   d = v²/(2a) + v·a/(2j)   →   solved for the highest safe speed v.
   */
  private updateSCurve(dt: number, dir: number, remaining: number, speed: number): MotionResult {
    const { acceleration: aMax, jerk, levelingSpeed } = this.config
    const a = aMax * 0.8 // keep a margin: the speed controller reacts slightly late
    const k = a / (2 * jerk)
    const d = Math.max(0, remaining - LEVEL_ZONE)
    const safeSpeed = a * (-k + Math.sqrt(k * k + (2 * d) / a))
    const desired = Math.max(levelingSpeed, Math.min(this.speedLimit, safeSpeed))

    // Ask for the acceleration that closes the speed gap, then limit how fast it may change.
    const gap = desired - speed
    // Speed still gained while easing acceleration back to zero = a²/(2j): start easing early.
    const wanted =
      this.accel > 0 && gap <= (this.accel * this.accel) / (2 * jerk) ? 0 : Math.max(-aMax, Math.min(aMax, gap * 4))
    const maxChange = jerk * dt
    this.accel = Math.max(this.accel - maxChange, Math.min(this.accel + maxChange, wanted))

    let next = Math.max(0, speed + this.accel * dt)
    if (remaining < 0.15) next = Math.max(next, levelingSpeed) // creep the last centimetres, never stall

    if (remaining < 0.15) this.phase = 'LEVELING'
    else if (this.accel > 0.03) this.phase = 'ACCELERATING'
    else if (this.accel < -0.03) this.phase = 'DECELERATING'
    else this.phase = speed >= this.speedLimit - 0.02 ? 'CRUISING' : this.phase

    const step = Math.min(next * dt, remaining)
    this.acceleration = ((next - speed) / dt) * dir
    this.velocity = next * dir
    this.position += step * dir
    return 'MOVING'
  }

  /** Emergency: motor off, brake on, decelerate at the brake's rate. Returns true once stopped. */
  updateBraking(dt: number): boolean {
    const speed = Math.abs(this.velocity)
    if (speed === 0) {
      this.phase = 'STOPPED'
      this.acceleration = 0
      return true
    }
    const dir = Math.sign(this.velocity)
    const next = Math.max(0, speed - this.config.brakeDeceleration * dt)
    this.position += ((speed + next) / 2) * dt * dir
    this.acceleration = ((next - speed) / dt) * dir
    this.velocity = next * dir
    this.phase = 'BRAKING'
    if (next === 0) {
      this.phase = 'STOPPED'
      this.acceleration = 0
      return true
    }
    return false
  }

  halt() {
    this.target = null
    this.motorEnergized = false
  }
}
