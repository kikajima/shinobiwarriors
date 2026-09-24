// ============================================================
// Shinobi Online — chat do jogo
// ============================================================

'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'

import { ELEMENT_MAP, type ElementId } from './element-data'
import { cn } from '@/lib/utils'

export interface ChatEntry {
  key: number
  kind: 'chat' | 'sys' | 'kill' | 'mission' | 'level'
  name?: string
  lv?: number
  el?: ElementId
  text: string
}

export interface ChatProps {
  messages: ChatEntry[]
  open: boolean
  isTouch: boolean
  onSend: (text: string) => void
  onOpen: () => void
  onClose: () => void
  onFocusChange: (focused: boolean) => void
}

let keySeq = 1
export const nextChatKey = () => keySeq++

export function Chat({ messages, open, isTouch, onSend, onOpen, onClose, onFocusChange }: ChatProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, open])

  // Enter abre o chat (desktop), Esc fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (e.key === 'Enter' && !typing && !isTouch) {
        e.preventDefault()
        onOpen()
        setTimeout(() => inputRef.current?.focus(), 30)
      }
      if (e.key === 'Escape') {
        inputRef.current?.blur()
        if (isTouch) onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isTouch, onOpen, onClose])

  const send = () => {
    const t = text.trim()
    if (t) {
      onSend(t)
      setText('')
    }
    inputRef.current?.blur()
    if (isTouch) onClose()
  }

  const shown = open ? messages.slice(-70) : messages.slice(-4)

  return (
    <div
      className={cn(
        'pointer-events-none absolute left-2 z-20 flex flex-col gap-1',
        isTouch ? 'bottom-44 left-2 w-[240px]' : 'bottom-4 w-[340px] sm:w-[380px]',
      )}
    >
      {/* mensagens */}
      <div
        onClick={() => !open && onOpen()}
        className={cn(
          'game-scroll pointer-events-auto flex flex-col gap-0.5 overflow-y-auto border-2 border-[#3a2f22] bg-[#0f0d0ac9] p-2',
          open ? 'h-40 sm:h-44' : 'h-[76px] cursor-pointer',
        )}
      >
        {shown.map((m) => (
          <ChatLine key={m.key} m={m} />
        ))}
      </div>

      {/* entrada */}
      {open ? (
        <div className="pointer-events-auto flex gap-1">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => onFocusChange(true)}
            onBlur={() => onFocusChange(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                send()
              }
            }}
            maxLength={120}
            placeholder="Mensagem para o chat global..."
            className="font-retro h-9 flex-1 rounded-none border-2 border-[#3a2f22] bg-[#0f0d0a] px-2 text-base text-[#e8d5a9] placeholder:text-[#6b5f4a] focus:border-[#f97316] focus:outline-none"
          />
          <button
            type="button"
            onClick={send}
            aria-label="Enviar"
            className="flex h-9 w-10 items-center justify-center border-2 border-[#f97316] bg-[#f97316] text-[#1a0e05] shadow-[2px_2px_0_rgba(0,0,0,0.5)] active:translate-y-[1px]"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ChatLine({ m }: { m: ChatEntry }) {
  if (m.kind === 'sys') {
    return (
      <div className="font-retro text-[14px] leading-snug text-[#f0d06099]">
        <span className="text-[#a89b7d]">• </span>
        {m.text}
      </div>
    )
  }
  if (m.kind === 'kill') {
    return (
      <div className="font-retro text-[13px] leading-snug text-[#8f857d]">
        <span className="text-[#ffb347]">{m.name}</span> <span className="text-[#6b5f4a]">derrotou</span> {m.text}
      </div>
    )
  }
  if (m.kind === 'mission') {
    return (
      <div className="font-retro text-[14px] leading-snug text-[#7dff7d]">
        <span className="text-[#a89b7d]">★ </span>
        {m.text}
      </div>
    )
  }
  const info = m.el ? ELEMENT_MAP[m.el] : null
  return (
    <div className="font-retro text-[14px] leading-snug text-[#e8d5a9]">
      <span className="text-[#8f857d]">[{m.lv}] </span>
      <span style={{ color: info?.color || '#f5f2ea' }}>{m.name}:</span> {m.text}
    </div>
  )
}
