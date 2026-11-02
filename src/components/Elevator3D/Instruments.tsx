import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { useLab } from '../../store/useLab'
import { fmt } from '../../utils/format'
import { StatePill } from '../ui'

/**
 * The hall lantern: the amber dot-matrix floor display found above every lift door.
 * It is the one loud element of the interface — everything else stays quiet.
 */
export function HallLantern({ size = 'lg' }: { size?: 'lg' | 'sm' }) {
  const s = useLab(
    useShallow((st) => ({
      floor: st.snapshot.currentFloor,
      dir: st.snapshot.direction,
      state: st.snapshot.state,
      v: st.snapshot.velocity,
      door: st.snapshot.doorStatus,
      target: st.snapshot.targetFloor,
      emergency: st.snapshot.emergency,
      moving: st.snapshot.velocity !== 0,
    })),
  )
  const em = s.state === 'EMERGENCY'
  const big = size === 'lg'
  return (
    <div className="pointer-events-auto flex items-stretch overflow-hidden rounded-lg border border-line-strong bg-surface/90 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.8)] backdrop-blur-sm">
      <div
        className={clsx(
          'relative flex items-center gap-2 bg-[#0a0907] font-dot leading-none tabular-nums',
          big ? 'px-4 py-2 text-[52px]' : 'px-2.5 py-1 text-[30px]',
          em ? 'text-danger' : 'text-lamp',
        )}
        style={{ textShadow: em ? '0 0 14px rgba(242,84,91,0.55)' : '0 0 14px rgba(255,181,71,0.45)' }}
        aria-label={`Car at floor ${s.floor}${s.dir !== 'NONE' ? `, going ${s.dir.toLowerCase()}` : ''}`}
      >
        <Arrow dir={s.dir} moving={s.moving} big={big} />
        <span className="min-w-[1.1ch] text-center font-black">{s.floor}</span>
      </div>
      {big && (
        <div className="flex min-w-[190px] flex-col justify-center gap-1 px-3 py-2">
          <StatePill state={s.state} />
          <div className="font-mono text-[11px] text-muted">
            {fmt(Math.abs(s.v))} m/s{s.target ? `, heading to ${s.target}` : ''}
          </div>
          <div className="text-[11.5px] text-ink-2">{em ? <span className="text-danger">{s.emergency?.reason}</span> : doorText(s.door)}</div>
        </div>
      )}
    </div>
  )
}

const doorText = (d: string) => ({ CLOSED: 'Doors closed and locked', OPENING: 'Doors opening', OPEN: 'Doors open', CLOSING: 'Doors closing' })[d] ?? d

function Arrow({ dir, moving, big }: { dir: string; moving: boolean; big: boolean }) {
  const px = big ? 22 : 13
  if (dir === 'NONE') return <span style={{ width: px }} />
  return (
    <svg width={px} height={px} viewBox="0 0 10 10" className={clsx(moving && 'animate-pulse')} aria-hidden>
      {/* dot-matrix arrow, drawn from 1×1 cells */}
      {(dir === 'UP' ? ARROW : [...ARROW].map(([x, y]) => [x, 9 - y])).map(([x, y]) => (
        <rect key={`${x}${y}`} x={x} y={y} width={0.86} height={0.86} rx={0.43} fill="currentColor" />
      ))}
    </svg>
  )
}
const ARROW: [number, number][] = [
  [4, 1], [5, 1], [3, 2], [4, 2], [5, 2], [6, 2], [2, 3], [3, 3], [4, 3], [5, 3], [6, 3], [7, 3],
  [4, 4], [5, 4], [4, 5], [5, 5], [4, 6], [5, 6], [4, 7], [5, 7], [4, 8], [5, 8],
]

/**
 * Shaft rail: every floor at a glance — where the car is, where it is going,
 * and every pending call. Click a floor to send the car there.
 */
export function ShaftRail() {
  const s = useLab(
    useShallow((st) => ({
      floors: st.config.floors,
      H: st.config.floorHeight,
      pos: st.snapshot.position,
      target: st.snapshot.targetFloor,
      car: st.snapshot.carCalls.map((c) => c.floor).join(','),
      hall: st.snapshot.hallCalls.map((h) => `${h.floor}${h.direction}`).join(','),
      doorOpen: st.snapshot.doorPosition > 0.05,
      em: st.snapshot.state === 'EMERGENCY',
    })),
  )
  const pressCar = useLab((st) => st.pressCar)
  const car = s.car.split(',').filter(Boolean).map(Number)
  const hall = s.hall.split(',').filter(Boolean)
  const order = Array.from({ length: s.floors }, (_, i) => s.floors - i)
  const rowH = Math.max(18, Math.min(30, Math.floor(340 / s.floors)))
  const carTop = ((s.floors - 1) * s.H - s.pos) / s.H // in rows from the top

  return (
    <div className="pointer-events-auto rounded-lg border border-line bg-surface/85 p-1.5 backdrop-blur-sm" aria-label="Shaft overview">
      <div className="relative">
        {/* the car */}
        <div
          className={clsx(
            'absolute left-[26px] w-[14px] rounded-[3px] transition-[top] duration-75 ease-linear',
            s.em ? 'bg-danger' : s.doorOpen ? 'bg-ok' : 'bg-accent',
          )}
          style={{ top: carTop * rowH + 3, height: rowH - 6, boxShadow: '0 0 10px currentColor' }}
        />
        <div className="absolute top-0 bottom-0 left-[32px] w-px bg-line-strong" />
        {order.map((f) => {
          const up = hall.includes(`${f}UP`)
          const down = hall.includes(`${f}DOWN`)
          return (
            <button
              key={f}
              onClick={() => pressCar(f)}
              title={`Send the car to floor ${f}`}
              className="group relative flex w-[78px] items-center gap-1 rounded px-1 hover:bg-surface-3"
              style={{ height: rowH }}
            >
              <span className={clsx('w-4 text-right font-mono text-[11px]', s.target === f ? 'text-accent' : 'text-muted group-hover:text-ink')}>{f}</span>
              <span className="w-[22px]" />
              <span className={clsx('h-1.5 w-1.5 rounded-full', car.includes(f) ? 'bg-accent' : 'bg-transparent')} title={car.includes(f) ? 'Car call' : undefined} />
              <span className="flex flex-col text-[8px] leading-[8px]">
                <span className={up ? 'text-lamp' : 'text-transparent'}>▲</span>
                <span className={down ? 'text-lamp' : 'text-transparent'}>▼</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Shown until the first button press, so an empty lab tells you what to do. */
export function FirstRunHint() {
  const pressed = useLab((st) => st.events.some((e) => e.category === 'input'))
  if (pressed) return null
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center">
      <div className="rounded-full border border-accent/40 bg-surface/90 px-4 py-1.5 text-[13px] text-ink backdrop-blur-sm">
        Press a floor button to send the car, then watch the code run on the right
      </div>
    </div>
  )
}
