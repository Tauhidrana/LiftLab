import { CameraControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { runtime } from '../../store/runtime'
import { useLab, type CameraPreset } from '../../store/useLab'
import { Building } from './Building'
import { Car } from './Car'
import { getDims, type Dims } from './dims'
import { Flows } from './Flows'
import { Machinery } from './Machinery'
import { font, makeCanvasTexture } from './parts'

const dot = (px: number) => `900 ${px}px Doto, "IBM Plex Mono", monospace`

export function ElevatorScene({ variant = 'simulation' }: { variant?: 'simulation' | 'architecture' }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 38, near: 0.05, far: 400, position: [20, 16, 28] }}
      gl={{ antialias: true, localClippingEnabled: true } as THREE.WebGLRendererParameters & { localClippingEnabled: boolean }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true
        gl.toneMapping = THREE.ACESFilmicToneMapping
      }}
      onPointerMissed={() => variant === 'architecture' && useLab.getState().selectComponent(null)}
    >
      <color attach="background" args={['#0b0d10']} />
      <fog attach="fog" args={['#0b0d10', 60, 140]} />
      <SceneContents variant={variant} />
    </Canvas>
  )
}

function SceneContents({ variant }: { variant: 'simulation' | 'architecture' }) {
  const floors = useLab((s) => s.config.floors)
  const floorHeight = useLab((s) => s.config.floorHeight)
  useLab((s) => s.generation) // re-mount scene on engine rebuild
  const engineering = useLab((s) => s.engineering)
  const camera = useLab((s) => s.camera)
  const d = useMemo(() => getDims(floors, floorHeight), [floors, floorHeight])
  const xray = variant === 'architecture' || engineering
  const cutaway = camera === 'cutaway'
  const clip = useMemo(() => (cutaway ? [new THREE.Plane(new THREE.Vector3(-1, 0, 0), d.shaft.x1 - 0.02)] : []), [cutaway, d])
  const display = useDisplayTexture()

  return (
    <>
      <Environment />
      <hemisphereLight args={['#dbe4ff', '#1f2937', 0.9]} />
      <directionalLight
        position={[14, d.shaftTop + 14, 18]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={d.shaftTop + 6}
        shadow-camera-bottom={-6}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
      />
      <gridHelper args={[60, 60, '#1f2630', '#161b22']} position={[0, -0.2, 0]} />
      <Building d={d} xray={xray} clip={clip} display={display} />
      <Machinery d={d} xray={xray} />
      <Car d={d} display={display} />
      {xray && <Flows d={d} />}
      <CameraRig d={d} variant={variant} />
    </>
  )
}

/** Image-based lighting from a procedural room (no network download). */
function Environment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.55
    return () => {
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])
  return null
}

/** The floor indicator display (shared by every landing and the car interior). */
function useDisplayTexture() {
  const t = useMemo(() => makeCanvasTexture(256, 100), [])
  const key = useRef('')
  // Redraw once the dot-matrix web font has loaded.
  useEffect(() => {
    document.fonts?.ready.then(() => (key.current = ''))
  }, [])
  useFrame(() => {
    const c = runtime.controller
    const em = c.sm.state === 'EMERGENCY'
    const blink = em && Math.floor(performance.now() / 500) % 2 === 0
    const k = `${c.currentFloor}${c.direction}${em}${blink}`
    if (k === key.current) return
    key.current = k
    const { ctx } = t
    ctx.fillStyle = '#05070a'
    ctx.fillRect(0, 0, 256, 100)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = em ? '#f2545b' : '#ffb547'
    if (em) {
      ctx.font = dot(40)
      ctx.fillText(blink ? 'STOP' : String(c.currentFloor), 128, 52)
    } else {
      ctx.font = dot(66)
      ctx.fillText(String(c.currentFloor), 150, 54)
      ctx.font = font(40, 600)
      ctx.fillText(c.direction === 'UP' ? '▲' : c.direction === 'DOWN' ? '▼' : '·', 82, 52)
    }
    t.texture.needsUpdate = true
  })
  return t.texture
}

type Shot = { pos: THREE.Vector3Tuple; target: THREE.Vector3Tuple; follow: boolean }

function shotFor(preset: CameraPreset, d: Dims, carY: number): Shot {
  const mid = d.shaftTop / 2
  switch (preset) {
    case 'building':
      return { pos: [26, mid + 10, 42], target: [0, mid - 1.5, 0], follow: false }
    case 'interior':
      return { pos: [-0.6, carY + 1.7, d.car.z - 0.55], target: [0.55, carY + 1.4, d.car.z + 0.75], follow: true }
    case 'shaft':
      return { pos: [3.2, carY + 3.4, 4.2], target: [0, carY + 1.2, -0.2], follow: true }
    case 'machine':
      return { pos: [4.6, d.shaftTop + 3.4, 4.8], target: [0, d.shaftTop + 0.9, -0.3], follow: false }
    case 'cutaway':
      return { pos: [36, mid + 4, 7], target: [0, mid - 1.5, -0.2], follow: false }
  }
}

function CameraRig({ d, variant }: { d: Dims; variant: 'simulation' | 'architecture' }) {
  const controls = useRef<CameraControls>(null!)
  const preset = useLab((s) => s.camera)
  const nonce = useLab((s) => s.cameraNonce)
  const follow = useRef(false)
  const lastY = useRef(0)
  const first = useRef(true)

  const pending = useRef<{ shot: Shot; smooth: boolean } | null>(null)

  useEffect(() => {
    const y = runtime.controller.motion.position
    const shot =
      variant === 'architecture' && preset === 'building'
        ? { pos: [20, d.shaftTop / 2 + 9, 24] as THREE.Vector3Tuple, target: [0, d.shaftTop / 2 - 0.5, -0.3] as THREE.Vector3Tuple, follow: false }
        : shotFor(preset, d, y)
    pending.current = { shot, smooth: !first.current }
    first.current = false
  }, [preset, nonce, d, variant])

  // Interior and shaft views ride along with the car.
  useFrame(() => {
    const y = runtime.controller.motion.position
    if (pending.current && controls.current) {
      const { shot, smooth } = pending.current
      pending.current = null
      follow.current = shot.follow
      lastY.current = y
      controls.current.setLookAt(...shot.pos, ...shot.target, smooth)
      return
    }
    const dy = y - lastY.current
    lastY.current = y
    if (!follow.current || dy === 0 || !controls.current) return
    const p = controls.current.getPosition(new THREE.Vector3())
    const t = controls.current.getTarget(new THREE.Vector3())
    controls.current.setLookAt(p.x, p.y + dy, p.z, t.x, t.y + dy, t.z, false)
  })

  return <CameraControls ref={controls} makeDefault minDistance={0.3} maxDistance={90} smoothTime={0.6} />
}
