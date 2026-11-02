import clsx from 'clsx'
import { Info, ShieldAlert } from 'lucide-react'
import { Group, Panel } from 'react-resizable-panels'
import { COMPONENT_BY_ID, COMPONENTS, type ComponentId, type MechComponent } from '../content/components'
import type { Snapshot } from '../engine/types'
import { Viewport } from '../components/Elevator3D/Viewport'
import { FLOW_COLORS } from '../components/Elevator3D/Flows'
import { Label, PanelHeader, Segmented } from '../components/ui'
import { SafetyCircuit } from '../components/ArchitectureViewer/SafetyCircuit'
import { useState } from 'react'
import { useLab } from '../store/useLab'
import { fmt } from '../utils/format'
import { Handle } from './SimulationPage'
import { useNarrow } from '../utils/useNarrow'

const GROUPS: MechComponent['group'][] = ['Drive', 'Car & shaft', 'Doors', 'Sensing & control', 'Safety']

export function ArchitecturePage() {
  const narrow = useNarrow()
  if (narrow) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-auto">
        <div className="h-[40vh] shrink-0 border-b border-line">
          <Viewport variant="architecture" />
        </div>
        <div className="max-h-[30vh] shrink-0 overflow-auto border-b border-line">
          <ComponentList />
        </div>
        <ComponentDetail />
      </div>
    )
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-warn/[0.06] px-4 py-1.5 text-[12px] text-ink-2">
        <ShieldAlert size={14} className="text-warn" />
        <span>
          <b className="text-ink">Simplified educational model.</b> Real elevators follow safety codes (e.g. EN 81-20/50, ASME A17.1) with hard-wired safety
          circuits, redundant brakes and certified components. This simulation is not a safety-certified controller.
        </span>
      </div>
      <Group orientation="horizontal" className="min-h-0 flex-1">
        <Panel id="list" defaultSize="250px" minSize="200px" maxSize="320px">
          <ComponentList />
        </Panel>
        <Handle />
        <Panel id="view" minSize="30%">
          <Viewport variant="architecture" />
        </Panel>
        <Handle />
        <Panel id="detail" defaultSize="420px" minSize="320px" maxSize="55%">
          <ComponentDetail />
        </Panel>
      </Group>
    </div>
  )
}

function ComponentList() {
  const selected = useLab((s) => s.selectedComponent)
  const select = useLab((s) => s.selectComponent)
  const hover = useLab((s) => s.hoverComponent)
  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <PanelHeader title="Components" />
      <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
        {GROUPS.map((g) => (
          <div key={g} className="mb-3">
            <div className="px-1.5 pb-1 text-[12px] font-medium text-faint">{g}</div>
            {COMPONENTS.filter((c) => c.group === g).map((c) => {
              const n = COMPONENTS.indexOf(c) + 1
              return (
                <button
                  key={c.id}
                  onClick={() => select(c.id)}
                  onMouseEnter={() => hover(c.id)}
                  onMouseLeave={() => hover(null)}
                  className={clsx(
                    'flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[12.5px] transition-colors',
                    selected === c.id ? 'bg-accent/12 text-accent' : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
                  )}
                >
                  <span className="w-5 font-mono text-[10px] text-faint">{String(n).padStart(2, '0')}</span>
                  {c.name}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function ComponentDetail() {
  const id = useLab((s) => s.selectedComponent)
  const snapshot = useLab((s) => s.snapshot)
  const select = useLab((s) => s.selectComponent)
  const c = id ? COMPONENT_BY_ID[id] : null
  const [tab, setTab] = useState<'component' | 'circuit'>('component')
  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <PanelHeader title={tab === 'circuit' ? 'Safety circuit' : c ? c.group : 'How it fits together'} icon={<Info size={14} />}>
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'component', label: 'Component' },
            { value: 'circuit', label: 'Safety circuit' },
          ]}
        />
      </PanelHeader>
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {tab === 'circuit' ? (
          <SafetyCircuit />
        ) : c ? (
          <>
            <h2 className="text-[17px] font-semibold text-ink">{c.name}</h2>
            <div className="mt-2 rounded-md border border-accent/30 bg-accent/[0.06] px-2.5 py-1.5 font-mono text-[11.5px] text-accent">
              LIVE · {c.live(snapshot)}
            </div>
            <Section title="Purpose">{c.purpose}</Section>
            <Section title="How it works">{c.how}</Section>
            <Section title="When it activates">{c.activation}</Section>
            {c.id === 'counterweight' && <CounterweightMath s={snapshot} />}
            <div className="mt-4">
              <Label>Communicates with</Label>
              <div className="space-y-1">
                {c.talksTo.map((t) => (
                  <button
                    key={t.id + t.via}
                    onClick={() => select(t.id)}
                    className="flex w-full items-center gap-2 rounded border border-line bg-surface-2 px-2 py-1 text-left hover:border-line-strong"
                  >
                    <span className="text-[12px] text-ink">{COMPONENT_BY_ID[t.id].name}</span>
                    <span className="ml-auto text-[11px] text-muted">{t.via}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-4 rounded-md border border-line bg-surface-2 p-2.5">
              <Label>Real industrial version</Label>
              <p className="text-[12px] leading-relaxed text-ink-2">{c.industrial}</p>
            </div>
          </>
        ) : (
          <p className="text-[13px] leading-relaxed text-ink-2">
            Select a component in the list or click it in the 3D view. The selected part glows in the model, and its live status comes straight from the running
            simulation — go back to <b className="text-ink">Simulation</b>, call the car, and come back to watch the motor, sheave and brake change state.
          </p>
        )}
        {tab === 'component' && (
          <div className="mt-5">
            <Label>System signal flow</Label>
            <SignalFlow s={snapshot} selected={id} onSelect={select} />
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <Label>{title}</Label>
      <p className="text-[13px] leading-relaxed text-ink-2">{children}</p>
    </div>
  )
}

function CounterweightMath({ s }: { s: Snapshot }) {
  const cfg = useLab((st) => st.config)
  const cw = cfg.carMass + cfg.ratedLoad * cfg.counterweightRatio
  const car = cfg.carMass + s.loadKg
  return (
    <div className="mt-4 rounded-md border border-line bg-surface-2 p-2.5 font-mono text-[11.5px] leading-relaxed text-ink-2">
      <div>counterweight = car + {cfg.counterweightRatio} × rated load</div>
      <div className="text-faint">
        {'             '}= {cfg.carMass} + {cfg.counterweightRatio} × {cfg.ratedLoad} = <span className="text-ink">{cw} kg</span>
      </div>
      <div className="mt-1">car side now = {car} kg</div>
      <div>
        motor lifts |{car} − {cw}| × 9.81 = <span className="text-accent">{fmt((Math.abs(car - cw) * 9.81) / 1000, 2)} kN</span>
      </div>
      <div>
        without counterweight: {car} × 9.81 = <span className="text-warn">{fmt((car * 9.81) / 1000, 2)} kN</span>
      </div>
    </div>
  )
}

/* ---------------- Signal-flow diagram ---------------- */

type Kind = 'power' | 'signal' | 'mechanical'
const NODES: Partial<Record<ComponentId, [number, number, string]>> = {
  floorController: [300, 30, 'Landing stations'],
  controlUnit: [175, 30, 'Control unit'],
  brake: [50, 30, 'Brake'],
  motor: [50, 105, 'Motor'],
  sheave: [50, 180, 'Sheave'],
  ropes: [140, 180, 'Ropes'],
  car: [230, 180, 'Car'],
  counterweight: [140, 250, 'Counterweight'],
  positionSensors: [230, 105, 'Position sensors'],
  doorMotor: [320, 105, 'Door operator'],
  doorSensors: [320, 180, 'Light curtain'],
  governor: [320, 250, 'Governor'],
  safetyGear: [230, 250, 'Safety gear'],
}
const EDGES: { a: ComponentId; b: ComponentId; kind: Kind; active: (s: Snapshot) => boolean }[] = [
  { a: 'controlUnit', b: 'motor', kind: 'power', active: (s) => s.motorEnergized },
  { a: 'controlUnit', b: 'brake', kind: 'power', active: (s) => !s.brakeEngaged },
  { a: 'brake', b: 'motor', kind: 'mechanical', active: (s) => s.brakeEngaged },
  { a: 'motor', b: 'sheave', kind: 'mechanical', active: (s) => s.velocity !== 0 },
  { a: 'sheave', b: 'ropes', kind: 'mechanical', active: (s) => s.velocity !== 0 },
  { a: 'ropes', b: 'car', kind: 'mechanical', active: (s) => s.velocity !== 0 },
  { a: 'ropes', b: 'counterweight', kind: 'mechanical', active: (s) => s.velocity !== 0 },
  { a: 'positionSensors', b: 'controlUnit', kind: 'signal', active: (s) => !s.faults.includes('positionSensorFault') },
  { a: 'floorController', b: 'controlUnit', kind: 'signal', active: (s) => s.hallCalls.length > 0 },
  { a: 'controlUnit', b: 'doorMotor', kind: 'signal', active: (s) => s.doorStatus === 'OPENING' || s.doorStatus === 'CLOSING' },
  { a: 'doorSensors', b: 'doorMotor', kind: 'signal', active: (s) => s.lightCurtainBlocked },
  { a: 'doorSensors', b: 'controlUnit', kind: 'signal', active: (s) => s.doorPosition > 0 },
  { a: 'car', b: 'governor', kind: 'mechanical', active: (s) => s.velocity !== 0 },
  { a: 'governor', b: 'safetyGear', kind: 'mechanical', active: (s) => s.governorTripped },
]
const KIND_COLOR: Record<Kind, string> = { power: FLOW_COLORS.power, signal: FLOW_COLORS.signal, mechanical: '#9aa3ad' }

function SignalFlow({ s, selected, onSelect }: { s: Snapshot; selected: ComponentId | null; onSelect: (id: ComponentId) => void }) {
  return (
    <div className="rounded-md border border-line bg-[#0d1014] p-2">
      <svg viewBox="0 0 370 280" className="w-full" role="img" aria-label="Signal flow between elevator components">
        <defs>
          {(Object.keys(KIND_COLOR) as Kind[]).map((k) => (
            <marker key={k} id={`arr-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill={KIND_COLOR[k]} />
            </marker>
          ))}
        </defs>
        {EDGES.map((e) => {
          const [x1, y1] = NODES[e.a]!
          const [x2, y2] = NODES[e.b]!
          const len = Math.hypot(x2 - x1, y2 - y1)
          const ux = (x2 - x1) / len
          const uy = (y2 - y1) / len
          const on = e.active(s)
          const related = selected && (e.a === selected || e.b === selected)
          return (
            <line
              key={e.a + e.b}
              x1={x1 + ux * 30}
              y1={y1 + uy * 14}
              x2={x2 - ux * 30}
              y2={y2 - uy * 14}
              stroke={KIND_COLOR[e.kind]}
              strokeWidth={related ? 2.2 : 1.4}
              strokeOpacity={on ? 0.95 : related ? 0.6 : 0.22}
              strokeDasharray={e.kind === 'signal' ? '4 3' : undefined}
              markerEnd={`url(#arr-${e.kind})`}
              style={on ? { animation: 'dash 0.8s linear infinite' } : undefined}
            />
          )
        })}
        {(Object.entries(NODES) as [ComponentId, [number, number, string]][]).map(([id, [x, y, label]]) => (
          <g key={id} onClick={() => onSelect(id)} className="cursor-pointer">
            <rect
              x={x - 46}
              y={y - 12}
              width={92}
              height={24}
              rx={5}
              fill={selected === id ? 'rgba(58,209,232,0.14)' : '#161a1f'}
              stroke={selected === id ? '#3ad1e8' : '#2f353e'}
            />
            <text x={x} y={y + 4} textAnchor="middle" fontSize="10.5" fill={selected === id ? '#3ad1e8' : '#aab1bb'} fontFamily="Inter, sans-serif">
              {label}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-1 flex gap-3 px-1 text-[10.5px] text-muted">
        {(Object.keys(KIND_COLOR) as Kind[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5">
            <span className="h-0.5 w-3" style={{ background: KIND_COLOR[k] }} />
            {k}
          </span>
        ))}
        <span className="ml-auto">bright = active now</span>
      </div>
      <style>{`@keyframes dash { to { stroke-dashoffset: -14; } }`}</style>
    </div>
  )
}
