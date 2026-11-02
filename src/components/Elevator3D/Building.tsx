import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { runtime } from '../../store/runtime'
import { useLab } from '../../store/useLab'
import type { Dims } from './dims'
import { font, HLMaterial, makeCanvasTexture, Pickable, surfaceTexture } from './parts'

interface Props {
  d: Dims
  xray: boolean
  clip: THREE.Plane[]
  display: THREE.Texture
  /** Furnish each landing as a lobby (first-person view only: its walls would hide the shaft from outside). */
  lobby: boolean
}

const GLASS = '#a9c2d3'

export function Building({ d, xray, clip, display, lobby }: Props) {
  const floors = useMemo(() => Array.from({ length: d.floors }, (_, i) => i + 1), [d.floors])
  const slabOpacity = xray ? 0.07 : 1
  const wallOpacity = xray ? 0.05 : 0.16
  const landingOpacity = xray ? 0.08 : 1
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
        <circleGeometry args={[30, 64]} />
        {xray ? <meshStandardMaterial color="#101317" roughness={1} /> : <meshStandardMaterial color="#8e8f8d" map={surfaceTexture('concrete', 14, 14)} roughness={0.95} />}
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
            <WallPanel x0={s.x0} x1={-d.door.open / 2} y0={0} y1={d.H - 0.2} opacity={landingOpacity} clip={clip} z={d.door.landingZ + 0.06} />
            <WallPanel x0={d.door.open / 2} x1={s.x1} y0={0} y1={d.H - 0.2} opacity={landingOpacity} clip={clip} z={d.door.landingZ + 0.06} />
            <WallPanel x0={-d.door.open / 2} x1={d.door.open / 2} y0={2.2} y1={d.H - 0.2} opacity={landingOpacity} clip={clip} z={d.door.landingZ + 0.06} />

            <DoorFrame d={d} />
            {lobby && <Lobby d={d} floor={f} />}
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
      {lobby && <LobbyLight d={d} />}
      {!xray && !lobby && <Facade d={d} clip={clip} />}

      {/* Shaft walls: back and sides (glass-like so the machinery stays visible) */}
      <mesh position={[0, (d.pitBottom + d.shaftTop) / 2, s.z0 - 0.08]}>
        <boxGeometry args={[s.x1 - s.x0 + 0.3, d.shaftTop - d.pitBottom, 0.1]} />
        <HLMaterial color={GLASS} transparent opacity={wallOpacity} roughness={0.05} metalness={0.3} clip={clip} />
      </mesh>
      {[s.x0 - 0.08, s.x1 + 0.08].map((x) => (
        <mesh key={x} position={[x, (d.pitBottom + d.shaftTop) / 2, (s.z0 + s.z1) / 2]}>
          <boxGeometry args={[0.1, d.shaftTop - d.pitBottom, s.z1 - s.z0 + 0.15]} />
          <HLMaterial color={GLASS} transparent opacity={wallOpacity} roughness={0.05} metalness={0.3} clip={clip} />
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
          <HLMaterial color="#ffffff" map={surfaceTexture('concrete', 1, 8)} transparent={xray} opacity={xray ? 0.1 : 1} roughness={0.85} clip={clip} />
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
      <HLMaterial color="#d2d0cb" map={surfaceTexture('concrete', 3, 3)} roughness={0.85} metalness={0.05} transparent={opacity < 1} opacity={opacity} clip={clip} />
    </mesh>
  )
}

function WallPanel(p: { x0: number; x1: number; y0: number; y1: number; z: number; opacity: number; clip: THREE.Plane[] }) {
  return (
    <mesh position={[(p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, p.z]} receiveShadow>
      <boxGeometry args={[p.x1 - p.x0, p.y1 - p.y0, 0.06]} />
      <HLMaterial color="#e2ddd4" map={surfaceTexture('ceiling')} roughness={0.55} metalness={0} transparent={p.opacity < 1} opacity={p.opacity} clip={p.clip} />
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
              <meshStandardMaterial color="#ffffff" map={surfaceTexture('brushed', 1, 1)} metalness={0.85} roughness={0.32} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  )
}

/** Brushed-steel architrave around each landing door. */
function DoorFrame({ d }: { d: Dims }) {
  const z = d.door.landingZ + 0.11
  const half = d.door.open / 2
  const mat = <meshStandardMaterial color="#ffffff" map={surfaceTexture('brushed', 0.3, 1)} metalness={0.9} roughness={0.3} />
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (half + 0.04), 1.12, z]} castShadow>
          <boxGeometry args={[0.08, 2.24, 0.04]} />
          {mat}
        </mesh>
      ))}
      <mesh position={[0, 2.26, z]} castShadow>
        <boxGeometry args={[d.door.open + 0.16, 0.08, 0.04]} />
        {mat}
      </mesh>
      {/* landing sill */}
      <mesh position={[0, 0.005, d.door.landingZ + 0.06]} receiveShadow>
        <boxGeometry args={[d.door.open + 0.1, 0.012, 0.12]} />
        <meshStandardMaterial color="#c8ccd0" metalness={0.9} roughness={0.45} />
      </mesh>
    </group>
  )
}

/** A simple lift lobby on every floor: marble floor, painted walls, ceiling downlights, a bench. */
function Lobby({ d, floor }: { d: Dims; floor: number }) {
  const z0 = d.door.landingZ + 0.1
  const z1 = z0 + 2.6
  const x = 2.6
  const ceil = d.H - 0.22
  const marble = useMemo(() => surfaceTexture('marble', 3, 1.4), [])
  const paint = useMemo(() => surfaceTexture('ceiling', 2, 1), [])
  const wood = useMemo(() => surfaceTexture('wood', 1, 1), [])
  const sign = useMemo(() => {
    const t = makeCanvasTexture(512, 256)
    t.ctx.fillStyle = '#2b2f35'
    t.ctx.fillRect(0, 0, 512, 256)
    t.ctx.fillStyle = '#f3f4f6'
    t.ctx.textAlign = 'center'
    t.ctx.textBaseline = 'middle'
    t.ctx.font = font(150, 600)
    t.ctx.fillText(String(floor), 256, 120)
    t.ctx.fillStyle = '#9ca3af'
    t.ctx.font = font(30, 500)
    t.ctx.fillText(`FLOOR · তলা`, 256, 222)
    t.texture.needsUpdate = true
    return t.texture
  }, [floor])
  useEffect(() => () => sign.dispose(), [sign])
  const wall = <meshStandardMaterial color="#d8d1c4" map={paint} roughness={0.85} />
  return (
    <group>
      <mesh position={[0, 0.004, (z0 + z1) / 2]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[x * 2, z1 - z0]} />
        <meshStandardMaterial color="#cfcac1" map={marble} roughness={0.2} metalness={0} />
      </mesh>
      <mesh position={[0, ceil, (z0 + z1) / 2]} rotation-x={Math.PI / 2}>
        <planeGeometry args={[x * 2, z1 - z0]} />
        <meshStandardMaterial color="#f4f2ee" roughness={0.95} />
      </mesh>
      {[-1.4, 0, 1.4].map((lx) => (
        <mesh key={lx} position={[lx, ceil - 0.004, z0 + 1.2]} rotation-x={Math.PI / 2}>
          <circleGeometry args={[0.08, 24]} />
          <meshStandardMaterial color="#ffffff" emissive="#fff3e0" emissiveIntensity={3} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* back wall, side walls */}
      <mesh position={[0, ceil / 2, z1]} rotation-y={Math.PI} receiveShadow>
        <planeGeometry args={[x * 2, ceil]} />
        {wall}
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * x, ceil / 2, (z0 + z1) / 2]} rotation-y={-s * (Math.PI / 2)} receiveShadow>
          <planeGeometry args={[z1 - z0, ceil]} />
          {wall}
        </mesh>
      ))}
      {/* skirting */}
      <mesh position={[0, 0.05, z1 - 0.01]}>
        <boxGeometry args={[x * 2, 0.1, 0.02]} />
        <meshStandardMaterial color="#3a3530" roughness={0.6} />
      </mesh>
      {/* floor number on the back wall, and a wooden bench */}
      <mesh position={[0, 1.65, z1 - 0.012]} rotation-y={Math.PI}>
        <planeGeometry args={[0.8, 0.4]} />
        <meshStandardMaterial map={sign} roughness={0.5} />
      </mesh>
      <group position={[-1.5, 0, z1 - 0.35]}>
        <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.4, 0.06, 0.4]} />
          <meshStandardMaterial color="#ffffff" map={wood} roughness={0.55} />
        </mesh>
        {[-0.6, 0.6].map((bx) => (
          <mesh key={bx} position={[bx, 0.21, 0]} castShadow>
            <boxGeometry args={[0.05, 0.42, 0.36]} />
            <meshStandardMaterial color="#2b2b2b" metalness={0.8} roughness={0.4} />
          </mesh>
        ))}
      </group>
      {/* potted plant */}
      <group position={[1.9, 0, z1 - 0.4]}>
        <mesh position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.16, 0.5, 24]} />
          <meshStandardMaterial color="#2f3236" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.85, 0]} castShadow>
          <icosahedronGeometry args={[0.38, 1]} />
          <meshStandardMaterial color="#3f6b3a" roughness={0.8} flatShading />
        </mesh>
      </group>
    </group>
  )
}

/** One warm light that follows the car's floor, so the lobby you step into is lit. */
function LobbyLight({ d }: { d: Dims }) {
  const ref = useRef<THREE.PointLight>(null!)
  useFrame(() => {
    const f = Math.round(runtime.controller.motion.position / d.H)
    ref.current.position.set(0, f * d.H + d.H - 0.6, d.door.landingZ + 1.4)
  })
  return <pointLight ref={ref} intensity={5} distance={6} decay={2} color="#fff1dc" />
}

/** Glass curtain wall with aluminium mullions and dark spandrel bands, so the frame reads as an office tower. */
function Facade({ d, clip }: { d: Dims; clip: THREE.Plane[] }) {
  const { building: b } = d
  const top = d.maxPos + d.H
  const sides: { x: number; z: number; len: number; rot: number }[] = [
    { x: 0, z: b.z1 + 0.16, len: b.x1 - b.x0, rot: 0 },
    { x: 0, z: b.z0 - 0.16, len: b.x1 - b.x0, rot: 0 },
    { x: b.x0 - 0.16, z: (b.z0 + b.z1) / 2, len: b.z1 - b.z0, rot: Math.PI / 2 },
    { x: b.x1 + 0.16, z: (b.z0 + b.z1) / 2, len: b.z1 - b.z0, rot: Math.PI / 2 },
  ]
  return (
    <group>
      {sides.map((s, i) => {
        const bays = Math.round(s.len / 1.4)
        return (
          <group key={i} position={[s.x, 0, s.z]} rotation-y={s.rot}>
            <mesh position={[0, top / 2, 0]}>
              <planeGeometry args={[s.len, top]} />
              <HLMaterial color="#8fa9bd" transparent opacity={0.2} roughness={0.04} metalness={0.7} side={THREE.DoubleSide} clip={clip} />
            </mesh>
            {Array.from({ length: bays + 1 }, (_, k) => (
              <mesh key={k} position={[-s.len / 2 + (k * s.len) / bays, top / 2, 0]} castShadow>
                <boxGeometry args={[0.05, top, 0.08]} />
                <HLMaterial color="#2a2f35" metalness={0.8} roughness={0.35} clip={clip} />
              </mesh>
            ))}
            {Array.from({ length: d.floors + 1 }, (_, f) => (
              <mesh key={`b${f}`} position={[0, f * d.H - 0.12, 0]} castShadow>
                <boxGeometry args={[s.len + 0.06, 0.34, 0.1]} />
                <HLMaterial color="#3a4048" metalness={0.5} roughness={0.5} clip={clip} />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}
