import { ElevatorController } from './ElevatorController'
import type { CustomSelect } from './RequestScheduler'
import type { Algorithm, SimConfig } from './types'

export interface BenchmarkResult {
  algorithm: Algorithm
  passengers: number
  served: number
  avgWait: number
  maxWait: number
  avgRide: number
  avgJourney: number
  distance: number
  energyWh: number
  trips: number
  floorCalls: number[]
  error: string | null
}

/**
 * Run the same seeded passenger traffic through each algorithm, headless and
 * with tracing off. Same seed + same config ⇒ identical passengers for every run,
 * so differences come only from the scheduling decisions.
 */
export function runBenchmark(
  base: SimConfig,
  algorithms: Algorithm[],
  opts: { spawnSeconds?: number; maxSeconds?: number; custom?: CustomSelect } = {},
): BenchmarkResult[] {
  const { spawnSeconds = 600, maxSeconds = 1800, custom } = opts
  const dt = 1 / 30
  return algorithms.map((algorithm) => {
    const c = new ElevatorController({ ...base, algorithm, mode: 'automatic' }, { trace: false })
    c.traffic.spawnUntil = spawnSeconds
    if (algorithm === 'CUSTOM' && custom) c.scheduler.custom = custom
    while (c.time < maxSeconds) {
      c.tick(dt)
      if (c.scheduler.customError) break
      const done = c.time > spawnSeconds && c.traffic.passengers.every((p) => p.state === 'DONE')
      if (done) break
    }
    const s = c.traffic.stats()
    return {
      algorithm,
      passengers: c.traffic.passengers.length,
      served: s.served,
      avgWait: s.avgWait,
      maxWait: s.maxWait,
      avgRide: s.avgRide,
      avgJourney: s.avgJourney,
      distance: c.metrics.distance,
      energyWh: (c.metrics.energyUsedJ - c.metrics.energyRegenJ) / 3600,
      trips: c.metrics.trips,
      floorCalls: [...c.metrics.floorCalls],
      error: c.scheduler.customError,
    }
  })
}
