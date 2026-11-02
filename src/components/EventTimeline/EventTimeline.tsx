import clsx from 'clsx'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { TraceCategory } from '../../engine/types'
import { useLab } from '../../store/useLab'
import { fmtTime } from '../../utils/format'
import { CATEGORY_COLOR } from '../ui'
import { useInspectedEvent } from '../CodeInspector/CodeInspector'
import { useMsg, useT } from '../../i18n'
import { fnLabel } from '../../engine/sources'

const FILTERS: { id: 'all' | TraceCategory | 'issues'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'input', label: 'Input' },
  { id: 'queue', label: 'Queue' },
  { id: 'state', label: 'State' },
  { id: 'motor', label: 'Motor' },
  { id: 'door', label: 'Door' },
  { id: 'sensor', label: 'Sensor' },
  { id: 'issues', label: 'Warnings' },
]

/** Live event log with timestamps. Click a row to inspect it. */
export function EventTimeline() {
  const events = useLab((s) => s.events)
  const debug = useLab((s) => s.debug)
  const select = useLab((s) => s.selectEvent)
  const current = useInspectedEvent()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const box = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const t = useT()
  const msg = useMsg()
  const codeLang = useLab((s) => s.codeLang)

  const rows = useMemo(
    () =>
      events.filter((e) => {
        if (!debug && e.level === 'verbose') return false
        if (filter === 'all') return true
        if (filter === 'issues') return e.level === 'warn' || e.level === 'danger'
        if (filter === 'motor') return e.category === 'motor' || e.category === 'brake' || e.category === 'motion'
        return e.category === filter
      }),
    [events, debug, filter],
  )

  useEffect(() => {
    if (stick.current && box.current) box.current.scrollTop = box.current.scrollHeight
  }, [rows])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={clsx('h-5 rounded px-1.5 text-[11px]', filter === f.id ? 'bg-surface-3 text-ink' : 'text-muted hover:text-ink-2')}
          >
            {t(f.label)}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] text-faint">{t('{n} events', { n: rows.length })}{debug ? ` · ${t('verbose on')}` : ''}</span>
      </div>
      <div
        ref={box}
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24
        }}
        className="min-h-0 flex-1 overflow-auto font-mono text-[11.5px]"
      >
        <table className="w-full table-fixed border-collapse">
          <tbody>
            {rows.map((e) => (
              <tr
                key={e.id}
                onClick={() => select(e.id)}
                className={clsx(
                  'cursor-pointer border-b border-line/50',
                  e.id === current?.id ? 'bg-accent/10' : 'hover:bg-surface-2',
                  e.level === 'verbose' && 'opacity-60',
                )}
              >
                <td className="w-[86px] py-[3px] pl-3 text-faint tabular-nums">{fmtTime(e.t)}</td>
                <td className="w-[18px]">
                  <span
                    className="block h-1.5 w-1.5 rounded-full"
                    style={{ background: e.level === 'danger' ? '#f43f5e' : e.level === 'warn' ? '#f5a524' : CATEGORY_COLOR[e.category] }}
                  />
                </td>
                <td className={clsx('w-[220px] truncate pr-2', e.level === 'danger' ? 'text-danger' : e.level === 'warn' ? 'text-warn' : 'text-ink')}>
                  {e.event}
                </td>
                <td className="w-[250px] truncate pr-2 text-[#82aaff]">{fnLabel(e.fn, codeLang)}</td>
                <td className="truncate pr-3 font-sans text-[12px] text-ink-2" title={msg(e.message)}>
                  {msg(e.message)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
