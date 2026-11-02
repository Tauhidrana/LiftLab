import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { runtime } from '../../store/runtime'
import { useLab } from '../../store/useLab'
import type { Dims } from './dims'
import { font, HLMaterial, makeCanvasTexture, Pickable } from './parts'

const STEEL = '#b9c1ca'
const FRAME = '#3d4450'

/* ---------- Car operating panel layout (shared by drawing and click mapping) ---------- */
const PANEL_W = 200
const ROW = 64
function panelLayout(floors: number) {
  const rows = Math.ceil(floors / 2)
  const buttons: { kind: 'floor' | 'open' | 'close' | 'stop'; floor?: number; x: number; y: number; r: number }[] = []
  for (let f = 1; f <= floors; f++) {
    const i = f - 1
    const row = rows - 1 - Math.floor(i / 2)
    buttons.push({ kind: 'floor', floor: f, x: i % 2 === 0 ? 62 : 138, y: 70 + row * ROW, r: 24 })
  }
  const yDoors = 70 + rows * ROW + 6
  buttons.push({ kind: 'open', x: 62, y: yDoors, r: 24 }, { kind: 'close', x: 138, y: yDoors, r: 24 })
  buttons.push({ kind: 'stop', x: 100, y: yDoors + 76, r: 30 })
  return { buttons, height: yDoors + 124 }
}

export function Car({ d, display }: { d: Dims; display: THREE.Texture }) {
  const group = useRef<THREE.Group>(null!)
  const doorL = useRef<THREE.Mesh>(null!)
  const doorR = useRef<THREE.Mesh>(null!)
  const light = useRef<THREE.PointLight>(null!)
  const ceiling = useRef<THREE.MeshStandardMaterial>(null!)
  const beams = useRef<THREE.Group>(null!)
  const obstacle = useRef<THREE.Mesh>(null!)
  const band = useRef<THREE.MeshBasicMaterial>(null!)
  const { w, d: depth, h } = d.car
  const half = d.door.open / 2

  useFrame(() => {
    const c = runtime.controller
    group.current.position.y = c.motion.position
    const p = c.doors.position
    doorL.current.position.x = -half / 2 - p * half * 0.98
    doorR.current.position.x = half / 2 + p * half * 0.98

    const powerLost = c.safety.has('powerLoss')
    light.current.intensity = powerLost ? 0.6 : 4
    light.current.color.set(powerLost ? '#ff6b4a' : '#fff4e6')
    ceiling.current.emissiveIntensity = powerLost ? 0.15 : 1.2
    ceiling.current.emissive.set(powerLost ? '#ff4a2a' : '#fff6e8')

    // Light-curtain beams are visible while the doors are not fully closed.
    beams.current.visible = p > 0.01
    const lc = c.doors.lightCurtain
    const color = !lc.healthy ? (Math.floor(performance.now() / 400) % 2 ? '#6b7280' : '#374151') : lc.blocked ? '#f43f5e' : '#fb7185'
    beams.current.children.forEach((m) => ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(color))
    beams.current.children.forEach((m) => (((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = lc.blocked ? 0.95 : 0.45))
    obstacle.current.visible = c.safety.has('doorObstruction') && p > 0.05
    // Status band: cyan moving, green doors, red emergency, dim idle — makes the car easy to spot.
    const st = c.sm.state
    band.current.color.set(st === 'EMERGENCY' ? '#f43f5e' : st.startsWith('MOVING') ? '#3ad1e8' : st.startsWith('DOOR') ? '#34d399' : '#475569')
  })

  return (
    <group ref={group}>
      <group position={[0, 0, d.car.z]}>
        <Pickable id="car">
          {/* Cabin shell: thin panels so the interior is visible from inside */}
          <mesh position={[0, -0.04, 0]} receiveShadow castShadow>
            <boxGeometry args={[w, 0.08, depth]} />
            <HLMaterial id="car" color="#2f343b" metalness={0.3} roughness={0.7} />
          </mesh>
          <mesh position={[0, h + 0.03, 0]} castShadow>
            <boxGeometry args={[w, 0.06, depth]} />
            <HLMaterial id="car" color={STEEL} metalness={0.8} roughness={0.35} />
          </mesh>
          <mesh position={[0, h - 0.005, 0]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[w * 0.6, depth * 0.5]} />
            <meshStandardMaterial ref={ceiling} color="#ffffff" emissive="#fff6e8" emissiveIntensity={1.2} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, h / 2, -depth / 2]} castShadow>
            <boxGeometry args={[w, h, 0.04]} />
            <HLMaterial id="car" color={STEEL} metalness={0.8} roughness={0.32} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[(s * w) / 2, h / 2, 0]} castShadow>
              <boxGeometry args={[0.04, h, depth]} />
              <HLMaterial id="car" color={STEEL} metalness={0.8} roughness={0.32} />
            </mesh>
          ))}
          {/* Front wall around the door opening */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (half + (w / 2 - half) / 2), h / 2, depth / 2]} castShadow>
              <boxGeometry args={[w / 2 - half, h, 0.04]} />
              <HLMaterial id="car" color={STEEL} metalness={0.8} roughness={0.32} />
            </mesh>
          ))}
          <mesh position={[0, (h + 2.2) / 2, depth / 2]}>
            <boxGeometry args={[d.door.open, h - 2.2, 0.04]} />
            <HLMaterial id="car" color={STEEL} metalness={0.8} roughness={0.32} />
          </mesh>
          {/* Handrail */}
          <mesh position={[0, 0.95, -depth / 2 + 0.06]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.018, 0.018, w * 0.8]} />
            <meshStandardMaterial color="#d1d5db" metalness={1} roughness={0.2} />
          </mesh>

          {/* Sling (car frame) */}
          <mesh position={[0, d.car.slingTop, 0]} castShadow>
            <boxGeometry args={[d.carRailX * 2, 0.14, 0.16]} />
            <HLMaterial id="car" color={FRAME} metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0, -0.16, 0]}>
            <boxGeometry args={[d.carRailX * 2, 0.14, 0.2]} />
            <HLMaterial id="car" color={FRAME} metalness={0.5} roughness={0.5} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (d.carRailX - 0.06), d.car.slingTop / 2 - 0.08, 0]}>
              <boxGeometry args={[0.08, d.car.slingTop + 0.2, 0.12]} />
              <HLMaterial id="car" color={FRAME} metalness={0.5} roughness={0.5} />
            </mesh>
          ))}
          {/* Rope hitch */}
          <mesh position={[0, d.car.slingTop + 0.12, d.hitchZ - d.car.z]}>
            <boxGeometry args={[0.3, 0.12, 0.12]} />
            <HLMaterial id="ropes" color="#6b7280" metalness={0.7} roughness={0.4} />
          </mesh>
        </Pickable>

        {/* Door operator on the car roof */}
        <Pickable id="doorMotor">
          <mesh position={[0, h + 0.16, depth / 2 - 0.12]} castShadow>
            <boxGeometry args={[1.3, 0.18, 0.16]} />
            <HLMaterial id="doorMotor" color="#4b5563" metalness={0.5} roughness={0.5} />
          </mesh>
          <mesh position={[0.5, h + 0.16, depth / 2 - 0.3]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.07, 0.07, 0.2, 16]} />
            <HLMaterial id="doorMotor" color="#1f6feb" metalness={0.5} roughness={0.4} />
          </mesh>
        </Pickable>

        {/* Car doors */}
        <group position={[0, 1.1, depth / 2 + 0.03]}>
          <mesh ref={doorL} castShadow>
            <boxGeometry args={[half, 2.2, 0.03]} />
            <HLMaterial id="doorMotor" color="#c9d0d8" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh ref={doorR} castShadow>
            <boxGeometry args={[half, 2.2, 0.03]} />
            <HLMaterial id="doorMotor" color="#c9d0d8" metalness={0.85} roughness={0.25} />
          </mesh>
        </group>

        {/* Light curtain: sensor strips + infrared beams */}
        <Pickable id="doorSensors">
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (half + 0.02), 1.05, depth / 2 + 0.06]}>
              <boxGeometry args={[0.025, 2.0, 0.025]} />
              <HLMaterial id="doorSensors" color="#111827" emissive="#7f1d1d" emissiveIntensity={0.6} />
            </mesh>
          ))}
          <group ref={beams} position={[0, 0, depth / 2 + 0.06]}>
            {Array.from({ length: 9 }, (_, i) => (
              <mesh key={i} position={[0, 0.15 + i * 0.22, 0]}>
                <boxGeometry args={[d.door.open, 0.006, 0.006]} />
                <meshBasicMaterial color="#fb7185" transparent opacity={0.45} toneMapped={false} />
              </mesh>
            ))}
          </group>
        </Pickable>
        {/* Obstacle used by the "door obstruction" fault (a suitcase in the doorway) */}
        <mesh ref={obstacle} position={[0.1, 0.28, depth / 2 + 0.08]} castShadow visible={false}>
          <boxGeometry args={[0.42, 0.56, 0.2]} />
          <meshStandardMaterial color="#b45309" roughness={0.7} />
        </mesh>

        {/* Safety gear wedges and guide shoes at the rails */}
        <Pickable id="safetyGear">
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * d.carRailX, -0.22, 0]}>
              <boxGeometry args={[0.16, 0.18, 0.2]} />
              <HLMaterial id="safetyGear" color="#9f1239" metalness={0.5} roughness={0.5} />
            </mesh>
          ))}
        </Pickable>
        {/* Position sensor head (reads the floor vanes on the rail) */}
        <Pickable id="positionSensors">
          <mesh position={[d.carRailX + 0.02, 1.2, 0.16]}>
            <boxGeometry args={[0.07, 0.14, 0.07]} />
            <HLMaterial id="positionSensors" color="#065f46" emissive="#10b981" emissiveIntensity={0.5} />
          </mesh>
        </Pickable>

        <mesh position={[0, h + 0.075, 0]}>
          <boxGeometry args={[w + 0.02, 0.03, depth + 0.02]} />
          <meshBasicMaterial ref={band} color="#475569" toneMapped={false} />
        </mesh>

        <CarPanel d={d} />
        {/* Interior position indicator above the door */}
        <mesh position={[0, 2.3, depth / 2 - 0.03]} rotation-y={Math.PI}>
          <planeGeometry args={[0.42, 0.17]} />
          <meshBasicMaterial map={display} toneMapped={false} />
        </mesh>

        <pointLight ref={light} position={[0, h - 0.25, 0]} intensity={4} distance={4} decay={1.6} color="#fff4e6" />
      </group>
    </group>
  )
}

/** The car operating panel: floor buttons, door open/close and emergency stop — all clickable. */
function CarPanel({ d }: { d: Dims }) {
  const layout = useMemo(() => panelLayout(d.floors), [d.floors])
  const t = useMemo(() => makeCanvasTexture(PANEL_W, layout.height), [layout.height])
  const key = useRef('')
  const lab = useLab.getState

  useFrame(() => {
    const c = runtime.controller
    const lit = new Set(c.carCalls.map((x) => x.floor))
    const estop = c.safety.has('emergencyStop')
    const k = `${[...lit].join(',')}|${estop}|${c.sm.state}`
    if (k === key.current) return
    key.current = k
    const { ctx } = t
    ctx.fillStyle = '#16191e'
    ctx.fillRect(0, 0, PANEL_W, layout.height)
    ctx.strokeStyle = '#3b424d'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, PANEL_W - 4, layout.height - 4)
    ctx.fillStyle = '#6b7280'
    ctx.font = font(14)
    ctx.textAlign = 'center'
    ctx.fillText('LIFTLAB · 630 kg · 8 P', PANEL_W / 2, 26)
    ctx.textBaseline = 'middle'
    for (const b of layout.buttons) {
      const on = b.kind === 'floor' ? lit.has(b.floor!) : b.kind === 'stop' ? estop : false
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      ctx.fillStyle = b.kind === 'stop' ? (on ? '#ef4444' : '#7f1d1d') : on ? '#0e7490' : '#2a2f37'
      ctx.fill()
      ctx.strokeStyle = on ? (b.kind === 'stop' ? '#fecaca' : '#67e8f9') : '#5b6472'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.fillStyle = on ? '#ffffff' : '#c3cad3'
      ctx.font = font(b.kind === 'floor' ? 22 : 15, 600)
      const label = b.kind === 'floor' ? String(b.floor) : b.kind === 'open' ? '◀|▶' : b.kind === 'close' ? '▶|◀' : 'STOP'
      ctx.fillText(label, b.x, b.y + 1)
    }
    t.texture.needsUpdate = true
  })

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (!e.uv) return
    const px = e.uv.x * PANEL_W
    const py = (1 - e.uv.y) * layout.height
    const hit = layout.buttons.find((b) => Math.hypot(b.x - px, b.y - py) <= b.r + 4)
    if (!hit) return
    const s = lab()
    if (hit.kind === 'floor') s.pressCar(hit.floor!)
    else if (hit.kind === 'open') s.doorOpen()
    else if (hit.kind === 'close') s.doorClose()
    else s.emergencyStop()
  }

  const heightM = 0.25 * (layout.height / PANEL_W)
  return (
    <mesh
      position={[d.car.w / 2 - 0.025, 1.25, d.car.d / 2 - 0.3]}
      rotation-y={-Math.PI / 2}
      onClick={onClick}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      <planeGeometry args={[0.25, heightM]} />
      <meshBasicMaterial map={t.texture} toneMapped={false} />
    </mesh>
  )
}
