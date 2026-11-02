import type { Snapshot } from '../engine/types'

export type ComponentId =
  | 'motor'
  | 'sheave'
  | 'ropes'
  | 'car'
  | 'counterweight'
  | 'rails'
  | 'brake'
  | 'doorMotor'
  | 'doorSensors'
  | 'positionSensors'
  | 'floorController'
  | 'controlUnit'
  | 'safetyGear'
  | 'buffers'
  | 'governor'
  | 'machineRoom'

export interface MechComponent {
  id: ComponentId
  name: string
  group: 'Drive' | 'Car & shaft' | 'Doors' | 'Sensing & control' | 'Safety'
  purpose: string
  how: string
  activation: string
  talksTo: { id: ComponentId; via: string }[]
  /** What the real industrial version adds beyond this model. */
  industrial: string
  live: (s: Snapshot) => string
}

const f = (n: number, d = 2) => n.toFixed(d)

export const COMPONENTS: MechComponent[] = [
  {
    id: 'motor',
    name: 'Electric traction motor',
    group: 'Drive',
    purpose: 'Turns electrical energy into the torque that moves the car.',
    how: 'A variable-frequency drive (VFD) feeds the motor a voltage whose frequency sets its speed. Raising the frequency smoothly gives the acceleration ramp; lowering it gives deceleration. Modern lifts use gearless permanent-magnet motors coupled straight to the sheave.',
    activation: 'Before the brake lifts, the drive builds "pre-torque" equal to the load imbalance so the car neither jumps nor drops. It then follows the speed profile commanded by the controller. When the car is heavier going down, the motor works as a generator.',
    talksTo: [
      { id: 'controlUnit', via: 'speed reference & enable (signal)' },
      { id: 'sheave', via: 'shaft torque (mechanical)' },
      { id: 'brake', via: 'shares the motor shaft' },
    ],
    industrial: 'Real drives run closed-loop vector control with an absolute encoder, current limits, motor thermal protection and regenerative or resistor braking units.',
    live: (s) =>
      `${s.motorEnergized ? 'ENERGISED' : 'OFF'} · ${f(Math.abs(s.motorRpm), 0)} rpm · ${s.motorPowerKw >= 0 ? '' : 'regenerating '}${f(Math.abs(s.motorPowerKw), 1)} kW`,
  },
  {
    id: 'sheave',
    name: 'Drive pulley (traction sheave)',
    group: 'Drive',
    purpose: 'Grips the ropes by friction and converts rotation into vertical rope travel.',
    how: 'The ropes sit in grooves cut into the sheave. Friction between rope and groove (traction) moves the ropes — they are not wound up like a winch. Rope speed = sheave radius × angular speed.',
    activation: 'Rotates whenever the motor turns. One revolution moves the car 2πr metres (here 1.51 m with r = 0.24 m).',
    talksTo: [
      { id: 'motor', via: 'shaft (mechanical)' },
      { id: 'ropes', via: 'groove friction (mechanical)' },
    ],
    industrial: 'Groove shape (U, V, undercut) is chosen to balance grip against rope wear; traction is verified by calculation (Euler–Eytelwein) for loaded, empty and emergency-stop cases.',
    live: (s) => `${f(Math.abs(s.motorRpm), 0)} rpm · rope speed ${f(Math.abs(s.velocity))} m/s`,
  },
  {
    id: 'ropes',
    name: 'Steel suspension ropes',
    group: 'Drive',
    purpose: 'Hang the car on one side of the sheave and the counterweight on the other.',
    how: 'Several independent steel wire ropes share the load, each strong enough with a large safety factor. Car and counterweight move in opposite directions at the same speed (1:1 roping).',
    activation: 'Move with the sheave. Watch the rope markers: they travel up on the car side while travelling down on the counterweight side.',
    talksTo: [
      { id: 'sheave', via: 'traction (mechanical)' },
      { id: 'car', via: 'rope hitch (mechanical)' },
      { id: 'counterweight', via: 'rope hitch (mechanical)' },
    ],
    industrial: 'Codes require at least 2–3 ropes and a safety factor of typically 12 or more; rope wear and stretch are inspected regularly.',
    live: (s) => `${s.velocity === 0 ? 'stationary' : s.velocity > 0 ? 'car side ↑, counterweight side ↓' : 'car side ↓, counterweight side ↑'}`,
  },
  {
    id: 'car',
    name: 'Elevator car (cabin)',
    group: 'Car & shaft',
    purpose: 'Carries passengers. Holds the car panel, door operator, light curtain and safety gear.',
    how: 'A steel sling (frame) carries the cabin. Guide shoes on the sling run on the rails. The car is hung from the ropes at the top of the sling.',
    activation: 'Moves when the motor turns with the brake released. Its doors open only when level with a landing.',
    talksTo: [
      { id: 'ropes', via: 'suspension (mechanical)' },
      { id: 'rails', via: 'guide shoes (mechanical)' },
      { id: 'controlUnit', via: 'travelling cable (signal & power)' },
    ],
    industrial: 'Real cars also have load-weighing sensors, an emergency light and alarm, a two-way intercom and a top-of-car inspection station.',
    live: (s) => `floor ${s.currentFloor} · ${f(s.position)} m · ${s.loadKg} kg load`,
  },
  {
    id: 'counterweight',
    name: 'Counterweight',
    group: 'Car & shaft',
    purpose: 'Balances the car so the motor only has to lift the difference, not the whole weight.',
    how: 'Its mass is the car mass plus about 40–50 % of the rated load. With an average load the two sides almost balance, and the motor only overcomes the imbalance, inertia and friction.',
    activation: 'Moves opposite to the car. When the car is light and going up, the heavier counterweight going down helps — the motor may even generate power.',
    talksTo: [
      { id: 'ropes', via: 'rope hitch (mechanical)' },
      { id: 'rails', via: 'its own guide rails (mechanical)' },
      { id: 'buffers', via: 'lands on its own buffer if it overtravels' },
    ],
    industrial: 'Made of stacked steel or concrete filler weights in a frame; it has its own guide rails and buffer, and sometimes its own safety gear.',
    live: (s) => `moving ${s.velocity === 0 ? '—' : s.velocity > 0 ? 'DOWN' : 'UP'} at ${f(Math.abs(s.velocity))} m/s`,
  },
  {
    id: 'rails',
    name: 'Guide rails',
    group: 'Car & shaft',
    purpose: 'Keep the car and the counterweight on a straight vertical path.',
    how: 'T-section steel rails run the full height of the shaft, bolted to the walls with brackets. Guide shoes or rollers on the car run along them.',
    activation: 'Passive. In an overspeed event the safety gear wedges grip these rails to stop the car.',
    talksTo: [
      { id: 'car', via: 'guide shoes' },
      { id: 'safetyGear', via: 'braking surface' },
    ],
    industrial: 'Rail straightness and joint alignment directly affect ride quality; rails must also carry the safety gear braking force.',
    live: () => 'passive structural component',
  },
  {
    id: 'brake',
    name: 'Electromagnetic brake',
    group: 'Drive',
    purpose: 'Holds the car still at a floor and stops it in an emergency.',
    how: 'Springs push brake shoes onto a drum or disc on the motor shaft. An electromagnet pulls them away. No power → springs win → brake closes. This "fail-safe" design means a power cut always brakes.',
    activation: 'Released (coil energised) only after the motor has pre-torque. Applied when the car is level at a floor, or instantly when the safety chain opens.',
    talksTo: [
      { id: 'controlUnit', via: 'brake coil supply (power)' },
      { id: 'motor', via: 'acts on the motor shaft' },
    ],
    industrial: 'Codes require two independent brake circuits, each able to hold the car alone, with monitoring of each brake shoe.',
    live: (s) => (s.brakeEngaged ? 'ENGAGED — springs clamping' : 'RELEASED — coil energised'),
  },
  {
    id: 'doorMotor',
    name: 'Door operator (door motor)',
    group: 'Doors',
    purpose: 'Opens and closes the car doors; a vane on the car door also drives the landing doors.',
    how: 'A small motor on top of the car drives the door panels through a belt. When the car is level, a coupler (vane) on the car door engages the landing door roller, so both open together.',
    activation: 'Commanded by the controller after arrival, on the door-open button, or on a reversal from the light curtain.',
    talksTo: [
      { id: 'controlUnit', via: 'open / close commands (signal)' },
      { id: 'doorSensors', via: 'reversal input (signal)' },
    ],
    industrial: 'Closing force and kinetic energy are limited by code (e.g. kinetic energy ≤ 10 J) so a door can never injure someone.',
    live: (s) => `${s.doorStatus} · ${f(s.doorPosition * 100, 0)} % open · ${s.doorLocked ? 'locked' : 'unlocked'}`,
  },
  {
    id: 'doorSensors',
    name: 'Door sensors (light curtain)',
    group: 'Doors',
    purpose: 'Detect anything in the doorway so the doors never close on a person.',
    how: 'Dozens of infrared beams cross the door opening between two sensor strips. If any beam is interrupted while closing, the doors reverse. A self-test checks the sensor itself.',
    activation: 'Active whenever the doors are not fully closed. Try the "Door obstruction" and "Door sensor failure" faults.',
    talksTo: [
      { id: 'doorMotor', via: 'reversal signal' },
      { id: 'controlUnit', via: 'status & self-test (signal)' },
    ],
    industrial: 'Real systems combine light curtains with door-lock contacts on every landing door; the lock contacts are part of the hard-wired safety chain.',
    live: (s) => (!s.lightCurtainHealthy ? 'FAILED self-test' : s.lightCurtainBlocked ? 'BEAM INTERRUPTED' : 'clear'),
  },
  {
    id: 'positionSensors',
    name: 'Position sensors',
    group: 'Sensing & control',
    purpose: 'Tell the controller exactly where the car is.',
    how: 'An encoder on the motor counts shaft rotation for continuous position. Magnetic or optical vanes at each floor confirm the car is level. The controller cross-checks the two.',
    activation: 'Updated every tick. A floor vane lights up as the car passes it. If the two disagree, the controller stops the car (try "Position sensor malfunction").',
    talksTo: [
      { id: 'controlUnit', via: 'position & floor-zone signals' },
      { id: 'floorController', via: 'floor indicator updates' },
    ],
    industrial: 'Modern systems use absolute encoded tapes in the shaft with safety-rated (SIL) position monitoring for unintended-movement protection.',
    live: (s) => (s.faults.includes('positionSensorFault') ? 'FAULT — no valid reading' : s.floorSensor ? `in floor ${s.floorSensor} zone` : `between floors · ${f(s.position)} m`),
  },
  {
    id: 'floorController',
    name: 'Floor controller (landing stations)',
    group: 'Sensing & control',
    purpose: 'The buttons and displays on each floor: register hall calls and show where the car is.',
    how: 'Each landing has UP/DOWN buttons and a position indicator. They connect to the main controller over a serial bus.',
    activation: 'Pressing a hall button sends a hall call; the indicator updates whenever the controller changes the current floor.',
    talksTo: [{ id: 'controlUnit', via: 'serial bus (signal)' }],
    industrial: 'Large buildings use destination dispatch: passengers enter their floor on a keypad and are told which car to take.',
    live: (s) => `${s.hallCalls.length} hall call(s) registered`,
  },
  {
    id: 'controlUnit',
    name: 'Main elevator control unit',
    group: 'Sensing & control',
    purpose: 'The brain: stores requests, schedules, commands drive, brake and doors, and monitors safety.',
    how: 'This is the ElevatorController in the code inspector. Every tick it reads sensors, runs the state machine and issues commands.',
    activation: 'Always running. Every event in the timeline came from here.',
    talksTo: [
      { id: 'motor', via: 'speed reference' },
      { id: 'brake', via: 'brake coil' },
      { id: 'doorMotor', via: 'door commands' },
      { id: 'positionSensors', via: 'position feedback' },
      { id: 'floorController', via: 'hall calls & indicators' },
      { id: 'governor', via: 'safety chain contact' },
    ],
    industrial: 'Industrial controllers separate the logic (PLC / microcontroller) from a hard-wired, certified safety circuit. Software alone is never trusted for safety.',
    live: (s) => `${s.state} · target ${s.targetFloor ?? '—'} · ${s.carCalls.length + s.hallCalls.length} queued`,
  },
  {
    id: 'safetyGear',
    name: 'Emergency safety gear',
    group: 'Safety',
    purpose: 'Mechanically clamps the car onto the guide rails if it falls or overspeeds.',
    how: 'Wedges or rollers under the car are pulled up by the governor rope when the governor trips. They jam between the rail and a housing, stopping the car progressively.',
    activation: 'Only on governor trip — a last-resort device independent of the motor, brake and software.',
    talksTo: [
      { id: 'governor', via: 'governor rope (mechanical)' },
      { id: 'rails', via: 'wedge clamping' },
    ],
    industrial: 'Progressive safety gear limits deceleration to about 0.2–1 g so passengers are not injured while stopping.',
    live: (s) => (s.governorTripped ? 'ENGAGED' : 'armed'),
  },
  {
    id: 'buffers',
    name: 'Buffer system',
    group: 'Safety',
    purpose: 'Absorb the impact if the car or counterweight travels past the end floors.',
    how: 'Spring or oil (hydraulic) buffers in the pit. Oil buffers push oil through small holes for a controlled stop.',
    activation: 'Only if everything else fails and the car overtravels. Normal service never touches them.',
    talksTo: [
      { id: 'car', via: 'impact (mechanical)' },
      { id: 'counterweight', via: 'impact (mechanical)' },
    ],
    industrial: 'Sized for 115 % of rated speed; final-limit switches open the safety chain before the buffers are reached.',
    live: () => 'standing by (no contact)',
  },
  {
    id: 'governor',
    name: 'Overspeed governor',
    group: 'Safety',
    purpose: 'Detects if the car moves too fast and triggers the safety gear.',
    how: 'A loop of rope runs from the car over the governor pulley to a tension pulley in the pit, so the pulley spins at car speed. Centrifugal flyweights swing out with speed; at ~115 % of rated speed they first open a switch, then grip the rope.',
    activation: 'Spins with every trip (watch it in the machine room). It trips only on overspeed.',
    talksTo: [
      { id: 'car', via: 'governor rope (mechanical)' },
      { id: 'safetyGear', via: 'pulls the safety linkage' },
      { id: 'controlUnit', via: 'overspeed switch in the safety chain' },
    ],
    industrial: 'Tripping speed is set and sealed during commissioning and tested periodically.',
    live: (s) => `${s.governorTripped ? 'TRIPPED' : 'monitoring'} · car at ${f((Math.abs(s.velocity) / 1.0) * 100, 0)} % of rated speed`,
  },
  {
    id: 'machineRoom',
    name: 'Machine room',
    group: 'Drive',
    purpose: 'Houses the motor, sheave, brake, governor and controller above the shaft.',
    how: 'Gives technicians access to the drive equipment. Many modern lifts are "machine-room-less" (MRL), with a compact motor inside the shaft.',
    activation: 'Always present; most of the drive activity happens here.',
    talksTo: [
      { id: 'motor', via: 'houses' },
      { id: 'controlUnit', via: 'houses' },
      { id: 'governor', via: 'houses' },
    ],
    industrial: 'Must be ventilated, lockable and lit, with a main switch to isolate power for maintenance.',
    live: () => 'housing drive and controller',
  },
]

export const COMPONENT_BY_ID = Object.fromEntries(COMPONENTS.map((c) => [c.id, c])) as Record<ComponentId, MechComponent>
