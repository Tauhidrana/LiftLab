import { BN } from './bn.ts'

/** Exact engine strings (event explanations, reasons, labels). */
const EXACT: Record<string, string> = {
  "A passenger inside the car pressed a destination button. The button sends a signal to the controller.": "কারের ভেতরের একজন যাত্রী গন্তব্যের বোতাম চেপেছেন। বোতামটি কন্ট্রোলারে একটি সিগন্যাল পাঠায়।",
  "A safe controller never returns to service while the cause of the stop is still present.": "থামার কারণ থেকে গেলে একটি নিরাপদ কন্ট্রোলার কখনও আবার চালু হয় না।",
  "After a stop between floors, the controller creeps to the nearest landing at low speed before resuming normal service.": "দুই ফ্লোরের মাঝে থামার পর, স্বাভাবিক চলাচলের আগে কন্ট্রোলার ধীর গতিতে কাছের ফ্লোরে যায়।",
  "Any safety fault cuts power to the motor and the brake coil. Springs then close the brake.": "যেকোনো নিরাপত্তা ত্রুটি মোটর আর ব্রেক কয়েলের বিদ্যুৎ কেটে দেয়। তারপর স্প্রিং ব্রেক বন্ধ করে।",
  "Brake coil energised: brake shoes lift off the drum": "ব্রেক কয়েলে বিদ্যুৎ: ব্রেক শু ড্রাম থেকে সরে গেছে",
  "Dispatch blocked by safety chain": "সেফটি চেইন যাত্রা আটকে দিয়েছে",
  "Door motor drives the car doors open; the vane couples the landing doors": "দরজার মোটর কারের দরজা খুলছে; ভেন ফ্লোরের দরজাকেও সাথে টানছে",
  "Doors cannot open: car is not level with a floor (door interlock)": "দরজা খোলা যাবে না: কার কোনো ফ্লোরের সাথে সমান নয় (ডোর ইন্টারলক)",
  "Doors closed; door lock contact made (safety chain link closed)": "দরজা বন্ধ; দরজার লক কন্টাক্ট লেগেছে (সেফটি চেইনের লিংক বন্ধ)",
  "Doors fully open": "দরজা পুরো খোলা",
  "Doors fully open — manual mode: waiting for the door-close button": "দরজা পুরো খোলা — ম্যানুয়াল মোড: দরজা-বন্ধের বোতামের অপেক্ষা",
  "Doors only open when the car is level with a landing. Opening between floors would expose the shaft.": "কার ফ্লোরের সাথে সমান হলেই কেবল দরজা খোলে। দুই ফ্লোরের মাঝে খুললে শ্যাফট খোলা হয়ে যেত।",
  "Elevator brakes are held OPEN by electricity. Cutting power lets springs close them — so a power failure always brakes.": "লিফটের ব্রেক বিদ্যুৎ দিয়ে খোলা রাখা হয়। বিদ্যুৎ কাটলে স্প্রিং সেগুলো বন্ধ করে — তাই বিদ্যুৎ গেলে সবসময় ব্রেক লাগে।",
  "If the controller cannot prove the doorway is clear, the safe choice is to keep the doors open.": "দরজা ফাঁকা কি না কন্ট্রোলার প্রমাণ করতে না পারলে, নিরাপদ পছন্দ হলো দরজা খোলা রাখা।",
  "Infrared beams cross the doorway. If one is broken while closing, the doors immediately reopen.": "দরজা জুড়ে ইনফ্রারেড রশ্মি থাকে। বন্ধ হওয়ার সময় একটি বাধা পেলেই দরজা সঙ্গে সঙ্গে আবার খোলে।",
  "Light curtain beam interrupted — obstruction in doorway": "লাইট কার্টেনের রশ্মি বাধা পেয়েছে — দরজায় কিছু আটকে আছে",
  "Light curtain clear: door motor drives the doors closed": "লাইট কার্টেন ফাঁকা: দরজার মোটর দরজা বন্ধ করছে",
  "Light curtain failed self-test — doorway cannot be verified clear": "লাইট কার্টেন সেলফ-টেস্টে ব্যর্থ — দরজা ফাঁকা কি না নিশ্চিত করা যাচ্ছে না",
  "Many modern lifts carry a battery that, after a power cut, slowly drives the car to the nearest floor so nobody is trapped.": "অনেক আধুনিক লিফটে একটি ব্যাটারি থাকে, যা বিদ্যুৎ গেলে কারকে ধীরে কাছের ফ্লোরে নিয়ে যায়, যাতে কেউ আটকে না থাকে।",
  "Recovery run after reset": "রিসেটের পর উদ্ধার-যাত্রা",
  "Request queue empty": "অনুরোধের কিউ খালি",
  "Request stored, but the car is in EMERGENCY and will not move until reset": "অনুরোধ জমা হলো, কিন্তু কার জরুরি অবস্থায় আছে, রিসেট না করা পর্যন্ত চলবে না",
  "Reset complete, car in service": "রিসেট সম্পূর্ণ, কার আবার চালু",
  "Someone waiting on a floor called the elevator and told it which way they want to go.": "ফ্লোরে অপেক্ষমাণ কেউ লিফট ডেকেছেন এবং কোন দিকে যেতে চান তা জানিয়েছেন।",
  "The car cannot brake harder than its comfortable deceleration, so it passes this floor.": "আরামদায়ক হারের চেয়ে জোরে কার ব্রেক করতে পারে না, তাই এই ফ্লোর পেরিয়ে যায়।",
  "The motor builds up torque before the brake lifts, so the car does not jerk or drop.": "ব্রেক খোলার আগেই মোটর টর্ক তৈরি করে, তাই কার ঝাঁকুনি খায় না বা নেমে যায় না।",
  "The motor can only start when every switch in the safety chain is closed.": "সেফটি চেইনের প্রতিটি সুইচ বন্ধ থাকলেই কেবল মোটর চালু হতে পারে।",
  "The request is stored in a queue so it is not forgotten while the car is busy.": "অনুরোধটি কিউতে রাখা হয়, যাতে কার ব্যস্ত থাকলেও ভুলে না যায়।",
  "Battery rescue at floor level": "ফ্লোর লেভেলে ব্যাটারি উদ্ধার",
  "Battery rescue: let passengers out": "ব্যাটারি উদ্ধার: যাত্রীদের বের হতে দিন",
  "Boot": "চালু হওয়া",
  "Door reversal": "দরজা উল্টো চলা",
  "Door reversal (obstruction)": "দরজা উল্টো চলা (বাধা)",
  "Door timer": "দরজার টাইমার",
  "Door-close button": "দরজা-বন্ধের বোতাম",
  "Door-close button pressed": "দরজা-বন্ধের বোতাম চাপা হয়েছে",
  "Door-open button": "দরজা-খোলার বোতাম",
  "Door-open button pressed at rest": "থেমে থাকা অবস্থায় দরজা-খোলার বোতাম চাপা",
  "Door-open button pressed while closing": "বন্ধ হওয়ার সময় দরজা-খোলার বোতাম চাপা",
  "Doors locked": "দরজা লক হয়েছে",
  "Drive fault during travel": "চলার সময় ড্রাইভে ত্রুটি",
  "Dwell time elapsed": "অপেক্ষার সময় শেষ",
  "Emergency stop button pressed": "জরুরি থামার বোতাম চাপা হয়েছে",
  "Mains power lost — brake drops (fail-safe)": "মূল বিদ্যুৎ চলে গেছে — ব্রেক লেগে যায় (ফেইল-সেফ)",
  "Overspeed governor tripped": "ওভারস্পিড গভর্নর ট্রিপ করেছে",
  "Position feedback implausible: encoder and floor sensors disagree": "অবস্থানের তথ্য অবিশ্বাস্য: এনকোডার আর ফ্লোর সেন্সর মিলছে না",
  "Reset": "রিসেট",
  "Request for the current floor while doors were closing": "দরজা বন্ধ হওয়ার সময় বর্তমান ফ্লোরের অনুরোধ",
  "Reset at floor level: doors reopen fully": "ফ্লোর লেভেলে রিসেট: দরজা আবার পুরো খুলছে",
  " (between floors)": " (দুই ফ্লোরের মাঝে)",
  " (destination)": " (গন্তব্য)",
  " — press RESET to return to service": " — আবার চালু করতে রিসেট চাপুন",
  "above": "উপরে",
  "below": "নিচে",
  "estimated arrival time": "আনুমানিক পৌঁছানোর সময়",
  "distance": "দূরত্ব",
}

/** Engine message templates: `{}` is a runtime value; the Bangla side may reorder them as {0}, {1}… Most specific first. */
const TEMPLATES: [string, string][] = [
  ["Car level at floor {}: motor de-energised, brake springs clamp the drum", "কার {0} তলায় সমান: মোটর বন্ধ, ব্রেকের স্প্রিং ড্রাম চেপে ধরেছে"],
  ["Remaining distance equals braking distance v²/2a: slowing for floor {}", "বাকি দূরত্ব = ব্রেকিং দূরত্ব v²/2a: {0} তলার জন্য গতি কমছে"],
  ["selectNext() returned {} — expected a floor number from 1 to {}, or null", "selectNext() দিয়েছে {0} — ১ থেকে {1} এর মধ্যে একটি ফ্লোর নম্বর বা null আশা করা হয়েছিল"],
  ["The {} algorithm compared every pending request and chose floor {}.", "{0} অ্যালগরিদম সব অপেক্ষমাণ অনুরোধ তুলনা করে {1} তলা বেছে নিয়েছে।"],
  ["Automatic rescue device: battery moves car to floor {} at {} m/s", "স্বয়ংক্রিয় উদ্ধার-যন্ত্র: ব্যাটারি কারকে {1} m/s গতিতে {0} তলায় নিচ্ছে"],
  ["Doors busy ({}); request will be scheduled once the doors lock", "দরজা ব্যস্ত ({0}); দরজা লক হলে অনুরোধটি ধরা হবে"],
  ["Drive energises the traction motor (pre-torque), limit {} m/s", "ড্রাইভ ট্র্যাকশন মোটর চালু করছে (প্রি-টর্ক), সীমা {0} m/s"],
  ["Too close to stop at floor {} (needs {} m) — will return later", "{0} তলায় থামার জন্য খুব কাছে ({1} m লাগবে) — পরে ফিরে আসবে"],
  ["Controller online: {} floors, {} scheduling, car at floor 1", "কন্ট্রোলার চালু: {0} তলা, {1} শিডিউলিং, কার ১ তলায়"],
  ["Rescue run reached floor {}; brake applied, opening doors", "উদ্ধার-যাত্রা {0} তলায় পৌঁছেছে; ব্রেক লেগেছে, দরজা খুলছে"],
  ["Continuing to floor {}; new request will be served later", "{0} তলায় চলছে; নতুন অনুরোধ পরে সারা হবে"],
  ["Car is between floors: recovery run to floor {} at {} m/s", "কার দুই ফ্লোরের মাঝে: {1} m/s গতিতে {0} তলায় উদ্ধার-যাত্রা"],
  ["Car already level at floor {}; battery opens the doors", "কার আগে থেকেই {0} তলায় সমান; ব্যাটারি দরজা খুলছে"],
  ["Car is already at floor {} — holding doors open", "কার আগে থেকেই {0} তলায় — দরজা খোলা রাখছে"],
  ["Floor {} removed from requestQueue; continuing {}", "{0} তলা requestQueue থেকে সরানো হলো; চলবে {1}"],
  ["SCAN: sweep to the end of the shaft (floor {})", "SCAN: শ্যাফটের শেষ পর্যন্ত যাওয়া ({0} তলা)"],
  ["Intermediate stop: floor {} is on the way to {}", "মাঝপথে থামা: {0} তলা {1} তলার পথেই"],
  ["Safety chain open: {}. Request kept in queue.", "সেফটি চেইন খোলা: {0}। অনুরোধ কিউতে রাখা হলো।"],
  ["CUSTOM: your selectNext() returned floor {}", "CUSTOM: আপনার selectNext() ফ্লোর {0} দিয়েছে"],
  ["Current floor {} → destination {}, direction {}", "বর্তমান ফ্লোর {0} → গন্তব্য {1}, দিক {2}"],
  ["Doors fully open — dwell timer {}s started", "দরজা পুরো খোলা — {0}s অপেক্ষার টাইমার শুরু"],
  ["{}: turnaround at floor {} (farthest call {})", "{0}: {1} তলায় ঘোরা ({2} সবচেয়ে দূরের ডাক)"],
  ["Average wait {} s is not below FCFS ({} s)", "গড় অপেক্ষা {0} s, FCFS ({1} s) এর চেয়ে কম নয়"],
  ["Average wait {} s is not below LOOK ({} s)", "গড় অপেক্ষা {0} s, LOOK ({1} s) এর চেয়ে কম নয়"],
  ["Cannot reset while faults are active: {}", "ত্রুটি থাকা অবস্থায় রিসেট করা যাবে না: {0}"],
  ["{} passenger(s) left, {} boarded at floor {}", "{2} তলায় {0} জন নেমেছেন, {1} জন উঠেছেন"],
  ["Reached floor {} with no request there", "{0} তলায় পৌঁছেছে, সেখানে কোনো অনুরোধ নেই"],
  ["Door-close button pressed in state {}", "{0} অবস্থায় দরজা-বন্ধের বোতাম চাপা হয়েছে"],
  ["Landing button at floor {} pressed ({})", "{0} তলার বোতাম চাপা হয়েছে ({1})"],
  ["Position sensor detects floor {} vane", "অবস্থান সেন্সর {0} তলার ভেন টের পেয়েছে"],
  ["SSTF: floor {} is the nearest request", "SSTF: {0} তলা সবচেয়ে কাছের অনুরোধ"],
  ["Door-open button pressed in state {}", "{0} অবস্থায় দরজা-খোলার বোতাম চাপা হয়েছে"],
  ["{} passenger(s) were never delivered", "{0} জন যাত্রী কখনও পৌঁছাননি"],
  ["Adding hall call {}{} to requestQueue", "ফ্লোরের ডাক {0}{1} requestQueue-তে যোগ হচ্ছে"],
  ["Floor {} is already in requestQueue", "{0} তলা আগে থেকেই requestQueue-তে আছে"],
  ["{}. Motor power cut, brake applied.", "{0}। মোটরের বিদ্যুৎ কাটা, ব্রেক লেগেছে।"],
  ["Hall call {}{} is already registered", "ফ্লোরের ডাক {0}{1} আগে থেকেই আছে"],
  ["{} → {} is not an allowed transition", "{0} → {1} অনুমোদিত পরিবর্তন নয়"],
  ["FCFS: oldest request is floor {}", "FCFS: সবচেয়ে পুরনো অনুরোধ {0} তলা"],
  ["Adding floor {} to requestQueue", "ফ্লোর {0} requestQueue-তে যোগ হচ্ছে"],
  ["Request at the current floor {}", "বর্তমান {0} তলাতেই অনুরোধ"],
  ["floor {} belongs to car {}'s zone", "{0} তলা কার {1}-এর জোনে"],
  ["{}: nearest stop {} while moving {}", "{0}: {2} যাওয়ার সময় {1} সবচেয়ে কাছের স্টপ"],
  ["Arrived at requested floor {}", "চাওয়া {0} তলায় পৌঁছেছে"],
  ["{} Wh is not below SSTF ({} Wh)", "{0} Wh, SSTF ({1} Wh) এর চেয়ে কম নয়"],
  ["Car panel button {} pressed", "কারের প্যানেলে {0} নম্বর বোতাম চাপা হয়েছে"],
  ["Dwell timer restarted ({}s)", "অপেক্ষার টাইমার আবার শুরু ({0}s)"],
  ["Reset requested in state {}", "{0} অবস্থায় রিসেট চাওয়া হয়েছে"],
  ["Scheduling algorithm {} → {}", "শিডিউলিং অ্যালগরিদম {0} → {1}"],
  ["selectNext() threw: {}", "selectNext() এ ত্রুটি: {0}"],
  ["Passenger at floor {}", "{0} তলায় যাত্রী"],
  ["Car passing floor {}{}", "কার {0} তলা পার হচ্ছে{1}"],
  ["Operation mode {} → {}", "চালানোর ধরন {0} → {1}"],
  ["{} — reversing doors", "{0} — দরজা আবার খুলছে"],
  ["{}. Doors stay open.", "{0}। দরজা খোলা থাকবে।"],
  ["Arrival at floor {}", "{0} তলায় পৌঁছানো"],
  ["Arrived at floor {}", "{0} তলায় পৌঁছেছে"],
  ["Car stopped at {} m{}", "কার {0} m এ থেমেছে{1}"],
  ["Someone waited {} s", "একজন {0} s অপেক্ষা করেছেন"],
  ["Cruising at {} m/s", "{0} m/s সমান গতিতে চলছে"],
  ["Approach floor {}", "{0} তলার কাছে আসছে"],
  ["Algorithm: {}", "অ্যালগরিদম: {0}"],
  ["Car button {}", "কারের বোতাম {0}"],
  ["Hall call {}{}", "ফ্লোরের ডাক {0}{1}"],
  ["lowest {}: {} {}", "সবচেয়ে কম {0}: {1} {2}"],
  ["{} cleared{}", "{0} সরানো হয়েছে{1}"],
  ["Clear: {}", "সরানো: {0}"],
  ["Fault: {}", "ত্রুটি: {0}"],
  ["Mode: {}", "মোড: {0}"],
  ["{} → {}: {}", "{0} → {1}: {2}"],
]

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** `{}{}` (two values side by side, e.g. "3▲") would split ambiguously, so the first of such a pair matches a number only. */
function toRegExp(en: string) {
  const parts = en.split('{}')
  let re = '^' + escape(parts[0])
  for (let i = 1; i < parts.length; i++) re += (parts[i] === '' && i < parts.length - 1 ? '(\\d+)' : '(.*?)') + escape(parts[i])
  return new RegExp(re + '$', 's')
}
const COMPILED = TEMPLATES.map(([en, bn]) => ({ re: toRegExp(en), bn }))

/** Translate a runtime message to Bangla. Values captured by a template are translated too (they are often nested messages). */
export function translateMessage(s: string, depth = 0): string {
  if (!s || depth > 4) return s
  // State names like IDLE or MOVING_UP are code identifiers: keep them (but translate plain directions).
  if (depth > 0 && /^[A-Z][A-Z_]+$/.test(s) && s !== 'UP' && s !== 'DOWN') return s
  const hit = EXACT[s] ?? BN[s]
  if (hit) return hit
  for (const { re, bn } of COMPILED) {
    const m = s.match(re)
    if (m) return bn.replace(/\{(\d)\}/g, (_, i: string) => translateMessage(m[+i + 1], depth + 1))
  }
  // Comma-separated lists, e.g. open safety-chain links or fault names.
  if (s.includes(', ')) {
    const parts = s.split(', ')
    if (parts.every((p) => EXACT[p] ?? BN[p])) return parts.map((p) => EXACT[p] ?? BN[p]).join(', ')
  }
  return s
}
