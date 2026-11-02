import clsx from 'clsx'
import { Check, X } from 'lucide-react'
import { useMemo, useRef } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { FAULT_LABELS } from '../../engine/SafetySystem'
import type { FaultId } from '../../engine/types'
import type { Sample } from '../../store/runtime'
import { useLab } from '../../store/useLab'
import { fmt } from '../../utils/format'
import { KV, Label } from '../ui'
import { LiveLineChart } from './LineChart'

/* ------------------------------------------------------------------ */
/* Request queue                                                       */
/* ------------------------------------------------------------------ */

export function QueuePanel() {
  const s = useLab(
    useShallow((st) => ({
      floors: st.config.floors,
      carCalls: st.snapshot.carCalls,
      hallCalls: st.snapshot.hallCalls,
      position: st.snapshot.position,
      floorHeight: st.config.floorHeight,
      target: st.snapshot.targetFloor,
      direction: st.snapshot.direction,
      time: Math.floor(st.snapshot.time),
      algorithm: st.config.algorithm,
    })),
  )
  const events = useLab((st) => st.events)
  const decision = useMemo(() => [...events].reverse().find((e) => e.event === 'NEXT_DESTINATION_SELECTED'), [events])
  const order = Array.from({ length: s.floors }, (_, i) => s.floors - i)
  const carAt = s.position / s.floorHeight + 1

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(240px,320px)_1fr] gap-0 overflow-hidden">
      {/* Shaft strip: where every request is, relative to the car */}
      <div className="overflow-auto border-r border-line p-3">
        <Label>Requests by floor</Label>
        {order.map((f) => {
          const car = s.carCalls.find((c) => c.floor === f)
          const up = s.hallCalls.find((h) => h.floor === f && h.direction === 'UP')
          const down = s.hallCalls.find((h) => h.floor === f && h.direction === 'DOWN')
          const here = Math.abs(carAt - f) < 0.5
          return (
            <div key={f} className={clsx('flex h-6 items-center gap-2 border-b border-line/50 font-mono text-[11.5px]', here && 'bg-accent/8')}>
              <span className="w-5 text-right text-muted">{f}</span>
              <span className="w-5 text-accent">{here ? '■' : ''}</span>
              <span className={clsx('w-16', car ? 'text-ink' : 'text-faint')}>{car ? `car ${s.time - Math.floor(car.time)}s` : '·'}</span>
              <span className={clsx('w-14', up ? 'text-ink' : 'text-faint')}>{up ? `▲ ${s.time - Math.floor(up.time)}s` : '·'}</span>
              <span className={clsx('w-14', down ? 'text-ink' : 'text-faint')}>{down ? `▼ ${s.time - Math.floor(down.time)}s` : '·'}</span>
              {s.target === f && <span className="ml-auto text-[10px] text-accent">TARGET</span>}
            </div>
          )
        })}
      </div>
      <div className="overflow-auto p-3">
        <Label>requestQueue (insertion order)</Label>
        <div className="flex min-h-7 flex-wrap gap-1">
          {s.carCalls.length + s.hallCalls.length === 0 && <span className="text-muted">empty — the car will go IDLE</span>}
          {[...s.carCalls.map((c) => ({ k: `c${c.floor}`, t: c.time, label: `${c.floor}`, kind: 'car' })), ...s.hallCalls.map((h) => ({ k: `h${h.floor}${h.direction}`, t: h.time, label: `${h.floor}${h.direction === 'UP' ? '▲' : '▼'}`, kind: 'hall' }))]
            .sort((a, b) => a.t - b.t)
            .map((r) => (
              <span key={r.k} className="rounded border border-line-strong bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px] text-ink">
                {r.label}
                <span className="ml-1 text-[10px] text-faint">{r.kind}</span>
              </span>
            ))}
        </div>
        <div className="mt-4">
          <Label>Last scheduler decision · {s.algorithm}</Label>
          {decision ? (
            <div className="space-y-1">
              <p className="text-[12.5px] text-ink">{decision.message}</p>
              <p className="font-mono text-[11px] text-muted">candidates (floor, kind, distance): {String(decision.inputs?.candidates ?? '')}</p>
            </div>
          ) : (
            <p className="text-muted">No decision yet.</p>
          )}
        </div>
        <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
          Car calls come from inside the car; hall calls (▲/▼) from the landings. With <b className="text-ink-2">LOOK</b>, the car serves calls ahead of it in
          its direction of travel first — that is why a ▼ call above the car may wait until the car turns around.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

const pickV = (s: Sample) => s.v
const pickP = (s: Sample) => s.power
const pickA = (s: Sample) => s.a

export function MotionPanel() {
  const s = useLab(
    useShallow((st) => ({
      floors: st.config.floors,
      H: st.config.floorHeight,
      rated: st.config.ratedSpeed,
      pos: st.snapshot.position,
      v: st.snapshot.velocity,
      a: st.snapshot.acceleration,
      phase: st.snapshot.phase,
      floor: st.snapshot.currentFloor,
      target: st.snapshot.targetFloor,
      dir: st.snapshot.direction,
      rpm: st.snapshot.motorRpm,
      profile: st.config.motionProfile,
    })),
  )
  // Progress of the current trip: remember where it started.
  const trip = useRef<{ target: number | null; start: number }>({ target: null, start: 0 })
  if (s.target !== trip.current.target) trip.current = { target: s.target, start: s.pos }
  const targetPos = s.target ? (s.target - 1) * s.H : null
  const remaining = targetPos !== null ? Math.abs(targetPos - s.pos) : 0
  const total = targetPos !== null ? Math.abs(targetPos - trip.current.start) : 0
  const progress = total > 0 ? 1 - remaining / total : 0
  const maxPos = (s.floors - 1) * s.H

  return (
    <div className="grid h-full min-h-0 grid-cols-[88px_220px_1fr] overflow-hidden">
      {/* Vertical position indicator */}
      <div className="relative border-r border-line px-3 py-3">
        <div className="relative h-full">
          <div className="absolute inset-y-0 left-6 w-px bg-line-strong" />
          {Array.from({ length: s.floors }, (_, i) => {
            const y = 1 - (i * s.H) / maxPos
            return (
              <div key={i} className="absolute left-0 flex -translate-y-1/2 items-center gap-1" style={{ top: `${y * 100}%` }}>
                <span className="w-4 text-right font-mono text-[10px] text-faint">{i + 1}</span>
                <span className={clsx('h-px w-3', s.target === i + 1 ? 'bg-accent' : 'bg-line-strong')} />
              </div>
            )
          })}
          <div
            className="absolute left-[18px] h-3 w-4 -translate-y-1/2 rounded-sm bg-accent shadow-[0_0_10px_var(--color-accent)]"
            style={{ top: `${(1 - s.pos / maxPos) * 100}%` }}
          />
        </div>
      </div>
      <div className="overflow-auto border-r border-line px-3 py-2">
        <KV k="Current floor" v={s.floor} />
        <KV k="Target floor" v={s.target ?? '—'} tone={s.target ? 'accent' : undefined} />
        <KV k="Direction" v={s.dir} />
        <KV k="Position" v={`${fmt(s.pos)} m`} />
        <KV k="Distance left" v={`${fmt(remaining)} m`} />
        <div className="my-1 h-1 overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-accent transition-[width] duration-100" style={{ width: `${progress * 100}%` }} />
        </div>
        <KV k="Velocity" v={`${fmt(Math.abs(s.v))} m/s`} />
        <KV k="Acceleration" v={`${fmt(s.a)} m/s²`} />
        <KV k="Phase" v={s.phase} tone={s.phase === 'BRAKING' ? 'danger' : s.phase === 'STOPPED' ? undefined : 'accent'} />
        <KV k="Sheave" v={`${fmt(Math.abs(s.rpm), 0)} rpm`} />
      </div>
      <div className="grid min-w-0 grid-cols-3 gap-4 overflow-hidden px-4 py-2">
        <LiveLineChart title="Velocity" unit="m/s, up is positive" pick={pickV} min={-s.rated} max={s.rated} />
        <LiveLineChart title="Acceleration" unit="m/s²" pick={pickA} min={-0.8} max={0.8} color="#c4b5fd" />
        <LiveLineChart title="Motor power" unit="kW, below zero = regenerating" pick={pickP} min={-3} max={3} color="#f5a524" />
        <p className="col-span-3 -mt-1 text-[11.5px] leading-relaxed text-muted">
          {s.profile === 's-curve'
            ? 'S-curve profile: acceleration itself ramps up and down (limited jerk), so the velocity curve has rounded corners and the ride feels smooth. The last few centimetres are crept at levelling speed.'
            : 'Trapezoid profile: constant acceleration, cruise, then deceleration once the remaining distance equals the braking distance v²/2a. Acceleration jumps instantly, which passengers feel as a jolt.'}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Metrics                                                             */
/* ------------------------------------------------------------------ */

export function MetricsPanel() {
  const s = useLab((st) => st.snapshot)
  const cfg = useLab((st) => st.config)
  const maxCalls = Math.max(1, ...s.floorCalls)
  const cw = cfg.carMass + cfg.ratedLoad * cfg.counterweightRatio
  const carSide = cfg.carMass + s.loadKg
  const imbalance = carSide - cw
  const net = s.energyUsedKwh - s.energyRegenKwh
  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_1fr_1.1fr] overflow-hidden">
      <div className="overflow-auto border-r border-line p-3">
        <Label>Operation</Label>
        <div className="grid grid-cols-2 gap-x-4">
          <KV k="Trips" v={s.trips} />
          <KV k="Distance" v={`${fmt(s.distanceTravelled, 1)} m`} />
          <KV k="Served" v={s.servedPassengers} />
          <KV k="Waiting" v={s.waiting} />
          <KV k="Avg wait" v={`${fmt(s.avgWait, 1)} s`} />
          <KV k="Avg ride" v={`${fmt(s.avgRide, 1)} s`} />
        </div>
        <div className="mt-3">
          <Label>Energy</Label>
          <KV k="Drawn from grid" v={`${fmt(s.energyUsedKwh * 1000, 1)} Wh`} />
          <KV k="Regenerated" v={`${fmt(s.energyRegenKwh * 1000, 1)} Wh`} tone="ok" />
          <KV k="Net" v={`${fmt(net * 1000, 1)} Wh`} />
          <KV k="Power now" v={`${fmt(s.motorPowerKw, 2)} kW`} tone={s.motorPowerKw < 0 ? 'ok' : undefined} />
        </div>
      </div>
      <div className="overflow-auto border-r border-line p-3">
        <Label>Counterweight balance</Label>
        <KV k="Car + load" v={`${carSide} kg`} />
        <KV k="Counterweight" v={`${cw} kg`} />
        <KV k="Imbalance" v={`${imbalance > 0 ? '+' : ''}${imbalance} kg (${imbalance > 0 ? 'car heavier' : imbalance < 0 ? 'counterweight heavier' : 'balanced'})`} />
        <KV k="Static motor force" v={`${fmt(Math.abs(imbalance * 9.81) / 1000, 2)} kN`} />
        <KV k="Without counterweight" v={`${fmt((carSide * 9.81) / 1000, 2)} kN`} tone="warn" />
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
          The counterweight equals the car plus {cfg.counterweightRatio * 100}% of rated load. The motor only lifts the <i>difference</i> —{' '}
          {fmt((Math.abs(imbalance) / carSide) * 100, 0)}% of what it would lift without one. When the heavier side goes down, the motor brakes it and works as a generator
          (regeneration).
        </p>
      </div>
      <div className="overflow-auto p-3">
        <Label>Calls per floor (heatmap)</Label>
        <div className="space-y-[3px]">
          {s.floorCalls
            .map((n, i) => ({ n, f: i + 1 }))
            .reverse()
            .map(({ n, f }) => (
              <div key={f} className="group flex items-center gap-2" title={`Floor ${f}: ${n} calls`}>
                <span className="w-4 text-right font-mono text-[10.5px] text-muted">{f}</span>
                <div className="h-3.5 flex-1 rounded-[3px] bg-surface-2">
                  <div
                    className="h-full rounded-[3px]"
                    style={{ width: `${(n / maxCalls) * 100}%`, background: `rgba(76, 154, 255, ${0.25 + 0.75 * (n / maxCalls)})` }}
                  />
                </div>
                <span className="w-6 font-mono text-[10.5px] text-ink-2">{n}</span>
              </div>
            ))}
        </div>
        <p className="mt-2 text-[11.5px] text-muted">Switch to Auto with the up-peak profile (Settings) to see the lobby light up.</p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Failures                                                            */
/* ------------------------------------------------------------------ */

const FAULT_INFO: Record<FaultId, string> = {
  doorObstruction: 'Something blocks the doorway. Light-curtain beams break → closing doors reverse and the dwell timer restarts. The car never leaves with the doorway blocked.',
  doorSensorFailure: 'The light curtain fails its self-test. The controller cannot prove the doorway is clear, so it keeps the doors open and refuses to move: fail-safe.',
  motorUnavailable: 'The drive reports a fault. At rest: requests are held and the car does not start. In motion: safety chain opens, brake stops the car.',
  positionSensorFault: 'Encoder and floor vanes disagree. Without trustworthy position, the controller cannot level or slow down correctly → emergency stop.',
  emergencyStop: 'Opens the safety chain directly. Motor power and brake coil are cut; springs apply the brake. Release it, then RESET for a slow recovery run.',
  powerLoss: 'Mains supply lost. The brake drops by itself (springs). After 2 s the battery rescue device creeps the car to the nearest floor and opens the doors.',
}

export function FaultsPanel() {
  const faults = useLab(useShallow((s) => s.snapshot.faults))
  const chain = useLab(useShallow((s) => s.snapshot.safetyChain))
  const emergency = useLab((s) => s.snapshot.emergency)
  const toggle = useLab((s) => s.toggleFault)
  const reset = useLab((s) => s.resetSystem)
  return (
    <div className="grid h-full min-h-0 grid-cols-[1.4fr_1fr] overflow-hidden">
      <div className="overflow-auto border-r border-line p-3">
        <Label>Inject a fault — and watch the safe response</Label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(FAULT_LABELS) as FaultId[]).map((f) => {
            const on = faults.includes(f)
            return (
              <button
                key={f}
                onClick={() => toggle(f)}
                className={clsx(
                  'rounded-md border p-2 text-left transition-colors',
                  on ? 'border-danger/60 bg-danger/10' : 'border-line-strong bg-surface-2 hover:border-faint',
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={clsx('relative h-3.5 w-6 rounded-full transition-colors', on ? 'bg-danger' : 'bg-line-strong')}>
                    <span className={clsx('absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-all', on ? 'left-3' : 'left-0.5')} />
                  </span>
                  <span className={clsx('text-[12px] font-medium', on ? 'text-danger' : 'text-ink')}>{FAULT_LABELS[f]}</span>
                </div>
                <p className="mt-1 text-[11px] leading-snug text-muted">{FAULT_INFO[f]}</p>
              </button>
            )
          })}
        </div>
      </div>
      <div className="overflow-auto p-3">
        <Label>Safety chain (all links must be closed to run)</Label>
        <div className="space-y-1">
          {chain.map((l, i) => (
            <div key={l.id} className="flex items-center gap-2">
              <span className="w-3 font-mono text-[10px] text-faint">{i + 1}</span>
              <span className={clsx('flex h-4 w-4 items-center justify-center rounded-full', l.ok ? 'bg-ok/15 text-ok' : 'bg-danger/20 text-danger')}>
                {l.ok ? <Check size={11} /> : <X size={11} />}
              </span>
              <span className={clsx('text-[12px]', l.ok ? 'text-ink-2' : 'text-danger')}>{l.label}</span>
              <span className="ml-auto font-mono text-[10px] text-faint">{l.ok ? 'closed' : 'OPEN'}</span>
            </div>
          ))}
        </div>
        {emergency && (
          <div className="mt-3 rounded-md border border-danger/40 bg-danger/10 p-2">
            <div className="font-mono text-[11px] text-danger">EMERGENCY · {emergency.phase}</div>
            <p className="mt-0.5 text-[12px] text-ink">{emergency.reason}</p>
            <button onClick={reset} className="mt-1.5 text-[12px] text-accent hover:underline">
              Clear the faults, then press Reset
            </button>
          </div>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Educational model. Real lifts implement the safety chain as hard-wired contacts in series and certified safety circuits, never in application software
          alone. Never bypass a safety device.
        </p>
      </div>
    </div>
  )
}
