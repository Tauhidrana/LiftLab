import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import { StatePill } from './components/ui'
import { AlgorithmsPage } from './pages/AlgorithmsPage'
import { ChallengesPage } from './pages/ChallengesPage'
import { GroupPage } from './pages/GroupPage'
import { ArchitecturePage } from './pages/ArchitecturePage'
import { LearningPage } from './pages/LearningPage'
import { SettingsPage } from './pages/SettingsPage'
import { SimulationPage } from './pages/SimulationPage'
import { useLab, type Page } from './store/useLab'
import { MobileSimulation } from './pages/MobileSimulation'
import { useNarrow } from './utils/useNarrow'

const NAV: { id: Page; label: string }[] = [
  { id: 'simulation', label: 'Simulation' },
  { id: 'architecture', label: 'Architecture' },
  { id: 'group', label: 'Group control' },
  { id: 'algorithms', label: 'Algorithms' },
  { id: 'challenges', label: 'Challenges' },
  { id: 'learning', label: 'Learning' },
  { id: 'settings', label: 'Settings' },
]

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
        <rect x="3" y="1.5" width="14" height="17" rx="2" fill="none" stroke="#3ad1e8" strokeWidth="1.5" />
        <line x1="10" y1="1.5" x2="10" y2="6" stroke="#3ad1e8" strokeWidth="1.5" />
        <rect x="6" y="6" width="8" height="7" rx="1" fill="#3ad1e8" />
      </svg>
      <span className="text-[14px] font-semibold tracking-tight text-ink">LiftLab</span>
      <span className="hidden font-mono text-[10px] text-faint md:inline">elevator engineering lab</span>
    </div>
  )
}

export default function App() {
  const page = useLab((s) => s.page)
  const setPage = useLab((s) => s.setPage)
  const narrow = useNarrow()
  const s = useLab(useShallow((st) => ({ state: st.snapshot.state, op: st.operation, alg: st.config.algorithm, floors: st.config.floors })))
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-11 shrink-0 items-center gap-4 overflow-x-auto border-b border-line bg-surface px-4 [scrollbar-width:none] md:gap-6">
        <Logo />
        <nav className="flex h-full shrink-0 items-center gap-0.5">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={clsx(
                'relative h-full px-2 text-[12.5px] whitespace-nowrap transition-colors md:px-3',
                page === n.id ? 'text-ink' : 'text-muted hover:text-ink-2',
              )}
            >
              {n.label}
              {page === n.id && <span className="absolute inset-x-3 bottom-0 h-px bg-accent" />}
            </button>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-3 font-mono text-[11px] text-muted sm:flex">
          <span className="hidden lg:inline">
            {s.floors} floors · {s.alg} · {s.op}
          </span>
          <StatePill state={s.state} />
        </div>
      </header>
      <main className="min-h-0 flex-1">
        {page === 'simulation' && (narrow ? <MobileSimulation /> : <SimulationPage />)}
        {page === 'architecture' && <ArchitecturePage />}
        {page === 'group' && <GroupPage />}
        {page === 'algorithms' && <AlgorithmsPage />}
        {page === 'challenges' && <ChallengesPage />}
        {page === 'learning' && <LearningPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
    </div>
  )
}
