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
        <rect x="0" y="0" width="20" height="20" rx="5" fill="#4c9aff" />
        <rect x="5.5" y="4" width="9" height="12" rx="1.2" fill="none" stroke="#fff" strokeWidth="1.5" />
        <line x1="10" y1="4" x2="10" y2="16" stroke="#fff" strokeWidth="1.5" />
      </svg>
      <div className="flex flex-col leading-none">
        <span className="text-[14px] font-semibold tracking-tight text-ink">LiftLab</span>
        <span className="mt-0.5 hidden text-[10.5px] text-faint md:inline">Elevator engineering lab</span>
      </div>
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
      <header className="flex h-13 shrink-0 items-center gap-4 overflow-x-auto border-b border-line bg-surface px-4 [scrollbar-width:none] md:gap-8">
        <Logo />
        <nav className="flex shrink-0 items-center gap-0.5 rounded-lg bg-surface-2 p-1">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setPage(n.id)}
              className={clsx(
                'h-7 rounded-md px-2.5 text-[12.5px] font-medium whitespace-nowrap transition-colors md:px-3',
                page === n.id ? 'bg-surface-3 text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-muted hover:text-ink',
              )}
            >
              {n.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-3 text-[12px] text-muted sm:flex">
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
