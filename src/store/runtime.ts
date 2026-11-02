import { DEFAULT_CONFIG } from '../engine/config'
import { ElevatorController } from '../engine/ElevatorController'
import type { CustomSelect } from '../engine/RequestScheduler'
import type { SimConfig, TraceEvent } from '../engine/types'

export const FIXED_DT = 1 / 60
const MAX_EVENTS = 800
const HISTORY_SECONDS = 30
const HISTORY_INTERVAL = 0.1

export interface Sample {
  t: number
  v: number
  a: number
  pos: number
  power: number
}

/**
 * Owns the single running ElevatorController and drives it with a
 * fixed-timestep loop (deterministic: same inputs → same behaviour).
 * React never ticks the engine; it only reads from here.
 */
class SimRuntime {
  controller!: ElevatorController
  config: SimConfig = { ...DEFAULT_CONFIG }
  events: TraceEvent[] = []
  history: Sample[] = []
  speed = 1
  paused = false
  /** Step mode: the loop is frozen; `runUntilEvent()` advances it. */
  stepMode = false
  generation = 0
  /** A Challenge-mode scheduler loaded into the live lab (algorithm 'CUSTOM'). */
  custom: CustomSelect | null = null

  private acc = 0
  private last = 0
  private nextSample = 0
  private raf = 0
  private listeners = new Set<() => void>()
  private unsubscribeTrace: (() => void) | null = null
  eventsVersion = 0

  constructor() {
    this.build()
  }

  private build() {
    this.unsubscribeTrace?.()
    this.controller = new ElevatorController(this.config)
    this.controller.scheduler.custom = this.custom
    this.events = []
    this.history = []
    this.nextSample = 0
    this.acc = 0
    this.eventsVersion++
    this.generation++
    this.unsubscribeTrace = this.controller.trace.subscribe((e) => {
      this.events.push(e)
      if (this.events.length > MAX_EVENTS) this.events.splice(0, this.events.length - MAX_EVENTS)
      this.eventsVersion++
    })
    this.controller.trace.beginChain('Boot')
    this.controller.trace.emit('boot', 'SimRuntime.build', {
      event: 'SYSTEM_BOOT',
      category: 'controller',
      message: `Controller online: ${this.config.floors} floors, ${this.config.algorithm} scheduling, car at floor 1`,
    })
  }

  rebuild(config: Partial<SimConfig>) {
    this.config = { ...this.config, ...config }
    this.build()
    this.notify()
  }

  start() {
    if (this.raf) return
    this.last = performance.now()
    const frame = (now: number) => {
      const real = Math.min(0.1, (now - this.last) / 1000)
      this.last = now
      if (!this.paused && !this.stepMode) {
        this.acc += real * this.speed
        while (this.acc >= FIXED_DT) {
          this.step()
          this.acc -= FIXED_DT
        }
      }
      this.notify()
      this.raf = requestAnimationFrame(frame)
    }
    this.raf = requestAnimationFrame(frame)
  }

  private step() {
    this.controller.tick(FIXED_DT)
    const c = this.controller
    if (c.time >= this.nextSample) {
      this.nextSample = c.time + HISTORY_INTERVAL
      this.history.push({ t: c.time, v: c.motion.velocity, a: c.motion.acceleration, pos: c.motion.position, power: c.powerW / 1000 })
      const cutoff = c.time - HISTORY_SECONDS
      while (this.history.length && this.history[0].t < cutoff) this.history.shift()
    }
  }

  /** Step mode: advance the simulation until at least one new (non-verbose) event is emitted. */
  runUntilEvent(maxSeconds = 120): boolean {
    const lastId = this.events.at(-1)?.id ?? 0
    for (let i = 0; i < maxSeconds / FIXED_DT; i++) {
      this.step()
      for (let j = this.events.length - 1; j >= 0 && this.events[j].id > lastId; j--) {
        if (this.events[j].level !== 'verbose') return true
      }
    }
    return false
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  private notify() {
    for (const l of this.listeners) l()
  }
}

export const runtime = new SimRuntime()
