# LiftLab: elevator engineering lab

An interactive 3D elevator simulation in which every animation is driven by a real,
deterministic simulation engine, and every engine decision is shown live in a code
inspector that highlights the line of source code that just ran.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
```

## Architecture

```
src/
  engine/                  framework-free simulation (no React, no Three.js)
    ElevatorController.ts  control unit: inputs, request queue, dispatch, doors, safety, tick()
    ElevatorStateMachine.ts legal state transitions in one table
    RequestScheduler.ts    FCFS / SSTF / SCAN / LOOK (collective control), pure function
    MovementEngine.ts      trapezoidal motion profile, braking
    DoorController.ts      door operator + light curtain
    SafetySystem.ts        safety chain, fault set, overspeed governor
    TrafficSimulator.ts    seeded passengers for Auto mode and benchmarks (per-car riders)
    GroupController.ts     multi-car dispatcher: nearest car, shortest ETA, zoning
    Tracer.ts              emits trace events; each emit('marker', …) is a real code line
    sources.ts             imports the engine source as text (?raw) and indexes the markers
    benchmark.ts           headless algorithm comparison
  store/
    runtime.ts             owns the controller and runs a fixed 60 Hz loop
    useLab.ts              Zustand UI store; snapshot pushed at ~15 Hz
  components/
    Elevator3D/            R3F scene: reads the engine every frame, never decides anything
    CodeInspector/         event card, execution order, live-highlighted source
    EventTimeline/ ControlPanel/ Dashboard/ ArchitectureViewer content in pages/
  challenge/               challenge definitions + Web Worker that runs user code safely
  content/components.ts    the 16 mechanical components (purpose, how, live status)
  pages/                   Simulation, Architecture, Group control, Algorithms, Challenges, Learning, Settings
```

**How the engine talks to the UI.** The engine is a plain class that the runtime
advances with a fixed time step. Same inputs give the same behaviour. The 3D layer
reads `runtime.controller` inside `useFrame`, so there are no React re-renders per
frame. Panels read a throttled snapshot from the store.

**How the inspector stays honest.** The engine calls `trace.emit('queue.addCar', …)`
from the very line where it acts. `sources.ts` finds that literal in the real source
file, so the inspector highlights the exact line and its enclosing function.

## Educational scope

This is a simplified model: S-curve (jerk-limited) or trapezoid motion, a simple
force balance for motor power, and a software safety chain. Real elevators follow
safety codes (EN 81-20/50, ASME A17.1) with hard-wired, certified safety circuits.
Do not use this to design or operate real equipment.

## Phase 2 (done)

- S-curve, jerk-limited motion with a levelling creep (Settings → Motion profile)
- Group control page: 2–4 cars, three dispatch strategies, live dispatcher log, headless comparison
- Challenges: write `selectNext(ctx)`, run it in a Web Worker against the built-in algorithms, then load it into the 3D lab
- Safety circuit ladder diagram (Architecture → Safety circuit), with clickable contacts
- New visual system: IBM Plex, an amber dot-matrix floor display, and a shaft rail overlay

## Next ideas

- Group control in 3D (several shafts side by side)
- Destination dispatch (passengers enter their floor at the landing)
- Load weighing and full-car bypass
