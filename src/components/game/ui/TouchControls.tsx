// ============================================================
// Shinobi Online — controles de toque (mobile)
// Joystick virtual + botões de ação com recargas
// ============================================================

'use client'

import { useRef, useState } from 'react'
import { FlaskConical, Swords } from 'lucide-react'

import { SkillButton, type GameAction, type SkillInfoLite } from './Hud'
import { skillIcon } from './Hud'
import { ELEMENT_MAP, type ElementId } from './element-data'
import type { HudState } from '../engine'

export interface TouchControlsProps {
  hud: HudState
  skills: SkillInfoLite[]
  element: ElementId
  onAction: (a: GameAction) => void
  onJoystick: (x: number, y: number) => void
}

const JOY_R = 46

export function TouchControls({ hud, skills, element, onAction, onJoystick }: TouchControlsProps) {
  const baseRef = useRef<HTMLDivElement>(null)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const activeId = useRef<number | null>(null)
  const info = ELEMENT_MAP[element]

  const handlePoint = (e: React.PointerEvent) => {
    const base = baseRef.current
    if (!base) return
    const rect = base.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = e.clientX - cx
    let dy = e.clientY - cy
    const d = Math.hypot(dx, dy)
    if (d > JOY_R) {
      dx = (dx / d) * JOY_R
      dy = (dy / d) * JOY_R
    }
    setKnob({ x: dx, y: dy })
    onJoystick(dx / JOY_R, dy / JOY_R)
  }

  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    activeId.current = e.pointerId
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    handlePoint(e)
  }

  const move = (e: React.PointerEvent) => {
    if (activeId.current !== e.pointerId) return
    e.preventDefault()
    handlePoint(e)
  }

  const end = (e: React.PointerEvent) => {
    if (activeId.current !== e.pointerId) return
    activeId.current = null
    setKnob({ x: 0, y: 0 })
    onJoystick(0, 0)
  }

  return (
    <>
      {/* joystick */}
      <div
        ref={baseRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="pointer-events-auto absolute bottom-4 left-3 z-30 flex h-[118px] w-[118px] items-center justify-center rounded-full border-2 border-[#3a2f22] bg-[#0f0d0a66] backdrop-blur-[1px]"
        style={{ touchAction: 'none' }}
        role="application"
        aria-label="Joystick de movimento"
      >
        {/* cruz direcional */}
        <div className="pointer-events-none absolute inset-3 rounded-full border border-[#3a2f2288]" />
        <div
          className="pointer-events-none h-12 w-12 rounded-full border-2 border-[#f97316] bg-[#211a12] shadow-[2px_2px_0_rgba(0,0,0,0.6)]"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>

      {/* botões de ação */}
      <div className="pointer-events-auto absolute bottom-3 right-3 z-30 flex items-end gap-2" style={{ touchAction: 'none' }}>
        {/* coluna: poção + skill 3/4 */}
        <div className="flex flex-col gap-2">
          <SkillButton
            icon={skillIcon(element, skills[3]?.archetype || 'aoe')}
            hotkey="4"
            cdLeft={hud.cds[4].left}
            cdTotal={hud.cds[4].total}
            cost={skills[3]?.ch}
            disabled={hud.ch < (skills[3]?.ch || 0)}
            elementColor={info.color}
            title={skills[3]?.name || ''}
            onTrigger={() => onAction('skill3')}
          />
          <SkillButton
            icon={skillIcon(element, skills[2]?.archetype || 'line')}
            hotkey="3"
            cdLeft={hud.cds[3].left}
            cdTotal={hud.cds[3].total}
            cost={skills[2]?.ch}
            disabled={hud.ch < (skills[2]?.ch || 0)}
            elementColor={info.color}
            title={skills[2]?.name || ''}
            onTrigger={() => onAction('skill2')}
          />
        </div>
        <div className="flex flex-col gap-2">
          <SkillButton
            icon={FlaskConical}
            cdLeft={hud.cds[5].left}
            cdTotal={hud.cds[5].total}
            count={hud.pot}
            title="Poção"
            onTrigger={() => onAction('potion')}
          />
          <SkillButton
            icon={skillIcon(element, skills[1]?.archetype || 'multi')}
            hotkey="2"
            cdLeft={hud.cds[2].left}
            cdTotal={hud.cds[2].total}
            cost={skills[1]?.ch}
            disabled={hud.ch < (skills[1]?.ch || 0)}
            elementColor={info.color}
            title={skills[1]?.name || ''}
            onTrigger={() => onAction('skill1')}
          />
        </div>
        <div className="flex flex-col gap-2">
          <SkillButton
            icon={skillIcon(element, skills[0]?.archetype || 'proj')}
            hotkey="1"
            cdLeft={hud.cds[1].left}
            cdTotal={hud.cds[1].total}
            cost={skills[0]?.ch}
            disabled={hud.ch < (skills[0]?.ch || 0)}
            elementColor={info.color}
            title={skills[0]?.name || ''}
            onTrigger={() => onAction('skill0')}
          />
          <SkillButton icon={Swords} cdLeft={hud.cds[0].left} cdTotal={hud.cds[0].total} size="lg" title="Ataque de kunai" onTrigger={() => onAction('attack')} />
        </div>
      </div>
    </>
  )
}
