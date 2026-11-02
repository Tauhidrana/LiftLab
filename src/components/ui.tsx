import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import type { ElevatorState, TraceCategory, TraceLevel } from '../engine/types'

export function Btn({
  active,
  tone = 'default',
  size = 'md',
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; tone?: 'default' | 'danger' | 'accent'; size?: 'sm' | 'md' }) {
  return (
    <button
      {...rest}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors select-none disabled:opacity-40',
        size === 'sm' ? 'h-6 px-2 text-[11px]' : 'h-8 px-3 text-xs',
        tone === 'danger'
          ? active
            ? 'border-danger bg-danger/25 text-white'
            : 'border-danger/40 bg-danger/10 text-danger hover:bg-danger/20'
          : active
            ? 'border-accent/60 bg-accent/12 text-accent'
            : tone === 'accent'
              ? 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
              : 'border-line-strong bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink',
        className,
      )}
    />
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
  size?: 'sm' | 'md'
}) {
  return (
    <div className="inline-flex rounded-md border border-line-strong bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={clsx(
            'rounded-[5px] font-medium transition-colors',
            size === 'sm' ? 'h-5 px-1.5 text-[11px]' : 'h-6 px-2 text-xs',
            value === o.value ? 'bg-surface-3 text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-muted hover:text-ink-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function PanelHeader({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-4">
      {icon && <span className="text-muted">{icon}</span>}
      <span className="text-[12px] font-semibold tracking-wide text-ink-2 uppercase">{title}</span>
      <div className="ml-auto flex items-center gap-1.5">{children}</div>
    </div>
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[12px] font-medium text-muted">{children}</div>
}

export function KV({ k, v, mono = true, tone }: { k: ReactNode; v: ReactNode; mono?: boolean; tone?: 'warn' | 'danger' | 'ok' | 'accent' }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-[3px]">
      <span className="text-muted">{k}</span>
      <span
        className={clsx(
          mono && 'font-mono text-[12px]',
          tone === 'warn' ? 'text-warn' : tone === 'danger' ? 'text-danger' : tone === 'ok' ? 'text-ok' : tone === 'accent' ? 'text-accent' : 'text-ink',
        )}
      >
        {v}
      </span>
    </div>
  )
}

export const STATE_TONE: Record<ElevatorState, string> = {
  IDLE: 'text-ink-2 border-line-strong bg-surface-3',
  MOVING_UP: 'text-accent border-accent/40 bg-accent/10',
  MOVING_DOWN: 'text-accent border-accent/40 bg-accent/10',
  DOOR_OPENING: 'text-ok border-ok/40 bg-ok/10',
  DOOR_OPEN: 'text-ok border-ok/40 bg-ok/10',
  DOOR_CLOSING: 'text-ok border-ok/40 bg-ok/10',
  EMERGENCY: 'text-danger border-danger/50 bg-danger/15',
}

export function StatePill({ state }: { state: ElevatorState }) {
  return (
    <span className={clsx('inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[10.5px] font-semibold tracking-wide', STATE_TONE[state])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {state.replace('_', ' ')}
    </span>
  )
}

export const CATEGORY_COLOR: Record<TraceCategory, string> = {
  input: '#e5e7eb',
  queue: '#a78bfa',
  scheduler: '#c084fc',
  controller: '#60a5fa',
  state: '#4c9aff',
  motor: '#f5a524',
  brake: '#fb923c',
  motion: '#94a3b8',
  sensor: '#34d399',
  door: '#86efac',
  safety: '#f43f5e',
  traffic: '#cbd5e1',
}

export function CategoryTag({ category, level }: { category: TraceCategory; level?: TraceLevel }) {
  const c = level === 'danger' ? '#f43f5e' : level === 'warn' ? '#f5a524' : CATEGORY_COLOR[category]
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-2">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
      {category}
    </span>
  )
}

export function Dot({ on, tone = 'accent' }: { on: boolean; tone?: 'accent' | 'ok' | 'warn' | 'danger' }) {
  const col = { accent: 'bg-accent', ok: 'bg-ok', warn: 'bg-warn', danger: 'bg-danger' }[tone]
  return <span className={clsx('inline-block h-2 w-2 rounded-full', on ? col : 'bg-line-strong')} />
}
