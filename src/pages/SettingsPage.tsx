import { useState } from 'react'
import { DEFAULT_CONFIG } from '../engine/config'
import type { SimConfig, TrafficProfile } from '../engine/types'
import { Btn, Label, Segmented } from '../components/ui'
import { useLab } from '../store/useLab'

type NumKey = { [K in keyof SimConfig]: SimConfig[K] extends number ? K : never }[keyof SimConfig]

const FIELDS: { key: NumKey; label: string; min: number; max: number; step: number; unit: string; hint: string }[] = [
  { key: 'floors', label: 'Floors', min: 3, max: 16, step: 1, unit: '', hint: 'Rebuilds the building.' },
  { key: 'floorHeight', label: 'Floor-to-floor height', min: 2.8, max: 4.5, step: 0.1, unit: 'm', hint: '' },
  { key: 'ratedSpeed', label: 'Rated speed', min: 0.5, max: 2.5, step: 0.1, unit: 'm/s', hint: 'Low-rise lifts: 0.6–1.6 m/s.' },
  { key: 'acceleration', label: 'Acceleration', min: 0.3, max: 1.2, step: 0.05, unit: 'm/s²', hint: 'Above ~1.2 feels uncomfortable.' },
  { key: 'jerk', label: 'Jerk limit', min: 0.3, max: 2.5, step: 0.1, unit: 'm/s³', hint: 'S-curve only. Lower is smoother and slower.' },
  { key: 'doorTravelTime', label: 'Door travel time', min: 1, max: 4, step: 0.1, unit: 's', hint: '' },
  { key: 'doorDwellTime', label: 'Door dwell time', min: 1, max: 10, step: 0.5, unit: 's', hint: 'How long doors stay open.' },
  { key: 'counterweightRatio', label: 'Counterweight balance', min: 0, max: 1, step: 0.05, unit: '× rated load', hint: 'Try 0 to see the motor work much harder.' },
  { key: 'carMass', label: 'Car mass', min: 400, max: 2000, step: 50, unit: 'kg', hint: '' },
  { key: 'trafficRate', label: 'Auto-mode arrivals', min: 1, max: 12, step: 1, unit: '/min', hint: '' },
  { key: 'seed', label: 'Random seed', min: 1, max: 9999, step: 1, unit: '', hint: 'Same seed ⇒ same passengers.' },
]

export function SettingsPage() {
  const config = useLab((s) => s.config)
  const apply = useLab((s) => s.applyConfig)
  const [draft, setDraft] = useState<SimConfig>(config)
  const dirty = JSON.stringify(draft) !== JSON.stringify(config)

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-[760px] px-6 py-6">
        <h1 className="text-[20px] font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-[13px] text-ink-2">Physical parameters of the simulated lift. Applying restarts the simulation.</p>
        <div className="mt-5 divide-y divide-line rounded-lg border border-line bg-surface">
          {FIELDS.map((f) => (
            <div key={f.key} className="grid grid-cols-[220px_1fr_110px] items-center gap-4 px-4 py-2.5">
              <div>
                <div className="text-[12.5px] text-ink">{f.label}</div>
                {f.hint && <div className="text-[11px] text-muted">{f.hint}</div>}
              </div>
              <input
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={draft[f.key]}
                onChange={(e) => setDraft({ ...draft, [f.key]: Number(e.target.value) })}
                className="accent-[var(--color-accent)]"
              />
              <span className="text-right font-mono text-[12px] text-ink">
                {draft[f.key]} <span className="text-faint">{f.unit}</span>
              </span>
            </div>
          ))}
          <div className="grid grid-cols-[220px_1fr] items-center gap-4 px-4 py-2.5">
            <div>
              <div className="text-[12.5px] text-ink">Motion profile</div>
              <div className="text-[11px] text-muted">How the drive ramps speed up and down.</div>
            </div>
            <Segmented<SimConfig['motionProfile']>
              value={draft.motionProfile}
              onChange={(v) => setDraft({ ...draft, motionProfile: v })}
              options={[
                { value: 's-curve', label: 'S-curve (jerk limited)' },
                { value: 'trapezoid', label: 'Trapezoid' },
              ]}
            />
          </div>
          <div className="grid grid-cols-[220px_1fr] items-center gap-4 px-4 py-2.5">
            <div className="text-[12.5px] text-ink">Auto-mode traffic pattern</div>
            <Segmented<TrafficProfile>
              value={draft.trafficProfile}
              onChange={(v) => setDraft({ ...draft, trafficProfile: v })}
              options={[
                { value: 'uniform', label: 'Uniform' },
                { value: 'up-peak', label: 'Up-peak' },
                { value: 'down-peak', label: 'Down-peak' },
                { value: 'lunch', label: 'Lunch' },
              ]}
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Btn tone="accent" disabled={!dirty} onClick={() => apply(draft)}>
            Apply &amp; restart
          </Btn>
          <Btn onClick={() => setDraft({ ...DEFAULT_CONFIG, algorithm: config.algorithm, mode: config.mode })}>Restore defaults</Btn>
        </div>
        <div className="mt-8">
          <Label>About this model</Label>
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            LiftLab is an educational simulation with plausible physics (constant-acceleration motion profile, force balance on the sheave, a fixed 60 Hz
            deterministic time step). It simplifies or omits many things real lifts have: jerk limiting, rope stretch, load weighing, door-zone re-levelling,
            group control, and certified hard-wired safety circuits. It must not be used to design or operate real equipment.
          </p>
        </div>
      </div>
    </div>
  )
}
