// ============================================================
// Shinobi Online — inventário autoritativo do servidor
// ============================================================

import { POTION } from './data'
import { EQUIPMENT_ITEMS } from './equipment'
import type { EquipmentItemSlot, EquipmentStats, InventorySlot } from './types'

export const INVENTORY_CAPACITY = 24

export type ItemKind = 'consumable' | 'material' | 'equipment'
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'unique'

export interface ItemDef {
  id: string
  name: string
  description: string
  kind: ItemKind
  rarity: ItemRarity
  maxStack: number
  usable?: boolean
  equipment?: {
    slot: EquipmentItemSlot
    requiredLv: number
    price: number
    baseStats: EquipmentStats
  }
}

export const ITEMS: Record<string, ItemDef> = {
  healing_potion: {
    id: 'healing_potion',
    name: 'Poção de Cura',
    description: 'Restaura 55% do HP máximo. Compartilha o tempo de recarga dos consumíveis.',
    kind: 'consumable',
    rarity: 'common',
    maxStack: POTION.max,
    usable: true,
  },
  chakra_pill: {
    id: 'chakra_pill',
    name: 'Pílula de Chakra',
    description: 'Restaura 35% do chakra máximo. Compartilha o tempo de recarga dos consumíveis.',
    kind: 'consumable',
    rarity: 'uncommon',
    maxStack: 12,
    usable: true,
  },
  iron_shard: {
    id: 'iron_shard',
    name: 'Fragmento de Ferro',
    description: 'Material obtido de inimigos. Será usado em forja e melhorias.',
    kind: 'material',
    rarity: 'common',
    maxStack: 30,
  },
  zetsu_cell: {
    id: 'zetsu_cell',
    name: 'Célula de Zetsu',
    description: 'Material incomum carregado por Zetsus. Útil para receitas avançadas.',
    kind: 'material',
    rarity: 'rare',
    maxStack: 20,
  },
  ancient_core: {
    id: 'ancient_core',
    name: 'Núcleo Ancião',
    description: 'Material raro deixado por inimigos poderosos.',
    kind: 'material',
    rarity: 'epic',
    maxStack: 5,
  },
  ...EQUIPMENT_ITEMS,
}

export const emptyInventory = (): InventorySlot[] =>
  Array.from({ length: INVENTORY_CAPACITY }, () => null)

export function normalizeInventory(raw: unknown, legacyPotionCount = POTION.start): InventorySlot[] {
  const slots = emptyInventory()
  if (Array.isArray(raw)) {
    for (let i = 0; i < Math.min(raw.length, INVENTORY_CAPACITY); i++) {
      const entry = raw[i] as any
      if (!entry || typeof entry !== 'object') continue
      const id = String(entry.id || '')
      const def = ITEMS[id]
      if (!def) continue
      const qty = Math.max(1, Math.min(def.maxStack, Math.floor(Number(entry.qty) || 1)))
      const upgrade = def.kind === 'equipment' ? Math.max(0, Math.min(11, Math.floor(Number(entry.upgrade) || 0))) : undefined
      slots[i] = { id, qty, ...(upgrade != null ? { upgrade } : {}) }
    }
    return slots
  }

  // Migração dos saves antigos: antes as poções eram apenas um número em "pot".
  const legacy = Math.max(0, Math.min(POTION.max, Math.floor(Number(legacyPotionCount) || 0)))
  if (legacy > 0) slots[0] = { id: 'healing_potion', qty: legacy }
  return slots
}

export function countItem(slots: InventorySlot[], itemId: string): number {
  let total = 0
  for (const slot of slots) if (slot?.id === itemId) total += slot.qty
  return total
}

export function addItem(slots: InventorySlot[], itemId: string, qty = 1): number {
  const def = ITEMS[itemId]
  if (!def) return 0
  let remaining = Math.max(0, Math.floor(qty))
  if (!remaining) return 0
  const initial = remaining

  for (const slot of slots) {
    if (!slot || slot.id !== itemId || slot.qty >= def.maxStack) continue
    const add = Math.min(remaining, def.maxStack - slot.qty)
    slot.qty += add
    remaining -= add
    if (!remaining) return initial
  }

  for (let i = 0; i < slots.length && remaining > 0; i++) {
    if (slots[i]) continue
    const add = Math.min(remaining, def.maxStack)
    slots[i] = { id: itemId, qty: add, ...(def.kind === 'equipment' ? { upgrade: 0 } : {}) }
    remaining -= add
  }

  return initial - remaining
}

export function removeItem(slots: InventorySlot[], itemId: string, qty = 1): number {
  let remaining = Math.max(0, Math.floor(qty))
  const initial = remaining
  for (let i = slots.length - 1; i >= 0 && remaining > 0; i--) {
    const slot = slots[i]
    if (!slot || slot.id !== itemId) continue
    const take = Math.min(remaining, slot.qty)
    slot.qty -= take
    remaining -= take
    if (slot.qty <= 0) slots[i] = null
  }
  return initial - remaining
}

export function removeFromSlot(slots: InventorySlot[], index: number, qty = 1): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= slots.length) return false
  const slot = slots[index]
  if (!slot) return false
  const take = Math.max(1, Math.floor(qty))
  if (slot.qty < take) return false
  slot.qty -= take
  if (slot.qty <= 0) slots[index] = null
  return true
}

export function itemDefsPayload() {
  return Object.values(ITEMS).map(({ id, name, description, kind, rarity, maxStack, usable, equipment }) => ({
    id, name, description, kind, rarity, maxStack, usable: !!usable,
    ...(equipment ? { equipment } : {}),
  }))
}

export interface LootEntry {
  id: string
  min: number
  max: number
  chance: number
}

const LOOT_TABLES: Record<string, LootEntry[]> = {
  bandido: [
    { id: 'iron_shard', min: 1, max: 1, chance: 0.16 },
    { id: 'chakra_pill', min: 1, max: 1, chance: 0.035 },
  ],
  sapo: [
    { id: 'chakra_pill', min: 1, max: 1, chance: 0.06 },
  ],
  gennin: [
    { id: 'iron_shard', min: 1, max: 2, chance: 0.28 },
    { id: 'chakra_pill', min: 1, max: 1, chance: 0.10 },
  ],
  zetsu: [
    { id: 'zetsu_cell', min: 1, max: 2, chance: 0.32 },
    { id: 'chakra_pill', min: 1, max: 1, chance: 0.08 },
  ],
  boss: [
    { id: 'ancient_core', min: 1, max: 1, chance: 1 },
    { id: 'zetsu_cell', min: 2, max: 4, chance: 1 },
    { id: 'chakra_pill', min: 1, max: 2, chance: 0.75 },
  ],
}

export function rollLoot(monsterType: string, rnd = Math.random): { id: string; qty: number }[] {
  const table = LOOT_TABLES[monsterType] || []
  const drops: { id: string; qty: number }[] = []
  for (const entry of table) {
    if (rnd() > entry.chance) continue
    const span = Math.max(0, entry.max - entry.min)
    const qty = entry.min + Math.floor(rnd() * (span + 1))
    drops.push({ id: entry.id, qty })
  }
  return drops
}
