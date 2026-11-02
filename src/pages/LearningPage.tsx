import clsx from 'clsx'
import { FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { Btn } from '../components/ui'
import { runtime } from '../store/runtime'
import { useLab } from '../store/useLab'

interface Topic {
  id: string
  title: string
  body: string[]
  steps?: string[]
  tryLabel: string
  run: () => void
}

const L = () => useLab.getState()
const fresh = (opts: { step?: boolean; engineering?: boolean; debug?: boolean } = {}) => {
  const s = L()
  if (s.operation !== 'normal') s.setOperation('normal')
  s.restart()
  if (s.engineering !== !!opts.engineering) s.toggleLens('engineering')
  if (s.debug !== !!opts.debug) s.toggleLens('debug')
  if (s.stepMode !== !!opts.step) s.setStepMode(!!opts.step)
  if (s.paused) s.togglePause()
  s.setPage('simulation')
}
/** Wait for simulated (not wall-clock) seconds, so scenarios behave the same at any speed. */
const afterSim = (seconds: number, fn: () => void) => {
  const target = runtime.controller.time + seconds
  const gen = runtime.generation
  const check = () => {
    if (runtime.generation !== gen) return
    if (runtime.controller.time >= target) fn()
    else requestAnimationFrame(check)
  }
  requestAnimationFrame(check)
}

const TOPICS: Topic[] = [
  {
    id: 'overview',
    title: 'How elevators work',
    body: [
      'A traction elevator hangs the car and a counterweight on steel ropes over a grooved pulley (the sheave). An electric motor turns the sheave; friction between rope and groove moves the ropes, raising one side and lowering the other.',
      'A controller decides where to go, a brake holds the car still, doors open only at a landing, and a chain of safety devices can stop everything independently of the software.',
    ],
    tryLabel: 'Watch a trip in the Engineering view',
    run: () => {
      fresh({ engineering: true })
      L().setCamera('cutaway')
      L().pressCar(6)
    },
  },
  {
    id: 'press',
    title: 'What happens when someone presses a floor button',
    body: ['One button press triggers a chain of functions. Use step mode to walk through it at your own pace.'],
    steps: [
      'pressCarButton() records the input event.',
      'requestFloor() adds the floor to requestQueue.',
      'dispatch() asks the scheduler for the next destination.',
      'startTrip() sets the target, energises the motor, then releases the brake.',
      'The state machine moves IDLE → MOVING_UP.',
      'Sensors update the floor indicator; deceleration starts when distance = v²/2a.',
      'onArrival() applies the brake, serves the request and opens the doors.',
    ],
    tryLabel: 'Step through “press 5”',
    run: () => {
      fresh({ step: true })
      L().pressCar(5)
    },
  },
  {
    id: 'decide',
    title: 'How an elevator decides which floor to visit',
    body: [
      'The controller never “remembers a plan”. Every time something changes, it asks the scheduler again: given all pending requests, the car position and its direction, where next?',
      'With LOOK + collective control the car keeps going in its direction while there are car calls or same-direction hall calls ahead, then turns around.',
    ],
    tryLabel: 'Car at 1 → 6, with calls at 3▲ and 7▼',
    run: () => {
      fresh()
      L().setBottomTab('queue')
      L().pressCar(6)
      afterSim(1.5, () => {
        L().pressHall(3, 'UP')
        L().pressHall(7, 'DOWN')
      })
    },
  },
  {
    id: 'queue',
    title: 'How elevator request queues work',
    body: [
      'Requests are stored as car calls (from inside the car) and hall calls (floor + direction, from the landings). The queue is not served first-in-first-out: the scheduler chooses from it.',
      'A request is removed only when the car stops at that floor and opens its doors (serveFloor).',
    ],
    tryLabel: 'Fill the queue and watch it drain',
    run: () => {
      fresh()
      L().setBottomTab('queue')
      ;[7, 3, 5, 2].forEach((f) => L().pressCar(f))
      L().pressHall(4, 'DOWN')
    },
  },
  {
    id: 'algorithms',
    title: 'How elevator scheduling algorithms work',
    body: ['FCFS, SSTF, SCAN and LOOK make different trade-offs between fairness, waiting time and travel distance. The comparison runs the real engine on identical traffic.'],
    tryLabel: 'Open the algorithm comparison',
    run: () => L().setPage('algorithms'),
  },
  {
    id: 'motor',
    title: 'How electric motors move elevators',
    body: [
      'A variable-frequency drive ramps the motor speed up and down, giving the smooth acceleration profile you see in the Motion tab. The motor first builds holding torque, then the brake lifts.',
      'Rope speed = sheave radius × angular speed. With r = 0.24 m, 1 m/s needs about 40 rpm — that is why modern gearless motors are big, slow and torque-heavy.',
    ],
    tryLabel: 'Watch the machine room on a trip',
    run: () => {
      fresh({ engineering: true })
      L().setCamera('machine')
      L().setBottomTab('motion')
      L().pressCar(8)
    },
  },
  {
    id: 'counterweight',
    title: 'Why counterweights are necessary',
    body: [
      'Without a counterweight the motor would lift the full weight of car and passengers. With one sized at car + 50 % of rated load, the motor lifts only the difference.',
      'When the heavier side moves down (e.g. an empty car going up), the motor acts as a brake and a generator: regenerative drives feed that energy back.',
    ],
    tryLabel: 'Compare power going up vs. down',
    run: () => {
      fresh({ engineering: true })
      L().setCamera('cutaway')
      L().setBottomTab('metrics')
      L().pressCar(8)
      afterSim(24, () => L().pressCar(1))
    },
  },
  {
    id: 'doors',
    title: 'How elevator doors detect obstacles',
    body: [
      'A light curtain of infrared beams spans the doorway. If any beam is broken while the doors close, they reverse at once. If the curtain itself fails its self-test, the safe choice is to keep the doors open.',
    ],
    tryLabel: 'Put a suitcase in the doorway',
    run: () => {
      fresh()
      L().setCamera('shaft')
      L().setBottomTab('faults')
      L().doorOpen()
      afterSim(3, () => L().toggleFault('doorObstruction'))
    },
  },
  {
    id: 'sensors',
    title: 'How position sensors work',
    body: [
      'An encoder on the motor counts rotation for continuous position; magnetic vanes at each floor confirm exact levelling. Watch the green vane light up as the car passes, and the green signal pulses travel to the controller.',
    ],
    tryLabel: 'Ride along in the shaft (debug on)',
    run: () => {
      fresh({ engineering: true, debug: true })
      L().setCamera('shaft')
      L().pressCar(5)
    },
  },
  {
    id: 'braking',
    title: 'How emergency braking works',
    body: [
      'The brake is held open by an electromagnet. Any safety fault cuts that power and springs clamp the brake — no software needed. If the car is ever too fast, the overspeed governor trips the safety gear onto the rails.',
      'After an emergency stop between floors, the controller only returns to service after a manual reset, with a slow recovery run to the nearest floor.',
    ],
    tryLabel: 'Emergency stop mid-trip',
    run: () => {
      fresh({ engineering: true })
      L().setBottomTab('faults')
      L().pressCar(8)
      afterSim(6, () => L().emergencyStop())
    },
  },
  {
    id: 'comms',
    title: 'How elevator controllers communicate with hardware',
    body: [
      'Power flows from the controller to the motor and brake coil; signals flow back from sensors over the travelling cable; commands go to the door operator. Landing stations talk over a serial bus.',
    ],
    tryLabel: 'Open the signal-flow diagram',
    run: () => {
      L().selectComponent('controlUnit')
      L().setPage('architecture')
    },
  },
]

export function LearningPage() {
  const [active, setActive] = useState(TOPICS[0].id)
  const t = TOPICS.find((x) => x.id === active)!
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] md:grid-cols-[300px_1fr] md:grid-rows-1">
      <nav className="max-h-[30vh] overflow-auto border-b border-line bg-surface p-2 md:max-h-none md:border-r md:border-b-0">
        <div className="px-2 pt-1 pb-2 text-[12px] font-medium text-faint">Topics</div>
        {TOPICS.map((x, i) => (
          <button
            key={x.id}
            onClick={() => setActive(x.id)}
            className={clsx(
              'flex w-full gap-2.5 rounded px-2 py-1.5 text-left text-[12.5px]',
              x.id === active ? 'bg-accent/12 text-accent' : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
            )}
          >
            <span className="font-mono text-[10.5px] text-faint">{String(i + 1).padStart(2, '0')}</span>
            {x.title}
          </button>
        ))}
      </nav>
      <article className="overflow-auto px-4 py-6 md:px-10 md:py-8">
        <div className="max-w-[680px]">
          <h1 className="text-[22px] font-semibold text-ink">{t.title}</h1>
          {t.body.map((p, i) => (
            <p key={i} className="mt-3 text-[14px] leading-[1.7] text-ink-2">
              {p}
            </p>
          ))}
          {t.steps && (
            <ol className="mt-4 space-y-1.5">
              {t.steps.map((s, i) => (
                <li key={i} className="flex gap-3 text-[13.5px] text-ink-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[10.5px] text-muted">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          )}
          <div className="mt-6 rounded-lg border border-accent/30 bg-accent/[0.05] p-4">
            <div className="flex items-center gap-2 text-[12px] font-medium text-accent">
              <FlaskConical size={14} /> Try it in the lab
            </div>
            <p className="mt-1 text-[12.5px] text-ink-2">This resets the simulation and sets up the scenario below.</p>
            <Btn tone="accent" className="mt-3" onClick={t.run}>
              {t.tryLabel}
            </Btn>
          </div>
        </div>
      </article>
    </div>
  )
}
