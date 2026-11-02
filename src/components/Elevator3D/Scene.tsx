import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, SSAO, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
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
      shadows="soft"
      dpr={[1, 2]}
      camera={{ fov: 38, near: 0.05, far: 400, position: [20, 16, 28] }}
      gl={{ antialias: true, localClippingEnabled: true } as THREE.WebGLRendererParameters & { localClippingEnabled: boolean }}
      onCreated={({ gl }) => {
        gl.localClippingEnabled = true
        // Tone mapping happens in the post-processing pass (see Effects).
        gl.toneMapping = THREE.NoToneMapping
      }}
      onPointerMissed={() => variant === 'architecture' && useLab.getState().selectComponent(null)}
    >
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

  // Realistic daylight by default; the dark blueprint look is kept for the x-ray / engineering lens.
  const bg = xray ? '#0b0d10' : '#c3c9cf'
  return (
    <>
      <color attach="background" args={[bg]} />
      <fog attach="fog" args={[bg, xray ? 60 : 45, xray ? 140 : 120]} />
      <Environment />
      <hemisphereLight args={xray ? ['#dbe4ff', '#1f2937', 0.9] : ['#eef3f8', '#6b6a66', 0.8]} />
      <directionalLight
        position={[14, d.shaftTop + 14, 18]}
        intensity={xray ? 2.2 : 2.8}
        color={xray ? '#ffffff' : '#fff3e2'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={d.shaftTop + 6}
        shadow-camera-bottom={-6}
        shadow-camera-far={120}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      {xray && <gridHelper args={[60, 60, '#1f2630', '#161b22']} position={[0, -0.2, 0]} />}
      <Building d={d} xray={xray} clip={clip} display={display} lobby={camera === 'interior' && !xray} />
      <Machinery d={d} xray={xray} />
      <Car d={d} display={display} xray={xray} mirror={camera === 'interior'} />
      {xray && <Flows d={d} />}
      <CameraRig d={d} variant={variant} />
      <Effects xray={xray} />
    </>
  )
}

/** Ambient occlusion (contact shadows in corners), bloom on lamps and displays, filmic tone mapping. */
function Effects({ xray }: { xray: boolean }) {
  return (
    // N8AO is not compatible with three r187's render targets; postprocessing's own SSAO is.
    <EffectComposer multisampling={4} enableNormalPass={!xray}>
      {xray ? <></> : <SSAO samples={21} radius={0.12} intensity={22} luminanceInfluence={0.5} worldDistanceThreshold={6} worldDistanceFalloff={2} worldProximityThreshold={0.6} worldProximityFalloff={0.3} />}
      <Bloom mipmapBlur luminanceThreshold={0.95} intensity={xray ? 0.35 : 0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <Vignette offset={0.3} darkness={0.45} />
    </EffectComposer>
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
    case 'interior': {
      // A passenger standing near the back wall, eyes at 1.62 m, looking at the doors.
      const eye = new THREE.Vector3(-0.12, carY + 1.62, d.car.z - d.car.d / 2 + 0.2)
      const look = new THREE.Vector3(0.12, carY + 1.15, d.car.z + d.car.d / 2).sub(eye).normalize().multiplyScalar(0.05).add(eye)
      return { pos: eye.toArray(), target: look.toArray(), follow: true }
    }
    case 'shaft':
      return { pos: [3.2, carY + 3.4, 4.2], target: [0, carY + 1.2, -0.2], follow: true }
    case 'machine':
      return { pos: [4.6, d.shaftTop + 3.4, 4.8], target: [0, d.shaftTop + 0.9, -0.3], follow: false }
    case 'cutaway':
      return { pos: [36, mid + 4, 7], target: [0, mid - 1.5, -0.2], follow: false }
  }
}

const { ACTION } = CameraControlsImpl
/** First person: drag turns your head, scroll zooms the eye (FOV), no walking through walls. */
function setFirstPerson(c: CameraControls, cam: THREE.PerspectiveCamera, on: boolean) {
  c.minDistance = on ? 0 : 0.3
  c.azimuthRotateSpeed = c.polarRotateSpeed = on ? -0.32 : 1
  c.minPolarAngle = on ? Math.PI * 0.22 : 0
  c.maxPolarAngle = on ? Math.PI * 0.8 : Math.PI
  c.mouseButtons.wheel = on ? ACTION.ZOOM : ACTION.DOLLY
  c.mouseButtons.right = on ? ACTION.NONE : ACTION.TRUCK
  c.mouseButtons.middle = on ? ACTION.NONE : ACTION.DOLLY
  c.touches.two = on ? ACTION.TOUCH_ZOOM : ACTION.TOUCH_DOLLY_TRUCK
  c.touches.three = on ? ACTION.NONE : ACTION.TOUCH_TRUCK
  c.minZoom = on ? 1 : 0.01
  c.maxZoom = on ? 2.5 : Infinity
  c.zoomTo(1, false)
  cam.fov = on ? 74 : 38
  cam.updateProjectionMatrix()
}

function CameraRig({ d, variant }: { d: Dims; variant: 'simulation' | 'architecture' }) {
  const controls = useRef<CameraControls>(null!)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
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
      const fp = preset === 'interior'
      setFirstPerson(controls.current, camera, fp)
      controls.current.setLookAt(...shot.pos, ...shot.target, smooth && !fp)
      return
    }
    const dy = y - lastY.current
    lastY.current = y
    if (!follow.current || dy === 0 || !controls.current) return
    // Shift the rig without resetting the look direction, so you can look around while riding.
    const t = controls.current.getTarget(new THREE.Vector3(), true)
    controls.current.moveTo(t.x, t.y + dy, t.z, false)
  })

  return <CameraControls ref={controls} makeDefault minDistance={0.3} maxDistance={90} smoothTime={0.6} />
}
