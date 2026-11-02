import { useCallback } from 'react'
import { useLab, type Lang } from '../store/useLab'
import { BN } from './bn'
import { translateMessage } from './messages'

type Vars = Record<string, string | number>

/** Translate an English UI string. Unknown strings fall back to English. `{name}` placeholders are filled from `vars`. */
export function tr(lang: Lang, s: string, vars?: Vars): string {
  let out = lang === 'bn' ? (BN[s] ?? s) : s
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(lang === 'bn' ? toBnDigits(v) : v))
  return out
}

export function useT() {
  const lang = useLab((s) => s.lang)
  return useCallback((s: string, vars?: Vars) => tr(lang, s, vars), [lang])
}

/** Engine event messages are built at runtime; translate them by pattern. */
export function useMsg() {
  const lang = useLab((s) => s.lang)
  return useCallback((s: string | undefined) => (s && lang === 'bn' ? translateMessage(s) : (s ?? '')), [lang])
}

const BN_DIGITS = '০১২৩৪৫৬৭৮৯'
export const toBnDigits = (v: string | number) => String(v).replace(/[0-9]/g, (d) => BN_DIGITS[+d])
