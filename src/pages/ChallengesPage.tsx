import clsx from 'clsx'
import { Check, Play, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { CHALLENGES, STARTER_CODE } from '../challenge/challenges'
import type { BenchmarkResult } from '../engine/benchmark'
import type { CustomSelect } from '../engine/RequestScheduler'
import { Btn } from '../components/ui'
import { useLab } from '../store/useLab'
import { fmt } from '../utils/format'
import { tokenize } from '../utils/highlight'

type Outcome = { mine: BenchmarkResult; refs: BenchmarkResult[] } | { error: string }

const TIME_LIMIT_MS = 8000
const storageKey = (id: string) => `liftlab.challenge.${id}`
const load = (id: string) => {
  try {
    return localStorage.getItem(storageKey(id)) ?? STARTER_CODE
  } catch {
    return STARTER_CODE
  }
}

export function ChallengesPage() {
  const [active, setActive] = useState(CHALLENGES[0].id)
  const ch = CHALLENGES.find((c) => c.id === active)!
  const [code, setCode] = useState(() => load(active))
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [running, setRunning] = useState(false)
  const [solved, setSolved] = useState<Record<string, boolean>>({})
  const loadCustom = useLab((s) => s.loadCustomScheduler)
  const setPage = useLab((s) => s.setPage)

  useEffect(() => {
    setCode(load(active))
    setOutcome(null)
  }, [active])
  useEffect(() => {
    try {
      localStorage.setItem(storageKey(active), code)
    } catch {
      /* storage unavailable: the code simply is not remembered */
    }
  }, [code, active])

  const run = () => {
    setRunning(true)
    setOutcome(null)
    const worker = new Worker(new URL('../challenge/challenge.worker.ts', import.meta.url), { type: 'module' })
    const timer = setTimeout(() => {
      worker.terminate()
      setRunning(false)
      setOutcome({ error: `Stopped after ${TIME_LIMIT_MS / 1000} s. Does selectNext() contain an endless loop?` })
    }, TIME_LIMIT_MS)
    worker.onmessage = (e: MessageEvent<Outcome>) => {
      clearTimeout(timer)
      worker.terminate()
      setRunning(false)
      setOutcome(e.data)
      if ('mine' in e.data) {
        const fail = e.data.mine.error ?? ch.check(e.data.mine, e.data.refs)
        setSolved((s) => ({ ...s, [ch.id]: !fail }))
      }
    }
    worker.onerror = (e) => {
      clearTimeout(timer)
      worker.terminate()
      setRunning(false)
      setOutcome({ error: e.message })
    }
    worker.postMessage({ code, challengeId: ch.id })
  }

  const failure = outcome && 'mine' in outcome ? (outcome.mine.error ?? ch.check(outcome.mine, outcome.refs)) : null
  const passed = outcome && 'mine' in outcome && !failure

  const tryInLab = () => {
    const fn = new Function(`"use strict";\n${code}\n;return selectNext`)() as CustomSelect
    loadCustom(fn)
    setPage('simulation')
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-1 overflow-auto lg:grid-cols-[300px_1fr] lg:overflow-hidden">
      <nav className="border-line bg-surface p-3 lg:overflow-auto lg:border-r">
        <h1 className="px-1 text-[17px] font-semibold text-ink">Challenges</h1>
        <p className="mt-1 px-1 text-[12.5px] leading-relaxed text-ink-2">
          Write the scheduler yourself. Your function runs inside the real engine against the same passengers as the built-in algorithms.
        </p>
        <ol className="mt-4 space-y-1">
          {CHALLENGES.map((c, i) => (
            <li key={c.id}>
              <button
                onClick={() => setActive(c.id)}
                className={clsx(
                  'flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left',
                  c.id === active ? 'bg-accent/10' : 'hover:bg-surface-3',
                )}
              >
                <span
                  className={clsx(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]',
                    solved[c.id] ? 'border-ok bg-ok/15 text-ok' : 'border-line-strong text-muted',
                  )}
                >
                  {solved[c.id] ? <Check size={11} /> : i + 1}
                </span>
                <span>
                  <span className={clsx('block text-[13px]', c.id === active ? 'text-accent' : 'text-ink')}>{c.title}</span>
                  <span className="block text-[11.5px] text-muted">{c.goal}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <section className="grid min-h-0 grid-rows-[auto_minmax(240px,1fr)_auto] overflow-hidden">
        <header className="border-b border-line px-5 py-4">
          <h2 className="text-[18px] font-semibold text-ink">{ch.title}</h2>
          <p className="mt-1 max-w-[720px] text-[13.5px] leading-relaxed text-ink-2">{ch.brief}</p>
          <details className="mt-1.5 text-[12.5px] text-muted">
            <summary className="cursor-pointer select-none hover:text-ink-2">Show a hint</summary>
            <p className="mt-1 text-ink-2">{ch.hint}</p>
          </details>
        </header>

        <div className="min-h-0 overflow-hidden">
          <CodeEditor value={code} onChange={setCode} onRun={run} />
        </div>

        <footer className="max-h-[48vh] overflow-auto border-t border-line bg-surface px-5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <Btn tone="accent" onClick={run} disabled={running}>
              <Play size={12} /> {running ? 'Running…' : 'Run tests'}
            </Btn>
            <span className="text-[11.5px] text-muted">Ctrl/⌘ + Enter</span>
            <Btn onClick={() => setCode(STARTER_CODE)} title="Replace your code with the starter code" className="ml-auto">
              <RotateCcw size={12} /> Reset code
            </Btn>
            {passed && (
              <Btn onClick={tryInLab} title="Use your scheduler in the 3D simulation">
                Watch it in the 3D lab
              </Btn>
            )}
          </div>
          {outcome && <Results outcome={outcome} failure={failure} />}
        </footer>
      </section>
    </div>
  )
}

function Results({ outcome, failure }: { outcome: Outcome; failure: string | null }) {
  if ('error' in outcome) {
    return <div className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-[12px] text-danger">{outcome.error}</div>
  }
  const rows = [{ ...outcome.mine, label: 'Your code' }, ...outcome.refs.map((r) => ({ ...r, label: r.algorithm }))]
  return (
    <div className="mt-3">
      <div
        className={clsx(
          'flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px]',
          failure ? 'border-warn/40 bg-warn/10 text-warn' : 'border-ok/40 bg-ok/10 text-ok',
        )}
      >
        {failure ? <X size={14} /> : <Check size={14} />}
        {failure ? `Not yet: ${failure}.` : 'Passed. Your scheduler meets the goal.'}
      </div>
      <table className="mt-2 w-full text-left font-mono text-[12px]">
        <thead className="text-faint">
          <tr>
            {['', 'Delivered', 'Average wait', 'Longest wait', 'Average ride', 'Distance', 'Net energy'].map((h) => (
              <th key={h} className="py-1 pr-4 font-sans text-[11.5px] font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className={clsx('border-t border-line/60', r.label === 'Your code' ? 'text-ink' : 'text-muted')}>
              <td className="py-1 pr-4 font-sans">{r.label}</td>
              <td className="pr-4">
                {r.served}/{r.passengers}
              </td>
              <td className="pr-4">{fmt(r.avgWait, 1)} s</td>
              <td className="pr-4">{fmt(r.maxWait, 0)} s</td>
              <td className="pr-4">{fmt(r.avgRide, 1)} s</td>
              <td className="pr-4">{fmt(r.distance, 0)} m</td>
              <td className="pr-4">{fmt(r.energyWh, 1)} Wh</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** A light code editor: a transparent textarea over syntax-highlighted text. */
function CodeEditor({ value, onChange, onRun }: { value: string; onChange: (v: string) => void; onRun: () => void }) {
  const pre = useRef<HTMLPreElement>(null)
  const lines = useMemo(() => value.split('\n').map(tokenize), [value])
  const shared = 'm-0 p-4 pl-14 font-mono text-[13px] leading-[21px] whitespace-pre'
  return (
    <div className="relative h-full bg-[#0d1014]">
      <pre ref={pre} aria-hidden className={clsx(shared, 'pointer-events-none absolute inset-0 overflow-hidden text-ink-2')}>
        {lines.map((toks, i) => (
          <div key={i} className="relative">
            <span className="absolute -left-10 w-7 text-right text-[#3b434e] select-none">{i + 1}</span>
            {toks.map((t, j) => (
              <span key={j} className={t.cls}>
                {t.text}
              </span>
            ))}
            {toks.length === 0 && ' '}
          </div>
        ))}
      </pre>
      <textarea
        aria-label="Your scheduler code"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={(e) => {
          if (pre.current) {
            pre.current.scrollTop = e.currentTarget.scrollTop
            pre.current.scrollLeft = e.currentTarget.scrollLeft
          }
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            onRun()
          } else if (e.key === 'Tab') {
            e.preventDefault()
            const el = e.currentTarget
            const { selectionStart: a, selectionEnd: b } = el
            const next = value.slice(0, a) + '  ' + value.slice(b)
            onChange(next)
            requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2))
          }
        }}
        className={clsx(shared, 'absolute inset-0 h-full w-full resize-none overflow-auto bg-transparent text-transparent caret-accent outline-none selection:bg-accent/25')}
      />
    </div>
  )
}
