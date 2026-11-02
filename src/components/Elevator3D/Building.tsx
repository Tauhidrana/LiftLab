import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { runtime } from '../../store/runtime'
import { useLab } from '../../store/useLab'
import type { Dims } from './dims'
import { font, HLMaterial, makeCanvasTexture, Pickable } from './parts'

interface Props {
  d: Dims
  xray: boolean
  clip: THREE.Plane[]
  display: THREE.Texture
}

const SLAB = '#58606b'
const WALL = '#4b525c'

export function Building({ d, xray, clip, display }: Props) {
  const floors = useMemo(() => Array.from({ length: d.floors }, (_, i) => i + 1), [d.floors])
  const slabOpacity = xray ? 0.07 : 0.72
  const wallOpacity = xray ? 0.05 : 0.22
  const { building: b, shaft: s } = d

  return (
    <group>
      {/* Pit floor */}
      <mesh position={[0, d.pitBottom - 0.1, (s.z0 + s.z1) / 2]} receiveShadow>
        <boxGeometry args={[s.x1 - s.x0 + 0.3, 0.2, s.z1 - s.z0 + 0.3]} />
        <HLMaterial color="#2a2e34" roughness={0.9} metalness={0.05} clip={clip} />
      </mesh>
      {/* Ground plane */}
      <mesh position={[0, -0.22, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <circleGeometry args={[30, 48]} />
        <meshStandardMaterial color="#101317" roughness={1} />
      </mesh>

      {floors.map((f) => {
        const y = (f - 1) * d.H
        return (
          <group key={f} position={[0, y, 0]}>
            {/* Floor slab with a hole for the shaft (4 pieces) */}
            <Slab x0={b.x0} x1={b.x1} z0={b.z0} z1={s.z0 - 0.15} opacity={slabOpacity} clip={clip} />
            <Slab x0={b.x0} x1={b.x1} z0={s.z1 + 0.1} z1={b.z1} opacity={slabOpacity} clip={clip} />
            <Slab x0={b.x0} x1={s.x0 - 0.15} z0={s.z0 - 0.15} z1={s.z1 + 0.1} opacity={slabOpacity} clip={clip} />
            <Slab x0={s.x1 + 0.15} x1={b.x1} z0={s.z0 - 0.15} z1={s.z1 + 0.1} opacity={slabOpacity} clip={clip} />

            {/* Landing wall around the door opening */}
            <WallPanel x0={s.x0} x1={-d.door.open / 2} y0={0} y1={d.H - 0.2} opacity={xray ? 0.08 : 0.85} clip={clip} z={d.door.landingZ + 0.06} />
            <WallPanel x0={d.door.open / 2} x1={s.x1} y0={0} y1={d.H - 0.2} opacity={xray ? 0.08 : 0.85} clip={clip} z={d.door.landingZ + 0.06} />
            <WallPanel x0={-d.door.open / 2} x1={d.door.open / 2} y0={2.2} y1={d.H - 0.2} opacity={xray ? 0.08 : 0.85} clip={clip} z={d.door.landingZ + 0.06} />

            <FloorSign floor={f} x={-0.9} y={1.95} z={d.door.landingZ + 0.1} />
            {/* Landing position indicator above the door */}
            <mesh position={[0, 2.45, d.door.landingZ + 0.1]}>
              <planeGeometry args={[0.5, 0.2]} />
              <meshBasicMaterial map={display} toneMapped={false} />
            </mesh>
            <Pickable id="floorController">
              <HallPanel floor={f} top={f === d.floors} bottom={f === 1} x={0.85} y={1.15} z={d.door.landingZ + 0.1} />
            </Pickable>
          </group>
        )
      })}

      <LandingDoors d={d} />

      {/* Shaft walls: back and sides (glass-like so the machinery stays visible) */}
      <mesh position={[0, (d.pitBottom + d.shaftTop) / 2, s.z0 - 0.08]}>
        <boxGeometry args={[s.x1 - s.x0 + 0.3, d.shaftTop - d.pitBottom, 0.1]} />
        <HLMaterial color={WALL} transparent opacity={wallOpacity} roughness={0.8} clip={clip} />
      </mesh>
      {[s.x0 - 0.08, s.x1 + 0.08].map((x) => (
        <mesh key={x} position={[x, (d.pitBottom + d.shaftTop) / 2, (s.z0 + s.z1) / 2]}>
          <boxGeometry args={[0.1, d.shaftTop - d.pitBottom, s.z1 - s.z0 + 0.15]} />
          <HLMaterial color={WALL} transparent opacity={wallOpacity} roughness={0.8} clip={clip} />
        </mesh>
      ))}

      {/* Structural columns */}
      {[
        [b.x0, b.z0],
        [b.x1, b.z0],
        [b.x0, b.z1],
        [b.x1, b.z1],
      ].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, d.shaftTop / 2 - 0.1, z]} castShadow>
          <boxGeometry args={[0.3, d.shaftTop, 0.3]} />
          <HLMaterial color={SLAB} transparent={xray} opacity={xray ? 0.1 : 1} roughness={0.8} clip={clip} />
        </mesh>
      ))}
      {/* Roof slab */}
      <group position={[0, d.maxPos + d.H, 0]}>
        <Slab x0={b.x0} x1={b.x1} z0={b.z0} z1={s.z0 - 0.15} opacity={slabOpacity} clip={clip} />
        <Slab x0={b.x0} x1={b.x1} z0={s.z1 + 0.1} z1={b.z1} opacity={slabOpacity} clip={clip} />
        <Slab x0={b.x0} x1={s.x0 - 0.15} z0={s.z0 - 0.15} z1={s.z1 + 0.1} opacity={slabOpacity} clip={clip} />
        <Slab x0={s.x1 + 0.15} x1={b.x1} z0={s.z0 - 0.15} z1={s.z1 + 0.1} opacity={slabOpacity} clip={clip} />
      </group>
    </group>
  )
}

function Slab({ x0, x1, z0, z1, opacity, clip }: { x0: number; x1: number; z0: number; z1: number; opacity: number; clip: THREE.Plane[] }) {
  return (
    <mesh position={[(x0 + x1) / 2, -0.11, (z0 + z1) / 2]} receiveShadow castShadow={opacity > 0.5}>
      <boxGeometry args={[x1 - x0, 0.2, z1 - z0]} />
      <HLMaterial color={SLAB} roughness={0.85} metalness={0.05} transparent={opacity < 1} opacity={opacity} clip={clip} />
    </mesh>
  )
}

function WallPanel(p: { x0: number; x1: number; y0: number; y1: number; z: number; opacity: number; clip: THREE.Plane[] }) {
  return (
    <mesh position={[(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, p.z]} receiveShadow>
      <boxGeometry args={[p.x1 - p.x0, p.y1 - p.y0, 0.06]} />
      <HLMaterial color="#5a616b" roughness={0.6} metalness={0.2} transparent={p.opacity < 1} opacity={p.opacity} clip={p.clip} />
    </mesh>
  )
}

function FloorSign({ floor, x, y, z }: { floor: number; x: number; y: number; z: number }) {
  const tex = useMemo(() => {
    const t = makeCanvasTexture(256, 128)
    t.ctx.fillStyle = '#0e1013'
    t.ctx.fillRect(0, 0, 256, 128)
    t.ctx.fillStyle = '#e5e7eb'
    t.ctx.font = font(72, 500)
    t.ctx.textAlign = 'center'
    t.ctx.textBaseline = 'middle'
    t.ctx.fillText(String(floor).padStart(2, '0'), 128, 70)
    t.ctx.fillStyle = '#6b7280'
    t.ctx.font = font(20)
    t.ctx.fillText('FLOOR', 128, 18)
    t.texture.needsUpdate = true
    return t.texture
  }, [floor])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <mesh position={[x, y, z]}>
      <planeGeometry args={[0.42, 0.21]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  )
}

/** UP / DOWN buttons on a landing. One canvas texture; the click's UV picks the button. */
function HallPanel({ floor, top, bottom, x, y, z }: { floor: number; top: boolean; bottom: boolean; x: number; y: number; z: number }) {
  const pressHall = useLab((s) => s.pressHall)
  const t = useMemo(() => makeCanvasTexture(96, 192), [])
  const key = useRef('')

  useFrame(() => {
    const c = runtime.controller
    const up = c.hallCalls.some((h) => h.floor === floor && h.direction === 'UP')
    const down = c.hallCalls.some((h) => h.floor === floor && h.direction === 'DOWN')
    const k = `${up}${down}`
    if (k === key.current) return
    key.current = k
    const { ctx } = t
    ctx.fillStyle = '#1b1e23'
    ctx.fillRect(0, 0, 96, 192)
    ctx.strokeStyle = '#3f4651'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, 92, 188)
    const drawBtn = (cy: number, lit: boolean, dirUp: boolean) => {
      ctx.beginPath()
      ctx.arc(48, cy, 30, 0, Math.PI * 2)
      ctx.fillStyle = lit ? '#0e7490' : '#2b3038'
      ctx.fill()
      ctx.strokeStyle = lit ? '#67e8f9' : '#596170'
      ctx.lineWidth = 4
      ctx.stroke()
      ctx.beginPath()
      const s = dirUp ? -1 : 1
      ctx.moveTo(48, cy + 12 * s)
      ctx.lineTo(34, cy - 8 * s)
      ctx.lineTo(62, cy - 8 * s)
      ctx.closePath()
      ctx.fillStyle = lit ? '#ecfeff' : '#9aa3af'
      ctx.fill()
    }
    if (!top) drawBtn(56, up, true)
    if (!bottom) drawBtn(136, down, false)
    t.texture.needsUpdate = true
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const v = e.uv?.y ?? 0.5
    if (v > 0.5 && !top) pressHall(floor, 'UP')
    else if (v <= 0.5 && !bottom) pressHall(floor, 'DOWN')
  }

  return (
    <mesh position={[x, y, z]} onClick={onClick} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      <planeGeometry args={[0.16, 0.32]} />
      <meshBasicMaterial map={t.texture} toneMapped={false} />
    </mesh>
  )
}

/** Landing doors open only at the floor where the car is level (coupled by the car door vane). */
function LandingDoors({ d }: { d: Dims }) {
  const refs = useRef<(THREE.Group | null)[]>([])
  const half = d.door.open / 2
  useFrame(() => {
    const c = runtime.controller
    for (let i = 0; i < d.floors; i++) {
      const g = refs.current[i]
      if (!g) continue
      const level = Math.abs(c.motion.position - i * d.H) < 0.03
      const p = level ? c.doors.position : 0
      g.children[0].position.x = -half / 2 - p * half * 0.98
      g.children[1].position.x = half / 2 + p * half * 0.98
    }
  })
  return (
    <>
      {Array.from({ length: d.floors }, (_, i) => (
        <group key={i} ref={(el) => void (refs.current[i] = el)} position={[0, i * d.H + 1.1, d.door.landingZ]}>
          {[0, 1].map((k) => (
            <mesh key={k} castShadow>
              <boxGeometry args={[half, 2.2, 0.04]} />
              <meshStandardMaterial color="#9aa3ad" metalness={0.85} roughness={0.28} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}
