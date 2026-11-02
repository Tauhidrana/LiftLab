import type { DoorStatus, SimConfig } from './types'

/**
 * The car door operator: a small motor that slides the car doors.
 * The landing (floor) doors are coupled to the car doors by a mechanical vane,
 * so they only open when the car is level with that floor.
 */
export class DoorController {
  position = 0 // 0 = closed, 1 = fully open
  status: DoorStatus = 'CLOSED'
  /** The door lock contact is part of the safety chain: no lock, no motion. */
  locked = true
  motorActive = false

  /** Light curtain: infrared beams across the doorway. */
  lightCurtain = { blocked: false, healthy: true }

  constructor(private config: SimConfig) {}

  startOpening() {
    this.locked = false
    this.status = 'OPENING'
    this.motorActive = true
  }

  startClosing() {
    this.status = 'CLOSING'
    this.motorActive = true
  }

  /** Returns 'OPENED' / 'CLOSED' on the step the doors finish moving. */
  update(dt: number): 'OPENED' | 'CLOSED' | null {
    const rate = dt / this.config.doorTravelTime
    if (this.status === 'OPENING') {
      this.position = Math.min(1, this.position + rate)
      if (this.position >= 1) {
        this.status = 'OPEN'
        this.motorActive = false
        return 'OPENED'
      }
    } else if (this.status === 'CLOSING') {
      this.position = Math.max(0, this.position - rate)
      if (this.position <= 0) {
        this.status = 'CLOSED'
        this.motorActive = false
        this.locked = true
        return 'CLOSED'
      }
    }
    return null
  }
}
