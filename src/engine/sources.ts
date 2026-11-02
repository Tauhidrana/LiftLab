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

export type SourceFile = keyof typeof SOURCES

export const SOURCE_LINES: Record<SourceFile, string[]> = Object.fromEntries(
  Object.entries(SOURCES).map(([k, v]) => [k, v.split('\n')]),
) as Record<SourceFile, string[]>

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

/** Index every `emit('marker'` call site across the sources. */
export const MARKERS: Record<string, CodeLocation> = (() => {
  const out: Record<string, CodeLocation> = {}
  for (const file of Object.keys(SOURCES) as SourceFile[]) {
    const lines = SOURCE_LINES[file]
    lines.forEach((l, i) => {
      const m = l.match(/emit\(\s*'([^']+)'/)
      if (m && !out[m[1]]) out[m[1]] = { file, line: i, ...enclosingFunction(lines, i) }
    })
  }
  return out
})()

/** Find where a named method lives (for the "call path" links). */
export function locateFunction(name: string): CodeLocation | null {
  for (const file of Object.keys(SOURCES) as SourceFile[]) {
    const lines = SOURCE_LINES[file]
    const i = lines.findIndex((l) => (l.match(METHOD_RE) ?? l.match(FUNCTION_RE))?.[1] === name)
    if (i >= 0) return { file, line: i, ...enclosingFunction(lines, i) }
  }
  return null
}
