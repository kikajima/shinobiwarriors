// ============================================================
// Shinobi Online — tipos de entidades
// ============================================================

import type { ElementId, VillageId } from './data'
import type { BotBrain } from './bots'

export type InventorySlot = { id: string; qty: number } | null

export interface PlayerEnt {
  id: number
  kind: 'human' | 'bot'
  name: string
  el: ElementId
  village: VillageId
  pal: number
  lv: number
  xp: number
  hp: number
  ch: number
  gold: number
  pot: number
  inventory: InventorySlot[]
  x: number
  y: number
  dir: number // 0=baixo 1=baixo-esq 2=esq 3=cima-esq 4=cima 5=cima-dir 6=dir 7=baixo-dir
  dead: boolean
  socket?: any
  bot?: BotBrain
  known: Map<number, number> // id -> lastSeen (apenas clientes humanos)
  lastMoveAt: number
  lastCombatAt: number
  cds: number[] // [básico, s0, s1, s2, s3, poção] — timestamps absolutos
  mi: number // índice da missão
  mp: number // progresso da missão
  lastChatAt: number
  lastHealAt: number
  bounty?: BountyContract | null
}

export interface MonsterEnt {
  id: number
  t: string
  name: string
  lv: number
  hp: number
  maxHp: number
  atk: number
  xp: number
  goldMin: number
  goldMax: number
  speed: number
  aggroR: number
  radius: number
  scale: number
  boss: boolean
  respawnMs: number
  x: number
  y: number
  spawnX: number
  spawnY: number
  dir: number
  aggroId: number | null
  atkAt: number
  dead: boolean
  respawnAt: number
  wanderT: number
  wanderDir: number
  wanderMoving: boolean
  slamAt: number
  slamPending: { x: number; y: number; at: number } | null
  // estados elementais aplicados por jutsus
  burnUntil: number
  burnNextAt: number
  burnDamage: number
  burnOwnerId: number | null
  slowUntil: number
  stunUntil: number
}

export interface ProjectileEnt {
  id: number
  owner: number
  x: number
  y: number
  vx: number
  vy: number
  k: number // chave visual: elIdx*4 + skillIdx
  dmg: number
  pierce: boolean
  radius: number
  ttl: number
  hitIds: Set<number>
}

export interface SavedPlayer {
  el: ElementId
  village?: VillageId
  lv: number
  xp: number
  gold: number
  pot: number
  inventory?: InventorySlot[]
  bounty?: BountyContract | null
}


export interface SavedBotProfile {
  el: ElementId
  village: VillageId
  pal: number
  lv: number
  xp: number
  gold: number
  pot: number
  inventory?: InventorySlot[]
  mi: number
  mp: number
  bounty?: BountyContract | null
}


export interface BountyContract {
  targetName: string
  targetVillage: VillageId
  targetLv: number
  rewardXp: number
  rewardGold: number
  acceptedAt: number
  expiresAt: number
  nextTrackAt: number
}
