import clsx from 'clsx'
import { useState } from 'react'
import { CodeInspector } from '../components/CodeInspector/CodeInspector'
import { ControlPanel } from '../components/ControlPanel/ControlPanel'
import { FaultsPanel, MetricsPanel, MotionPanel, QueuePanel } from '../components/Dashboard/Panels'
import { TransportBar } from '../components/Dashboard/TransportBar'
import { Viewport } from '../components/Elevator3D/Viewport'
import { EventTimeline } from '../components/EventTimeline/EventTimeline'
import { useLab } from '../store/useLab'
import { useT } from '../i18n'

type Tab = 'controls' | 'inspector' | 'panels'

/** Narrow-screen layout: 3D on top, one panel at a time below. */
export function MobileSimulation() {
  const [tab, setTab] = useState<Tab>('controls')
  const bottom = useLab((s) => s.bottomTab)
  const t = useT()
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="h-[42vh] shrink-0 border-b border-line">
        <Viewport />
      </div>
      <div className="flex shrink-0 gap-1 border-b border-line bg-surface px-2 py-1">
        {(
          [
            ['controls', 'Controls'],
            ['inspector', 'Code inspector'],
            ['panels', 'Timeline & data'],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={clsx('h-7 flex-1 rounded text-[12px]', tab === id ? 'bg-surface-3 text-ink' : 'text-muted')}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'controls' && <ControlPanel />}
        {tab === 'inspector' && <CodeInspector />}
        {tab === 'panels' && (
          <div className="flex h-full min-h-0 flex-col">
            <TransportBar />
            <div className="min-h-0 flex-1 overflow-auto">
              {bottom === 'timeline' && <EventTimeline />}
              {bottom === 'queue' && <QueuePanel />}
              {bottom === 'motion' && <MotionPanel />}
              {bottom === 'metrics' && <MetricsPanel />}
              {bottom === 'faults' && <FaultsPanel />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
