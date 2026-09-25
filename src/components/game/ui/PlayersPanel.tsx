// ============================================================
// Shinobi Online — painel de jogadores online
// ============================================================

'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { PixelPanel } from './pixel'
import { ELEMENT_MAP, type ElementId } from './element-data'
import { VILLAGE_COLORS, VILLAGE_NAMES, type RosterEnt } from '../types'

export interface PlayersPanelProps {
  players: RosterEnt[]
  selfId: number
  open: boolean
}

export function PlayersPanel({ players, selfId, open }: PlayersPanelProps) {
  if (!open) return null
  const sorted = [...players].sort((a, b) => b.lv - a.lv)
  return (
    <div className="pointer-events-auto absolute right-2 top-[132px] z-20 sm:right-3 sm:top-[148px]">
      <PixelPanel className="w-[240px] !p-2" title={`ONLINE (${players.length})`}>
        <ScrollArea className="game-scroll h-[240px] max-h-[42vh] pr-1.5">
          <div className="flex flex-col gap-[3px]">
            {sorted.map((p) => {
              const info = ELEMENT_MAP[p.el as ElementId] || ELEMENT_MAP.fogo
              const isSelf = p.id === selfId
              return (
                <div
                  key={p.id}
                  className={`font-retro flex items-center justify-between gap-1 border px-1.5 py-[1px] text-[14px] leading-tight ${
                    isSelf ? 'border-[#f9731688] bg-[#f9731615]' : 'border-transparent'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1">
                    <span className="inline-block h-2 w-2 shrink-0 border border-black/40" style={{ background: info.color }} />
                    <span className={`truncate ${isSelf ? 'text-[#ffb347]' : 'text-[#e8d5a9]'}`}>{p.n}</span><span className="text-[11px]" style={{color:VILLAGE_COLORS[p.v]}} title={VILLAGE_NAMES[p.v]}>[{p.v.toUpperCase().slice(0,3)}]</span>
                  </span>
                  <span className="shrink-0 text-[#a89b7d]">Nv{p.lv}</span>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </PixelPanel>
    </div>
  )
}
