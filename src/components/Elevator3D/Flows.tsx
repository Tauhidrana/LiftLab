import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ElevatorController } from '../../engine/ElevatorController'
import { runtime } from '../../store/runtime'
import { cwTop, type Dims } from './dims'

export const FLOW_COLORS = { power: '#f59e0b', signal: '#34d399', command: '#4c9aff', motion: '#e5e7eb' }

type V = [number, number, number]

/** Pulses travelling along a polyline. `direction` returns 1 (forward), -1 (reverse) or 0 (inactive). */
function PulsePath({ points, direction, color, count = 7, speed = 1.4 }: {
  points: (c: ElevatorController) => V[]
  direction: (c: ElevatorController) => number
  color: string
  count?: number
  speed?: number
}) {
  const inst = useRef<THREE.InstancedMesh>(null!)
  const lineGeo = useMemo(() => new THREE.BufferGeometry(), [])
  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }), [color])
  const line = useMemo(() => new THREE.Line(lineGeo, lineMat), [lineGeo, lineMat])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const phase = useRef(0)

  useFrame((_, dt) => {
    const c = runtime.controller
    const pts = points(c).map((p) => new THREE.Vector3(...p))
    lineGeo.setFromPoints(pts)
    const dir = direction(c)
    lineMat.opacity = dir === 0 ? 0.12 : 0.45
    const segs: number[] = []
    let total = 0
    for (let i = 1; i < pts.length; i++) {
      const l = pts[i].distanceTo(pts[i - 1])
      segs.push(l)
      total += l
    }
    if (dir === 0 || total === 0) {
      inst.current.count = 0
      return
    }
    phase.current = (phase.current + dt * speed * dir + total) % total
    const gap = total / count
    for (let k = 0; k < count; k++) {
      let s = (phase.current + k * gap) % total
      let i = 0
      while (i < segs.length - 1 && s > segs[i]) s -= segs[i++]
      tmp.position.lerpVectors(pts[i], pts[i + 1], Math.min(1, s / segs[i]))
      tmp.updateMatrix()
      inst.current.setMatrixAt(k, tmp.matrix)
    }
    inst.current.count = count
    inst.current.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <primitive object={line} />
      <instancedMesh ref={inst} args={[undefined, undefined, count]}>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}

/** Power, signal and command flows + movement arrows (Engineering lens / Architecture page). */
export function Flows({ d }: { d: Dims }) {
  const y0 = d.shaftTop
  const sy = d.sheave.y
  const cab: V = [-1.75, y0 + 1.95, 0.9]
  return (
    <group>
      {/* Drive power: controller → motor. Reverses when the motor regenerates. */}
      <PulsePath
        color={FLOW_COLORS.power}
        points={() => [cab, [-1.75, y0 + 2.45, 0.9], [0.75, y0 + 2.45, 0.9], [0.75, y0 + 2.45, d.sheave.z], [0.75, sy + 0.37, d.sheave.z]]}
        direction={(c) => (c.motion.motorEnergized ? (c.powerW >= 0 ? 1 : -1) : 0)}
        speed={2}
      />
      {/* Brake coil supply: energised = brake released */}
      <PulsePath
        color={FLOW_COLORS.power}
        count={4}
        points={() => [[-1.6, y0 + 1.95, 0.9], [-1.6, y0 + 2.2, 0.9], [-0.42, y0 + 2.2, 0.9], [-0.42, y0 + 2.2, d.sheave.z], [-0.42, sy + 0.6, d.sheave.z]]}
        direction={(c) => (c.motion.brakeEngaged ? 0 : 1)}
      />
      {/* Position feedback: car sensor → controller (travelling cable) */}
      <PulsePath
        color={FLOW_COLORS.signal}
        points={(c) => {
          const p = c.motion.position
          return [[d.carRailX + 0.02, p + 1.2, d.car.z + 0.16], [1.25, p + 1.2, 0.9], [1.25, y0 - 0.15, 0.9], [-1.75, y0 - 0.15, 0.9], [-1.75, y0 + 0.05, 0.9]]
        }}
        direction={(c) => (c.safety.has('positionSensorFault') ? 0 : 1)}
        speed={1.2}
      />
      {/* Door commands: controller → door operator */}
      <PulsePath
        color={FLOW_COLORS.command}
        count={5}
        points={(c) => {
          const p = c.motion.position
          return [[-1.55, y0 + 0.05, 1.1], [-1.55, y0 - 0.3, 1.1], [-1.2, y0 - 0.3, 1.1], [-1.2, p + d.car.h + 0.4, 1.1], [0, p + d.car.h + 0.25, 1.05]]
        }}
        direction={(c) => (c.doors.motorActive ? 1 : 0)}
        speed={2.4}
      />
      <MotionArrows d={d} />
    </group>
  )
}

/** Arrows beside the car and the counterweight: they always point in opposite directions. */
function MotionArrows({ d }: { d: Dims }) {
  const car = useRef<THREE.Group>(null!)
  const cw = useRef<THREE.Group>(null!)
  useFrame(() => {
    const c = runtime.controller
    const v = c.motion.velocity
    const moving = Math.abs(v) > 0.01
    car.current.visible = cw.current.visible = moving
    car.current.position.y = c.motion.position + 1.2
    car.current.rotation.z = v > 0 ? 0 : Math.PI
    cw.current.position.y = cwTop(d, c.motion.position) - d.cw.h / 2
    cw.current.rotation.z = v > 0 ? Math.PI : 0
  })
  const arrow = (
    <>
      <mesh position={[0, -0.15, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 8]} />
        <meshBasicMaterial color={FLOW_COLORS.motion} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <coneGeometry args={[0.1, 0.22, 12]} />
        <meshBasicMaterial color={FLOW_COLORS.motion} toneMapped={false} />
      </mesh>
    </>
  )
  return (
    <>
      <group ref={car} position={[-d.carRailX - 0.32, 0, d.car.z]}>{arrow}</group>
      <group ref={cw} position={[-d.cw.w / 2 - 0.25, 0, d.cw.z]}>{arrow}</group>
    </>
  )
}
