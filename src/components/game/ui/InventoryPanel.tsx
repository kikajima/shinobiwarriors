'use client'

import { useEffect, useMemo, useState } from 'react'
import { CircleDot, FlaskConical, Gem, PackageOpen, Shield, Sparkles, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { EquipmentSlot, EquipmentStateMsg, InventorySlotView, ItemDefView } from '../types'
import { PixelPanel } from './pixel'

const rarityClass: Record<string, string> = {
  common: 'border-[#5a4a32] text-[#c8baa0]',
  uncommon: 'border-[#3f7048] text-[#8ee39a]',
  rare: 'border-[#395f86] text-[#86c8ff]',
  epic: 'border-[#744b8d] text-[#d8a3ff]',
  legendary: 'border-[#b88a20] text-[#ffd866]',
  unique: 'border-[#b64545] text-[#ff8a80]',
}

const slotLabels: Record<EquipmentSlot, string> = {
  head: 'Cabeça',
  torso: 'Torso',
  boots: 'Botas',
  gloves: 'Luvas',
  accessory1: 'Acessório 1',
  accessory2: 'Acessório 2',
  pants: 'Calças',
}

const forgeMult = [1,1.06,1.12,1.20,1.30,1.42,1.56,1.72,1.90,2.10,2.32,2.58]

function ItemIcon({ def }: { def?: ItemDefView }) {
  if (!def) return <PackageOpen className="h-5 w-5 text-[#4d4436]" />
  if (def.id === 'healing_potion') return <FlaskConical className="h-5 w-5 text-[#e88a8a]" />
  if (def.id === 'chakra_pill') return <CircleDot className="h-5 w-5 text-[#73c8ff]" />
  if (def.kind === 'equipment') return <Shield className="h-5 w-5 text-[#e8d5a9]" />
  if (def.rarity === 'epic') return <Sparkles className="h-5 w-5 text-[#d8a3ff]" />
  return <Gem className="h-5 w-5 text-[#c9ad79]" />
}

function StatLine({ def, upgrade = 0 }: { def: ItemDefView; upgrade?: number }) {
  const s=def.equipment?.baseStats
  if(!s)return null
  const m=forgeMult[Math.max(0,Math.min(11,upgrade))]||1
  const parts:string[]=[]
  if(s.hp)parts.push('HP +' + Math.round(s.hp*m))
  if(s.chakra)parts.push('Chakra +' + Math.round(s.chakra*m))
  if(s.attack)parts.push('ATQ +' + (s.attack*m).toFixed(1))
  if(s.defense)parts.push('DEF +' + (s.defense*m*100).toFixed(1) + '%')
  if(s.speed)parts.push('VEL +' + (s.speed*m).toFixed(1))
  if(s.crit)parts.push('CRIT +' + (s.crit*m*100).toFixed(1) + '%')
  return <div className="font-retro mt-1 text-[13px] leading-tight text-[#9bd9f6]">{parts.join(' · ')}</div>
}

export function InventoryPanel({
  open,
  slots,
  capacity,
  itemDefs,
  equipment,
  onClose,
  onUse,
  onEquip,
  onUnequip,
}: {
  open: boolean
  slots: InventorySlotView[]
  capacity: number
  itemDefs: ItemDefView[]
  equipment: EquipmentStateMsg | null
  onClose: () => void
  onUse: (slot: number) => void
  onEquip: (slot: number, target?: EquipmentSlot) => void
  onUnequip: (slot: EquipmentSlot) => void
}) {
  const [selected, setSelected] = useState<number | null>(null)
  const [selectedEquip, setSelectedEquip] = useState<EquipmentSlot | null>(null)
  const defs = useMemo(() => new Map(itemDefs.map((d) => [d.id, d])), [itemDefs])
  const padded = useMemo(() => Array.from({ length: capacity }, (_, i) => slots[i] || null), [capacity, slots])

  useEffect(() => {
    if (!open) { setSelected(null); setSelectedEquip(null) }
    else if (selected != null && !padded[selected]) setSelected(null)
  }, [open, padded, selected])

  if (!open) return null

  const invSlot = selected == null ? null : padded[selected]
  const invDef = invSlot ? defs.get(invSlot.id) : undefined
  const equipped = selectedEquip && equipment ? equipment.loadout[selectedEquip] : null
  const equippedDef = equipped ? defs.get(equipped.id) : undefined

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0f0d0aaa] p-2 sm:p-3">
      <PixelPanel className="relative max-h-[94vh] w-[min(760px,98vw)] overflow-y-auto !p-3 sm:!p-4" title="INVENTÁRIO & EQUIPAMENTOS">
        <button type="button" onClick={onClose} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center border border-[#3a2f22] text-[#a89b7d]" aria-label="Fechar inventário">
          <X className="h-4 w-4" />
        </button>

        <div className="font-pixel mb-2 mt-2 text-[8px] tracking-wider text-[#f0d060]">EQUIPADO</div>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7 sm:gap-2">
          {(Object.keys(slotLabels) as EquipmentSlot[]).map((slotKey) => {
            const entry=equipment?.loadout[slotKey]
            const def=entry?defs.get(entry.id):undefined
            return <button key={slotKey} type="button" onClick={()=>{setSelected(null);setSelectedEquip(slotKey)}} className={'relative min-h-[62px] border-2 bg-[#17120d] p-1 ' + (selectedEquip===slotKey?'border-[#f0d060]':def?(rarityClass[def.rarity]||rarityClass.common):'border-[#30281e]')}>
              <span className="font-retro block text-[11px] text-[#7e725d]">{slotLabels[slotKey]}</span>
              <span className="mt-1 flex justify-center"><ItemIcon def={def}/></span>
              {entry?.upgrade ? <span className="font-retro absolute bottom-0.5 right-1 text-[12px] text-[#f0d060]">+{entry.upgrade}</span>:null}
            </button>
          })}
        </div>

        {equipment ? <div className="font-retro mt-2 grid grid-cols-3 gap-x-3 border border-[#3a2f22] bg-[#15100c] px-2 py-1 text-[12px] text-[#a89b7d] sm:grid-cols-6">
          <span>HP <b className="text-[#7dff7d]">+{equipment.stats.hp}</b></span>
          <span>CH <b className="text-[#73c8ff]">+{equipment.stats.chakra}</b></span>
          <span>ATQ <b className="text-[#ffb347]">+{equipment.stats.attack.toFixed(1)}</b></span>
          <span>DEF <b className="text-[#e8d5a9]">+{(equipment.stats.defense*100).toFixed(1)}%</b></span>
          <span>VEL <b className="text-[#d8a3ff]">+{equipment.stats.speed.toFixed(1)}</b></span>
          <span>CRIT <b className="text-[#ffd866]">+{(equipment.stats.crit*100).toFixed(1)}%</b></span>
        </div>:null}

        <div className="font-retro mb-2 mt-4 flex items-center justify-between text-[14px] text-[#a89b7d]">
          <span>{padded.filter(Boolean).length}/{capacity} slots ocupados</span>
          <span className="hidden sm:inline">Tecla I para abrir/fechar</span>
        </div>

        <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
          {padded.map((entry, index) => {
            const item = entry ? defs.get(entry.id) : undefined
            const active = selected === index
            return (
              <button key={index} type="button" onClick={() => {setSelectedEquip(null);setSelected(entry ? index : null)}} className={['relative aspect-square min-h-11 border-2 bg-[#17120d] p-1 shadow-[2px_2px_0_rgba(0,0,0,0.35)]',active?'border-[#f0d060]':item?rarityClass[item.rarity]||rarityClass.common:'border-[#30281e]'].join(' ')} title={item ? item.name + ' x' + (entry?.qty || 0) : 'Slot vazio'}>
                <span className="flex h-full items-center justify-center"><ItemIcon def={item}/></span>
                {entry && entry.qty > 1 ? <span className="font-retro absolute bottom-0.5 right-1 text-[13px] leading-none text-[#fff0dc]">{entry.qty}</span>:null}
                {entry?.upgrade ? <span className="font-retro absolute bottom-0.5 right-1 text-[12px] text-[#f0d060]">+{entry.upgrade}</span>:null}
                <span className="font-retro absolute left-1 top-0.5 text-[10px] text-[#5e5444]">{index+1}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-4 min-h-[118px] border-2 border-[#3a2f22] bg-[#15100c] p-3">
          {invSlot && invDef ? (
            <div className="flex gap-3">
              <div className={'flex h-12 w-12 shrink-0 items-center justify-center border-2 bg-[#201810] ' + (rarityClass[invDef.rarity]||rarityClass.common)}><ItemIcon def={invDef}/></div>
              <div className="min-w-0 flex-1">
                <div className="font-retro flex items-center justify-between gap-2 text-lg text-[#fff0dc]"><span>{invDef.name}{invSlot.upgrade ? ' +' + invSlot.upgrade : ''}</span><span className="text-[14px] text-[#a89b7d]">x{invSlot.qty}</span></div>
                <div className="font-retro mt-1 text-[14px] leading-tight text-[#a89b7d]">{invDef.description}</div>
                <StatLine def={invDef} upgrade={invSlot.upgrade||0}/>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-pixel text-[7px] uppercase tracking-wider text-[#c8baa0]">{invDef.kind==='consumable'?'Consumível':invDef.kind==='equipment'?'Equipamento':'Material'} · {invDef.rarity}</span>
                  {invDef.kind==='equipment' ? (
                    invDef.equipment?.slot==='accessory' ? <div className="flex gap-1"><Button onClick={()=>onEquip(selected!,'accessory1')} className="h-auto rounded-none px-2 py-1 font-pixel text-[7px]">ACESS. 1</Button><Button onClick={()=>onEquip(selected!,'accessory2')} className="h-auto rounded-none px-2 py-1 font-pixel text-[7px]">ACESS. 2</Button></div>
                    : <Button onClick={()=>onEquip(selected!)} className="h-auto rounded-none border-2 border-[#f97316] bg-[#f97316] px-4 py-1.5 font-pixel text-[8px] text-[#1a0e05] hover:bg-[#ea580c]">EQUIPAR</Button>
                  ) : invDef.usable ? <Button onClick={()=>onUse(selected!)} className="h-auto rounded-none border-2 border-[#f97316] bg-[#f97316] px-4 py-1.5 font-pixel text-[8px] text-[#1a0e05] hover:bg-[#ea580c]">USAR</Button>:null}
                </div>
              </div>
            </div>
          ) : equipped && equippedDef && selectedEquip ? (
            <div className="flex gap-3">
              <div className={'flex h-12 w-12 shrink-0 items-center justify-center border-2 bg-[#201810] ' + (rarityClass[equippedDef.rarity]||rarityClass.common)}><ItemIcon def={equippedDef}/></div>
              <div className="min-w-0 flex-1">
                <div className="font-retro text-lg text-[#fff0dc]">{equippedDef.name}{equipped.upgrade?' +'+equipped.upgrade:''}</div>
                <div className="font-retro text-[13px] text-[#a89b7d]">{slotLabels[selectedEquip]}</div>
                <StatLine def={equippedDef} upgrade={equipped.upgrade}/>
                <Button onClick={()=>onUnequip(selectedEquip)} className="mt-2 h-auto rounded-none border-2 border-[#5a4a32] bg-[#211a12] px-3 py-1 font-pixel text-[7px] text-[#c8baa0]">DESEQUIPAR</Button>
              </div>
            </div>
          ) : <div className="font-retro flex min-h-[82px] items-center justify-center text-[15px] text-[#6f6452]">Selecione um item ou slot equipado para ver os detalhes.</div>}
        </div>
      </PixelPanel>
    </div>
  )
}
