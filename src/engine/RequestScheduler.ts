import type { Algorithm, CarCall, Direction, HallCall, SchedulerDecision } from './types'

export interface SchedulingContext {
  algorithm: Algorithm
  floors: number
  /** Car position measured in floors (e.g. 3.4 = 40% of the way from 3 to 4). */
  position: number
  direction: Direction
  carCalls: CarCall[]
  hallCalls: HallCall[]
}

interface Stop {
  floor: number
  kind: 'car' | 'hall-up' | 'hall-down'
  time: number
}

const EPS = 0.01

/**
 * Decides where the car should go next.
 *
 * It is a pure function of the context: the same requests and position always
 * give the same answer, which is what makes the simulation deterministic.
 */
/** A user-written scheduler (Challenge mode): returns a floor number or null. */
export type CustomSelect = (ctx: SchedulingContext) => number | null | undefined

export class RequestScheduler {
  custom: CustomSelect | null = null
  /** Set when the custom function throws or returns something invalid. */
  customError: string | null = null

  selectNext(ctx: SchedulingContext): SchedulerDecision | null {
    const stops = collectStops(ctx)
    if (stops.length === 0) return null

    const candidates = stops.map((s) => ({
      floor: s.floor,
      kind: s.kind,
      distance: Math.abs(s.floor - ctx.position),
    }))
    const pick = (floor: number, reason: string): SchedulerDecision => ({ floor, reason, candidates })

    switch (ctx.algorithm) {
      case 'CUSTOM': {
        const floor = this.runCustom(ctx)
        return floor === null ? null : pick(floor, `CUSTOM: your selectNext() returned floor ${floor}`)
      }

      case 'FCFS': {
        // First-Come-First-Served: the oldest request wins, no matter where it is.
        const oldest = [...stops].sort((a, b) => a.time - b.time)[0]
        return pick(oldest.floor, `FCFS: oldest request is floor ${oldest.floor}`)
      }

      case 'SSTF': {
        // Shortest-Seek-Time-First: always go to the closest request.
        const nearest = [...stops].sort(
          (a, b) => Math.abs(a.floor - ctx.position) - Math.abs(b.floor - ctx.position) || a.time - b.time,
        )[0]
        return pick(nearest.floor, `SSTF: floor ${nearest.floor} is the nearest request`)
      }

      case 'SCAN':
      case 'LOOK': {
        const dir = ctx.direction === 'NONE' ? initialDirection(ctx, stops) : ctx.direction
        const here = stops.find((s) => Math.abs(s.floor - ctx.position) < EPS)
        if (here && ctx.direction === 'NONE') return pick(here.floor, `Request at the current floor ${here.floor}`)

        for (const d of [dir, opposite(dir)] as const) {
          const ahead = stops.filter((s) => isAhead(s.floor, ctx.position, d))
          if (ahead.length === 0) continue

          // Collective control: on the way, stop for car calls and hall calls going our way.
          const sameWay = ahead.filter((s) => s.kind === 'car' || s.kind === hallKind(d) || ctx.algorithm === 'SCAN')
          if (sameWay.length > 0) {
            const nearest = nearestInDirection(sameWay, d)
            return pick(nearest, `${ctx.algorithm}: nearest stop ${d === 'UP' ? 'above' : 'below'} while moving ${d}`)
          }
          // Only opposite-direction hall calls ahead: go to the farthest one, then turn around.
          const far = farthestInDirection(ahead, d)
          return pick(far, `${ctx.algorithm}: turnaround at floor ${far} (farthest call ${d === 'UP' ? 'above' : 'below'})`)
        }

        if (ctx.algorithm === 'SCAN') {
          // SCAN sweeps to the end of the shaft before reversing.
          const end = dir === 'UP' ? ctx.floors : 1
          if (Math.abs(ctx.position - end) > EPS) return pick(end, `SCAN: sweep to the end of the shaft (floor ${end})`)
        }
        return here ? pick(here.floor, `Request at the current floor ${here.floor}`) : null
      }
    }
  }

  /** Call the user's function on a copy of the context, and reject bad answers. */
  private runCustom(ctx: SchedulingContext): number | null {
    if (!this.custom) return null
    try {
      const copy = structuredClone(ctx)
      const floor = this.custom(copy)
      if (floor === null || floor === undefined) return null
      if (!Number.isInteger(floor) || floor < 1 || floor > ctx.floors) {
        this.customError = `selectNext() returned ${JSON.stringify(floor)} — expected a floor number from 1 to ${ctx.floors}, or null`
        return null
      }
      return floor
    } catch (e) {
      this.customError = `selectNext() threw: ${(e as Error).message}`
      return null
    }
  }

  /** After stopping at a floor, which way will the car continue? */
  directionAfterStop(ctx: SchedulingContext): Direction {
    if (ctx.algorithm === 'FCFS' || ctx.algorithm === 'SSTF' || ctx.algorithm === 'CUSTOM') return 'NONE'
    const stops = collectStops(ctx).filter((s) => Math.abs(s.floor - ctx.position) > EPS)
    if (ctx.direction !== 'NONE' && stops.some((s) => isAhead(s.floor, ctx.position, ctx.direction))) return ctx.direction
    if (ctx.direction !== 'NONE') {
      const back = opposite(ctx.direction)
      if (stops.some((s) => isAhead(s.floor, ctx.position, back))) return back
    }
    // Nothing elsewhere: honour a hall call waiting here, if any.
    const hereHall = ctx.hallCalls.find((h) => Math.abs(h.floor - ctx.position) < EPS)
    return hereHall ? hereHall.direction : 'NONE'
  }
}

function collectStops(ctx: SchedulingContext): Stop[] {
  return [
    ...ctx.carCalls.map((c) => ({ floor: c.floor, kind: 'car' as const, time: c.time })),
    ...ctx.hallCalls.map((h) => ({ floor: h.floor, kind: hallKind(h.direction), time: h.time })),
  ]
}

function initialDirection(ctx: SchedulingContext, stops: Stop[]): 'UP' | 'DOWN' {
  const nearest = [...stops].sort(
    (a, b) => Math.abs(a.floor - ctx.position) - Math.abs(b.floor - ctx.position) || a.time - b.time,
  )[0]
  return nearest.floor >= ctx.position ? 'UP' : 'DOWN'
}

const opposite = (d: 'UP' | 'DOWN'): 'UP' | 'DOWN' => (d === 'UP' ? 'DOWN' : 'UP')
const hallKind = (d: 'UP' | 'DOWN') => (d === 'UP' ? ('hall-up' as const) : ('hall-down' as const))
const isAhead = (floor: number, pos: number, d: Direction) => (d === 'UP' ? floor > pos + EPS : floor < pos - EPS)

function nearestInDirection(stops: Stop[], d: 'UP' | 'DOWN') {
  const floors = stops.map((s) => s.floor)
  return d === 'UP' ? Math.min(...floors) : Math.max(...floors)
}
function farthestInDirection(stops: Stop[], d: 'UP' | 'DOWN') {
  const floors = stops.map((s) => s.floor)
  return d === 'UP' ? Math.max(...floors) : Math.min(...floors)
}
