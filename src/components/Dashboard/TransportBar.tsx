import clsx from 'clsx'
import { Footprints, Pause, Play, RotateCcw, SkipBack, SkipForward, Square } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useLab, type BottomTab } from '../../store/useLab'
import { fmtTime } from '../../utils/format'
import { Btn, Segmented } from '../ui'

const TABS: { id: BottomTab; label: string }[] = [
  { id: 'timeline', label: 'Event timeline' },
  { id: 'queue', label: 'Request queue' },
  { id: 'motion', label: 'Motion' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'faults', label: 'Failures' },
]

export function TransportBar() {
  const s = useLab(
    useShallow((st) => ({
      paused: st.paused,
      speed: st.speed,
      stepMode: st.stepMode,
      playing: st.playing,
      tab: st.bottomTab,
      time: st.snapshot.time,
      faults: st.snapshot.faults.length,
    })),
  )
  const a = useLab(
    useShallow((st) => ({
      togglePause: st.togglePause,
      setSpeed: st.setSpeed,
      restart: st.restart,
      setStepMode: st.setStepMode,
      stepNext: st.stepNext,
      stepPrev: st.stepPrev,
      setPlaying: st.setPlaying,
      setTab: st.setBottomTab,
    })),
  )

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 overflow-x-auto border-b border-line bg-surface px-2 [scrollbar-width:none]">
      <div className="flex shrink-0 items-center gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => a.setTab(t.id)}
            className={clsx(
              'relative h-7 rounded px-2 text-[12px] whitespace-nowrap transition-colors',
              s.tab === t.id ? 'bg-surface-3 text-ink' : 'text-muted hover:text-ink-2',
            )}
          >
            {t.label}
            {t.id === 'faults' && s.faults > 0 && <span className="ml-1 rounded bg-danger/20 px-1 font-mono text-[10px] text-danger">{s.faults}</span>}
          </button>
        ))}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="hidden border-r border-line pr-3 font-mono text-[11.5px] whitespace-nowrap text-muted tabular-nums 2xl:inline">
          sim t {fmtTime(s.time)}
        </span>

        {s.stepMode ? (
          <div className="flex items-center gap-1">
            <Btn size="sm" onClick={a.stepPrev} title="Previous step">
              <SkipBack size={12} /> Prev
            </Btn>
            <Btn size="sm" tone="accent" onClick={a.stepNext} title="Execute the next operation">
              <SkipForward size={12} /> Next step
            </Btn>
            <Btn size="sm" active={s.playing} onClick={() => a.setPlaying(!s.playing)} title="Play the sequence step by step">
              {s.playing ? <Square size={11} /> : <Play size={12} />} {s.playing ? 'Stop' : 'Play'}
            </Btn>
          </div>
        ) : (
          <>
            <Btn size="sm" onClick={a.togglePause} title={s.paused ? 'Resume' : 'Pause'} className="w-[74px]">
              {s.paused ? <Play size={12} /> : <Pause size={12} />} {s.paused ? 'Resume' : 'Pause'}
            </Btn>
            <Segmented size="sm" value={s.speed} onChange={a.setSpeed} options={[0.5, 1, 2, 4].map((v) => ({ value: v, label: `${v}×` }))} />
          </>
        )}
        <Btn size="sm" active={s.stepMode} onClick={() => a.setStepMode(!s.stepMode)} title="Step-by-step execution">
          <Footprints size={12} /> Step
        </Btn>
        <Btn size="sm" onClick={a.restart} title="Restart the simulation">
          <RotateCcw size={12} />
        </Btn>
      </div>
    </div>
  )
}
