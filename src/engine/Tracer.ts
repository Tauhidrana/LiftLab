import type { TraceCategory, TraceContext, TraceEvent, TraceLevel } from './types'

export interface EmitData {
  event: string
  category: TraceCategory
  message: string
  level?: TraceLevel
  explain?: string
  inputs?: Record<string, unknown>
  change?: { field: string; from: string; to: string }
}

/**
 * Records what the engine does, as it does it.
 *
 * Every `emit()` call sits on a real line of engine code. The first argument
 * (the "marker") is a unique string literal; the Code Inspector searches the
 * engine source for that literal to highlight the exact line that ran.
 */
export class Tracer {
  enabled = true
  private nextId = 1
  private chainId = 0
  private chainLabel = 'boot'
  private listeners = new Set<(e: TraceEvent) => void>()

  constructor(
    private clock: () => number,
    private context: () => TraceContext,
  ) {}

  /** Start a new causal chain: everything emitted until the next call shares it. */
  beginChain(label: string) {
    if (!this.enabled) return
    this.chainId++
    this.chainLabel = label
  }

  emit(marker: string, fn: string, data: EmitData) {
    if (!this.enabled) return
    const e: TraceEvent = {
      id: this.nextId++,
      t: this.clock(),
      marker,
      fn,
      level: data.level ?? 'info',
      chain: this.chainId,
      chainLabel: this.chainLabel,
      ctx: this.context(),
      ...data,
    }
    for (const l of this.listeners) l(e)
  }

  subscribe(fn: (e: TraceEvent) => void) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}
