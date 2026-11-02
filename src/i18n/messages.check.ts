// Self-check for the runtime message translator. Run: npm run check:i18n
import { translateMessage as tm } from './messages.ts'
const cases: [string, string][] = [
  ['Hall call 3▲ is already registered', 'ফ্লোরের ডাক 3▲ আগে থেকেই আছে'],
  ['Car passing floor 4 (destination)', 'কার 4 তলা পার হচ্ছে (গন্তব্য)'],
  ['IDLE → MOVING_UP: LOOK: nearest stop above while moving UP', 'IDLE → MOVING_UP: LOOK: উপরে যাওয়ার সময় উপরে সবচেয়ে কাছের স্টপ'],
  ['Emergency stop button pressed. Motor power cut, brake applied.', 'জরুরি থামার বোতাম চাপা হয়েছে। মোটরের বিদ্যুৎ কাটা, ব্রেক লেগেছে।'],
  ['Safety chain open: Door locks closed, Mains supply. Request kept in queue.', 'সেফটি চেইন খোলা: দরজার লক বন্ধ, মূল বিদ্যুৎ। অনুরোধ কিউতে রাখা হলো।'],
  ['2 passenger(s) left, 1 boarded at floor 5', '5 তলায় 2 জন নেমেছেন, 1 জন উঠেছেন'],
  ['Car stopped at 3.21 m (between floors)', 'কার 3.21 m এ থেমেছে (দুই ফ্লোরের মাঝে)'],
  ['something unknown', 'something unknown'],
]
for (const [en, bn] of cases) if (tm(en) !== bn) throw new Error(`${en}\n  got:  ${tm(en)}\n  want: ${bn}`)
console.log('ok', cases.length)
