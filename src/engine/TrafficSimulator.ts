import type { HallDirection, Passenger, SimConfig } from './types'

/** Small deterministic PRNG so the same seed always gives the same traffic. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface TrafficHooks {
  callElevator(floor: number, direction: HallDirection): void
  requestFloor(floor: number): void
  hasHallCall(floor: number, direction: HallDirection): boolean
}

export const CAR_CAPACITY = 8

/**
 * Passenger traffic for Automatic mode and for algorithm comparisons.
 * Passengers arrive at random floors (seeded), press the hall button,
 * board when the car arrives going their way, and press their destination.
 */
export class TrafficSimulator {
  enabled = false
  passengers: Passenger[] = []
  private rng: () => number
  private nextSpawn = 0
  private nextId = 1
  /** Stop spawning after this time (used by headless benchmarks). */
  spawnUntil = Infinity

  constructor(private config: SimConfig) {
    this.rng = mulberry32(config.seed)
  }

  /** Passengers riding in a given car (single-car simulations use car 0). */
  riders(car = 0) {
    return this.passengers.filter((p) => p.state === 'RIDING' && (p.car ?? 0) === car)
  }
  get waiting() {
    return this.passengers.filter((p) => p.state === 'WAITING')
  }

  update(time: number, hooks: TrafficHooks, doorsBusyAt: number[]) {
    if (!this.enabled) return
    if (time >= this.nextSpawn && time < this.spawnUntil) {
      this.spawn(time, hooks)
      const meanGap = 60 / Math.max(0.1, this.config.trafficRate)
      this.nextSpawn = time - Math.log(1 - this.rng()) * meanGap // exponential inter-arrival
    }
    // Passengers left behind (car full) press the hall button again once the car has left their floor.
    for (const p of this.waiting) {
      const dir = p.destination > p.origin ? 'UP' : 'DOWN'
      if (!doorsBusyAt.includes(p.origin) && !hooks.hasHallCall(p.origin, dir)) hooks.callElevator(p.origin, dir)
    }
  }

  private spawn(time: number, hooks: TrafficHooks) {
    const n = this.config.floors
    const r = () => 1 + Math.floor(this.rng() * n)
    let origin = r()
    let destination = r()
    const roll = this.rng()
    if (this.config.trafficProfile === 'up-peak' && roll < 0.8) origin = 1
    if (this.config.trafficProfile === 'down-peak' && roll < 0.8) destination = 1
    if (this.config.trafficProfile === 'lunch' && roll < 0.5) {
      if (this.rng() < 0.5) origin = 1
      else destination = 1
    }
    if (origin === destination) destination = origin === n ? 1 : origin + 1 + Math.floor(this.rng() * (n - origin))
    const p: Passenger = { id: this.nextId++, origin, destination, spawnTime: time, state: 'WAITING' }
    this.passengers.push(p)
    const dir = destination > origin ? 'UP' : 'DOWN'
    if (!hooks.hasHallCall(origin, dir)) hooks.callElevator(origin, dir)
  }

  /** Doors are open at `floor`: riders leave, then waiting passengers going `direction` board. */
  exchange(time: number, floor: number, direction: 'UP' | 'DOWN' | 'NONE', hooks: TrafficHooks, car = 0) {
    let out = 0
    let inn = 0
    for (const p of this.riders(car)) {
      if (p.destination === floor) {
        p.state = 'DONE'
        p.arriveTime = time
        out++
      }
    }
    for (const p of this.waiting) {
      if (p.origin !== floor) continue
      const dir = p.destination > p.origin ? 'UP' : 'DOWN'
      if (direction !== 'NONE' && dir !== direction) continue
      if (this.riders(car).length >= CAR_CAPACITY) break
      p.state = 'RIDING'
      p.car = car
      p.boardTime = time
      inn++
      hooks.requestFloor(p.destination)
    }
    return { out, inn }
  }

  stats() {
    const done = this.passengers.filter((p) => p.state === 'DONE')
    const boarded = this.passengers.filter((p) => p.boardTime !== undefined)
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
    const waits = boarded.map((p) => p.boardTime! - p.spawnTime)
    return {
      served: done.length,
      avgWait: avg(waits),
      maxWait: waits.length ? Math.max(...waits) : 0,
      avgRide: avg(done.map((p) => p.arriveTime! - p.boardTime!)),
      avgJourney: avg(done.map((p) => p.arriveTime! - p.spawnTime)),
    }
  }

  reset() {
    this.passengers = []
    this.rng = mulberry32(this.config.seed)
    this.nextSpawn = 0
    this.nextId = 1
  }
}
