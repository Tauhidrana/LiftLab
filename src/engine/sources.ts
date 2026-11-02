/**
 * The engine's real source files, imported as text so the Code Inspector shows
 * exactly the code that is running — not a decorative copy.
 */
import controller from './ElevatorController.ts?raw'
import stateMachine from './ElevatorStateMachine.ts?raw'
import scheduler from './RequestScheduler.ts?raw'
import movement from './MovementEngine.ts?raw'
import doors from './DoorController.ts?raw'
import safety from './SafetySystem.ts?raw'
import traffic from './TrafficSimulator.ts?raw'
import runtimeSrc from '../store/runtime.ts?raw'
// Readable Python versions of the same engine (same trace markers, so the same line lights up).
import pyController from './python/elevator_controller.py?raw'
import pyScheduler from './python/scheduler.py?raw'
import pyStateMachine from './python/state_machine.py?raw'
import pyMovement from './python/movement.py?raw'
import pyDoors from './python/door_controller.py?raw'
import pySafety from './python/safety_system.py?raw'
import pyTraffic from './python/traffic.py?raw'
import pyRuntime from './python/runtime.py?raw'

export const SOURCES = {
  'ElevatorController.ts': controller,
  'RequestScheduler.ts': scheduler,
  'ElevatorStateMachine.ts': stateMachine,
  'MovementEngine.ts': movement,
  'DoorController.ts': doors,
  'SafetySystem.ts': safety,
  'TrafficSimulator.ts': traffic,
  'runtime.ts': runtimeSrc,
} as const

export const PY_SOURCES: Record<string, string> = {
  'elevator_controller.py': pyController,
  'scheduler.py': pyScheduler,
  'state_machine.py': pyStateMachine,
  'movement.py': pyMovement,
  'door_controller.py': pyDoors,
  'safety_system.py': pySafety,
  'traffic.py': pyTraffic,
  'runtime.py': pyRuntime,
}

export type CodeLang = 'python' | 'typescript'
export type SourceFile = string

const splitLines = (src: Record<string, string>) => Object.fromEntries(Object.entries(src).map(([k, v]) => [k, v.split('\n')]))
export const SOURCE_LINES: Record<SourceFile, string[]> = { ...splitLines(SOURCES), ...splitLines(PY_SOURCES) }
export const FILES_BY_LANG: Record<CodeLang, SourceFile[]> = { typescript: Object.keys(SOURCES), python: Object.keys(PY_SOURCES) }

export interface CodeLocation {
  file: SourceFile
  line: number // 0-based line of the emit() marker
  fnStart: number
  fnEnd: number
  fnName: string
}

/** Methods whose body contains a given line, found by brace matching. */
const METHOD_RE = /^\s{2}(?:private |public |static |readonly )*(?:get )?([A-Za-z_]\w*)\s*\(.*\)\s*(?::\s*[^{]+)?\{\s*$/
const FUNCTION_RE = /^(?:export )?function\s+([A-Za-z_]\w*)/

function enclosingFunction(lines: string[], at: number) {
  for (let i = at; i >= 0; i--) {
    const m = lines[i].match(METHOD_RE) ?? lines[i].match(FUNCTION_RE)
    if (!m) continue
    let depth = 0
    let end = i
    for (let j = i; j < lines.length; j++) {
      for (const ch of lines[j]) {
        if (ch === '{') depth++
        else if (ch === '}') depth--
      }
      if (depth === 0 && j > i) {
        end = j
        break
      }
    }
    if (end >= at) return { fnStart: i, fnEnd: end, fnName: m[1] }
  }
  return { fnStart: at, fnEnd: at, fnName: '?' }
}

/** Python: a function runs from its `def` until the indentation drops back. */
function enclosingPyFunction(lines: string[], at: number) {
  for (let i = at; i >= 0; i--) {
    const m = lines[i].match(/^(\s*)def (\w+)\(/)
    if (!m) continue
    const indent = m[1].length
    let end = i
    for (let j = i + 1; j < lines.length; j++) {
      if (!lines[j].trim()) continue
      if (lines[j].length - lines[j].trimStart().length <= indent) break
      end = j
    }
    if (end >= at) return { fnStart: i, fnEnd: end, fnName: m[2] }
  }
  return { fnStart: at, fnEnd: at, fnName: '?' }
}

/** Index every `emit('marker'` call site across one language's sources. */
function indexMarkers(lang: CodeLang): Record<string, CodeLocation> {
  const out: Record<string, CodeLocation> = {}
  for (const file of FILES_BY_LANG[lang]) {
    const lines = SOURCE_LINES[file]
    lines.forEach((l, i) => {
      const m = l.match(/emit\(\s*'([^']+)'/)
      if (m && !out[m[1]]) out[m[1]] = { file, line: i, ...(lang === 'python' ? enclosingPyFunction(lines, i) : enclosingFunction(lines, i)) }
    })
  }
  return out
}
export const MARKERS_BY_LANG: Record<CodeLang, Record<string, CodeLocation>> = { typescript: indexMarkers('typescript'), python: indexMarkers('python') }
export const MARKERS = MARKERS_BY_LANG.typescript

/** 'ElevatorController.pressCarButton' → 'ElevatorController.press_car_button' for the Python view. */
export const fnLabel = (fn: string, lang: CodeLang) =>
  lang === 'python' ? fn.replace(/\.(\w+)$/, (_, m: string) => '.' + m.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())) : fn

/** Find where a named method lives (for the "call path" links). */
export function locateFunction(name: string): CodeLocation | null {
  for (const file of FILES_BY_LANG.typescript) {
    const lines = SOURCE_LINES[file]
    const i = lines.findIndex((l) => (l.match(METHOD_RE) ?? l.match(FUNCTION_RE))?.[1] === name)
    if (i >= 0) return { file, line: i, ...enclosingFunction(lines, i) }
  }
  return null
}
