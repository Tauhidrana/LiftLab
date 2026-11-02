import clsx from 'clsx'
import { Bug, ChevronDown, ChevronUp, Cog, DoorClosed, DoorOpen, OctagonX, RotateCcw, TriangleAlert } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { Algorithm, OperationMode } from '../../engine/types'
import { runtime } from '../../store/runtime'
import { useLab } from '../../store/useLab'
import { Btn, Label, Segmented } from '../ui'

export function ControlPanel() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto bg-surface">
      <ModeSection />
      <CarPanel />
      <HallCalls />
      <LoadSection />
    </div>
  )
}

function Section({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('border-b border-line px-3 py-3', className)}>{children}</div>
}

const OPS: { value: OperationMode; label: string; title: string }[] = [
  { value: 'normal', label: 'Normal', title: 'Regular passenger operation' },
  { value: 'manual', label: 'Manual', title: 'Doors close only on the close button' },
  { value: 'automatic', label: 'Auto', title: 'Simulated passengers generate traffic' },
]

function ModeSection() {
  const op = useLab((s) => s.operation)
  const setOp = useLab((s) => s.setOperation)
  const { debug, engineering, failureLab } = useLab(useShallow((s) => ({ debug: s.debug, engineering: s.engineering, failureLab: s.failureLab })))
  const toggle = useLab((s) => s.toggleLens)
  const algorithm = useLab((s) => s.config.algorithm)
  const setAlgorithm = useLab((s) => s.setAlgorithm)
  const hasCustom = useLab((s) => s.hasCustom)
  return (
    <Section>
      <Label>Operation</Label>
      <Segmented value={op} options={OPS} onChange={setOp} />
      <p className="mt-1.5 text-[11.5px] leading-snug text-muted">
        {op === 'normal' && 'Doors close automatically after the dwell time.'}
        {op === 'manual' && 'You control the doors: the car waits until you press close.'}
        {op === 'automatic' && 'Simulated passengers call the car and press destinations.'}
      </p>
      <div className="mt-3">
        <Label>Lenses</Label>
        <div className="flex flex-wrap gap-1">
          <Btn size="sm" active={debug} onClick={() => toggle('debug')} title="Show every internal event, including sensor ticks">
            <Bug size={12} /> Debug
          </Btn>
          <Btn size="sm" active={engineering} onClick={() => toggle('engineering')} title="X-ray view with power and signal flows">
            <Cog size={12} /> Engineering
          </Btn>
          <Btn size="sm" active={failureLab} onClick={() => toggle('failureLab')} title="Inject faults and watch the safe response">
            <TriangleAlert size={12} /> Failures
          </Btn>
        </div>
      </div>
      <div className="mt-3">
        <Label>Scheduling</Label>
        <Segmented<Algorithm>
          size="sm"
          value={algorithm}
          onChange={setAlgorithm}
          options={(hasCustom ? (['LOOK', 'SCAN', 'SSTF', 'FCFS', 'CUSTOM'] as const) : (['LOOK', 'SCAN', 'SSTF', 'FCFS'] as const)).map((a) => ({ value: a, label: a === 'CUSTOM' ? 'Yours' : a }))}
        />
      </div>
    </Section>
  )
}

function CarPanel() {
  const floors = useLab((s) => s.config.floors)
  const lit = useLab(useShallow((s) => s.snapshot.carCalls.map((c) => c.floor)))
  const estop = useLab((s) => s.snapshot.faults.includes('emergencyStop'))
  const emergency = useLab((s) => s.snapshot.state === 'EMERGENCY')
  const a = useLab(useShallow((s) => ({ pressCar: s.pressCar, doorOpen: s.doorOpen, doorClose: s.doorClose, emergencyStop: s.emergencyStop, reset: s.resetSystem })))
  const order = Array.from({ length: floors }, (_, i) => floors - i)

  return (
    <Section>
      <Label>Car operating panel</Label>
      <div className="rounded-lg border border-line-strong bg-[#0d1013] p-2.5">
        <div className="grid grid-cols-4 gap-1.5">
          {order.map((f) => (
            <button
              key={f}
              onClick={() => a.pressCar(f)}
              className={clsx(
                'h-9 rounded-full border font-mono text-[13px] font-medium transition-all',
                lit.includes(f)
                  ? 'border-accent bg-accent/20 text-accent shadow-[0_0_12px_-2px_var(--color-accent)]'
                  : 'border-line-strong bg-surface-2 text-ink-2 hover:border-faint hover:text-ink',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Btn onClick={a.doorOpen} title="Door open">
            <DoorOpen size={13} /> Open
          </Btn>
          <Btn onClick={a.doorClose} title="Door close">
            <DoorClosed size={13} /> Close
          </Btn>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <Btn tone="danger" active={estop} onClick={a.emergencyStop} title={estop ? 'Release emergency stop' : 'Emergency stop'}>
            <OctagonX size={13} /> {estop ? 'Release' : 'E-Stop'}
          </Btn>
          <Btn tone={emergency ? 'accent' : 'default'} disabled={!emergency} onClick={a.reset} title="Return to service after an emergency">
            <RotateCcw size={13} /> Reset
          </Btn>
        </div>
      </div>
    </Section>
  )
}

function HallCalls() {
  const floors = useLab((s) => s.config.floors)
  const calls = useLab(useShallow((s) => s.snapshot.hallCalls.map((h) => `${h.floor}${h.direction}`)))
  const carFloor = useLab((s) => s.snapshot.currentFloor)
  const pressHall = useLab((s) => s.pressHall)
  const order = Array.from({ length: floors }, (_, i) => floors - i)
  return (
    <Section>
      <Label>Landing calls</Label>
      <div className="space-y-px">
        {order.map((f) => (
          <div key={f} className={clsx('flex h-7 items-center gap-2 rounded px-1.5', carFloor === f && 'bg-surface-2')}>
            <span className="w-5 font-mono text-[12px] text-ink-2">{f}</span>
            <span className={clsx('h-1.5 w-1.5 rounded-full', carFloor === f ? 'bg-accent' : 'bg-transparent')} title={carFloor === f ? 'Car is here' : undefined} />
            <div className="ml-auto flex gap-1">
              {(['UP', 'DOWN'] as const).map((d) => {
                const disabled = (d === 'UP' && f === floors) || (d === 'DOWN' && f === 1)
                const on = calls.includes(`${f}${d}`)
                return (
                  <button
                    key={d}
                    disabled={disabled}
                    onClick={() => pressHall(f, d)}
                    aria-label={`Call ${d} at floor ${f}`}
                    className={clsx(
                      'flex h-6 w-7 items-center justify-center rounded border transition-colors',
                      disabled ? 'invisible' : on ? 'border-accent bg-accent/20 text-accent' : 'border-line-strong bg-surface-2 text-muted hover:text-ink',
                    )}
                  >
                    {d === 'UP' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

function LoadSection() {
  const op = useLab((s) => s.operation)
  const load = useLab((s) => s.snapshot.loadKg)
  const passengers = useLab((s) => s.snapshot.passengers)
  const generation = useLab((s) => s.generation)
  return (
    <Section className="border-b-0">
      <Label>Car load</Label>
      {op === 'automatic' ? (
        <p className="text-[12px] text-muted">
          {passengers} passenger(s) aboard · <span className="font-mono text-ink">{load} kg</span>
        </p>
      ) : (
        <>
          <input
            key={generation}
            type="range"
            min={0}
            max={630}
            step={75}
            defaultValue={runtime.controller.config.manualLoadKg}
            onChange={(e) => (runtime.controller.config.manualLoadKg = Number(e.target.value))}
            className="w-full accent-[var(--color-accent)]"
          />
          <div className="flex justify-between font-mono text-[11px] text-muted">
            <span>{load} kg</span>
            <span>≈ {Math.round(load / 75)} persons</span>
          </div>
          <p className="mt-1 text-[11.5px] leading-snug text-muted">Changes the motor power: compare an empty car going up vs. a full one.</p>
        </>
      )}
    </Section>
  )
}
