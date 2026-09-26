'use client'

import { useMemo, useState } from 'react'
import { Coins, Hammer, Shield, ShoppingBag, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { EquipmentShopMsg, EquipmentSlot, InventorySlotView, ItemDefView } from '../types'
import { PixelPanel } from './pixel'

const rarityText: Record<string,string> = {
  common:'text-[#c8baa0]', uncommon:'text-[#8ee39a]', rare:'text-[#86c8ff]', epic:'text-[#d8a3ff]', legendary:'text-[#ffd866]', unique:'text-[#ff8a80]',
}
const rarityOrder: Record<string,number> = {common:0,uncommon:1,rare:2,epic:3,legendary:4,unique:5}
const slotLabel: Record<string,string> = {head:'Cabeça',torso:'Torso',boots:'Botas',gloves:'Luvas',accessory:'Acessório',accessory1:'Acessório 1',accessory2:'Acessório 2',pants:'Calças'}

export function EquipmentShopPanel({
  shop, level, inventory, itemDefs, onClose, onBuy, onForge,
}:{
  shop: EquipmentShopMsg
  level:number
  inventory:InventorySlotView[]
  itemDefs:ItemDefView[]
  onClose:()=>void
  onBuy:(id:string)=>void
  onForge:(slot:EquipmentSlot)=>void
}) {
  const [tab,setTab]=useState<'shop'|'forge'>('shop')
  const defs=useMemo(()=>new Map(itemDefs.map(d=>[d.id,d])),[itemDefs])
  const counts=useMemo(()=>{
    const m=new Map<string,number>()
    for(const slot of inventory)if(slot)m.set(slot.id,(m.get(slot.id)||0)+slot.qty)
    return m
  },[inventory])
  const catalog=[...shop.catalog].sort((a,b)=>(rarityOrder[a.rarity]-rarityOrder[b.rarity])||a.slot.localeCompare(b.slot))

  return <div className="absolute inset-0 z-[55] flex items-center justify-center bg-[#0f0d0abb] p-2 sm:p-4">
    <PixelPanel className="relative max-h-[94vh] w-[min(780px,98vw)] overflow-y-auto !p-3 sm:!p-4" title={shop.name}>
      <button type="button" onClick={onClose} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center border border-[#3a2f22] text-[#a89b7d]" aria-label="Fechar"><X className="h-4 w-4"/></button>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex gap-1">
          <button type="button" onClick={()=>setTab('shop')} className={'font-pixel border-2 px-3 py-1 text-[8px] '+(tab==='shop'?'border-[#f0d060] text-[#f0d060]':'border-[#3a2f22] text-[#8d8069]')}><ShoppingBag className="mr-1 inline h-3 w-3"/>LOJA</button>
          <button type="button" onClick={()=>setTab('forge')} className={'font-pixel border-2 px-3 py-1 text-[8px] '+(tab==='forge'?'border-[#f97316] text-[#ff9d5c]':'border-[#3a2f22] text-[#8d8069]')}><Hammer className="mr-1 inline h-3 w-3"/>FORJA</button>
        </div>
        <div className="font-retro flex items-center gap-1 text-[15px] text-[#f0d060]"><Coins className="h-4 w-4"/>{shop.equipment.gold} ryō</div>
      </div>

      {tab==='shop'?<div className="mt-3 grid gap-2 sm:grid-cols-2">
        {catalog.map(item=>{
          const def=defs.get(item.id)
          const locked=level<item.requiredLv
          const poor=shop.equipment.gold<item.price
          const s=item.baseStats
          const stats=[s.hp?'HP +'+s.hp:'',s.chakra?'CH +'+s.chakra:'',s.attack?'ATQ +'+s.attack:'',s.defense?'DEF +'+(s.defense*100).toFixed(1)+'%':'',s.speed?'VEL +'+s.speed:'',s.crit?'CRIT +'+(s.crit*100).toFixed(1)+'%':''].filter(Boolean).join(' · ')
          return <div key={item.id} className="border-2 border-[#3a2f22] bg-[#17120d] p-2">
            <div className="flex items-start gap-2"><Shield className="mt-0.5 h-4 w-4 text-[#d9c39a]"/><div className="min-w-0 flex-1"><div className={'font-retro text-[16px] '+(rarityText[item.rarity]||'text-[#e8d5a9]')}>{item.name}</div><div className="font-retro text-[12px] text-[#82755f]">{slotLabel[item.slot]} · Nv {item.requiredLv}+</div></div></div>
            <div className="font-retro mt-1 text-[12px] leading-tight text-[#9bd9f6]">{stats}</div>
            <div className="mt-2 flex items-center justify-between"><span className="font-retro text-[14px] text-[#f0d060]">{item.price} ryō</span><Button disabled={locked||poor} onClick={()=>onBuy(item.id)} className="h-auto rounded-none border-2 border-[#f97316] bg-[#f97316] px-3 py-1 font-pixel text-[7px] text-[#1a0e05] disabled:opacity-35">{locked?'NÍVEL '+item.requiredLv:'COMPRAR'}</Button></div>
          </div>
        })}
      </div>:<div className="mt-3 space-y-2">
        {(Object.keys(shop.equipment.loadout) as EquipmentSlot[]).map(slot=>{
          const eq=shop.equipment.loadout[slot]
          const def=eq?defs.get(eq.id):undefined
          const cost=shop.equipment.forgeCosts[slot]
          if(!eq||!def)return <div key={slot} className="font-retro border border-[#30281e] bg-[#15100c] p-2 text-[14px] text-[#5f5545]">{slotLabel[slot]} — vazio</div>
          const mats=cost?Object.entries(cost.materials).map(([id,qty])=>{
            const name=defs.get(id)?.name||id
            const have=counts.get(id)||0
            return name+' '+have+'/'+qty
          }).join(' · '):''
          const canGold=!!cost&&shop.equipment.gold>=cost.gold
          const canMats=!!cost&&Object.entries(cost.materials).every(([id,qty])=>(counts.get(id)||0)>=qty)
          return <div key={slot} className="border-2 border-[#3a2f22] bg-[#17120d] p-2">
            <div className="flex items-center justify-between gap-2"><div><div className={'font-retro text-[16px] '+(rarityText[def.rarity]||'text-[#e8d5a9]')}>{def.name} <span className="text-[#f0d060]">+{eq.upgrade}</span></div><div className="font-retro text-[12px] text-[#82755f]">{slotLabel[slot]}</div></div>{cost?<Button disabled={!canGold||!canMats} onClick={()=>onForge(slot)} className="h-auto rounded-none border-2 border-[#f97316] bg-[#7c3514] px-3 py-1 font-pixel text-[7px] text-[#ffd0a8]">FORJAR +{eq.upgrade+1}</Button>:<span className="font-pixel text-[8px] text-[#ffd866]">MÁX +11</span>}</div>
            {cost?<><div className="font-retro mt-1 text-[13px] text-[#f0d060]">{cost.gold} ryō</div><div className="font-retro text-[12px] text-[#a89b7d]">{mats||'Sem materiais adicionais'}</div></>:null}
          </div>
        })}
        <div className="font-retro border border-[#4a3528] bg-[#1d160f] p-2 text-[13px] leading-tight text-[#b9a98c]">A forja é garantida e não destrói o item. Os níveis altos exigem Células de Zetsu e Núcleos Anciões.</div>
      </div>}
    </PixelPanel>
  </div>
}
