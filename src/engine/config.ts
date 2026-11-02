import type { SimConfig } from './types'

/**
 * Educationally plausible defaults for a small passenger lift
 * (8 persons / 630 kg, 1.0 m/s — typical for a mid-rise residential building).
 */
export const DEFAULT_CONFIG: SimConfig = {
  floors: 8,
  floorHeight: 3.2,
  ratedSpeed: 1.0,
  acceleration: 0.7,
  jerk: 0.9,
  motionProfile: 's-curve',
  brakeDeceleration: 2.5,
  levelingSpeed: 0.04,
  rescueSpeed: 0.25,
  doorTravelTime: 1.8,
  doorDwellTime: 3,
  carMass: 900,
  ratedLoad: 630,
  counterweightRatio: 0.5,
  passengerMass: 75,
  sheaveRadius: 0.24,
  driveEfficiency: 0.85,
  algorithm: 'LOOK',
  mode: 'normal',
  manualLoadKg: 150,
  trafficProfile: 'uniform',
  trafficRate: 4,
  seed: 42,
}
