import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { ComponentId } from '../../content/components'
import { useLab } from '../../store/useLab'

export const ACCENT = '#3ad1e8'

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
