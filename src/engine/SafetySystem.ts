import type { FaultId } from './types'

export interface SafetyInputs {
  doorsLocked: boolean
  speed: number
  ratedSpeed: number
}

export interface ChainLink {
  id: string
  label: string
  ok: boolean
}

export const FAULT_LABELS: Record<FaultId, string> = {
  doorObstruction: 'Door obstruction',
  doorSensorFailure: 'Door sensor (light curtain) failure',
  motorUnavailable: 'Traction motor / drive unavailable',
  positionSensorFault: 'Position sensor malfunction',
  emergencyStop: 'Emergency stop pressed',
  powerLoss: 'Mains power loss',
}

/**
 * The safety chain: a series of switches that must ALL be closed for the
 * motor to run. In a real elevator this is hard-wired in series, so any one
 * open contact cuts power to the motor and drops the brake — even if the
 * software misbehaves. Here it is modelled in code for learning purposes.
 */
export class SafetySystem {
  faults = new Set<FaultId>()
  governorTripped = false

  has(f: FaultId) {
    return this.faults.has(f)
  }

  chain(inputs: SafetyInputs): ChainLink[] {
    return [
      { id: 'doorLock', label: 'Door locks closed', ok: inputs.doorsLocked },
      { id: 'estop', label: 'Emergency stop circuit', ok: !this.has('emergencyStop') },
      { id: 'power', label: 'Mains supply', ok: !this.has('powerLoss') },
      { id: 'drive', label: 'Drive / motor ready', ok: !this.has('motorUnavailable') },
      { id: 'position', label: 'Position feedback plausible', ok: !this.has('positionSensorFault') },
      { id: 'governor', label: 'Overspeed governor', ok: !this.governorTripped },
    ]
  }

  /** May the car move? Every link must be closed. */
  canMove(inputs: SafetyInputs): { ok: boolean; open: ChainLink[] } {
    const open = this.chain(inputs).filter((l) => !l.ok)
    return { ok: open.length === 0, open }
  }

  /** May the doors close? The doorway must be verified clear. */
  canCloseDoors(lightCurtain: { blocked: boolean; healthy: boolean }): { ok: boolean; reason?: string } {
    if (!lightCurtain.healthy) return { ok: false, reason: 'Light curtain failed self-test — doorway cannot be verified clear' }
    if (lightCurtain.blocked) return { ok: false, reason: 'Light curtain beam interrupted — obstruction in doorway' }
    return { ok: true }
  }

  /** The governor trips if the car exceeds 115% of rated speed. */
  checkOverspeed(speed: number, ratedSpeed: number): boolean {
    if (Math.abs(speed) > ratedSpeed * 1.15) this.governorTripped = true
    return this.governorTripped
  }
}
