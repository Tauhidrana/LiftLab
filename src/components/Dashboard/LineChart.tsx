import { useEffect, useRef, useState } from 'react'
import { runtime, type Sample } from '../../store/runtime'

/**
 * Single-series live line chart drawn on a canvas straight from the runtime's
 * history buffer (no React re-render per frame). Hover shows a crosshair + value.
 */
export function LiveLineChart({
  title,
  unit,
  pick,
  min,
  max,
  color = '#4c9aff',
  height = 92,
}: {
  title: string
  unit: string
  pick: (s: Sample) => number
  min: number
  max: number
  color?: string
  height?: number
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const hover = useRef<number | null>(null)
  const [tip, setTip] = useState<{ x: number; text: string } | null>(null)

  useEffect(() => {
    let raf = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      const el = canvas.current
      if (!el) return
      const dpr = window.devicePixelRatio || 1
      const w = el.clientWidth
      const h = el.clientHeight
      if (el.width !== w * dpr) el.width = w * dpr
      if (el.height !== h * dpr) el.height = h * dpr
      const ctx = el.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const data = runtime.history
      const padL = 34
      const padB = 14
      const now = runtime.controller.time
      const t0 = now - 30
      const lo = Math.min(min, ...data.map(pick))
      const hi = Math.max(max, ...data.map(pick))
      const X = (t: number) => padL + ((t - t0) / 30) * (w - padL - 4)
      const Y = (v: number) => 4 + (1 - (v - lo) / (hi - lo || 1)) * (h - padB - 8)

      // recessive grid + axis labels
      ctx.font = '10px "IBM Plex Mono", monospace'
      ctx.fillStyle = '#5b6370'
      ctx.strokeStyle = '#1e232a'
      ctx.lineWidth = 1
      for (const v of [lo, (lo + hi) / 2, hi]) {
        ctx.beginPath()
        ctx.moveTo(padL, Y(v) + 0.5)
        ctx.lineTo(w - 4, Y(v) + 0.5)
        ctx.stroke()
        ctx.fillText(v.toFixed(1), 2, Y(v) + 3)
      }
      if (lo < 0 && hi > 0) {
        ctx.strokeStyle = '#2f353e'
        ctx.beginPath()
        ctx.moveTo(padL, Y(0) + 0.5)
        ctx.lineTo(w - 4, Y(0) + 0.5)
        ctx.stroke()
      }
      ctx.fillText('−30 s', padL, h - 2)
      ctx.fillText('now', w - 26, h - 2)

      if (data.length > 1) {
        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.beginPath()
        data.forEach((s, i) => (i ? ctx.lineTo(X(s.t), Y(pick(s))) : ctx.moveTo(X(s.t), Y(pick(s)))))
        ctx.stroke()
      }
      if (hover.current !== null && data.length) {
        const t = t0 + ((hover.current - padL) / (w - padL - 4)) * 30
        let best = data[0]
        for (const s of data) if (Math.abs(s.t - t) < Math.abs(best.t - t)) best = s
        const x = X(best.t)
        ctx.strokeStyle = '#4b5563'
        ctx.beginPath()
        ctx.moveTo(x + 0.5, 4)
        ctx.lineTo(x + 0.5, h - padB)
        ctx.stroke()
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, Y(pick(best)), 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#111418'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [pick, min, max, color])

  return (
    <div className="relative">
      <div className="mb-1 flex items-baseline gap-2">
        <span className="text-[11px] font-medium text-ink-2">{title}</span>
        <span className="font-mono text-[10px] text-faint">{unit}</span>
      </div>
      <canvas
        ref={canvas}
        style={{ height }}
        className="block w-full"
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          hover.current = e.clientX - r.left
          const data = runtime.history
          if (!data.length) return
          const now = runtime.controller.time
          const t = now - 30 + ((hover.current - 34) / (r.width - 38)) * 30
          let best = data[0]
          for (const s of data) if (Math.abs(s.t - t) < Math.abs(best.t - t)) best = s
          setTip({ x: hover.current, text: `${pick(best).toFixed(2)} ${unit} · t=${best.t.toFixed(1)}s` })
        }}
        onMouseLeave={() => {
          hover.current = null
          setTip(null)
        }}
      />
      {tip && (
        <div
          className="pointer-events-none absolute top-5 rounded border border-line-strong bg-surface-3 px-1.5 py-0.5 font-mono text-[10.5px] text-ink"
          style={{ left: Math.min(tip.x + 8, 9999) }}
        >
          {tip.text}
        </div>
      )}
    </div>
  )
}
