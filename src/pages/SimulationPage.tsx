import { Group, Panel, Separator } from 'react-resizable-panels'
import { CodeInspector } from '../components/CodeInspector/CodeInspector'
import { ControlPanel } from '../components/ControlPanel/ControlPanel'
import { FaultsPanel, MetricsPanel, MotionPanel, QueuePanel } from '../components/Dashboard/Panels'
import { TransportBar } from '../components/Dashboard/TransportBar'
import { Viewport } from '../components/Elevator3D/Viewport'
import { EventTimeline } from '../components/EventTimeline/EventTimeline'
import { useLab } from '../store/useLab'

export function Handle({ vertical }: { vertical?: boolean }) {
  return (
    <Separator
      className={
        vertical
          ? 'relative h-px bg-line transition-colors hover:bg-accent/60 data-[separator=active]:bg-accent before:absolute before:inset-x-0 before:-top-1 before:-bottom-1'
          : 'relative w-px bg-line transition-colors hover:bg-accent/60 data-[separator=active]:bg-accent before:absolute before:inset-y-0 before:-left-1 before:-right-1'
      }
    />
  )
}

export function SimulationPage() {
  const tab = useLab((s) => s.bottomTab)
  return (
    <Group orientation="horizontal" className="h-full">
      <Panel id="controls" defaultSize="248px" minSize="200px" maxSize="340px" collapsible collapsedSize="0px">
        <ControlPanel />
      </Panel>
      <Handle />
      <Panel id="center" minSize="30%">
        <Group orientation="vertical" className="h-full">
          <Panel id="viewport" minSize="25%">
            <Viewport />
          </Panel>
          <Handle vertical />
          <Panel id="bottom" defaultSize="34%" minSize="40px" collapsible collapsedSize="40px">
            <div className="flex h-full min-h-0 flex-col bg-surface">
              <TransportBar />
              <div className="min-h-0 flex-1">
                {tab === 'timeline' && <EventTimeline />}
                {tab === 'queue' && <QueuePanel />}
                {tab === 'motion' && <MotionPanel />}
                {tab === 'metrics' && <MetricsPanel />}
                {tab === 'faults' && <FaultsPanel />}
              </div>
            </div>
          </Panel>
        </Group>
      </Panel>
      <Handle />
      <Panel id="inspector" defaultSize="440px" minSize="320px" maxSize="60%" collapsible collapsedSize="0px">
        <CodeInspector />
      </Panel>
    </Group>
  )
}
