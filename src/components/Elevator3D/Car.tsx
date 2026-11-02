import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { runtime } from '../../store/runtime'
import { useLab } from '../../store/useLab'
import type { Dims } from './dims'
import { font, HLMaterial, makeCanvasTexture, Pickable, surfaceTexture } from './parts'

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

export function Car({ d, display, xray }: { d: Dims; display: THREE.Texture; xray: boolean }) {
  const group = useRef<THREE.Group>(null!)
  const doorL = useRef<THREE.Mesh>(null!)
  const doorR = useRef<THREE.Mesh>(null!)
  const light = useRef<THREE.PointLight>(null!)
  const ceiling = useRef(new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6e8', emissiveIntensity: 2.5, side: THREE.DoubleSide }))
  const beams = useRef<THREE.Group>(null!)
  const obstacle = useRef<THREE.Mesh>(null!)
  const band = useRef<THREE.MeshBasicMaterial>(null!)
  const { w, d: depth, h } = d.car
  const half = d.door.open / 2
  const brushed = useMemo(() => surfaceTexture('brushed', 2, 1), [])
  const floorTex = useMemo(() => surfaceTexture('granite', 1.3, 1.15), [])
  const ceilTex = useMemo(() => surfaceTexture('ceiling'), [])

  useFrame(() => {
    const c = runtime.controller
    group.current.position.y = c.motion.position
    const p = c.doors.position
    doorL.current.position.x = -half / 2 - p * half * 0.98
    doorR.current.position.x = half / 2 + p * half * 0.98

    const powerLost = c.safety.has('powerLoss')
    light.current.intensity = powerLost ? 1 : 6
    light.current.color.set(powerLost ? '#ff6b4a' : '#fff4e6')
    ceiling.current.emissiveIntensity = powerLost ? 0.3 : 2.5
    ceiling.current.emissive.set(powerLost ? '#ff4a2a' : '#fff6e8')

    // Infrared beams are invisible in real life: only drawn in the x-ray / engineering lens.
    beams.current.visible = xray && p > 0.01
    const lc = c.doors.lightCurtain
    const color = !lc.healthy ? (Math.floor(performance.now() / 400) % 2 ? '#6b7280' : '#374151') : lc.blocked ? '#f43f5e' : '#fb7185'
    beams.current.children.forEach((m) => ((m as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(color))
    beams.current.children.forEach((m) => (((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = lc.blocked ? 0.95 : 0.45))
    obstacle.current.visible = c.safety.has('doorObstruction') && p > 0.05
    // Status band: cyan moving, green doors, red emergency, dim idle — makes the car easy to spot.
    const st = c.sm.state
    band.current.color.set(st === 'EMERGENCY' ? '#f43f5e' : st.startsWith('MOVING') ? '#4c9aff' : st.startsWith('DOOR') ? '#34d399' : '#475569')
  })

  return (
    <group ref={group}>
      <group position={[0, 0, d.car.z]}>
        <Pickable id="car">
          {/* Cabin shell: thin panels so the interior is visible from inside */}
          {/* Floor: polished granite tile */}
          <mesh position={[0, -0.04, 0]} receiveShadow castShadow>
            <boxGeometry args={[w, 0.08, depth]} />
            <HLMaterial id="car" color="#ffffff" map={floorTex} metalness={0.05} roughness={0.28} />
          </mesh>
          {/* Aluminium door sill */}
          <mesh position={[0, 0.004, depth / 2 + 0.02]} receiveShadow>
            <boxGeometry args={[d.door.open + 0.1, 0.012, 0.1]} />
            <meshStandardMaterial color="#c8ccd0" metalness={0.9} roughness={0.45} />
          </mesh>
          <mesh position={[0, h + 0.03, 0]} castShadow>
            <boxGeometry args={[w, 0.06, depth]} />
            <HLMaterial id="car" color={STEEL} metalness={0.8} roughness={0.35} />
          </mesh>
          {/* Suspended ceiling with recessed downlights */}
          <mesh position={[0, h - 0.002, 0]} rotation-x={Math.PI / 2}>
            <planeGeometry args={[w - 0.02, depth - 0.02]} />
            <meshStandardMaterial color="#ffffff" map={ceilTex} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
          {[-0.4, 0.4].flatMap((x) =>
            [-0.32, 0.32].map((z) => (
              <mesh key={`${x}${z}`} position={[x, h - 0.006, z]} rotation-x={Math.PI / 2} material={ceiling.current}>
                <circleGeometry args={[0.07, 32]} />
              </mesh>
            )),
          )}
          {/* Back wall: brushed steel with a champagne feature panel */}
          <mesh position={[0, h / 2, -depth / 2]} castShadow receiveShadow>
            <boxGeometry args={[w, h, 0.04]} />
            <HLMaterial id="car" color="#bcc1c6" map={brushed} metalness={0.9} roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.4, -depth / 2 + 0.024]}>
            <boxGeometry args={[w * 0.56, 1.6, 0.008]} />
            <meshStandardMaterial color="#c9b79a" map={brushed} metalness={0.9} roughness={0.22} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[(s * w) / 2, h / 2, 0]} castShadow receiveShadow>
                <boxGeometry args={[0.04, h, depth]} />
                <HLMaterial id="car" color="#bcc1c6" map={brushed} metalness={0.9} roughness={0.3} />
              </mesh>
              {/* panel joints */}
              {[-depth / 6, depth / 6].map((z) => (
                <mesh key={z} position={[s * (w / 2 - 0.021), h / 2, z]}>
                  <boxGeometry args={[0.002, h, 0.006]} />
                  <meshStandardMaterial color="#2b2f34" roughness={0.6} />
                </mesh>
              ))}
              {/* kick plate */}
              <mesh position={[s * (w / 2 - 0.022), 0.06, 0]}>
                <boxGeometry args={[0.004, 0.12, depth - 0.02]} />
                <meshStandardMaterial color="#3a3e44" metalness={0.8} roughness={0.5} />
              </mesh>
            </group>
          ))}
          <mesh position={[0, 0.06, -depth / 2 + 0.022]}>
            <boxGeometry args={[w - 0.02, 0.12, 0.004]} />
            <meshStandardMaterial color="#3a3e44" metalness={0.8} roughness={0.5} />
          </mesh>
          {/* Front wall around the door opening */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[s * (half + (w / 2 - half) / 2), h / 2, depth / 2]} castShadow>
              <boxGeometry args={[w / 2 - half, h, 0.04]} />
              <HLMaterial id="car" color="#bcc1c6" map={brushed} metalness={0.9} roughness={0.3} />
            </mesh>
          ))}
          <mesh position={[0, (h + 2.2) / 2, depth / 2]}>
            <boxGeometry args={[d.door.open, h - 2.2, 0.04]} />
            <HLMaterial id="car" color="#bcc1c6" map={brushed} metalness={0.9} roughness={0.3} />
          </mesh>
          {/* Handrails (back and sides) with wall brackets */}
          <mesh position={[0, 0.92, -depth / 2 + 0.07]} rotation-z={Math.PI / 2}>
            <cylinderGeometry args={[0.019, 0.019, w * 0.78, 20]} />
            <meshStandardMaterial color="#e5e7eb" metalness={1} roughness={0.15} />
          </mesh>
          {[-1, 1].map((s) => (
            <group key={s}>
              <mesh position={[s * (w / 2 - 0.07), 0.92, -depth / 6]} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.019, 0.019, depth * 0.5, 20]} />
                <meshStandardMaterial color="#e5e7eb" metalness={1} roughness={0.15} />
              </mesh>
              <mesh position={[s * w * 0.3, 0.92, -depth / 2 + 0.04]} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.008, 0.008, 0.06, 10]} />
                <meshStandardMaterial color="#d1d5db" metalness={1} roughness={0.2} />
              </mesh>
            </group>
          ))}

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
            <HLMaterial id="doorMotor" color="#bcc1c6" map={brushed} metalness={0.9} roughness={0.28} />
          </mesh>
          <mesh ref={doorR} castShadow>
            <boxGeometry args={[half, 2.2, 0.03]} />
            <HLMaterial id="doorMotor" color="#bcc1c6" map={brushed} metalness={0.9} roughness={0.28} />
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

        <pointLight ref={light} position={[0, h - 0.2, 0]} intensity={4} distance={5} decay={2} color="#fff4e6" />
      </group>
    </group>
  )
}

/** The car operating panel: floor buttons, door open/close and emergency stop — all clickable. */
function CarPanel({ d }: { d: Dims }) {
  const layout = useMemo(() => panelLayout(d.floors), [d.floors])
  const t = useMemo(() => makeCanvasTexture(PANEL_W * 2, layout.height * 2), [layout.height])
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
    ctx.setTransform(2, 0, 0, 2, 0, 0)
    // brushed faceplate
    const g = ctx.createLinearGradient(0, 0, PANEL_W, 0)
    g.addColorStop(0, '#9aa1a9')
    g.addColorStop(0.5, '#c3c8ce')
    g.addColorStop(1, '#8f969e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, PANEL_W, layout.height)
    ctx.strokeStyle = '#6b727b'
    ctx.lineWidth = 4
    ctx.strokeRect(2, 2, PANEL_W - 4, layout.height - 4)
    ctx.fillStyle = '#3a3f46'
    ctx.font = font(14)
    ctx.textAlign = 'center'
    ctx.fillText('LIFTLAB · 630 kg · 8 P', PANEL_W / 2, 26)
    ctx.textBaseline = 'middle'
    for (const b of layout.buttons) {
      const on = b.kind === 'floor' ? lit.has(b.floor!) : b.kind === 'stop' ? estop : false
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      ctx.fillStyle = b.kind === 'stop' ? (on ? '#ef4444' : '#a3161c') : '#d9dde1'
      ctx.fill()
      ctx.strokeStyle = on ? (b.kind === 'stop' ? '#fecaca' : '#60a5fa') : '#80878f'
      ctx.lineWidth = on ? 5 : 3
      ctx.stroke()
      ctx.fillStyle = b.kind === 'stop' ? '#ffffff' : on ? '#2563eb' : '#2b3036'
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
