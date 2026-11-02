import type { Tracer } from './Tracer'
import type { ElevatorState } from './types'

/**
 * Every legal state change, in one table.
 * If a transition is not listed here, the elevator cannot make it —
 * the controller asks, the state machine decides.
 */
export const TRANSITIONS: Record<ElevatorState, ElevatorState[]> = {
  IDLE: ['MOVING_UP', 'MOVING_DOWN', 'DOOR_OPENING', 'EMERGENCY'],
  MOVING_UP: ['DOOR_OPENING', 'IDLE', 'EMERGENCY'],
  MOVING_DOWN: ['DOOR_OPENING', 'IDLE', 'EMERGENCY'],
  DOOR_OPENING: ['DOOR_OPEN', 'EMERGENCY'],
  DOOR_OPEN: ['DOOR_CLOSING', 'EMERGENCY'],
  DOOR_CLOSING: ['DOOR_OPENING', 'IDLE', 'MOVING_UP', 'MOVING_DOWN', 'EMERGENCY'],
  EMERGENCY: ['IDLE', 'DOOR_OPENING', 'MOVING_UP', 'MOVING_DOWN'],
}

export class ElevatorStateMachine {
  state: ElevatorState = 'IDLE'
  enteredAt = 0

  constructor(
    private trace: Tracer,
    private clock: () => number,
  ) {}

  can(next: ElevatorState): boolean {
    return TRANSITIONS[this.state].includes(next)
  }

  transition(next: ElevatorState, reason: string): boolean {
    if (next === this.state) return true
    if (!this.can(next)) {
      this.trace.emit('sm.reject', 'ElevatorStateMachine.transition', {
        event: 'ILLEGAL_TRANSITION_BLOCKED',
        category: 'state',
        level: 'warn',
        message: `${this.state} → ${next} is not an allowed transition`,
        inputs: { from: this.state, to: next, reason },
      })
      return false
    }
    const prev = this.state
    this.state = next
    this.enteredAt = this.clock()
    this.trace.emit('sm.transition', 'ElevatorStateMachine.transition', {
      event: 'STATE_TRANSITION',
      category: 'state',
      message: `${prev} → ${next}: ${reason}`,
      change: { field: 'elevatorState', from: prev, to: next },
      inputs: { reason },
    })
    return true
  }

  reset() {
    this.state = 'IDLE'
    this.enteredAt = this.clock()
  }
}
