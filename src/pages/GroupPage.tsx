import clsx from 'clsx'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { carName, GroupController, runGroupBenchmark, type DispatchStrategy } from '../engine/GroupController'
import { runBenchmark } from '../engine/benchmark'
import type { TrafficProfile } from '../engine/types'
import { Btn, Label, Segmented } from '../components/ui'
import { useLab } from '../store/useLab'
import { fmt, fmtTime } from '../utils/format'

const STRATEGIES: { id: DispatchStrategy; label: string; text: string }[] = [
  { id: 'nearest', label: 'Nearest car', text: 'Send the car that is physically closest, ignoring which way it is going or how busy it is. Simple, but cars bunch together and the closest car is often the wrong one.' },
  { id: 'eta', label: 'Shortest ETA', text: 'Estimate when each car could arrive, counting the stops it has already promised and whether it must turn around first. Pick the earliest. This is the basis of real group controllers.' },
  { id: 'zoning', label: 'Zoning', text: 'Split the building into bands of floors, one band per car. Predictable and fair per zone, but a busy zone cannot borrow an idle car.' },
]

export function GroupPage() {
  const base = useLab((s) => s.config)
  const [cars, setCars] = useState(3)
  const [strategy, setStrategy] = useState<DispatchStrategy>('eta')
  const [profile, setProfile] = useState<TrafficProfile>('up-peak')
  const [rate, setRate] = useState(8)
  const [speed, setSpeed] = useState(4)
  const [paused, setPaused] = useState(false)
  const [seed, setSeed] = useState(0)
  const config = useMemo(() => ({ ...base, trafficProfile: profile, trafficRate: rate }), [base, profile, rate])

  const group = useRef<GroupController>(null!)
  const [, setFrame] = useState(0)
  const live = useRef({ speed, paused })
  live.current = { speed, paused }

  // (Re)build the group whenever its shape changes.
  useEffect(() => {
    group.current = new GroupController(config, cars, strategy)
  }, [config, cars, seed]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!group.current) group.current = new GroupController(config, cars, strategy)
  useEffect(() => {
    group.current.strategy = strategy
  }, [strategy])

  // Fixed-step loop; the monitor redraws ~30 times a second.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let acc = 0
    let lastDraw = 0
    const loop = (now: number) => {
      const real = Math.min(0.1, (now - last) / 1000)
      last = now
      if (!live.current.paused) {
        acc += real * live.current.speed
        while (acc >= 1 / 60) {
          group.current.tick(1 / 60)
          acc -= 1 / 60
        }
      }
      if (now - lastDraw > 33) {
        lastDraw = now
        setFrame((f) => f + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const g = group.current
  const stats = g.stats()
  const waiting = g.traffic.waiting.length

  return (
    <div className="grid h-full min-h-0 grid-cols-1 overflow-auto lg:grid-cols-[280px_1fr_340px] lg:overflow-hidden">
      {/* Controls */}
      <aside className="space-y-5 overflow-auto border-line bg-surface p-4 lg:border-r">
        <div>
          <h1 className="text-[17px] font-semibold text-ink">Group control</h1>
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-2">
            Several cars share the landing buttons. A dispatcher hands every hall call to exactly one car. Each car still runs its own controller.
          </p>
        </div>
        <div>
          <Label>Cars</Label>
          <Segmented value={cars} onChange={setCars} options={[2, 3, 4].map((n) => ({ value: n, label: `${n} cars` }))} />
        </div>
        <div>
          <Label>Dispatch strategy</Label>
          <div className="space-y-1.5">
            {STRATEGIES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStrategy(s.id)}
                className={clsx(
                  'w-full rounded-lg border p-2.5 text-left transition-colors',
                  strategy === s.id ? 'border-accent/50 bg-accent/[0.07]' : 'border-line bg-surface-2 hover:border-line-strong',
                )}
              >
                <div className={clsx('text-[13px] font-medium', strategy === s.id ? 'text-accent' : 'text-ink')}>{s.label}</div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-muted">{s.text}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label>Traffic</Label>
          <Segmented<TrafficProfile>
            size="sm"
            value={profile}
            onChange={setProfile}
            options={[
              { value: 'uniform', label: 'Uniform' },
              { value: 'up-peak', label: 'Morning' },
              { value: 'down-peak', label: 'Evening' },
              { value: 'lunch', label: 'Lunch' },
            ]}
          />
          <div className="mt-3 flex items-center gap-3">
            <input type="range" min={2} max={16} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="flex-1 accent-[var(--color-accent)]" aria-label="Arrivals per minute" />
            <span className="w-24 text-right font-mono text-[12px] text-ink">{rate} people/min</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn onClick={() => setPaused(!paused)}>
            {paused ? <Play size={12} /> : <Pause size={12} />} {paused ? 'Resume' : 'Pause'}
          </Btn>
          <Segmented size="sm" value={speed} onChange={setSpeed} options={[1, 2, 4, 8].map((v) => ({ value: v, label: `${v}×` }))} />
          <Btn onClick={() => setSeed(seed + 1)} title="Restart with the same traffic">
            <RotateCcw size={12} /> Restart
          </Btn>
        </div>
      </aside>

      {/* Monitor */}
      <section className="flex min-h-[520px] flex-col overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-4 py-2.5 text-[12.5px]">
          <Stat label="Time" value={fmtTime(g.time)} />
          <Stat label="Waiting now" value={String(waiting)} />
          <Stat label="Served" value={String(stats.served)} />
          <Stat label="Average wait" value={`${fmt(stats.avgWait, 1)} s`} strong />
          <Stat label="Longest wait" value={`${fmt(stats.maxWait, 0)} s`} />
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-4">
          <Monitor g={g} />
        </div>
      </section>

      {/* Dispatcher */}
      <aside className="flex min-h-0 flex-col border-line bg-surface lg:border-l">
        <div className="border-b border-line px-4 py-3">
          <div className="text-[13px] font-semibold text-ink">Dispatcher decisions</div>
          <div className="text-[12px] text-muted">Score per car, lower wins. Newest first.</div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2 py-1">
          {g.log.length === 0 && <p className="p-2 text-[12.5px] text-muted">Waiting for the first hall call.</p>}
          {[...g.log].reverse().slice(0, 40).map((d, i) => (
            <div key={`${d.t}-${i}`} className="border-b border-line/60 px-2 py-2">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[11px] text-faint">{fmtTime(d.t)}</span>
                <span className="font-mono text-[13px] text-lamp">
                  {d.floor}
                  {d.direction === 'UP' ? '▲' : '▼'}
                </span>
                <span className="text-[12.5px] text-ink">goes to car {carName(d.car)}</span>
              </div>
              <div className="mt-1 flex gap-1">
                {d.scores.map((s, c) => (
                  <span
                    key={c}
                    className={clsx(
                      'rounded px-1.5 py-0.5 font-mono text-[10.5px]',
                      c === d.car ? 'bg-accent/15 text-accent' : 'bg-surface-3 text-muted',
                    )}
                  >
                    {carName(c)} {s >= 100 ? (d.strategy === 'zoning' ? 'other zone' : '—') : fmt(s, 1)}
                  </span>
                ))}
              </div>
              <div className="mt-0.5 text-[11.5px] text-muted">{d.reason}</div>
            </div>
          ))}
        </div>
        <Comparison config={config} cars={cars} />
      </aside>
    </div>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted">{label}</span>
      <span className={clsx('font-mono', strong ? 'text-[15px] text-ink' : 'text-ink-2')}>{value}</span>
    </div>
  )
}

/** The lift-monitoring screen: one column per shaft, one row per floor. */
function Monitor({ g }: { g: GroupController }) {
  const floors = g.config.floors
  const row = Math.max(26, Math.min(44, Math.floor(560 / floors)))
  const gutter = 92
  const col = 92
  const gap = 18
  const width = gutter + g.cars.length * (col + gap)
  const height = floors * row + 54
  const yOf = (pos: number) => 34 + (floors - 1) * row - (pos / g.config.floorHeight) * row
  const waiting = g.traffic.waiting

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto block h-auto w-full" style={{ maxWidth: width * 1.15 }} role="img" aria-label="Group monitor">
      {Array.from({ length: floors }, (_, i) => {
        const f = i + 1
        const y = yOf((f - 1) * g.config.floorHeight)
        const here = waiting.filter((p) => p.origin === f)
        const up = here.filter((p) => p.destination > f).length
        const down = here.length - up
        return (
          <g key={f}>
            <line x1={gutter - 6} x2={width} y1={y + row} y2={y + row} stroke="#252a32" />
            <text x={10} y={y + row / 2 + 4} fontSize="12" fill="#878f9b" fontFamily="IBM Plex Mono">
              {f}
            </text>
            {/* waiting passengers, by direction */}
            {up > 0 && (
              <text x={30} y={y + row / 2 + 4} fontSize="11" fill="#ffb547" fontFamily="IBM Plex Mono">
                ▲{up}
              </text>
            )}
            {down > 0 && (
              <text x={58} y={y + row / 2 + 4} fontSize="11" fill="#ffb547" fontFamily="IBM Plex Mono">
                ▼{down}
              </text>
            )}
          </g>
        )
      })}
      {g.cars.map((c, i) => {
        const x = gutter + i * (col + gap)
        const y = yOf(c.motion.position)
        const state = c.sm.state
        const fill = state === 'EMERGENCY' ? '#f2545b' : c.doors.position > 0.05 ? '#4ade80' : '#3ad1e8'
        const riders = g.traffic.riders(i).length
        return (
          <g key={i}>
            <text x={x + col / 2} y={16} textAnchor="middle" fontSize="12" fill="#e8eaed" fontFamily="IBM Plex Sans" fontWeight={600}>
              Car {carName(i)}
            </text>
            <rect x={x} y={34} width={col} height={floors * row} rx={4} fill="#14171c" stroke="#252a32" />
            {/* promised stops */}
            {c.carCalls.map((cc) => (
              <circle key={`c${cc.floor}`} cx={x + 12} cy={yOf((cc.floor - 1) * g.config.floorHeight) + row / 2} r={3.5} fill="#3ad1e8" />
            ))}
            {c.hallCalls.map((h) => (
              <text key={`h${h.floor}${h.direction}`} x={x + col - 14} y={yOf((h.floor - 1) * g.config.floorHeight) + row / 2 + 4} fontSize="11" fill="#ffb547">
                {h.direction === 'UP' ? '▲' : '▼'}
              </text>
            ))}
            {/* the car */}
            <rect x={x + 22} y={y + 3} width={col - 44} height={row - 6} rx={3} fill={fill} fillOpacity={0.9} />
            <text x={x + col / 2} y={y + row / 2 + 4} textAnchor="middle" fontSize="11" fill="#0f1115" fontFamily="IBM Plex Mono" fontWeight={600}>
              {riders}/8
            </text>
            <text x={x + col / 2} y={height - 6} textAnchor="middle" fontSize="11" fill="#5e6672" fontFamily="IBM Plex Mono">
              {state === 'IDLE' ? 'idle' : state.startsWith('MOVING') ? (c.direction === 'UP' ? 'up' : 'down') : state.startsWith('DOOR') ? 'doors' : 'stop'}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

/** Headless comparison: one car vs. this group under each strategy, same passengers. */
function Comparison({ config, cars }: { config: Parameters<typeof runGroupBenchmark>[0]; cars: number }) {
  const [rows, setRows] = useState<{ label: string; wait: number; max: number }[] | null>(null)
  const [busy, setBusy] = useState(false)
  const run = () => {
    setBusy(true)
    setTimeout(() => {
      const single = runBenchmark(config, ['LOOK'])[0]
      const group = runGroupBenchmark(config, cars, ['nearest', 'eta', 'zoning'])
      setRows([
        { label: '1 car', wait: single.avgWait, max: single.maxWait },
        ...group.map((r) => ({ label: `${cars} cars, ${STRATEGIES.find((s) => s.id === r.strategy)!.label}`, wait: r.avgWait, max: r.maxWait })),
      ])
      setBusy(false)
    }, 20)
  }
  const max = rows ? Math.max(...rows.map((r) => r.wait)) : 1
  const best = rows ? Math.min(...rows.map((r) => r.wait)) : 0
  return (
    <div className="border-t border-line p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-semibold text-ink">Average wait, 10 minutes of the same traffic</div>
      </div>
      {rows ? (
        <div className="mt-3 space-y-2">
          {rows.map((r) => (
            <div key={r.label} title={`${r.label}: average ${fmt(r.wait, 1)} s, longest ${fmt(r.max, 0)} s`}>
              <div className="flex justify-between text-[11.5px]">
                <span className="text-ink-2">{r.label}</span>
                <span className={clsx('font-mono', r.wait === best ? 'text-ink' : 'text-muted')}>{fmt(r.wait, 1)} s</span>
              </div>
              <div className="mt-0.5 h-2 rounded-r-[4px] bg-surface-3">
                <div className={clsx('h-full rounded-r-[4px] bg-accent', r.wait !== best && 'opacity-50')} style={{ width: `${(r.wait / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[12px] text-muted">Runs the real engine headless for each option.</p>
      )}
      <Btn tone="accent" className="mt-3" onClick={run} disabled={busy}>
        {busy ? 'Running…' : rows ? 'Run again' : 'Compare strategies'}
      </Btn>
    </div>
  )
}
