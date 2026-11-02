import clsx from 'clsx'
import { Play } from 'lucide-react'
import { useEffect, useState } from 'react'
import { runBenchmark, type BenchmarkResult } from '../engine/benchmark'
import type { Algorithm, TrafficProfile } from '../engine/types'
import { Btn, Label, Segmented } from '../components/ui'
import { useLab } from '../store/useLab'
import { useT } from '../i18n'
import { fmt } from '../utils/format'

const ALGOS: { id: Algorithm; name: string; idea: string; good: string; bad: string; code: string }[] = [
  {
    id: 'FCFS',
    name: 'First-Come, First-Served',
    idea: 'Serve requests strictly in the order they arrived.',
    good: 'Perfectly fair ordering, trivial to implement.',
    bad: 'Zig-zags across the building, passing floors where people wait. Long waits and high energy.',
    code: 'oldest = requests.sortBy(time)[0]\nreturn oldest.floor',
  },
  {
    id: 'SSTF',
    name: 'Shortest Seek Time First',
    idea: 'Always go to the closest pending request.',
    good: 'Low average wait when traffic is light.',
    bad: 'Can starve far-away floors: a busy cluster keeps the car nearby.',
    code: 'return requests.minBy(r => |r.floor − position|).floor',
  },
  {
    id: 'SCAN',
    name: 'SCAN (elevator algorithm)',
    idea: 'Sweep to the end of the shaft in one direction, serving everything on the way, then reverse.',
    good: 'No starvation; every floor is visited within one round trip.',
    bad: 'Travels to the end floor even if nobody is there.',
    code: 'ahead = requests above (if UP)\nif ahead: return nearest(ahead)\nif not at end: return endFloor\nreverse()',
  },
  {
    id: 'LOOK',
    name: 'LOOK + collective control',
    idea: 'Like SCAN, but turn around at the last request. Stop only for car calls and hall calls going your way.',
    good: 'What real single-car controllers do: short rides, few wasted stops.',
    bad: 'A hall call in the opposite direction waits until the car turns around.',
    code: 'sameWay = carCalls ahead ∪ hallCalls ahead with dir = travel\nif sameWay: return nearest(sameWay)\nif any ahead: return farthest (turnaround)\nreverse()',
  },
]

const METRICS: { key: keyof BenchmarkResult; label: string; unit: string; digits: number; lowerBetter: boolean }[] = [
  { key: 'avgWait', label: 'Average wait', unit: 's', digits: 1, lowerBetter: true },
  { key: 'maxWait', label: 'Longest wait', unit: 's', digits: 0, lowerBetter: true },
  { key: 'avgRide', label: 'Average ride', unit: 's', digits: 1, lowerBetter: true },
  { key: 'distance', label: 'Distance travelled', unit: 'm', digits: 0, lowerBetter: true },
  { key: 'energyWh', label: 'Net energy', unit: 'Wh', digits: 1, lowerBetter: true },
]

export function AlgorithmsPage() {
  const config = useLab((s) => s.config)
  const setAlgorithm = useLab((s) => s.setAlgorithm)
  const setPage = useLab((s) => s.setPage)
  const [profile, setProfile] = useState<TrafficProfile>('uniform')
  const [rate, setRate] = useState(5)
  const [seed, setSeed] = useState(42)
  const [results, setResults] = useState<BenchmarkResult[] | null>(null)
  const [running, setRunning] = useState(false)
  const [tip, setTip] = useState<string | null>(null)
  const t = useT()

  const run = () => {
    setRunning(true)
    setTimeout(() => {
      setResults(runBenchmark({ ...config, trafficProfile: profile, trafficRate: rate, seed }, ['FCFS', 'SSTF', 'SCAN', 'LOOK']))
      setRunning(false)
    }, 20)
  }
  useEffect(run, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-[1180px] px-6 py-6">
        <h1 className="text-[20px] font-semibold text-ink">{t('Scheduling algorithms')}</h1>
        <p className="mt-1 max-w-[760px] text-[13px] leading-relaxed text-ink-2">
          {t('The scheduler answers one question, over and over: “given every pending request and where the car is, which floor next?” Below, the real engine runs the same 10 minutes of seeded passenger traffic through each algorithm, headless, at thousands of times real speed.')}
        </p>

        <div className="mt-5 flex flex-wrap items-end gap-5 rounded-lg border border-line bg-surface p-3">
          <div>
            <Label>Traffic pattern</Label>
            <Segmented<TrafficProfile>
              value={profile}
              onChange={setProfile}
              options={[
                { value: 'uniform', label: t('Uniform') },
                { value: 'up-peak', label: t('Morning up-peak') },
                { value: 'down-peak', label: t('Evening down-peak') },
                { value: 'lunch', label: t('Lunch') },
              ]}
            />
          </div>
          <div>
            <Label>{`${t('Arrivals')} · ${rate}/min`}</Label>
            <input type="range" min={1} max={10} value={rate} onChange={(e) => setRate(Number(e.target.value))} className="w-40 accent-[var(--color-accent)]" />
          </div>
          <div>
            <Label>Seed</Label>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 0)}
              className="h-7 w-20 rounded-md border border-line-strong bg-surface-2 px-2 font-mono text-[12px] text-ink"
            />
          </div>
          <Btn tone="accent" onClick={run} disabled={running}>
            <Play size={12} /> {t(running ? 'Running…' : 'Run comparison')}
          </Btn>
          {results && <span className="font-mono text-[11px] text-muted">{t('{n} passengers · same arrivals for every algorithm', { n: results[0].passengers })}</span>}
        </div>

        {results && (
          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            {METRICS.map((m) => {
              const vals = results.map((r) => r[m.key] as number)
              const max = Math.max(...vals, 1e-9)
              const best = m.lowerBetter ? Math.min(...vals) : Math.max(...vals)
              return (
                <div key={m.key} className="rounded-lg border border-line bg-surface p-3">
                  <div className="text-[12px] font-medium text-ink">{t(m.label)}</div>
                  <div className="mb-2 font-mono text-[10px] text-faint">{m.unit} · {t('lower is better')}</div>
                  <div className="space-y-1.5">
                    {results.map((r) => {
                      const v = r[m.key] as number
                      return (
                        <div
                          key={r.algorithm}
                          className="group flex items-center gap-2"
                          onMouseEnter={() => setTip(`${r.algorithm} · ${t(m.label)}: ${fmt(v, m.digits)} ${m.unit}`)}
                          onMouseLeave={() => setTip(null)}
                        >
                          <span className="w-10 font-mono text-[10.5px] text-ink-2">{r.algorithm}</span>
                          <div className="h-3 flex-1">
                            <div
                              className={clsx('h-full rounded-r-[4px] transition-all group-hover:opacity-100', v === best ? 'opacity-100' : 'opacity-55')}
                              style={{ width: `${Math.max(2, (v / max) * 100)}%`, background: '#4c9aff' }}
                            />
                          </div>
                          <span className={clsx('w-12 text-right font-mono text-[10.5px]', v === best ? 'text-ink' : 'text-muted')}>{fmt(v, m.digits)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
        <div className="mt-1 h-4 font-mono text-[11px] text-ink-2">{tip}</div>

        {results && (
          <details className="mt-1 rounded-lg border border-line bg-surface">
            <summary className="cursor-pointer px-3 py-2 text-[12px] text-ink-2">{t('Table view')}</summary>
            <table className="w-full font-mono text-[11.5px]">
              <thead className="text-faint">
                <tr className="border-y border-line">
                  {['Algorithm', 'Served', 'Avg wait', 'Max wait', 'Avg ride', 'Avg journey', 'Distance', 'Trips', 'Net energy'].map((h) => (
                    <th key={h} className="px-3 py-1.5 text-left font-normal">
                      {t(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.algorithm} className="border-b border-line/60 text-ink-2">
                    <td className="px-3 py-1.5 text-ink">{r.algorithm}</td>
                    <td className="px-3">
                      {r.served}/{r.passengers}
                    </td>
                    <td className="px-3">{fmt(r.avgWait, 1)} s</td>
                    <td className="px-3">{fmt(r.maxWait, 0)} s</td>
                    <td className="px-3">{fmt(r.avgRide, 1)} s</td>
                    <td className="px-3">{fmt(r.avgJourney, 1)} s</td>
                    <td className="px-3">{fmt(r.distance, 0)} m</td>
                    <td className="px-3">{r.trips}</td>
                    <td className="px-3">{fmt(r.energyWh, 1)} Wh</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
          {ALGOS.map((a) => (
            <div key={a.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-[13px] font-semibold text-accent">{a.id}</span>
                <span className="text-[13px] text-ink">{t(a.name)}</span>
                {config.algorithm === a.id && <span className="ml-auto font-mono text-[10px] text-ok">{t('ACTIVE IN SIMULATION')}</span>}
              </div>
              <p className="mt-1.5 text-[12.5px] text-ink-2">{t(a.idea)}</p>
              <pre className="mt-2 overflow-auto rounded border border-line bg-[#0d1014] p-2 font-mono text-[11.5px] leading-relaxed text-ink-2">{a.code}</pre>
              <div className="mt-2 grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <span className="text-ok">+ </span>
                  <span className="text-ink-2">{t(a.good)}</span>
                </div>
                <div>
                  <span className="text-warn">− </span>
                  <span className="text-ink-2">{t(a.bad)}</span>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Btn
                  size="sm"
                  onClick={() => {
                    setAlgorithm(a.id)
                    setPage('simulation')
                  }}
                >
                  {t('Use in live simulation')}
                </Btn>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-[12px] text-muted">
          {t('Source')}: <span className="font-mono text-ink-2">RequestScheduler.selectNext()</span>. {t('Open it in the Code Inspector. Large buildings use group control across many cars: see the Group control page.')}
        </p>
      </div>
    </div>
  )
}
