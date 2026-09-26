// ============================================================
// Shinobi Online — equipamentos, raridades, atributos e forja
// ============================================================

import type { EquipmentItemSlot, EquipmentLoadout, EquipmentSlot, EquippedItem, EquipmentStats } from './types'

export type EquipmentRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'unique'

export const EQUIPMENT_SLOTS: EquipmentSlot[] = [
  'head', 'torso', 'boots', 'gloves', 'accessory1', 'accessory2', 'pants',
]

export const EQUIPMENT_RARITIES: EquipmentRarity[] = [
  'common', 'uncommon', 'rare', 'epic', 'legendary', 'unique',
]

export const RARITY_LABELS: Record<EquipmentRarity, string> = {
  common: 'Comum',
  uncommon: 'Incomum',
  rare: 'Raro',
  epic: 'Épico',
  legendary: 'Lendário',
  unique: 'Único',
}

const RARITY_MULT: Record<EquipmentRarity, number> = {
  common: 1,
  uncommon: 1.45,
  rare: 2.05,
  epic: 2.9,
  legendary: 4.05,
  unique: 5.6,
}

const RARITY_PRICE: Record<EquipmentRarity, number> = {
  common: 120,
  uncommon: 420,
  rare: 1250,
  epic: 3600,
  legendary: 10500,
  unique: 30000,
}

const RARITY_LEVEL: Record<EquipmentRarity, number> = {
  common: 1,
  uncommon: 5,
  rare: 12,
  epic: 25,
  legendary: 45,
  unique: 70,
}

const RARITY_FORGE_COST: Record<EquipmentRarity, number> = {
  common: 1,
  uncommon: 1.2,
  rare: 1.5,
  epic: 1.9,
  legendary: 2.5,
  unique: 3.3,
}

export const FORGE_MULT = [1, 1.06, 1.12, 1.20, 1.30, 1.42, 1.56, 1.72, 1.90, 2.10, 2.32, 2.58]

const SLOT_LABELS: Record<EquipmentItemSlot, string> = {
  head: 'Cabeça',
  torso: 'Torso',
  boots: 'Botas',
  gloves: 'Luvas',
  accessory: 'Acessório',
  pants: 'Calças',
}

const SLOT_NAMES: Record<EquipmentItemSlot, string> = {
  head: 'Bandana Shinobi',
  torso: 'Colete Shinobi',
  boots: 'Botas de Combate',
  gloves: 'Luvas de Combate',
  accessory: 'Talismã Shinobi',
  pants: 'Calças Shinobi',
}

const RARITY_PREFIX: Record<EquipmentRarity, string> = {
  common: 'Simples',
  uncommon: 'Reforçado',
  rare: 'Elite',
  epic: 'Ancestral',
  legendary: 'Kage',
  unique: 'Relíquia',
}

const SLOT_BASE: Record<EquipmentItemSlot, EquipmentStats> = {
  head:      { hp: 10, chakra: 8, attack: 0, defense: 0.004, speed: 0, crit: 0.001 },
  torso:     { hp: 18, chakra: 0, attack: 0, defense: 0.012, speed: 0, crit: 0 },
  boots:     { hp: 0, chakra: 0, attack: 0, defense: 0.004, speed: 2.5, crit: 0 },
  gloves:    { hp: 0, chakra: 0, attack: 2.5, defense: 0, speed: 0, crit: 0.004 },
  accessory: { hp: 4, chakra: 5, attack: 1.4, defense: 0, speed: 0.5, crit: 0.0025 },
  pants:     { hp: 14, chakra: 3, attack: 0, defense: 0.009, speed: 0.5, crit: 0 },
}

export interface EquipmentItemDef {
  id: string
  name: string
  description: string
  kind: 'equipment'
  rarity: EquipmentRarity
  maxStack: 1
  usable: boolean
  equipment: {
    slot: EquipmentItemSlot
    requiredLv: number
    price: number
    baseStats: EquipmentStats
  }
}

const itemId = (slot: EquipmentItemSlot, rarity: EquipmentRarity) => 'gear_' + slot + '_' + rarity

const roundStat = (key: keyof EquipmentStats, n: number) =>
  key === 'defense' || key === 'crit' ? Math.round(n * 10000) / 10000 : Math.round(n * 10) / 10

const scaleStats = (stats: EquipmentStats, mult: number): EquipmentStats => {
  const out = emptyStats()
  for (const key of Object.keys(out) as (keyof EquipmentStats)[]) out[key] = roundStat(key, stats[key] * mult)
  return out
}

export const EQUIPMENT_ITEMS: Record<string, EquipmentItemDef> = {}
for (const slot of Object.keys(SLOT_BASE) as EquipmentItemSlot[]) {
  for (const rarity of EQUIPMENT_RARITIES) {
    const mult = RARITY_MULT[rarity]
    const stats = scaleStats(SLOT_BASE[slot], mult)
    const id = itemId(slot, rarity)
    EQUIPMENT_ITEMS[id] = {
      id,
      name: RARITY_PREFIX[rarity] + ' ' + SLOT_NAMES[slot],
      description: SLOT_LABELS[slot] + ' ' + RARITY_LABELS[rarity] + ' com atributos escalados pela raridade e pela forja.',
      kind: 'equipment',
      rarity,
      maxStack: 1,
      usable: true,
      equipment: {
        slot,
        requiredLv: RARITY_LEVEL[rarity],
        price: Math.round(RARITY_PRICE[rarity] * (slot === 'accessory' ? .9 : slot === 'torso' ? 1.15 : 1)),
        baseStats: stats,
      },
    }
  }
}

export function emptyStats(): EquipmentStats {
  return { hp: 0, chakra: 0, attack: 0, defense: 0, speed: 0, crit: 0 }
}

export function emptyEquipment(): EquipmentLoadout {
  return {
    head: null,
    torso: null,
    boots: null,
    gloves: null,
    accessory1: null,
    accessory2: null,
    pants: null,
  }
}

export function equipmentDef(id: string | undefined | null): EquipmentItemDef | null {
  return id ? EQUIPMENT_ITEMS[id] || null : null
}

export function validEquipmentSlot(itemSlot: EquipmentItemSlot, target: EquipmentSlot): boolean {
  if (itemSlot === 'accessory') return target === 'accessory1' || target === 'accessory2'
  return itemSlot === target
}

export function normalizeEquipment(raw: unknown): EquipmentLoadout {
  const loadout = emptyEquipment()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return loadout
  for (const slot of EQUIPMENT_SLOTS) {
    const v = (raw as any)[slot]
    const def = equipmentDef(v?.id)
    const upgrade = Math.max(0, Math.min(11, Math.floor(Number(v?.upgrade) || 0)))
    if (!def || !validEquipmentSlot(def.equipment.slot, slot)) continue
    loadout[slot] = { id: def.id, upgrade }
  }
  return loadout
}

export function statsForItem(item: EquippedItem | null | undefined): EquipmentStats {
  const def = equipmentDef(item?.id)
  if (!def) return emptyStats()
  const upgrade = Math.max(0, Math.min(11, Math.floor(Number(item?.upgrade) || 0)))
  return scaleStats(def.equipment.baseStats, FORGE_MULT[upgrade])
}

export function equipmentStats(loadout: EquipmentLoadout | undefined | null): EquipmentStats {
  const total = emptyStats()
  if (!loadout) return total
  for (const slot of EQUIPMENT_SLOTS) {
    const stats = statsForItem(loadout[slot])
    for (const key of Object.keys(total) as (keyof EquipmentStats)[]) total[key] += stats[key]
  }
  total.hp = Math.round(total.hp)
  total.chakra = Math.round(total.chakra)
  total.attack = Math.round(total.attack * 10) / 10
  total.speed = Math.round(total.speed * 10) / 10
  total.defense = Math.round(total.defense * 10000) / 10000
  total.crit = Math.round(total.crit * 10000) / 10000
  return total
}

export function equipmentPower(item: EquippedItem | null | undefined): number {
  const s = statsForItem(item)
  return s.hp * .12 + s.chakra * .11 + s.attack * 2.2 + s.defense * 420 + s.speed * .8 + s.crit * 520
}

export function forgeCost(item: EquippedItem | null | undefined): { gold: number; materials: Record<string, number> } | null {
  const def = equipmentDef(item?.id)
  if (!def) return null
  const up = Math.max(0, Math.min(11, Math.floor(Number(item?.upgrade) || 0)))
  if (up >= 11) return null
  const baseGold = [80, 130, 220, 360, 600, 900, 1400, 2200, 3400, 5200, 8000][up]
  const iron = [1, 2, 3, 4, 6, 8, 10, 12, 0, 0, 0][up]
  const zetsu = [0, 0, 0, 0, 0, 0, 1, 2, 4, 6, 8][up]
  const core = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2][up]
  const mult = RARITY_FORGE_COST[def.rarity]
  const materials: Record<string, number> = {}
  if (iron) materials.iron_shard = Math.max(1, Math.ceil(iron * Math.sqrt(mult)))
  if (zetsu) materials.zetsu_cell = Math.max(1, Math.ceil(zetsu * Math.sqrt(mult)))
  if (core) materials.ancient_core = Math.max(1, Math.ceil(core * Math.sqrt(mult)))
  return { gold: Math.round(baseGold * mult), materials }
}

export function equipmentCatalogPayload() {
  return Object.values(EQUIPMENT_ITEMS).map((def) => ({
    id: def.id,
    name: def.name,
    rarity: def.rarity,
    slot: def.equipment.slot,
    requiredLv: def.equipment.requiredLv,
    price: def.equipment.price,
    baseStats: def.equipment.baseStats,
  }))
}
