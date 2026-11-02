import clsx from 'clsx'
import { Box, Building2, Cog, DoorOpen, ScanLine } from 'lucide-react'
import { COMPONENT_BY_ID } from '../../content/components'
import { useLab, type CameraPreset } from '../../store/useLab'
import { FLOW_COLORS } from './Flows'
import { ElevatorScene } from './Scene'
import { WebGLGuard } from './WebGLGuard'
import { FirstRunHint, HallLantern, ShaftRail } from './Instruments'

const PRESETS: { id: CameraPreset; label: string; icon: React.ReactNode }[] = [
  { id: 'building', label: 'Building', icon: <Building2 size={13} /> },
  { id: 'interior', label: 'Interior', icon: <DoorOpen size={13} /> },
  { id: 'shaft', label: 'Shaft', icon: <ScanLine size={13} /> },
  { id: 'machine', label: 'Machine room', icon: <Cog size={13} /> },
  { id: 'cutaway', label: 'Side cutaway', icon: <Box size={13} /> },
]

export function Viewport({ variant = 'simulation' }: { variant?: 'simulation' | 'architecture' }) {
  const camera = useLab((s) => s.camera)
  const setCamera = useLab((s) => s.setCamera)
  const engineering = useLab((s) => s.engineering)
  const xray = variant === 'architecture' || engineering
  return (
    <div className="relative h-full w-full overflow-hidden bg-bg">
      <WebGLGuard>
        <ElevatorScene variant={variant} />
      </WebGLGuard>
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <HallLantern />
        <div className="flex flex-col items-end gap-2">
        <div className="pointer-events-auto flex flex-wrap justify-end gap-0.5 rounded-xl border border-line-strong bg-surface/90 p-1 shadow-lg shadow-black/30 backdrop-blur-md">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setCamera(p.id)}
              title={p.label}
              className={clsx(
                'flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium transition-colors',
                camera === p.id ? 'bg-accent text-white shadow-sm' : 'text-muted hover:bg-surface-3 hover:text-ink',
              )}
            >
              {p.icon}
              <span className="hidden lg:inline">{p.label}</span>
            </button>
          ))}
        </div>
        {variant === 'simulation' && <ShaftRail />}
        </div>
      </div>
      {variant === 'simulation' && <FirstRunHint />}
      {xray && <FlowLegend />}
      {variant === 'simulation' && engineering && <ComponentToast />}
      <div className="pointer-events-none absolute right-3 bottom-2.5 rounded-md bg-black/45 px-2 py-1 text-[11px] text-white/80 backdrop-blur-sm">
        {camera === 'interior' ? 'Drag to look around · Scroll to zoom · Click the panel to choose a floor' : 'Drag to orbit · Scroll to zoom · Right-drag to pan'}
      </div>
    </div>
  )
}

function FlowLegend() {
  const items = [
    { c: FLOW_COLORS.power, l: 'Power (motor, brake coil)' },
    { c: FLOW_COLORS.signal, l: 'Sensor signal' },
    { c: FLOW_COLORS.command, l: 'Door command' },
    { c: '#ffb547', l: 'Rope markers' },
  ]
  return (
    <div className="pointer-events-none absolute bottom-2 left-2.5 rounded-md border border-line bg-surface/85 px-2.5 py-1.5 backdrop-blur-sm">
      {items.map((i) => (
        <div key={i.l} className="flex items-center gap-2 text-[11px] text-ink-2">
          <span className="h-2 w-2 rounded-full" style={{ background: i.c }} />
          {i.l}
        </div>
      ))}
    </div>
  )
}

/** In the Engineering lens, clicking a component shows a compact card in the viewport. */
function ComponentToast() {
  const id = useLab((s) => s.selectedComponent)
  const live = useLab((s) => (id ? COMPONENT_BY_ID[id].live(s.snapshot) : ''))
  const close = useLab((s) => s.selectComponent)
  const setPage = useLab((s) => s.setPage)
  if (!id) {
    return (
      <div className="pointer-events-none absolute right-2.5 bottom-7 text-[11px] text-muted">Click any machine part to identify it</div>
    )
  }
  const c = COMPONENT_BY_ID[id]
  return (
    <div className="absolute right-2.5 bottom-7 w-[300px] rounded-md border border-line-strong bg-surface/95 p-3 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="text-[13px] font-semibold text-ink">{c.name}</div>
        <button onClick={() => close(null)} className="text-muted hover:text-ink" aria-label="Close">
          ×
        </button>
      </div>
      <p className="mt-1 text-[12px] leading-snug text-ink-2">{c.purpose}</p>
      <div className="mt-1.5 font-mono text-[11px] text-accent">{live}</div>
      <button onClick={() => setPage('architecture')} className="mt-2 text-[11.5px] text-accent hover:underline">
        Open in Architecture
      </button>
    </div>
  )
}
