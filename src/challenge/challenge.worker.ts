/// <reference lib="webworker" />
import { runBenchmark } from '../engine/benchmark'
import { DEFAULT_CONFIG } from '../engine/config'
import type { CustomSelect } from '../engine/RequestScheduler'
import { CHALLENGES } from './challenges'

/**
 * Runs user code away from the page: an endless loop here cannot freeze the UI,
 * and the page terminates this worker after a time limit.
 */
self.onmessage = (e: MessageEvent<{ code: string; challengeId: string }>) => {
  const { code, challengeId } = e.data
  let fn: CustomSelect | null
  try {
    fn = new Function(`"use strict";\n${code}\n;return typeof selectNext === 'function' ? selectNext : null`)() as CustomSelect | null
  } catch (err) {
    return self.postMessage({ error: `Your code does not compile: ${(err as Error).message}` })
  }
  if (!fn) return self.postMessage({ error: 'Define a function named selectNext(ctx).' })
  const ch = CHALLENGES.find((c) => c.id === challengeId)!
  const cfg = { ...DEFAULT_CONFIG, ...ch.config }
  const [mine] = runBenchmark(cfg, ['CUSTOM'], { custom: fn })
  const refs = runBenchmark(cfg, ch.references)
  self.postMessage({ mine, refs })
}
