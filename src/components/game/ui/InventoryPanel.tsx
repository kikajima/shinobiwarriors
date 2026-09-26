'use client'

import { useEffect, useMemo, useState } from 'react'
import { CircleDot, FlaskConical, Gem, PackageOpen, Sparkles, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { InventorySlotView, ItemDefView } from '../types'
import { PixelPanel } from './pixel'

const rarityClass: Record<string, string> = {
  common: 'border-[#5a4a32] text-[#c8baa0]',
  uncommon: 'border-[#3f7048] text-[#8ee39a]',
  rare: 'border-[#395f86] text-[#86c8ff]',
  epic: 'border-[#744b8d] text-[#d8a3ff]',
}

function ItemIcon({ def }: { def?: ItemDefView }) {
  if (!def) return <PackageOpen className="h-5 w-5 text-[#4d4436]" />
  if (def.id === 'healing_potion') return <FlaskConical className="h-5 w-5 text-[#e88a8a]" />
  if (def.id === 'chakra_pill') return <CircleDot className="h-5 w-5 text-[#73c8ff]" />
  if (def.rarity === 'epic') return <Sparkles className="h-5 w-5 text-[#d8a3ff]" />
  return <Gem className="h-5 w-5 text-[#c9ad79]" />
}

export function InventoryPanel({
  open,
  slots,
  capacity,
  itemDefs,
  onClose,
  onUse,
}: {
  open: boolean
  slots: InventorySlotView[]
  capacity: number
  itemDefs: ItemDefView[]
  onClose: () => void
  onUse: (slot: number) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const defs = useMemo(() => new Map(itemDefs.map((d) => [d.id, d])), [itemDefs])
  const padded = useMemo(
    () => Array.from({ length: capacity }, (_, i) => slots[i] || null),
    [capacity, slots],
  )

  useEffect(() => {
    if (!open) setSelected(null)
    else if (selected != null && !padded[selected]) setSelected(null)
  }, [open, padded, selected])

  if (!open) return null

  const slot = selected == null ? null : padded[selected]
  const def = slot ? defs.get(slot.id) : undefined

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0f0d0aaa] p-3">
      <PixelPanel className="relative w-[min(620px,96vw)] !p-4" title="INVENTÁRIO">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center border border-[#3a2f22] text-[#a89b7d]"
          aria-label="Fechar inventário"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="font-retro mb-3 mt-2 flex items-center justify-between text-[14px] text-[#a89b7d]">
          <span>{padded.filter(Boolean).length}/{capacity} slots ocupados</span>
          <span className="hidden sm:inline">Tecla I para abrir/fechar</span>
        </div>

        <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
          {padded.map((entry, index) => {
            const item = entry ? defs.get(entry.id) : undefined
            const active = selected === index
            return (
              <button
                key={index}
                type="button"
                onClick={() => setSelected(entry ? index : null)}
                className={[
                  'relative aspect-square min-h-11 border-2 bg-[#17120d] p-1 shadow-[2px_2px_0_rgba(0,0,0,0.35)]',
                  active ? 'border-[#f0d060]' : item ? rarityClass[item.rarity] || rarityClass.common : 'border-[#30281e]',
                ].join(' ')}
                title={item ? item.name + ' x' + (entry?.qty || 0) : 'Slot vazio'}
              >
                <span className="flex h-full items-center justify-center">
                  <ItemIcon def={item} />
                </span>
                {entry && entry.qty > 1 ? (
                  <span className="font-retro absolute bottom-0.5 right-1 text-[13px] leading-none text-[#fff0dc]">
                    {entry.qty}
                  </span>
                ) : null}
                <span className="font-retro absolute left-1 top-0.5 text-[10px] text-[#5e5444]">{index + 1}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 min-h-[112px] border-2 border-[#3a2f22] bg-[#15100c] p-3">
          {slot && def ? (
            <div className="flex gap-3">
              <div className={'flex h-12 w-12 shrink-0 items-center justify-center border-2 bg-[#201810] ' + (rarityClass[def.rarity] || rarityClass.common)}>
                <ItemIcon def={def} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-retro flex items-center justify-between gap-2 text-lg text-[#fff0dc]">
                  <span>{def.name}</span>
                  <span className="text-[14px] text-[#a89b7d]">x{slot.qty}</span>
                </div>
                <div className="font-retro mt-1 text-[14px] leading-tight text-[#a89b7d]">{def.description}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-pixel text-[7px] uppercase tracking-wider text-[#c8baa0]">
                    {def.kind === 'consumable' ? 'Consumível' : 'Material'} · {def.rarity}
                  </span>
                  {def.usable ? (
                    <Button
                      onClick={() => onUse(selected!)}
                      className="h-auto rounded-none border-2 border-[#f97316] bg-[#f97316] px-4 py-1.5 font-pixel text-[8px] text-[#1a0e05] hover:bg-[#ea580c]"
                    >
                      USAR
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="font-retro flex min-h-[82px] items-center justify-center text-[15px] text-[#6f6452]">
              Selecione um item para ver os detalhes.
            </div>
          )}
        </div>
      </PixelPanel>
    </div>
  )
}
