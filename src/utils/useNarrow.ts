import { useSyncExternalStore } from 'react'

const QUERY = '(max-width: 900px)'
const subscribe = (cb: () => void) => {
  const m = window.matchMedia(QUERY)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

/** True on phone / small-tablet widths, where the three-panel desktop layout does not fit. */
export const useNarrow = () => useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches)
