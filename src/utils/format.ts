export const fmtTime = (t: number) => {
  const m = Math.floor(t / 60)
  const s = t - m * 60
  return `${String(m).padStart(2, '0')}:${s.toFixed(2).padStart(5, '0')}`
}
export const fmt = (n: number, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '—')
