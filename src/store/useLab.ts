import { create } from 'zustand'
import type { Algorithm, FaultId, HallDirection, OperationMode, SimConfig, Snapshot, TraceEvent } from '../engine/types'
import type { ComponentId } from '../content/components'
import type { CustomSelect } from '../engine/RequestScheduler'
import { runtime } from './runtime'

export type Page = 'simulation' | 'architecture' | 'group' | 'algorithms' | 'challenges' | 'learning' | 'settings'
export type CameraPreset = 'building' | 'interior' | 'shaft' | 'machine' | 'cutaway'
export type BottomTab = 'timeline' | 'queue' | 'motion' | 'metrics' | 'faults'
export type Lang = 'en' | 'bn'
export type CodeLang = 'python' | 'typescript'

// Per-viewer preferences; storage can be unavailable (private mode), so never let it throw.
const pref = <T extends string>(key: string, fallback: T, allowed: T[]): T => {
  try {
    const v = localStorage.getItem(key) as T | null
    return v && allowed.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}
const savePref = (key: string, v: string) => {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* ignore */
  }
}

interface LabState {
  page: Page
  lang: Lang
  codeLang: CodeLang
  setLang(l: Lang): void
  setCodeLang(l: CodeLang): void
  operation: OperationMode
  /** Lenses can be combined with any operation mode. */
  debug: boolean
  engineering: boolean
  failureLab: boolean

  camera: CameraPreset
  cameraNonce: number
  bottomTab: BottomTab

  snapshot: Snapshot
  events: TraceEvent[]
  generation: number
  /** null = follow the latest event live */
  selectedEventId: number | null

  paused: boolean
  speed: number
  stepMode: boolean
  playing: boolean

  selectedComponent: ComponentId | null
  hoveredComponent: ComponentId | null
  config: SimConfig

  setPage(p: Page): void
  setOperation(m: OperationMode): void
  toggleLens(l: 'debug' | 'engineering' | 'failureLab'): void
  setCamera(c: CameraPreset): void
  setBottomTab(t: BottomTab): void
  selectEvent(id: number | null): void
  selectComponent(id: ComponentId | null): void
  hoverComponent(id: ComponentId | null): void

  pressCar(floor: number): void
  pressHall(floor: number, dir: HallDirection): void
  doorOpen(): void
  doorClose(): void
  emergencyStop(): void
  toggleFault(f: FaultId): void
  resetSystem(): void
  setAlgorithm(a: Algorithm): void
  hasCustom: boolean
  loadCustomScheduler(fn: CustomSelect): void

  togglePause(): void
  setSpeed(s: number): void
  restart(): void
  applyConfig(c: Partial<SimConfig>): void

  setStepMode(on: boolean): void
  stepNext(): void
  stepPrev(): void
  setPlaying(on: boolean): void
}

const c = () => runtime.controller

export const useLab = create<LabState>((set, get) => ({
  page: 'simulation',
  lang: pref<Lang>('liftlab.lang', 'en', ['en', 'bn']),
  codeLang: pref<CodeLang>('liftlab.codeLang', 'python', ['python', 'typescript']),
  setLang: (lang) => {
    savePref('liftlab.lang', lang)
    document.documentElement.lang = lang
    set({ lang })
  },
  setCodeLang: (codeLang) => {
    savePref('liftlab.codeLang', codeLang)
    set({ codeLang })
  },
  operation: runtime.config.mode,
  debug: false,
  engineering: false,
  failureLab: false,
  camera: 'building',
  cameraNonce: 0,
  bottomTab: 'timeline',
  snapshot: c().getSnapshot(),
  events: [...runtime.events],
  generation: runtime.generation,
  selectedEventId: null,
  paused: false,
  speed: 1,
  stepMode: false,
  playing: false,
  selectedComponent: null,
  hoveredComponent: null,
  config: runtime.config,

  setPage: (page) => set({ page }),
  setOperation: (m) => {
    c().setMode(m)
    set({ operation: m })
  },
  toggleLens: (l) => {
    const on = !get()[l]
    set({ [l]: on } as Partial<LabState>)
    if (l === 'engineering') set({ camera: on ? 'cutaway' : 'building', cameraNonce: get().cameraNonce + 1 })
    if (l === 'failureLab' && on) set({ bottomTab: 'faults' })
  },
  setCamera: (camera) => set({ camera, cameraNonce: get().cameraNonce + 1 }),
  setBottomTab: (bottomTab) => set({ bottomTab }),
  selectEvent: (id) => set({ selectedEventId: id }),
  selectComponent: (id) => set({ selectedComponent: id }),
  hoverComponent: (id) => set({ hoveredComponent: id }),

  pressCar: (f) => input(() => c().pressCarButton(f)),
  pressHall: (f, d) => input(() => c().pressHallButton(f, d)),
  doorOpen: () => input(() => c().pressDoorOpen()),
  doorClose: () => input(() => c().pressDoorClose()),
  emergencyStop: () => input(() => c().pressEmergencyStop()),
  toggleFault: (f) => input(() => (c().safety.has(f) ? c().clearFault(f) : c().injectFault(f))),
  resetSystem: () => input(() => c().resetSystem()),
  setAlgorithm: (a) => {
    input(() => c().setAlgorithm(a))
    set({ config: { ...runtime.config, algorithm: a } })
    runtime.config.algorithm = a
  },

  hasCustom: false,
  loadCustomScheduler: (fn) => {
    runtime.custom = fn
    c().scheduler.custom = fn
    c().scheduler.customError = null
    set({ hasCustom: true })
    get().setAlgorithm('CUSTOM')
  },

  togglePause: () => {
    runtime.paused = !runtime.paused
    set({ paused: runtime.paused })
  },
  setSpeed: (s) => {
    runtime.speed = s
    set({ speed: s })
  },
  restart: () => {
    runtime.rebuild({ mode: get().operation })
    set({ selectedEventId: null, playing: false })
  },
  applyConfig: (cfg) => {
    runtime.rebuild({ ...cfg, mode: get().operation })
    set({ config: runtime.config, selectedEventId: null })
  },

  setStepMode: (on) => {
    runtime.stepMode = on
    const last = runtime.events.at(-1)?.id ?? null
    set({ stepMode: on, playing: false, selectedEventId: on ? last : null })
  },
  stepNext: () => {
    const { selectedEventId } = get()
    const events = runtime.events
    const idx = events.findIndex((e) => e.id === selectedEventId)
    // Next already-recorded event (skipping verbose ones unless debugging)…
    for (let i = idx + 1; i < events.length; i++) {
      if (get().debug || events[i].level !== 'verbose') return set({ selectedEventId: events[i].id })
    }
    // …or run the engine forward until something new happens.
    const lastId = events.at(-1)?.id ?? 0
    if (!runtime.runUntilEvent()) return set({ playing: false })
    const next = runtime.events.find((e) => e.id > lastId && (get().debug || e.level !== 'verbose'))
    set({ selectedEventId: next?.id ?? runtime.events.at(-1)?.id ?? null })
  },
  stepPrev: () => {
    const { selectedEventId, debug } = get()
    const events = runtime.events
    const idx = events.findIndex((e) => e.id === selectedEventId)
    for (let i = idx - 1; i >= 0; i--) {
      if (debug || events[i].level !== 'verbose') return set({ selectedEventId: events[i].id })
    }
  },
  setPlaying: (on) => set({ playing: on }),
}))

/** User inputs: in step mode, jump the cursor to the first event they caused. */
function input(fn: () => void) {
  const lastId = runtime.events.at(-1)?.id ?? 0
  fn()
  const s = useLab.getState()
  if (s.stepMode) {
    const first = runtime.events.find((e) => e.id > lastId)
    if (first) useLab.setState({ selectedEventId: first.id })
  }
}

/* Push engine state into React at ~15 Hz (the 3D view reads the engine directly every frame). */
let lastPush = 0
let lastEventsVersion = -1
runtime.subscribe(() => {
  const now = performance.now()
  if (now - lastPush < 66) return
  lastPush = now
  const patch: Partial<LabState> = { snapshot: runtime.controller.getSnapshot() }
  if (runtime.eventsVersion !== lastEventsVersion) {
    lastEventsVersion = runtime.eventsVersion
    patch.events = [...runtime.events]
  }
  if (useLab.getState().generation !== runtime.generation) patch.generation = runtime.generation
  useLab.setState(patch)
})

/* Step-mode autoplay. */
let playTimer: ReturnType<typeof setInterval> | null = null
useLab.subscribe((s, prev) => {
  if (s.playing === prev.playing) return
  if (playTimer) clearInterval(playTimer)
  playTimer = s.playing ? setInterval(() => useLab.getState().stepNext(), 900) : null
})

runtime.start()
