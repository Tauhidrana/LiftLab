import clsx from 'clsx'
import { useShallow } from 'zustand/react/shallow'
import type { FaultId } from '../../engine/types'
import { useLab } from '../../store/useLab'
import { useT } from '../../i18n'

interface Contact {
  id: string
  label: string
  where: string
  closed: boolean
  /** Fault this contact maps to in the simulation, if it can be operated here. */
  fault?: FaultId
  note: string
}

/**
 * The safety circuit as a ladder diagram. Every contact is wired in series, so
 * current reaches the main contactor (and with it the motor and brake coil)
 * only when every single one is closed. This is hardware: no software can
 * override an open contact.
 */
export function SafetyCircuit() {
  const s = useLab(
    useShallow((st) => ({
      floors: st.config.floors,
      faults: st.snapshot.faults.join(','),
      governor: st.snapshot.governorTripped,
      doorPos: st.snapshot.doorPosition,
      locked: st.snapshot.doorLocked,
      floor: st.snapshot.currentFloor,
      motor: st.snapshot.motorEnergized,
      brake: st.snapshot.brakeEngaged,
    })),
  )
  const toggleFault = useLab((st) => st.toggleFault)
  const t = useT()
  const faults = s.faults.split(',')
  const has = (f: FaultId) => faults.includes(f)
  const carDoorClosed = s.locked && s.doorPos <= 0.001

  const contacts: Contact[] = [
    { id: 'mains', label: 'Main switch and supply', where: 'machine room', closed: !has('powerLoss'), fault: 'powerLoss', note: 'Opening it simulates a power cut.' },
    { id: 'pit', label: 'Pit stop switch', where: 'shaft pit', closed: true, note: 'Technicians open it before stepping into the pit.' },
    { id: 'estop', label: 'Emergency stop', where: 'car panel / car roof', closed: !has('emergencyStop'), fault: 'emergencyStop', note: 'Latching: it stays open until released, then Reset is needed.' },
    { id: 'gov', label: 'Overspeed governor switch', where: 'machine room', closed: !s.governor, note: 'Opens at about 115 % of rated speed, before the safety gear grips.' },
    { id: 'final', label: 'Final limit switches', where: 'top and bottom of shaft', closed: true, note: 'Open if the car travels past the end floors.' },
    { id: 'cardoor', label: 'Car door contact', where: 'car door', closed: carDoorClosed, note: 'Opens whenever the car door is not fully shut.' },
    ...Array.from({ length: s.floors }, (_, i) => {
      const f = s.floors - i
      const open = f === s.floor && s.doorPos > 0.001
      return { id: `lock${f}`, label: t('Landing door lock, floor {f}', { f }), where: t('floor {f}', { f }), closed: !open, note: 'Each landing door has its own lock in the chain.' }
    }),
    { id: 'drive', label: 'Drive ready', where: 'controller cabinet', closed: !has('motorUnavailable'), fault: 'motorUnavailable', note: 'The drive opens it when it detects its own fault.' },
  ]
  const firstOpen = contacts.findIndex((c) => !c.closed)
  const chainClosed = firstOpen === -1

  return (
    <div>
      <p className="text-[12.5px] leading-relaxed text-ink-2">
        {t('Read from top to bottom. Current flows through each contact in turn. One open contact anywhere and the main contactor drops: motor off, brake applied.')}
      </p>
      <div className="mt-3 rounded-lg border border-line bg-[#0d1014] py-2">
        <Rail label={t('L1 · 110 V safety supply')} live />
        {contacts.map((c, i) => {
          const live = firstOpen === -1 || i < firstOpen
          const isBreak = i === firstOpen
          return (
            <div key={c.id} className="group grid grid-cols-[40px_minmax(0,1fr)] items-stretch">
              <Wire live={live} closed={c.closed} />
              <div className="flex min-w-0 items-center gap-2 py-1 pr-3">
                <div className="min-w-0 flex-1">
                  <div className={clsx('text-[12.5px]', c.closed ? 'text-ink' : 'text-danger')}>{t(c.label)}</div>
                  <div className="truncate text-[11px] text-faint" title={t(c.note)}>
                    {t(c.where)}. {t(c.note)}
                  </div>
                </div>
                {c.fault ? (
                  <button
                    onClick={() => toggleFault(c.fault!)}
                    className={clsx(
                      'h-6 shrink-0 rounded border px-2 text-[11px]',
                      c.closed ? 'border-line-strong text-muted hover:text-ink' : 'border-danger/50 bg-danger/10 text-danger',
                    )}
                  >
                    {t(c.closed ? 'Open it' : 'Close it')}
                  </button>
                ) : (
                  <span className={clsx('shrink-0 font-mono text-[11px]', c.closed ? 'text-faint' : 'text-danger')}>{t(c.closed ? 'closed' : 'open')}</span>
                )}
              </div>
              {isBreak && <div className="col-span-2 ml-[40px] pb-1 text-[11px] text-danger">{t('Current stops here')}</div>}
            </div>
          )
        })}
        <div className="grid grid-cols-[40px_1fr] items-center">
          <div className="flex justify-center">
            <span
              className={clsx(
                'flex h-7 w-7 items-center justify-center rounded-full border-2 font-mono text-[11px] font-semibold',
                chainClosed ? 'border-lamp text-lamp shadow-[0_0_12px_rgba(255,181,71,0.45)]' : 'border-line-strong text-faint',
              )}
            >
              K
            </span>
          </div>
          <div className="py-1.5 pr-3">
            <div className="text-[12.5px] text-ink">{t('Main contactor coil')}</div>
            <div className="text-[11px] text-faint">{t(chainClosed ? 'Energised: its contacts connect the drive and brake supply.' : 'Dropped: drive and brake coil disconnected.')}</div>
          </div>
        </div>
        <Rail label="N" live={chainClosed} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Output label={t('Motor')} on={chainClosed && s.motor} onText={t('running')} offText={t('no power')} />
        <Output label={t('Brake coil')} on={chainClosed && !s.brake} onText={t('energised, brake lifted')} offText={t('off, springs clamp')} />
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
        {t('Simplified. Real circuits add bypass-proof door-zone checks, monitored contactors in pairs and inspection-mode wiring. In this app the chain is modelled in code for teaching.')}
      </p>
    </div>
  )
}

function Rail({ label, live }: { label: string; live: boolean }) {
  return (
    <div className="grid grid-cols-[40px_1fr] items-center">
      <div className="flex justify-center">
        <span className={clsx('h-2 w-2 rounded-full', live ? 'bg-lamp' : 'bg-line-strong')} />
      </div>
      <span className="font-mono text-[11px] text-faint">{label}</span>
    </div>
  )
}

/** One series contact: a wire segment with a break drawn as a lifted blade when open. */
function Wire({ live, closed }: { live: boolean; closed: boolean }) {
  const color = live ? '#ffb547' : '#323843'
  return (
    <svg viewBox="0 0 40 44" className="h-full min-h-[44px] w-10" preserveAspectRatio="none" aria-hidden>
      <line x1="20" y1="0" x2="20" y2="14" stroke={color} strokeWidth="2" strokeDasharray={live ? '4 3' : undefined} className={live ? 'circuit-flow' : ''} />
      <circle cx="20" cy="15" r="2.2" fill={color} />
      {closed ? (
        <line x1="20" y1="15" x2="20" y2="29" stroke={live ? color : '#5e6672'} strokeWidth="2" />
      ) : (
        <line x1="20" y1="15" x2="31" y2="25" stroke="#f2545b" strokeWidth="2" strokeLinecap="round" />
      )}
      <circle cx="20" cy="29" r="2.2" fill={live && closed ? color : '#323843'} />
      <line x1="20" y1="30" x2="20" y2="44" stroke={live && closed ? color : '#323843'} strokeWidth="2" strokeDasharray={live && closed ? '4 3' : undefined} className={live && closed ? 'circuit-flow' : ''} />
    </svg>
  )
}

function Output({ label, on, onText, offText }: { label: string; on: boolean; onText: string; offText: string }) {
  return (
    <div className={clsx('rounded-lg border px-3 py-2', on ? 'border-lamp/40 bg-lamp/[0.06]' : 'border-line bg-surface-2')}>
      <div className="text-[12.5px] text-ink">{label}</div>
      <div className={clsx('text-[11.5px]', on ? 'text-lamp' : 'text-muted')}>{on ? onText : offText}</div>
    </div>
  )
}
