import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { ComponentId } from '../../content/components'
import { useLab } from '../../store/useLab'

export const ACCENT = '#4c9aff'

interface HLProps {
  id?: ComponentId
  color: string
  metalness?: number
  roughness?: number
  transparent?: boolean
  opacity?: number
  emissive?: string
  emissiveIntensity?: number
  side?: THREE.Side
  clip?: THREE.Plane[]
  map?: THREE.Texture
  roughnessMap?: THREE.Texture
}

/** A standard material that glows when its mechanical component is selected or hovered. */
export function HLMaterial({ id, color, metalness = 0.4, roughness = 0.5, emissive = '#000000', emissiveIntensity = 1, ...rest }: HLProps) {
  const ref = useRef<THREE.MeshStandardMaterial>(null!)
  useFrame(() => {
    if (!id || !ref.current) return
    const s = useLab.getState()
    const selected = s.selectedComponent === id
    const hovered = s.hoveredComponent === id
    if (selected || hovered) {
      ref.current.emissive.set(ACCENT)
      ref.current.emissiveIntensity = selected ? 0.55 + Math.sin(performance.now() / 260) * 0.15 : 0.3
    } else {
      ref.current.emissive.set(emissive)
      ref.current.emissiveIntensity = emissiveIntensity
    }
  })
  return (
    <meshStandardMaterial
      ref={ref}
      color={color}
      metalness={metalness}
      roughness={roughness}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      transparent={rest.transparent}
      opacity={rest.opacity ?? 1}
      side={rest.side ?? THREE.FrontSide}
      clippingPlanes={rest.clip ?? null}
      map={rest.map ?? null}
      roughnessMap={rest.roughnessMap ?? null}
      depthWrite={!rest.transparent || (rest.opacity ?? 1) > 0.5}
    />
  )
}

/** Makes a group selectable as a mechanical component (Architecture page / Engineering lens). */
export function Pickable({ id, children }: { id: ComponentId; children: ReactNode }) {
  const enabled = useLab((s) => s.page === 'architecture' || s.engineering)
  const select = useLab((s) => s.selectComponent)
  const hover = useLab((s) => s.hoverComponent)
  if (!enabled) return <group>{children}</group>
  return (
    <group
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation()
        select(id)
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation()
        hover(id)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={() => {
        hover(null)
        document.body.style.cursor = ''
      }}
    >
      {children}
    </group>
  )
}

/** A canvas-backed texture for labels, displays and button panels (no font downloads). */
export function makeCanvasTexture(w: number, h: number) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return { canvas, ctx, texture }
}

export const font = (size: number, weight = 500) => `${weight} ${size}px "IBM Plex Mono", ui-monospace, monospace`

type TexKind = 'brushed' | 'concrete' | 'granite' | 'ceiling' | 'marble' | 'wood'
const texCache = new Map<string, THREE.Texture>()

/** Procedural surface textures (brushed steel, concrete, granite tile), cached per kind + repeat. */
export function surfaceTexture(kind: TexKind, rx = 1, ry = 1) {
  const key = `${kind}${rx}x${ry}`
  const hit = texCache.get(key)
  if (hit) return hit
  const base = texCache.get(kind) ?? drawSurface(kind)
  texCache.set(kind, base)
  const t = rx === 1 && ry === 1 ? base : base.clone()
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(rx, ry)
  t.needsUpdate = true
  texCache.set(key, t)
  return t
}

function drawSurface(kind: TexKind) {
  const n = kind === 'ceiling' || kind === 'concrete' ? 256 : 512
  const { ctx, texture } = makeCanvasTexture(n, n)
  const gray = (v: number, a: number) => `rgba(${v},${v},${v},${a})`
  if (kind === 'brushed') {
    ctx.fillStyle = '#c4c9ce'
    ctx.fillRect(0, 0, n, n)
    // vertical grain
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = gray(Math.random() < 0.5 ? 255 : 120, 0.03 + Math.random() * 0.04)
      ctx.fillRect(Math.random() * n, Math.random() * n, 1, 20 + Math.random() * n)
    }
  } else if (kind === 'concrete' || kind === 'ceiling') {
    ctx.fillStyle = kind === 'ceiling' ? '#eceae6' : '#a9a7a2'
    ctx.fillRect(0, 0, n, n)
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = gray(Math.random() < 0.5 ? 255 : 60, 0.035)
      ctx.beginPath()
      ctx.arc(Math.random() * n, Math.random() * n, 10 + Math.random() * 40, 0, Math.PI * 2)
      ctx.fill()
    }
    for (let i = 0; i < 6000; i++) {
      ctx.fillStyle = gray(Math.random() < 0.5 ? 255 : 40, 0.08 + Math.random() * 0.12)
      ctx.fillRect(Math.random() * n, Math.random() * n, 1, 1)
    }
  } else if (kind === 'marble') {
    // light stone tiles with soft veins
    ctx.fillStyle = '#e9e6df'
    ctx.fillRect(0, 0, n, n)
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(120,115,108,${0.05 + Math.random() * 0.12})`
      ctx.lineWidth = 0.6 + Math.random() * 1.8
      ctx.beginPath()
      let x = Math.random() * n
      let y = Math.random() * n
      ctx.moveTo(x, y)
      for (let k = 0; k < 8; k++) ctx.lineTo((x += (Math.random() - 0.3) * 70), (y += (Math.random() - 0.5) * 60))
      ctx.stroke()
    }
    ctx.strokeStyle = '#bdb8ae'
    ctx.lineWidth = 2
    for (const v of [0, n / 2, n]) {
      ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, n); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(n, v); ctx.stroke()
    }
  } else if (kind === 'wood') {
    ctx.fillStyle = '#8a5a35'
    ctx.fillRect(0, 0, n, n)
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = gray(Math.random() < 0.5 ? 30 : 200, 0.05 + Math.random() * 0.06)
      ctx.fillRect(0, Math.random() * n, n, 1 + Math.random() * 2)
    }
  } else {
    ctx.fillStyle = '#3b3e43'
    ctx.fillRect(0, 0, n, n)
    for (let i = 0; i < 14000; i++) {
      const r = Math.random()
      ctx.fillStyle = r < 0.45 ? gray(20, 0.6) : r < 0.85 ? gray(110, 0.5) : gray(220, 0.7)
      const s = 1 + Math.random() * 2.2
      ctx.fillRect(Math.random() * n, Math.random() * n, s, s)
    }
    // 2 × 2 tiles with grout lines
    ctx.strokeStyle = '#1c1e21'
    ctx.lineWidth = 3
    for (const v of [0, n / 2, n]) {
      ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, n); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(n, v); ctx.stroke()
    }
  }
  texture.needsUpdate = true
  return texture
}
