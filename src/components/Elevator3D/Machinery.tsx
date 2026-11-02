import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { runtime } from '../../store/runtime'
import { cwTop, type Dims } from './dims'
import { HLMaterial, Pickable } from './parts'

const RAIL = '#7c8591'
const ROPE = '#a8b0ba'

export function Machinery({ d, xray }: { d: Dims; xray: boolean }) {
  return (
    <group>
      <Rails d={d} />
      <FloorVanes d={d} />
      <Counterweight d={d} />
      <Ropes d={d} />
      <MachineRoom d={d} xray={xray} />
      <Governor d={d} />
      <Buffers d={d} />
    </group>
  )
}

function Rails({ d }: { d: Dims }) {
  const len = d.shaftTop - d.pitBottom
  const y = (d.shaftTop + d.pitBottom) / 2
  return (
    <Pickable id="rails">
      {[-1, 1].map((s) => (
        <group key={s} position={[s * (d.carRailX + 0.05), y, d.car.z]}>
          <mesh castShadow>
            <boxGeometry args={[0.05, len, 0.14]} />
            <HLMaterial id="rails" color={RAIL} metalness={0.85} roughness={0.35} />
          </mesh>
          <mesh position={[s * 0.035, 0, 0]}>
            <boxGeometry args={[0.025, len, 0.05]} />
            <HLMaterial id="rails" color={RAIL} metalness={0.85} roughness={0.35} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`cw${s}`} position={[s * d.cw.railX, y, d.cw.z]}>
          <boxGeometry args={[0.04, len, 0.09]} />
          <HLMaterial id="rails" color={RAIL} metalness={0.85} roughness={0.35} />
        </mesh>
      ))}
    </Pickable>
  )
}

/** Floor vanes: one per landing on the rail; they light up while the car's sensor reads them. */
function FloorVanes({ d }: { d: Dims }) {
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  useFrame(() => {
    const c = runtime.controller
    for (let i = 0; i < d.floors; i++) {
      const m = mats.current[i]
      if (!m) continue
      const on = c.floorSensor === i + 1
      m.emissive.set(on ? '#34d399' : '#064e3b')
      m.emissiveIntensity = on ? 1.6 : 0.4
    }
  })
  return (
    <Pickable id="positionSensors">
      {Array.from({ length: d.floors }, (_, i) => (
        <mesh key={i} position={[d.carRailX + 0.1, i * d.H + 1.2, d.car.z + 0.16]}>
          <boxGeometry args={[0.02, 0.22, 0.05]} />
          <meshStandardMaterial ref={(m) => void (mats.current[i] = m)} color="#0f172a" emissive="#064e3b" />
        </mesh>
      ))}
    </Pickable>
  )
}

function Counterweight({ d }: { d: Dims }) {
  const g = useRef<THREE.Group>(null!)
  useFrame(() => {
    g.current.position.y = cwTop(d, runtime.controller.motion.position) - d.cw.h / 2
  })
  const { w, h, d: depth } = d.cw
  return (
    <group ref={g} position={[0, 0, d.cw.z]}>
      <Pickable id="counterweight">
        {/* Frame */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[(s * w) / 2, 0, 0]} castShadow>
            <boxGeometry args={[0.06, h, depth + 0.04]} />
            <HLMaterial id="counterweight" color="#3f4652" metalness={0.5} roughness={0.5} />
          </mesh>
        ))}
        {/* Stacked filler weights */}
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[0, -h / 2 + 0.1 + i * 0.165, 0]} castShadow>
            <boxGeometry args={[w - 0.08, 0.15, depth]} />
            <HLMaterial id="counterweight" color={i % 2 ? '#525a66' : '#5b6370'} metalness={0.3} roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[0, h / 2 + 0.05, 0]}>
          <boxGeometry args={[w, 0.1, depth + 0.04]} />
          <HLMaterial id="counterweight" color="#3f4652" metalness={0.5} roughness={0.5} />
        </mesh>
      </Pickable>
    </group>
  )
}

/**
 * Suspension ropes. Car side hangs from the car hitch, counterweight side from the
 * counterweight; both run over the sheave. Bright markers are painted on the ropes,
 * so they visibly travel with the rope — up on one side, down on the other.
 */
function Ropes({ d }: { d: Dims }) {
  const carRopes = useRef<THREE.Group>(null!)
  const cwRopes = useRef<THREE.Group>(null!)
  const markers = useRef<THREE.InstancedMesh>(null!)
  const SPACING = 1.6
  const MAX_MARKERS = 64
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const xs = [-0.07, 0, 0.07]

  useFrame(() => {
    const pos = runtime.controller.motion.position
    const sheaveY = d.sheave.y
    const carHitch = pos + d.car.slingTop + 0.18
    const cwHitch = cwTop(d, pos) + 0.1
    const fit = (grp: THREE.Group, y0: number) => {
      const len = Math.max(0.01, sheaveY - y0)
      grp.children.forEach((m) => {
        m.scale.y = len
        m.position.y = y0 + len / 2
      })
    }
    fit(carRopes.current, carHitch)
    fit(cwRopes.current, cwHitch)

    // Markers fixed to the rope: they ride with the car (car side) and the counterweight (other side).
    let n = 0
    const place = (y0: number, z: number) => {
      for (let y = y0 + 0.5; y < sheaveY - 0.1 && n < MAX_MARKERS; y += SPACING) {
        tmp.position.set(0.07, y, z)
        tmp.updateMatrix()
        markers.current.setMatrixAt(n++, tmp.matrix)
      }
    }
    place(carHitch, d.hitchZ)
    place(cwHitch, d.cw.z)
    markers.current.count = n
    markers.current.instanceMatrix.needsUpdate = true
  })

  return (
    <Pickable id="ropes">
      <group ref={carRopes} position={[0, 0, d.hitchZ]}>
        {xs.map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 1, 6]} />
            <HLMaterial id="ropes" color={ROPE} metalness={0.9} roughness={0.35} />
          </mesh>
        ))}
      </group>
      <group ref={cwRopes} position={[0, 0, d.cw.z]}>
        {xs.map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 1, 6]} />
            <HLMaterial id="ropes" color={ROPE} metalness={0.9} roughness={0.35} />
          </mesh>
        ))}
      </group>
      <instancedMesh ref={markers} args={[undefined, undefined, MAX_MARKERS]}>
        <boxGeometry args={[0.035, 0.12, 0.035]} />
        <meshBasicMaterial color="#ffb547" toneMapped={false} />
      </instancedMesh>
    </Pickable>
  )
}

function MachineRoom({ d, xray }: { d: Dims; xray: boolean }) {
  const sheave = useRef<THREE.Group>(null!)
  const drum = useRef<THREE.Group>(null!)
  const shoes = useRef<THREE.Group>(null!)
  const shoeMat = useRef<THREE.MeshStandardMaterial>(null!)
  const leds = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const m = d.machine
  const y0 = d.shaftTop
  const sy = d.sheave.y

  useFrame(() => {
    const c = runtime.controller
    // Rope speed = r·ω → angle = -position / r (sign: car side rope rises when the car rises).
    const angle = -c.motion.position / d.sheave.r
    sheave.current.rotation.x = angle
    drum.current.rotation.x = angle
    // Brake shoes: clamped (gap 0) when engaged, lifted 4 cm when the coil is energised.
    const gap = c.motion.brakeEngaged ? 0 : 0.045
    const [top, bottom] = shoes.current.children
    top.position.y = 0.33 + gap
    bottom.position.y = -0.33 - gap
    shoeMat.current.color.set(c.motion.brakeEngaged ? '#dc2626' : '#57534e')
    // Controller status LEDs: run / doors / fault
    const s = c.sm.state
    const set = (i: number, on: boolean, col: string) => {
      const mat = leds.current[i]
      if (!mat) return
      mat.emissive.set(on ? col : '#111')
      mat.emissiveIntensity = on ? 2 : 0.2
    }
    set(0, s.startsWith('MOVING'), '#4c9aff')
    set(1, s.startsWith('DOOR'), '#a3e635')
    set(2, s === 'EMERGENCY' && Math.floor(performance.now() / 300) % 2 === 0, '#ef4444')
  })

  return (
    <group>
      {/* Room shell */}
      <Pickable id="machineRoom">
        <mesh position={[0, y0 - 0.1, (m.z0 + m.z1) / 2]} receiveShadow>
          <boxGeometry args={[m.x1 - m.x0, 0.2, m.z1 - m.z0]} />
          <HLMaterial id="machineRoom" color="#30353d" roughness={0.9} transparent opacity={xray ? 0.25 : 0.95} />
        </mesh>
        {[
          { p: [0, y0 + m.h / 2, m.z0], s: [m.x1 - m.x0, m.h, 0.08] },
          { p: [m.x0, y0 + m.h / 2, (m.z0 + m.z1) / 2], s: [0.08, m.h, m.z1 - m.z0] },
          { p: [m.x1, y0 + m.h / 2, (m.z0 + m.z1) / 2], s: [0.08, m.h, m.z1 - m.z0] },
          { p: [0, y0 + m.h, (m.z0 + m.z1) / 2], s: [m.x1 - m.x0, 0.08, m.z1 - m.z0] },
        ].map((w, i) => (
          <mesh key={i} position={w.p as [number, number, number]}>
            <boxGeometry args={w.s as [number, number, number]} />
            <HLMaterial id="machineRoom" color="#5a626e" transparent opacity={0.1} roughness={0.6} />
          </mesh>
        ))}
        {/* Machine bedplate */}
        <mesh position={[0.2, y0 + 0.15, d.sheave.z]} castShadow>
          <boxGeometry args={[2.4, 0.3, 0.9]} />
          <HLMaterial id="machineRoom" color="#2b3038" metalness={0.4} roughness={0.6} />
        </mesh>
      </Pickable>

      {/* Traction sheave with spokes so rotation is visible */}
      <Pickable id="sheave">
        <group ref={sheave} position={[0, sy, d.sheave.z]}>
          <mesh rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[d.sheave.r, d.sheave.r, 0.26, 40]} />
            <HLMaterial id="sheave" color="#8b95a1" metalness={0.9} roughness={0.3} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} rotation-x={(i * Math.PI) / 3} position={[0.135, 0, 0]}>
              <boxGeometry args={[0.02, d.sheave.r * 1.9, 0.07]} />
              <HLMaterial id="sheave" color="#f59e0b" metalness={0.4} roughness={0.5} />
            </mesh>
          ))}
        </group>
      </Pickable>

      {/* Motor, coaxial with the sheave */}
      <Pickable id="motor">
        <group position={[0.75, sy, d.sheave.z]}>
          <mesh rotation-z={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.36, 0.36, 0.7, 32]} />
            <HLMaterial id="motor" color="#1e3a5f" metalness={0.6} roughness={0.4} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[-0.25 + i * 0.1, 0, 0]} rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.375, 0.375, 0.025, 32]} />
              <HLMaterial id="motor" color="#274b75" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
          <mesh position={[0, -0.45, 0]}>
            <boxGeometry args={[0.6, 0.18, 0.6]} />
            <HLMaterial id="motor" color="#2b3038" metalness={0.4} roughness={0.6} />
          </mesh>
        </group>
      </Pickable>

      {/* Electromagnetic brake: drum on the shaft, spring-applied shoes */}
      <Pickable id="brake">
        <group position={[-0.42, sy, d.sheave.z]}>
          <group ref={drum}>
            <mesh rotation-z={Math.PI / 2}>
              <cylinderGeometry args={[0.3, 0.3, 0.16, 32]} />
              <HLMaterial id="brake" color="#6b7280" metalness={0.9} roughness={0.3} />
            </mesh>
            <mesh position={[-0.085, 0.2, 0]}>
              <boxGeometry args={[0.01, 0.08, 0.08]} />
              <meshBasicMaterial color="#e5e7eb" />
            </mesh>
          </group>
          <group ref={shoes}>
            {[0, 1].map((i) => (
              <mesh key={i} position={[0, i === 0 ? 0.33 : -0.33, 0]}>
                <boxGeometry args={[0.18, 0.06, 0.4]} />
                <meshStandardMaterial ref={i === 0 ? shoeMat : undefined} color="#dc2626" metalness={0.3} roughness={0.6} />
              </mesh>
            ))}
          </group>
          {/* Brake magnet housing */}
          <mesh position={[0, 0.5, 0]}>
            <boxGeometry args={[0.2, 0.2, 0.3]} />
            <HLMaterial id="brake" color="#3f3f46" metalness={0.5} roughness={0.5} />
          </mesh>
        </group>
      </Pickable>

      {/* Main control unit (cabinet) */}
      <Pickable id="controlUnit">
        <group position={[-1.75, y0 + 1.0, 0.9]}>
          <mesh castShadow>
            <boxGeometry args={[0.7, 1.9, 0.45]} />
            <HLMaterial id="controlUnit" color="#2d333b" metalness={0.5} roughness={0.5} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[0.36, 0.6 - i * 0.12, 0]}>
              <sphereGeometry args={[0.03, 12, 12]} />
              <meshStandardMaterial ref={(mm) => void (leds.current[i] = mm)} color="#111" emissive="#111" />
            </mesh>
          ))}
        </group>
      </Pickable>
    </group>
  )
}

function Governor({ d }: { d: Dims }) {
  const pulley = useRef<THREE.Group>(null!)
  const tension = useRef<THREE.Group>(null!)
  const g = d.governor
  const topY = d.shaftTop + 0.45
  const botY = d.pitBottom + 0.45
  useFrame(() => {
    const a = -runtime.controller.motion.position / g.r
    pulley.current.rotation.x = a
    tension.current.rotation.x = a
  })
  const zc = (g.zA + g.zB) / 2
  return (
    <Pickable id="governor">
      <group ref={pulley} position={[g.x, topY, zc]}>
        <mesh rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[g.r, g.r, 0.06, 24]} />
          <HLMaterial id="governor" color="#a16207" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh position={[0.035, 0, 0]}>
          <boxGeometry args={[0.01, g.r * 1.8, 0.04]} />
          <meshBasicMaterial color="#fde68a" />
        </mesh>
      </group>
      <group ref={tension} position={[g.x, botY, zc]}>
        <mesh rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[g.r, g.r, 0.06, 24]} />
          <HLMaterial id="governor" color="#a16207" metalness={0.7} roughness={0.35} />
        </mesh>
      </group>
      {[g.zA, g.zB].map((z) => (
        <mesh key={z} position={[g.x, (topY + botY) / 2, z]}>
          <cylinderGeometry args={[0.006, 0.006, topY - botY, 4]} />
          <HLMaterial id="governor" color="#d6a84a" metalness={0.8} roughness={0.4} />
        </mesh>
      ))}
    </Pickable>
  )
}

function Buffers({ d }: { d: Dims }) {
  const spring = (z: number, key: string) => (
    <group key={key} position={[0, d.pitBottom, z]}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.1, 20]} />
        <HLMaterial id="buffers" color="#3f3f46" metalness={0.5} roughness={0.5} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[0, 0.16 + i * 0.09, 0]} rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.1, 0.018, 8, 20]} />
          <HLMaterial id="buffers" color="#eab308" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 0.72, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.05, 20]} />
        <HLMaterial id="buffers" color="#3f3f46" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  )
  return <Pickable id="buffers">{[spring(d.car.z, 'car'), spring(d.cw.z, 'cw')]}</Pickable>
}
