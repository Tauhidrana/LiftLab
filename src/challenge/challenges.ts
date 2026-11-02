import type { BenchmarkResult } from '../engine/benchmark'
import type { Algorithm, SimConfig } from '../engine/types'

export interface Challenge {
  id: string
  title: string
  brief: string
  hint: string
  config: Partial<SimConfig>
  references: Algorithm[]
  /** Returns null on success, or what is still missing. */
  check(mine: BenchmarkResult, refs: BenchmarkResult[]): string | null
  goal: string
}

const allServed = (r: BenchmarkResult) => (r.served < r.passengers ? `${r.passengers - r.served} passenger(s) were never delivered` : null)

export const CHALLENGES: Challenge[] = [
  {
    id: 'beat-fcfs',
    title: 'Better than first come, first served',
    brief: 'The starter code serves requests strictly in arrival order. Make the average wait shorter than FCFS on ordinary traffic.',
    hint: 'A car that is already passing a floor could stop there. Try picking the closest request instead of the oldest.',
    goal: 'Average wait below FCFS, everyone delivered',
    config: { trafficProfile: 'uniform', trafficRate: 5, seed: 7 },
    references: ['FCFS'],
    check: (m, [fcfs]) => allServed(m) ?? (m.avgWait < fcfs.avgWait ? null : `Average wait ${m.avgWait.toFixed(1)} s is not below FCFS (${fcfs.avgWait.toFixed(1)} s)`),
  },
  {
    id: 'nobody-left',
    title: 'Nobody waits two minutes',
    brief: 'Shortest-distance scheduling has a fairness problem: far-away floors can starve. Keep every passenger’s wait under 120 seconds.',
    hint: 'Keep going in one direction while there is work ahead (ctx.direction), then turn around.',
    goal: 'Longest wait under 120 s, everyone delivered',
    config: { trafficProfile: 'uniform', trafficRate: 6, seed: 21 },
    references: ['SSTF', 'LOOK'],
    check: (m) => allServed(m) ?? (m.maxWait < 120 ? null : `Someone waited ${m.maxWait.toFixed(0)} s`),
  },
  {
    id: 'morning-rush',
    title: 'Morning rush',
    brief: 'At 8:30 almost everyone boards at floor 1 and rides up. Beat the LOOK algorithm’s average wait.',
    hint: 'When the car has nothing to do, where should it go? Most new calls will come from floor 1.',
    goal: 'Average wait below LOOK, everyone delivered',
    config: { trafficProfile: 'up-peak', trafficRate: 7, seed: 3 },
    references: ['LOOK', 'SSTF'],
    check: (m, [look]) => allServed(m) ?? (m.avgWait < look.avgWait ? null : `Average wait ${m.avgWait.toFixed(1)} s is not below LOOK (${look.avgWait.toFixed(1)} s)`),
  },
  {
    id: 'energy',
    title: 'Energy saver',
    brief: 'Every start and every metre costs energy. Deliver everyone over the lunch hour using less net energy than SSTF.',
    hint: 'Fewer direction changes mean fewer accelerations. Serve everything on the way before reversing.',
    goal: 'Net energy below SSTF, everyone delivered',
    config: { trafficProfile: 'lunch', trafficRate: 5, seed: 11 },
    references: ['SSTF', 'LOOK'],
    check: (m, [sstf]) => allServed(m) ?? (m.energyWh < sstf.energyWh ? null : `${m.energyWh.toFixed(1)} Wh is not below SSTF (${sstf.energyWh.toFixed(1)} Wh)`),
  },
]

export const STARTER_CODE = `/**
 * Decide where the car goes next. Called every time something changes.
 *
 * ctx.position   car position in floors (3.5 = halfway between 3 and 4)
 * ctx.direction  'UP' | 'DOWN' | 'NONE'
 * ctx.floors     number of floors
 * ctx.carCalls   [{ floor, time }]             buttons pressed inside the car
 * ctx.hallCalls  [{ floor, direction, time }]  buttons pressed on landings
 *
 * Return a floor number, or null to stay idle.
 */
function selectNext(ctx) {
  const requests = [...ctx.carCalls, ...ctx.hallCalls]
  if (requests.length === 0) return null

  // First come, first served: the oldest request wins.
  requests.sort((a, b) => a.time - b.time)
  return requests[0].floor
}
`
