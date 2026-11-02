import { ElevatorController } from './ElevatorController'
import { TrafficSimulator } from './TrafficSimulator'
import type { HallDirection, SimConfig } from './types'

export type DispatchStrategy = 'nearest' | 'eta' | 'zoning'

export interface DispatchDecision {
  t: number
  floor: number
  direction: HallDirection
  car: number
  strategy: DispatchStrategy
  /** Score per car (lower is better): distance for "nearest", seconds for "eta". */
  scores: number[]
  reason: string
}

const STOP_TIME = 9 // s — a typical stop: decelerate, doors open, dwell, close, accelerate

/**
 * Group control: several cars in neighbouring shafts share the landing buttons.
 * A hall call is not "for the building" — the dispatcher assigns it to exactly one car.
 * Each car keeps its own ElevatorController (state machine, scheduler, doors, safety).
 */
export class GroupController {
  readonly cars: ElevatorController[]
  readonly traffic: TrafficSimulator
  readonly log: DispatchDecision[] = []
  time = 0

  constructor(
    readonly config: SimConfig,
    readonly carCount: number,
    public strategy: DispatchStrategy,
  ) {
    this.traffic = new TrafficSimulator(config)
    this.traffic.enabled = true
    const link = {
      traffic: this.traffic,
      callElevator: (floor: number, dir: HallDirection) => this.assignHallCall(floor, dir),
      hasHallCall: (floor: number, dir: HallDirection) => this.cars.some((c) => c.hallCalls.some((h) => h.floor === floor && h.direction === dir)),
    }
    this.cars = Array.from(
      { length: carCount },
      (_, i) => new ElevatorController({ ...config, mode: 'normal', algorithm: 'LOOK' }, { trace: false, carId: i, group: link }),
    )
    // Spread idle cars over the building so they do not all start at the lobby.
    this.cars.forEach((c, i) => {
      const floor = 1 + Math.round((i * (config.floors - 1)) / Math.max(1, carCount))
      c.motion.position = c.floorPosition(floor)
      c.currentFloor = floor
    })
  }

  tick(dt: number) {
    this.time += dt
    for (const c of this.cars) c.tick(dt)
    const busy = this.cars.flatMap((c) => c.doorsBusyAt())
    this.traffic.update(this.time, { callElevator: (f, d) => this.assignHallCall(f, d), requestFloor: () => {}, hasHallCall: (f, d) => this.cars.some((c) => c.hallCalls.some((h) => h.floor === f && h.direction === d)) }, busy)
  }

  /** The dispatcher: pick one car for a landing call. */
  assignHallCall(floor: number, direction: HallDirection) {
    const scores = this.cars.map((c) => this.score(c, floor, direction))
    let best = 0
    scores.forEach((s, i) => {
      if (s < scores[best]) best = i
    })
    const unit = this.strategy === 'nearest' ? 'floors' : 's'
    const decision: DispatchDecision = {
      t: this.time,
      floor,
      direction,
      car: best,
      strategy: this.strategy,
      scores,
      reason:
        this.strategy === 'zoning'
          ? `floor ${floor} belongs to car ${carName(best)}'s zone`
          : `lowest ${this.strategy === 'eta' ? 'estimated arrival time' : 'distance'}: ${scores[best].toFixed(1)} ${unit}`,
    }
    this.log.push(decision)
    if (this.log.length > 200) this.log.shift()
    this.cars[best].callElevator(floor, direction)
  }

  private score(car: ElevatorController, floor: number, dir: HallDirection): number {
    const pos = car.motion.position / this.config.floorHeight + 1
    const out = car.sm.state === 'EMERGENCY' ? 1e6 : 0
    switch (this.strategy) {
      case 'nearest':
        return out + Math.abs(pos - floor)
      case 'zoning': {
        // Split the floors into equal bands, one per car.
        const band = Math.ceil(this.config.floors / this.carCount)
        const zone = Math.min(this.carCount - 1, Math.floor((floor - 1) / band))
        return out + (zone === car.carId ? 0 : 100 + Math.abs(pos - floor))
      }
      case 'eta':
        return out + this.estimateArrival(car, pos, floor, dir)
    }
  }

  /**
   * Estimated time for `car` to reach `floor`, counting the stops it has already promised.
   * Same direction and the call is ahead → on the way. Otherwise it must finish its sweep first.
   */
  private estimateArrival(car: ElevatorController, pos: number, floor: number, dir: HallDirection): number {
    const floorTime = this.config.floorHeight / this.config.ratedSpeed
    const stops = [...car.carCalls.map((c) => c.floor), ...car.hallCalls.map((h) => h.floor)]
    const d = car.direction
    const ahead = d === 'UP' ? floor >= pos : d === 'DOWN' ? floor <= pos : true
    if (d === 'NONE' || (ahead && d === dir)) {
      const between = stops.filter((f) => (floor > pos ? f > pos && f < floor : f < pos && f > floor)).length
      return Math.abs(floor - pos) * floorTime + between * STOP_TIME + (car.sm.state.startsWith('DOOR') ? 3 : 0)
    }
    // Finish the current sweep to its last stop, then come back.
    const turn = d === 'UP' ? Math.max(pos, ...stops) : Math.min(pos, ...stops)
    return (Math.abs(turn - pos) + Math.abs(turn - floor)) * floorTime + stops.length * STOP_TIME
  }

  stats() {
    return this.traffic.stats()
  }
}

export const carName = (i: number) => String.fromCharCode(65 + i)

/** Headless comparison of strategies on identical seeded traffic. */
export function runGroupBenchmark(config: SimConfig, carCount: number, strategies: DispatchStrategy[], spawnSeconds = 600) {
  return strategies.map((strategy) => {
    const g = new GroupController(config, carCount, strategy)
    g.traffic.spawnUntil = spawnSeconds
    while (g.time < spawnSeconds * 3) {
      g.tick(1 / 30)
      if (g.time > spawnSeconds && g.traffic.passengers.every((p) => p.state === 'DONE')) break
    }
    const s = g.stats()
    return {
      strategy,
      passengers: g.traffic.passengers.length,
      ...s,
      distance: g.cars.reduce((a, c) => a + c.metrics.distance, 0),
      energyWh: g.cars.reduce((a, c) => a + (c.metrics.energyUsedJ - c.metrics.energyRegenJ), 0) / 3600,
    }
  })
}
