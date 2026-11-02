import clsx from 'clsx'
import { Code2, Pin, Radio } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { FILES_BY_LANG, fnLabel, MARKERS_BY_LANG, SOURCE_LINES, type SourceFile } from '../../engine/sources'
import { useMsg, useT } from '../../i18n'
import type { TraceEvent } from '../../engine/types'
import { useLab } from '../../store/useLab'
import { fmt, fmtTime } from '../../utils/format'
import { tokenize, type Token } from '../../utils/highlight'
import { Btn, CategoryTag, PanelHeader, Segmented } from '../ui'

/** The event the inspector is showing: the pinned one, or the latest one live. */
export function useInspectedEvent(): TraceEvent | null {
  const events = useLab((s) => s.events)
  const selected = useLab((s) => s.selectedEventId)
  const debug = useLab((s) => s.debug)
  return useMemo(() => {
    if (selected !== null) return events.find((e) => e.id === selected) ?? null
    for (let i = events.length - 1; i >= 0; i--) if (debug || events[i].level !== 'verbose') return events[i]
    return null
  }, [events, selected, debug])
}

export function CodeInspector() {
  const ev = useInspectedEvent()
  const pinned = useLab((s) => s.selectedEventId !== null)
  const stepMode = useLab((s) => s.stepMode)
  const selectEvent = useLab((s) => s.selectEvent)
  const codeLang = useLab((s) => s.codeLang)
  const setCodeLang = useLab((s) => s.setCodeLang)
  const t = useT()

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <PanelHeader title={t('Code Inspector')} icon={<Code2 size={14} />}>
        <Segmented
          size="sm"
          value={codeLang}
          onChange={setCodeLang}
          options={[
            { value: 'python', label: 'Python', title: t('Easy-to-read Python version of the same logic') },
            { value: 'typescript', label: 'TypeScript', title: t('The real code running in your browser') },
          ]}
        />
        {pinned && !stepMode ? (
          <Btn size="sm" onClick={() => selectEvent(null)} title={t('Resume following the live simulation')}>
            <Pin size={11} /> {t('Pinned · follow live')}
          </Btn>
        ) : (
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-accent">
            <Radio size={11} className={stepMode ? '' : 'animate-pulse'} /> {t(stepMode ? 'STEP MODE' : 'LIVE')}
          </span>
        )}
      </PanelHeader>
      {ev ? (
        <>
          <EventCard ev={ev} />
          <ExecutionOrder ev={ev} />
          <CodeView ev={ev} />
        </>
      ) : (
        <div className="p-6 text-muted">{t('Press a floor button to see the controller at work.')}</div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_1fr] gap-2 py-[3px]">
      <span className="text-[12px] text-faint">{label}</span>
      <div className="min-w-0 font-mono text-[12px] text-ink">{children}</div>
    </div>
  )
}

function EventCard({ ev }: { ev: TraceEvent }) {
  const { ctx } = ev
  const t = useT()
  const msg = useMsg()
  const codeLang = useLab((s) => s.codeLang)
  const tone = ev.level === 'danger' ? 'text-danger' : ev.level === 'warn' ? 'text-warn' : 'text-ink'
  return (
    <div key={ev.id} className="flash shrink-0 border-b border-line px-3 py-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        <CategoryTag category={ev.category} level={ev.level} />
        <span className="ml-auto font-mono text-[10px] text-faint">
          #{ev.id} · t={fmtTime(ev.t)}
        </span>
      </div>
      <Row label={t('Event')}>
        <span className={clsx('font-semibold', tone)}>{ev.event}</span>
      </Row>
      <Row label={t('Function')}>
        <span className="text-[#82aaff]">{fnLabel(ev.fn, codeLang)}()</span>
      </Row>
      {ev.inputs && (
        <Row label={t('Input')}>
          <div className="space-y-0.5">
            {Object.entries(ev.inputs).map(([k, v]) => (
              <div key={k} className="break-words">
                <span className="text-ink-2">{k}</span> <span className="text-faint">=</span>{' '}
                <span className="text-[#f78c6c]">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
              </div>
            ))}
          </div>
        </Row>
      )}
      <Row label={t('System')}>
        <span className="font-sans text-[12.5px] text-ink">{msg(ev.message)}</span>
      </Row>
      {ev.change && (
        <Row label={t(ev.change.field === 'elevatorState' ? 'Transition' : 'Changed')}>
          <span className="text-ink-2">{ev.change.field}: </span>
          <span className="text-muted line-through decoration-faint">{ev.change.from}</span>
          <span className="text-faint"> → </span>
          <span className="text-accent">{ev.change.to}</span>
        </Row>
      )}
      <div className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line">
        {[
          ['Floor', ctx.floor],
          ['Target', ctx.target ?? '—'],
          ['Direction', ctx.direction],
          ['Motor', ctx.motor],
          ['Brake', ctx.brake],
          ['Door', ctx.door],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface-2 px-2 py-1">
            <div className="text-[10.5px] text-faint">{t(String(k))}</div>
            <div className="font-mono text-[11.5px] text-ink">{String(v)}</div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px]">
        <span className="text-faint">requestQueue</span>
        <span className="text-ink-2">[{ctx.queue.join(', ')}]</span>
        <span className="ml-auto text-faint">{fmt(ctx.position)} m</span>
      </div>
      {ev.explain && <p className="mt-2 border-l-2 border-accent/50 pl-2 text-[12px] leading-relaxed text-ink-2">{msg(ev.explain)}</p>}
    </div>
  )
}

/** All events triggered by the same cause, in the order they executed. */
function ExecutionOrder({ ev }: { ev: TraceEvent }) {
  const events = useLab((s) => s.events)
  const debug = useLab((s) => s.debug)
  const select = useLab((s) => s.selectEvent)
  const codeLang = useLab((s) => s.codeLang)
  const t = useT()
  const msg = useMsg()
  const chain = useMemo(
    () => events.filter((e) => e.chain === ev.chain && (debug || e.level !== 'verbose')).slice(0, 14),
    [events, ev.chain, debug],
  )
  return (
    <div className="shrink-0 border-b border-line px-3 py-2">
      <div className="mb-1 flex items-center gap-2 text-[12px] text-faint">
        {t('Execution order')} <span className="text-muted">— {t('caused by')} “{msg(ev.chainLabel)}”</span>
      </div>
      <ol className="max-h-[132px] space-y-px overflow-auto">
        {chain.map((e, i) => (
          <li key={e.id}>
            <button
              onClick={() => select(e.id)}
              className={clsx(
                'flex w-full items-center gap-2 rounded px-1.5 py-[2px] text-left font-mono text-[11px]',
                e.id === ev.id ? 'bg-accent/12 text-accent' : 'text-ink-2 hover:bg-surface-3',
              )}
            >
              <span className="w-4 text-right text-faint">{i + 1}</span>
              <span className="truncate">{fnLabel(e.fn, codeLang)}()</span>
              <span className="ml-auto shrink-0 text-[10px] text-faint">{e.event}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

function CodeView({ ev }: { ev: TraceEvent }) {
  const codeLang = useLab((s) => s.codeLang)
  const t = useT()
  const FILES = FILES_BY_LANG[codeLang]
  const loc = MARKERS_BY_LANG[codeLang][ev.marker]
  const [file, setFile] = useState<SourceFile>(loc?.file ?? FILES[0])
  const scroller = useRef<HTMLDivElement>(null)

  // Follow the executing line into its file.
  useEffect(() => {
    setFile((cur) => loc?.file ?? (FILES.includes(cur) ? cur : FILES[0]))
  }, [loc, FILES])

  const shown = FILES.includes(file) ? file : FILES[0]
  const tokens = useMemo(() => SOURCE_LINES[shown].map((l) => tokenize(l, codeLang)), [shown, codeLang])
  const active = loc && loc.file === shown ? loc : null

  useEffect(() => {
    if (!active || !scroller.current) return
    const el = scroller.current.querySelector<HTMLElement>(`[data-line="${active.line}"]`)
    if (!el) return
    const box = scroller.current
    const target = el.offsetTop - box.clientHeight * 0.35
    box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  }, [active, ev.id])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-line px-1.5 [scrollbar-width:none]">
        {FILES.map((f) => (
          <button
            key={f}
            onClick={() => setFile(f)}
            className={clsx(
              'relative h-8 shrink-0 px-2 font-mono text-[11px] whitespace-nowrap transition-colors',
              f === shown ? 'text-ink' : 'text-faint hover:text-ink-2',
            )}
          >
            {f.replace(/\.(ts|py)$/, '')}
            {loc?.file === f && <span className="absolute top-1.5 right-0.5 h-1 w-1 rounded-full bg-accent" />}
            {f === shown && <span className="absolute inset-x-1 bottom-0 h-px bg-accent" />}
          </button>
        ))}
      </div>
      {active && (
        <div className="flex shrink-0 items-center gap-2 border-b border-line bg-surface-2 px-3 py-1 font-mono text-[11px]">
          <span className="text-faint">{t('executing')}</span>
          <span className="text-[#82aaff]">{active.fnName}()</span>
          <span className="ml-auto text-faint">
            {shown}:{active.line + 1}
          </span>
        </div>
      )}
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto bg-[#0d1014] py-1 font-mono text-[11.5px] leading-[18px]">
        {tokens.map((t, i) => (
          <CodeLine
            key={i}
            n={i}
            tokens={t}
            mode={active ? (i === active.line ? 'exec' : i >= active.fnStart && i <= active.fnEnd ? 'fn' : 'dim') : null}
          />
        ))}
      </div>
    </div>
  )
}

const CodeLine = memo(function CodeLine({ n, tokens, mode }: { n: number; tokens: Token[]; mode: 'exec' | 'fn' | 'dim' | null }) {
  return (
    <div
      data-line={n}
      className={clsx(
        'flex min-w-max pr-4',
        mode === 'exec' && 'bg-accent/15 shadow-[inset_2px_0_0_var(--color-accent)]',
        mode === 'fn' && 'bg-white/[0.025]',
        mode === 'dim' && 'opacity-55',
      )}
    >
      <span className={clsx('w-10 shrink-0 pr-3 text-right select-none', mode === 'exec' ? 'text-accent' : 'text-[#3b434e]')}>{n + 1}</span>
      <span className="whitespace-pre">
        {tokens.map((t, i) => (
          <span key={i} className={t.cls}>
            {t.text}
          </span>
        ))}
      </span>
    </div>
  )
})
