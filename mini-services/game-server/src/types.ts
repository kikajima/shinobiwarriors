// ============================================================
// Shinobi Online — tipos de entidades
// ============================================================

import type { ElementId } from './data'
import type { BotBrain } from './bots'

export interface PlayerEnt {
  id: number
  kind: 'human' | 'bot'
  name: string
  el: ElementId
  pal: number
  lv: number
  xp: number
  hp: number
  ch: number
  gold: number
  pot: number
  x: number
  y: number
  dir: number // 0=baixo 1=cima 2=esquerda 3=direita
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
  lv: number
  xp: number
  gold: number
  pot: number
}
