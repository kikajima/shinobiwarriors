// ============================================================
// Shinobi Online — IA dos bots (simulam jogadores reais)
// Comportamentos: grind, viagem, descanso, poções, chat casual,
// respostas contextuais, level up, morte e reconexão.
// ============================================================

import type { Game } from './game'
import type { MonsterEnt, PlayerEnt } from './types'
import { BOT_SPEED, CHAT, MISSIONS, MONSTERS, POTION, SKILLS, maxChOf, maxHpOf } from './data'
import { GRIND_ANCHORS, ZONE_ANCHORS, VILLAGE_EXITS, VILLAGE_SPAWNS, tileWalkable, walkable, zoneAt, type World } from './world'

const rnd = Math.random
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
const dir8 = (dx: number, dy: number): number => { const oct=(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8; return (oct+6)%8 }
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]

export type BotFocus = 'mission' | 'grind' | 'explore' | 'pvp' | 'social'
export const BOT_FOCUS_TYPES: BotFocus[] = ['mission', 'grind', 'explore', 'pvp', 'social']

export type BotPurposeKind = 'mission' | 'hunt' | 'explore' | 'pvp' | 'bounty' | 'recover' | 'social' | 'heal' | 'shop' | 'prepare'
export interface BotPurpose {
  kind: BotPurposeKind
  label: string
  since: number
  targetId?: number
}

export interface BotPersonality {
  primary: BotFocus
  mission: number
  grind: number
  explore: number
  pvp: number
  social: number
  caution: number
}

const hashName = (name: string): number => {
  let h = 2166136261 >>> 0
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h >>> 0
}
const unitFromHash = (h: number, shift: number) => (((h >>> shift) & 255) / 255 - .5) * .16
const clampTrait = (n: number) => Math.max(.05, Math.min(.98, n))

export function botPersonalityForName(name: string): BotPersonality {
  const h = hashName(name.toLowerCase())
  const primary = BOT_FOCUS_TYPES[h % BOT_FOCUS_TYPES.length]
  const base: Record<BotFocus, Omit<BotPersonality, 'primary'>> = {
    mission: { mission:.90, grind:.58, explore:.30, pvp:.22, social:.36, caution:.64 },
    grind:   { mission:.50, grind:.94, explore:.34, pvp:.34, social:.24, caution:.52 },
    explore: { mission:.36, grind:.46, explore:.95, pvp:.42, social:.48, caution:.48 },
    pvp:     { mission:.30, grind:.48, explore:.52, pvp:.94, social:.26, caution:.34 },
    social:  { mission:.48, grind:.42, explore:.52, pvp:.24, social:.95, caution:.72 },
  }
  const b = base[primary]
  return {
    primary,
    mission: clampTrait(b.mission + unitFromHash(h, 0)),
    grind: clampTrait(b.grind + unitFromHash(h, 4)),
    explore: clampTrait(b.explore + unitFromHash(h, 8)),
    pvp: clampTrait(b.pvp + unitFromHash(h, 12)),
    social: clampTrait(b.social + unitFromHash(h, 16)),
    caution: clampTrait(b.caution + unitFromHash(h, 20)),
  }
}

const weightedFocus = (weights: Record<BotFocus, number>): BotFocus => {
  const total = BOT_FOCUS_TYPES.reduce((sum, k) => sum + Math.max(0, weights[k]), 0)
  if (total <= 0) return 'grind'
  let roll = rnd() * total
  for (const k of BOT_FOCUS_TYPES) {
    roll -= Math.max(0, weights[k])
    if (roll <= 0) return k
  }
  return 'grind'
}

export const BOT_TARGET = 60

const TILE = 32

/** Caminho em grade usado pelos bots para atravessar portões e contornar obstáculos. */
export function findBotPath(
  world: World,
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
): { x: number; y: number }[] {
  const w = world.w, h = world.h
  const clampX = (x: number) => Math.max(0, Math.min(w - 1, x))
  const clampY = (y: number) => Math.max(0, Math.min(h - 1, y))
  const sx = clampX(Math.floor(startX / TILE))
  const sy = clampY(Math.floor(startY / TILE))
  let gx = clampX(Math.floor(targetX / TILE))
  let gy = clampY(Math.floor(targetY / TILE))

  // Se a âncora cair num tile bloqueado, usa o caminhável mais próximo.
  if (!tileWalkable(world, gx, gy)) {
    let found = false
    for (let r = 1; r <= 5 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const tx = gx + dx, ty = gy + dy
          if (tileWalkable(world, tx, ty)) {
            gx = tx; gy = ty; found = true; break
          }
        }
      }
    }
    if (!found) return []
  }

  const start = sy * w + sx, goal = gy * w + gx
  const prev = new Int32Array(w * h)
  prev.fill(-1)
  const queue = new Int32Array(w * h)
  let head = 0, tail = 0
  queue[tail++] = start
  prev[start] = start
  const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] as const

  while (head < tail && prev[goal] === -1) {
    const cur = queue[head++], cx = cur % w, cy = Math.floor(cur / w)
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy
      if (!tileWalkable(world, nx, ny)) continue
      if (dx !== 0 && dy !== 0 && (!tileWalkable(world, cx + dx, cy) || !tileWalkable(world, cx, cy + dy))) continue
      const ni = ny * w + nx
      if (prev[ni] !== -1) continue
      prev[ni] = cur
      queue[tail++] = ni
    }
  }
  if (prev[goal] === -1) return []

  const tiles: number[] = []
  for (let cur = goal;; cur = prev[cur]) {
    tiles.push(cur)
    if (cur === start) break
  }
  tiles.reverse()

  // Comprime trechos retos; o bot não precisa de um waypoint a cada tile.
  const route: { x: number; y: number }[] = []
  let lastDx = 0, lastDy = 0
  for (let i = 1; i < tiles.length; i++) {
    const ax = tiles[i - 1] % w, ay = Math.floor(tiles[i - 1] / w)
    const bx = tiles[i] % w, by = Math.floor(tiles[i] / w)
    const dx = bx - ax, dy = by - ay
    if (i > 1 && (dx !== lastDx || dy !== lastDy)) {
      route.push({ x: (ax + .5) * TILE, y: (ay + .5) * TILE })
    }
    lastDx = dx; lastDy = dy
  }
  route.push({ x: (gx + .5) * TILE, y: (gy + .5) * TILE })
  return route
}

const zoneForLevel = (lv: number): string => {
  if (lv < 15) return 'campo'
  if (lv < 35) return 'floresta'
  if (lv < 60) return rnd() < 0.55 ? 'lago' : 'vale'
  return 'vale'
}

const missionZoneFor = (ent: PlayerEnt): string | null => {
  const mission = MISSIONS[ent.mi]
  if (!mission || mission.monster === 'any') return null
  if (mission.monster === 'bandido') return 'campo'
  if (mission.monster === 'sapo') return 'lago'
  if (mission.monster === 'gennin') return 'floresta'
  return 'vale'
}

const zoneForBot = (ent: PlayerEnt): string => missionZoneFor(ent) || zoneForLevel(ent.lv)

const EL_PT: Record<string, string> = { fogo: 'fogo', agua: 'agua', raio: 'raio', vento: 'vento', terra: 'terra' }

export class BotBrain {
  game: Game
  ent: PlayerEnt
  state: 'grind' | 'travel' | 'rest' = 'travel'
  zone: string
  route: { x: number; y: number }[] = []
  routeI = 0
  targetId: number | null = null
  pvpTargetId: number | null = null
  pvpUntil = 0
  nextPvpScanAt = 0
  personality: BotPersonality
  focus: BotFocus = 'mission'
  focusUntil = 0
  nextCastAt = 0
  wanderAt = 0
  wanderAng = 0
  restUntil = 0
  grindUntil = 0
  nextChatAt = 0
  replyAt = 0
  replyText = ''
  desiredRange = 100 + rnd() * 55
  respawnAt = 0
  stuckCheckAt = 0
  stuckPos = { x: 0, y: 0 }
  stuckCount = 0
  grindAnchor: { x: number; y: number } | null = null
  returningToVillage = false
  lastZone = ''
  zoneChanges = 0
  purpose: BotPurpose = { kind: 'hunt', label: 'procurando treino', since: 0 }
  routeGoal: { x: number; y: number } | null = null
  routeFailures = 0
  lastProgressAt = 0
  lastProgressPos = { x: 0, y: 0 }
  nextPurposeCheckAt = 0
  villageTask: 'heal' | 'shop' | 'bounty' | 'social' | 'depart' = 'heal'
  villageRoute: { x: number; y: number }[] = []
  villageRouteI = 0
  villageTaskUntil = 0
  villagePreparedAt = 0
  nextBountyPlanAt = 0
  bountyLastKnown: { x: number; y: number; at: number; targetId?: number } | null = null

  constructor(game: Game, ent: PlayerEnt) {
    this.game = game
    this.ent = ent
    this.personality = botPersonalityForName(ent.name)
    this.zone = zoneForBot(ent)
    this.lastZone = this.zone
    const now = Date.now()
    this.nextChatAt = now + 15000 + rnd() * 90000 * (1.25 - this.personality.social * .45)
    this.chooseFocus(now, true)
    if (zoneAt(this.game.world, ent.x, ent.y).safe && this.needsVillagePrep()) this.beginVillageRoutine(now)
    else this.startFocusedActivity(now)
  }

  missionReady(): boolean {
    const mission = MISSIONS[this.ent.mi]
    if (!mission || mission.monster === 'any') return true
    const def = MONSTERS[mission.monster]
    if (!def) return true
    if (def.boss) return this.ent.lv >= Math.max(10, def.lv - 2) && this.ent.pot >= 4
    return def.lv <= this.ent.lv + 2
  }

  desiredPotionStock(): number {
    const levelBonus = Math.min(3, Math.floor(this.ent.lv / 15))
    return Math.max(3, Math.min(POTION.max, 3 + Math.round(this.personality.caution * 2) + levelBonus))
  }

  goldReserve(): number {
    return 35 + Math.min(300, this.ent.lv * 4)
  }

  needsVillagePrep(): boolean {
    const hpPct = this.ent.hp / Math.max(1, maxHpOf(this.ent.lv))
    const chPct = this.ent.ch / Math.max(1, maxChOf(this.ent.lv))
    const needsPotions = this.ent.pot < this.desiredPotionStock() && this.ent.gold >= POTION.price
    return hpPct < .68 || chPct < .42 || needsPotions
  }

  chooseFocus(now: number, force = false): BotFocus {
    if (!force && now < this.focusUntil) return this.focus
    const ent = this.ent
    const hpPct = ent.hp / Math.max(1, maxHpOf(ent.lv))
    const mission = MISSIONS[ent.mi]
    const missionRemaining = mission ? Math.max(0, mission.need - ent.mp) / Math.max(1, mission.need) : 0
    const ready = this.missionReady()

    const weights: Record<BotFocus, number> = {
      mission: this.personality.mission * (1 + missionRemaining * 1.15) * (ready ? 1 : .10),
      grind: this.personality.grind * (ready ? 1 : 2.35),
      explore: this.personality.explore,
      pvp: this.personality.pvp,
      social: this.personality.social * .48,
    }

    // Shinobis iniciantes se comportam como iniciantes: missão e treino antes de PvP.
    if (ent.lv < 5) {
      weights.mission *= 2.4
      weights.grind *= 1.8
      weights.explore *= .48
      weights.pvp *= .04
      weights.social *= .28
    } else if (ent.lv < 10) {
      weights.mission *= 1.7
      weights.grind *= 1.35
      weights.pvp *= .30
      weights.social *= .55
    }

    if (this.needsVillagePrep()) {
      weights.social += 1.6 + this.personality.caution
      weights.pvp *= .10
      weights.explore *= .45
    } else if (hpPct > .85 && ent.pot >= 3) {
      weights.social *= .58
    }

    if (this.focus) weights[this.focus] *= .70

    this.focus = weightedFocus(weights)
    const early = ent.lv < 10
    this.focusUntil = now + (early ? 45000 : 75000) + rnd() * (early ? 90000 : 180000)
    return this.focus
  }

  chooseProductiveFocus(now: number): BotFocus {
    this.chooseFocus(now, true)
    if (this.focus === 'social') {
      if (this.missionReady() && this.personality.mission >= this.personality.grind * .72) this.focus = 'mission'
      else this.focus = rnd() < .72 ? 'grind' : 'explore'
      this.focusUntil = now + 60000 + rnd() * 150000
    }
    return this.focus
  }

  shouldTakeBounty(): boolean {
    const ent = this.ent
    if (ent.bounty && ent.bounty.expiresAt > Date.now()) return true
    if (ent.lv < 3 || ent.pot < 2) return false
    const base = .12 + this.personality.pvp * .58 + (this.personality.primary === 'pvp' ? .16 : 0)
    return rnd() < Math.min(.88, base)
  }

  shouldPursueBounty(now = Date.now()): boolean {
    const b = this.ent.bounty
    if (!b || b.expiresAt <= now || this.ent.lv < 3 || this.ent.pot < 1) return false
    const gap = b.targetLv - this.ent.lv
    const maxGap = 2 + Math.round((1 - this.personality.caution) * 6)
    if (gap > maxGap) return false
    return this.focus === 'pvp' || this.personality.pvp > .62 || rnd() < .28 + this.personality.pvp * .42
  }

  planBountyHunt(now: number): boolean {
    const ent = this.ent
    const b = ent.bounty
    if (!b || b.expiresAt <= now) return false
    if (now < this.nextBountyPlanAt && this.route.length) return true
    this.nextBountyPlanAt = now + 2500

    const clue = this.game.trackBounty(ent, now, true)
    if (!clue.ok) {
      if (this.bountyLastKnown && now - this.bountyLastKnown.at < 45000) {
        this.setPurpose('bounty', `seguindo última pista de ${b.targetName}`, this.bountyLastKnown.targetId)
        this.state = 'travel'
        return this.routeToPoint(this.bountyLastKnown.x, this.bountyLastKnown.y)
      }
      return false
    }

    const target = clue.target as PlayerEnt
    this.bountyLastKnown = { x: target.x, y: target.y, at: now, targetId: target.id }

    if (clue.safe) {
      const exits = VILLAGE_EXITS[target.village] || []
      const exit = [...exits].sort((a,b)=>dist(ent,a)-dist(ent,b))[0]
      if (!exit) return false
      this.setPurpose('bounty', `aguardando ${target.name} sair de ${clue.zone}`, target.id)
      this.state = 'travel'
      this.pvpTargetId = null
      return this.routeToPoint(exit.x, exit.y)
    }

    this.setPurpose('bounty', `rastreando contrato: ${target.name}`, target.id)
    this.state = 'travel'
    this.pvpTargetId = null
    return this.routeToPoint(target.x, target.y)
  }

  setPurpose(kind: BotPurposeKind, label: string, targetId?: number) {
    this.purpose = { kind, label, since: Date.now(), ...(targetId != null ? { targetId } : {}) }
  }

  findPreferredMonster(missionOnly = false): MonsterEnt | null {
    const ent = this.ent
    const mission = MISSIONS[ent.mi]
    if (missionOnly && !this.missionReady()) return null

    let best: MonsterEnt | null = null
    let bestScore = Infinity
    for (const m of this.game.monsters.values()) {
      if (m.dead) continue
      const missionMatch = !mission || mission.monster === 'any' || mission.monster === m.t
      if (missionOnly && !missionMatch && mission?.monster !== 'any') continue
      if (m.lv > ent.lv + 2) continue
      if (m.boss && ent.lv < 10) continue

      const d = dist(m, ent)
      let claimers = 0
      for (const p of this.game.players.values()) {
        if (p.id === ent.id || p.kind !== 'bot' || !p.bot) continue
        if (p.bot.targetId === m.id || p.bot.purpose.targetId === m.id) claimers++
      }

      const idealLv = Math.min(ent.lv + 1, 12)
      let score = d + Math.abs(idealLv - m.lv) * 42 + claimers * 210
      score -= Math.min(260, m.xp * .55)
      if (missionMatch) score -= 300 * this.personality.mission
      if (score < bestScore) { best = m; bestScore = score }
    }
    return best
  }

  beginVillageRoutine(now: number) {
    this.state = 'rest'
    this.returningToVillage = false
    this.targetId = null
    this.pvpTargetId = null
    this.route = []
    this.routeI = 0
    this.routeGoal = null
    this.villageRoute = []
    this.villageRouteI = 0
    this.villageTask = 'heal'
    this.villageTaskUntil = now + 30000
    this.setPurpose('prepare', 'se preparando na vila')
  }

  followVillageRoute(targetX: number, targetY: number, dt: number): boolean {
    const ent = this.ent
    if (!this.villageRoute.length || this.villageRouteI >= this.villageRoute.length) {
      this.villageRoute = findBotPath(this.game.world, ent.x, ent.y, targetX, targetY)
      this.villageRouteI = 0
      if (!this.villageRoute.length) return false
    }
    const wp = this.villageRoute[this.villageRouteI]
    this.stepToward(wp.x, wp.y, Math.min(BOT_SPEED * .72, 105) * dt)
    if (dist(ent, wp) < 22) this.villageRouteI++
    return this.villageRouteI >= this.villageRoute.length
  }

  clearVillageRoute() {
    this.villageRoute = []
    this.villageRouteI = 0
  }

  routeToPoint(targetX: number, targetY: number): boolean {
    const ent = this.ent
    const world = this.game.world
    const startsSafe = !!zoneAt(world, ent.x, ent.y).safe
    const targetSafe = !!zoneAt(world, targetX, targetY).safe

    let route: { x: number; y: number }[] = []
    if (startsSafe && !targetSafe) {
      const exits = VILLAGE_EXITS[ent.village] || []
      const exit = [...exits].sort((a,b)=>dist(a,{x:targetX,y:targetY})-dist(b,{x:targetX,y:targetY}))[0]
      if (!exit) return false

      const toExit = findBotPath(world, ent.x, ent.y, exit.x, exit.y)
      if (!toExit.length) {
        this.route = []
        this.routeI = 0
        this.routeGoal = null
        this.routeFailures++
        return false
      }
      const fromExit = findBotPath(world, exit.x, exit.y, targetX, targetY)
      route = [...toExit, ...fromExit]
    } else {
      route = findBotPath(world, ent.x, ent.y, targetX, targetY)
    }

    if (!route.length) {
      this.route = []
      this.routeI = 0
      this.routeGoal = null
      this.routeFailures++
      return false
    }
    this.route = route
    this.routeI = 0
    this.routeGoal = route[route.length - 1] || { x: targetX, y: targetY }
    this.routeFailures = 0
    this.lastProgressAt = Date.now()
    this.lastProgressPos = { x: ent.x, y: ent.y }
    return true
  }

  routeToMonster(monster: MonsterEnt, kind: 'mission' | 'hunt'): boolean {
    this.setPurpose(kind, kind === 'mission' ? `cumprindo missão: ${monster.name}` : `caçando ${monster.name}`, monster.id)
    this.state = 'travel'
    this.returningToVillage = false
    this.targetId = monster.id
    const ok = this.routeToPoint(monster.spawnX, monster.spawnY)
    if (!ok) this.targetId = null
    return ok
  }

  startFocusedActivity(now: number) {
    const ent = this.ent
    this.chooseFocus(now)
    this.targetId = null
    this.pvpTargetId = null

    if (this.needsVillagePrep() && !zoneAt(this.game.world, ent.x, ent.y).safe) {
      this.setPurpose('recover', 'voltando para se preparar')
      this.routeTo('vila', false)
      return
    }

    if (this.shouldPursueBounty(now) && this.planBountyHunt(now)) return

    if (this.focus === 'social') {
      this.setPurpose('social', 'fazendo uma pausa curta na vila')
      this.routeTo('vila', false)
      return
    }

    if (this.focus === 'mission') {
      if (!this.missionReady()) {
        this.focus = 'grind'
        this.setPurpose('hunt', `treinando para: ${MISSIONS[ent.mi]?.name || 'próxima missão'}`)
        const training = this.findPreferredMonster(false)
        if (training && this.routeToMonster(training, 'hunt')) return
        this.routeTo(zoneForLevel(ent.lv), false)
        return
      }
      const target = this.findPreferredMonster(true)
      if (target && this.routeToMonster(target, 'mission')) return
      const missionZone = missionZoneFor(ent)
      this.setPurpose('mission', 'indo para a área da missão')
      this.routeTo(missionZone || zoneForLevel(ent.lv), false)
      return
    }

    if (this.focus === 'grind') {
      const target = this.findPreferredMonster(false)
      if (target && this.routeToMonster(target, 'hunt')) return
      this.setPurpose('hunt', 'procurando inimigos adequados para treinar')
      this.routeTo(zoneForLevel(ent.lv), false)
      return
    }

    if (this.focus === 'explore') {
      const choices = ['campo', 'floresta', 'lago', 'vale'].filter(z => z !== this.zone)
      this.setPurpose('explore', 'explorando uma nova região')
      this.routeTo(pick(choices.length ? choices : ['campo', 'floresta', 'lago', 'vale']), false)
      return
    }

    if (ent.lv < 5 || ent.pot < 2) {
      this.focus = 'grind'
      this.setPurpose('hunt', 'treinando antes de procurar PvP')
      const target = this.findPreferredMonster(false)
      if (target && this.routeToMonster(target, 'hunt')) return
      this.routeTo(zoneForLevel(ent.lv), false)
      return
    }

    this.setPurpose('pvp', 'patrulhando as fronteiras por rivais')
    this.routeTo('vale', false)
  }

  inCombat() {
    return (this.state === 'grind' && this.targetId != null) || this.pvpTargetId != null
  }

  onLevelUp() {
    if (rnd() < 0.3 * this.personality.social) this.game.chatOut(this.ent, pick(CHAT.levelUp).replace('{lv}', String(this.ent.lv)))
    this.focusUntil = Math.min(this.focusUntil, Date.now() + 25000)
  }

  onMissionAdvance() {
    this.targetId = null
    this.focusUntil = 0
    this.chooseFocus(Date.now(), true)
    this.startFocusedActivity(Date.now())
  }

  onBountyAssigned() {
    const now = Date.now()
    this.nextBountyPlanAt = 0
    if (this.ent.bounty && (this.personality.pvp > .5 || rnd() < .55)) {
      this.focus = 'pvp'
      this.focusUntil = now + 90000 + rnd() * 150000
    }
  }

  onBountyComplete(victim: PlayerEnt, xp: number, gold: number) {
    void xp; void gold
    this.pvpTargetId = null
    this.targetId = null
    this.bountyLastKnown = null
    this.focusUntil = 0
    if (rnd() < .25 * this.personality.social) this.game.chatOut(this.ent, `contrato em ${victim.name} concluido, vou me preparar`)
    this.routeTo('vila', false)
  }

  onPvpHit(src: PlayerEnt) {
    if (src.id === this.ent.id || src.dead) return
    this.setPurpose('pvp', `revidando ataque de ${src.name}`, src.id)
    this.pvpTargetId = src.id
    this.pvpUntil = Date.now() + 12000
    this.targetId = null
  }

  onDeath(src: MonsterEnt | PlayerEnt) {
    this.respawnAt = Date.now() + 6000 + rnd() * 6000
    this.targetId = null
    this.pvpTargetId = null
    if (rnd() < 0.25) {
      this.game.chatOut(this.ent, pick(CHAT.death).replace('{mob}', src.name))
    }
  }

  sayJoin() {
    setTimeout(() => this.game.chatOut(this.ent, pick(CHAT.join)), 1200 + rnd() * 4000)
  }

  sayFarewell() {
    this.game.chatOut(this.ent, pick(CHAT.farewell))
  }

  think(dt: number, now: number) {
    const ent = this.ent
    if (ent.dead) {
      if (this.respawnAt && now >= this.respawnAt) {
        this.respawnAt = 0
        this.game.respawnPlayer(ent)
        this.beginVillageRoutine(now)
      }
      return
    }

    if (this.replyAt && now >= this.replyAt) {
      this.replyAt = 0
      if (now - ent.lastChatAt > 8000) this.game.chatOut(ent, this.replyText)
    }
    if (now >= this.nextChatAt) {
      const social = this.personality.social
      this.nextChatAt = now + 65000 + rnd() * 260000 * (1.25 - social * .35)
      if (rnd() < .10 + social * .42) this.ambientChat()
    }

    if (now >= this.focusUntil && !this.inCombat()) {
      this.chooseFocus(now, true)
      if (this.state !== 'travel') this.startFocusedActivity(now)
    }

    const bountyTarget = ent.bounty ? this.game.playerByName(ent.bounty.targetName) : null
    if (bountyTarget && !bountyTarget.dead && this.game.canPvp(ent, bountyTarget) && dist(ent, bountyTarget) < 560 && this.shouldPursueBounty(now)) {
      this.setPurpose('bounty', `encontrou o alvo: ${bountyTarget.name}`, bountyTarget.id)
      this.pvpTargetId = bountyTarget.id
      this.pvpUntil = now + 14000
    } else if (ent.bounty && this.shouldPursueBounty(now) && now >= this.nextBountyPlanAt && this.state !== 'rest' && !this.inCombat()) {
      this.planBountyHunt(now)
    }

    const rival = this.pvpTargetId != null ? this.game.players.get(this.pvpTargetId) : undefined
    if (rival && now < this.pvpUntil && this.game.canPvp(ent, rival)) {
      this.thinkPvp(rival, dt, now)
      return
    }
    this.pvpTargetId = null

    if (this.state !== 'rest' && now >= this.nextPvpScanAt && !zoneAt(this.game.world, ent.x, ent.y).safe) {
      const pvpIntent = this.focus === 'pvp' ? 1 : this.focus === 'explore' ? .48 : .20
      this.nextPvpScanAt = now + 1400 + rnd() * (2400 - this.personality.pvp * 700)
      const candidate = this.findPvpTarget()
      if (candidate) {
        const d = dist(candidate, ent)
        const engageChance = Math.min(.96, this.personality.pvp * pvpIntent + (d < 125 ? .42 : 0))
        if (rnd() < engageChance) {
          this.setPurpose('pvp', `enfrentando rival: ${candidate.name}`, candidate.id)
          this.pvpTargetId = candidate.id
          this.pvpUntil = now + 7000 + rnd() * (9000 + this.personality.pvp * 5000)
          this.targetId = null
          this.thinkPvp(candidate, dt, now)
          return
        }
      }
    }

    switch (this.state) {
      case 'rest': this.thinkRest(dt, now); break
      case 'travel': this.thinkTravel(dt, now); break
      case 'grind': this.thinkGrind(dt, now); break
    }
  }

  thinkRest(dt: number, now: number) {
    const ent = this.ent
    const fountain = this.game.world.fountains.find(f => f.village === ent.village)
    const shops = this.game.world.shops.filter(q => q.village === ent.village)
    const bountyNpc = this.game.world.bountyNpcs.find(q => q.village === ent.village)

    if (this.villageTask === 'heal') {
      const hpFull = ent.hp >= maxHpOf(ent.lv) * .98
      const chFull = ent.ch >= maxChOf(ent.lv) * .98
      if (!fountain || (hpFull && chFull)) {
        this.villageTask = 'shop'
        this.clearVillageRoute()
      } else if (dist(ent, fountain) < 108) {
        this.game.botUseFountain(ent)
        this.villageTask = 'shop'
        this.clearVillageRoute()
      } else {
        this.setPurpose('heal', 'indo até a fonte recuperar forças')
        this.followVillageRoute(fountain.x, fountain.y, dt)
        return
      }
    }

    if (this.villageTask === 'shop') {
      const desired = this.desiredPotionStock()
      const canBuy = ent.pot < desired && ent.gold >= POTION.price
      if (!canBuy || !shops.length) {
        this.villageTask = this.shouldTakeBounty() && bountyNpc ? 'bounty' : 'social'
        this.villageTaskUntil = now + 1800 + rnd() * (1800 + this.personality.social * 3500)
        this.clearVillageRoute()
      } else {
        const shop = [...shops].sort((a,b)=>dist(ent,a)-dist(ent,b))[0]
        if (dist(ent, shop) < 140) {
          this.setPurpose('shop', `comprando suprimentos em ${shop.name}`)
          this.game.botBuyPotions(ent, desired, this.goldReserve())
          this.villageTask = this.shouldTakeBounty() && bountyNpc ? 'bounty' : 'social'
          this.villageTaskUntil = now + 1800 + rnd() * (1800 + this.personality.social * 3500)
          this.clearVillageRoute()
        } else {
          this.setPurpose('shop', `indo comprar suprimentos em ${shop.name}`)
          this.followVillageRoute(shop.x, shop.y, dt)
          return
        }
      }
    }

    if (this.villageTask === 'bounty') {
      if (!bountyNpc) {
        this.villageTask = 'social'
      } else if (dist(ent, bountyNpc) < 110) {
        this.setPurpose('bounty', 'pegando contrato de caça')
        if (!ent.bounty || ent.bounty.expiresAt <= now) this.game.assignBounty(ent, now)
        this.villageTask = 'social'
        this.villageTaskUntil = now + 900 + rnd() * 2200
        this.clearVillageRoute()
      } else {
        this.setPurpose('bounty', 'indo ao Oficial de Caçadas')
        this.followVillageRoute(bountyNpc.x, bountyNpc.y, dt)
        return
      }
    }

    if (this.villageTask === 'social') {
      this.setPurpose('social', 'organizando equipamentos antes de sair')
      if (now < this.villageTaskUntil) {
        if (now >= this.wanderAt) {
          this.wanderAt = now + 1200 + rnd() * 1800
          this.wanderAng = rnd() * Math.PI * 2
        }
        const home = VILLAGE_SPAWNS[ent.village] || VILLAGE_SPAWNS.folha
        const wx = ent.x + Math.cos(this.wanderAng) * 36
        const wy = ent.y + Math.sin(this.wanderAng) * 36
        if (dist({x:wx,y:wy}, home) < 300) this.stepToward(wx, wy, 24 * dt)
        return
      }
      this.villageTask = 'depart'
    }

    if (this.villageTask === 'depart') {
      this.villagePreparedAt = now
      this.focusUntil = 0
      this.chooseProductiveFocus(now)
      this.setPurpose('prepare', 'saindo da vila para progredir')
      this.startFocusedActivity(now)
    }
  }

  thinkTravel(dt: number, now: number) {
    const ent = this.ent

    if (this.purpose.kind === 'bounty' && this.purpose.targetId != null) {
      const target = this.game.players.get(this.purpose.targetId)
      if (target && !target.dead && this.game.canPvp(ent, target) && dist(target, ent) < 560) {
        this.pvpTargetId = target.id
        this.pvpUntil = now + 14000
        this.route = []
        this.routeI = 0
        this.routeGoal = null
        this.thinkPvp(target, dt, now)
        return
      }
    }

    // Se o propósito era chegar a um monstro e ele já está perto, começa o combate
    // sem insistir em terminar waypoints antigos.
    if (this.purpose.kind !== 'bounty' && this.purpose.targetId != null) {
      const monster = this.game.monsters.get(this.purpose.targetId)
      const outsideSafeZone = !zoneAt(this.game.world, ent.x, ent.y).safe
      if (outsideSafeZone && monster && !monster.dead && dist(monster, ent) < 500) {
        this.targetId = monster.id
        this.state = 'grind'
        this.route = []
        this.routeI = 0
        this.routeGoal = null
        this.grindUntil = now + 120000 + rnd() * 220000
        return
      }
    }

    const wp = this.route[this.routeI]
    if (!wp) {
      this.targetId = null
      this.routeGoal = null
      if (this.returningToVillage) {
        this.beginVillageRoutine(now)
      } else if (this.purpose.kind === 'bounty' && ent.bounty) {
        this.state = 'grind'
        this.grindUntil = now + 8000
        this.nextBountyPlanAt = Math.min(this.nextBountyPlanAt, now + 1200)
      } else {
        this.state = 'grind'
        const base = this.focus === 'explore' ? 70000 : this.focus === 'pvp' ? 90000 : 180000
        const span = this.focus === 'grind' ? 300000 : 150000
        this.grindUntil = now + base + rnd() * span
      }
      return
    }

    this.stepToward(wp.x, wp.y, BOT_SPEED * dt)
    if (dist(ent, wp) < 24) this.routeI++

    // Recuperação de rota: mede progresso real, não animação/intenção.
    if (now >= this.stuckCheckAt) {
      this.stuckCheckAt = now + 1800
      const moved = dist(ent, this.lastProgressPos)
      if (moved >= 18) {
        this.stuckCount = 0
        this.lastProgressAt = now
        this.lastProgressPos = { x: ent.x, y: ent.y }
      } else {
        this.stuckCount++
        if (this.stuckCount >= 2) {
          const goal = this.routeGoal
          const reroute = goal ? findBotPath(this.game.world, ent.x, ent.y, goal.x, goal.y) : []
          if (reroute.length) {
            this.route = reroute
            this.routeI = 0
            this.routeGoal = reroute[reroute.length - 1] || goal
            this.stuckCount = 0
            this.lastProgressPos = { x: ent.x, y: ent.y }
            this.lastProgressAt = now
          } else {
            // Nunca anda em linha reta por uma rota impossível.
            this.route = []
            this.routeI = 0
            this.routeGoal = null
            this.targetId = null
            this.stuckCount = 0
            this.routeFailures++
            this.focusUntil = 0
            if (this.routeFailures >= 2) {
              this.setPurpose('recover', 'recalculando caminho pela vila')
              this.routeTo('vila', false)
            } else {
              this.chooseFocus(now, true)
              this.startFocusedActivity(now)
            }
          }
        }
      }
    }
  }

  thinkGrind(dt: number, now: number) {
    const ent = this.ent
    const monsters = this.game.monsters

    if (zoneAt(this.game.world, ent.x, ent.y).safe) {
      this.targetId = null
      this.pvpTargetId = null
      this.focusUntil = 0
      this.chooseProductiveFocus(now)
      this.setPurpose('prepare', 'saindo da zona segura antes de combater')
      this.startFocusedActivity(now)
      return
    }

    if (ent.bounty && this.shouldPursueBounty(now) && now >= this.nextBountyPlanAt) {
      if (this.planBountyHunt(now)) return
    }

    if (now >= this.grindUntil) {
      this.focusUntil = 0
      this.chooseFocus(now, true)
      this.startFocusedActivity(now)
      return
    }

    let target: MonsterEnt | undefined = this.targetId != null ? monsters.get(this.targetId) : undefined
    if (target && (target.dead || dist(target, ent) > 620)) { target = undefined; this.targetId = null }
    if (!target) {
      let best: MonsterEnt | undefined
      let bestScore = Infinity
      const mission = MISSIONS[ent.mi]
      const missionDriven = this.focus === 'mission' && this.missionReady()
      const searchRange = this.focus === 'explore' ? 260 : this.focus === 'pvp' ? 190 : 500
      for (const m of monsters.values()) {
        if (m.dead) continue
        const missionMatch = !mission || mission.monster === 'any' || mission.monster === m.t
        if (missionDriven && !missionMatch && mission?.monster !== 'any') continue
        if (m.lv > ent.lv + 2) continue
        if (m.boss && ent.lv < 10) continue
        const d = dist(m, ent)
        if (d >= searchRange) continue
        let score = d + Math.max(0, m.lv - ent.lv) * 8
        if (missionMatch) score -= 110 * this.personality.mission
        if (this.focus === 'grind') score -= Math.max(0, ent.lv - m.lv) * 2
        if (score < bestScore) { best = m; bestScore = score }
      }
      if (best) { target = best; this.targetId = best.id }
    }

    if (!target) {
      if (now >= this.nextPurposeCheckAt && (this.focus === 'mission' || this.focus === 'grind')) {
        this.nextPurposeCheckAt = now + 3500 + rnd() * 3500
        const preferred = this.findPreferredMonster(this.focus === 'mission')
        if (preferred && dist(preferred, ent) > 430 && this.routeToMonster(preferred, this.focus === 'mission' ? 'mission' : 'hunt')) return
        if (preferred) { target = preferred; this.targetId = preferred.id }
      }
      if (!target) {
        if (now >= this.wanderAt) {
          this.wanderAt = now + 1800 + rnd() * 2600
          this.wanderAng = rnd() * Math.PI * 2
        }
        const anchorTile = this.currentAnchor()
        const anchor = { x: (anchorTile.x + .5) * TILE, y: (anchorTile.y + .5) * TILE }
        const d = dist(ent, anchor)
        if (d > 120) {
          this.stepToward(anchor.x, anchor.y, BOT_SPEED * dt)
        } else if (rnd() < .22 + this.personality.explore * .22) {
          const wx = ent.x + Math.cos(this.wanderAng) * 70
          const wy = ent.y + Math.sin(this.wanderAng) * 70
          this.stepToward(wx, wy, 48 * dt)
        }
        return
      }
    }

    const d = dist(target, ent)
    const hpPct = ent.hp / (90 + 28 * (ent.lv - 1))
    if (hpPct < 0.34 && ent.pot > 0 && now >= ent.cds[5]) {
      this.game.usePotion(ent)
      if (rnd() < 0.2) this.game.chatOut(ent, pick(CHAT.potion))
    }
    const retreatAt = .11 + this.personality.caution * .16
    if (hpPct < retreatAt && rnd() < .08 + this.personality.caution * .08) {
      this.setPurpose('recover', 'recuando para recuperar vida e poções')
      this.routeTo('vila', false)
      this.targetId = null
      if (rnd() < 0.12 * this.personality.social) this.game.chatOut(ent, 'vou recuperar na vila, ja volto')
      return
    }

    if (d > this.desiredRange) this.stepToward(target.x, target.y, BOT_SPEED * dt)
    else if (d < 46 && rnd() < 0.3) {
      const ang = Math.atan2(ent.y - target.y, ent.x - target.x)
      this.stepToward(ent.x + Math.cos(ang) * 60, ent.y + Math.sin(ang) * 60, BOT_SPEED * dt * 0.7)
    }

    if (now >= this.nextCastAt) {
      this.nextCastAt = now + 380 + rnd() * 950
      const aimX = target.x + (rnd() - 0.5) * 26
      const aimY = target.y + (rnd() - 0.5) * 26
      const skills = SKILLS[ent.el]
      const ready: number[] = []
      const weights: number[] = []
      for (let i = 0; i < 4; i++) {
        if (now < ent.cds[1 + i] || ent.ch < skills[i].ch || d > skills[i].range * 0.92) continue
        ready.push(i); weights.push(skills[i].mult * (skills[i].archetype === 'proj' ? 1.6 : 1))
      }
      if (ready.length > 0) {
        const total = weights.reduce((a, b) => a + b, 0)
        let rr = rnd() * total
        let chosen = ready[0]
        for (let i = 0; i < ready.length; i++) {
          rr -= weights[i]
          if (rr <= 0) { chosen = ready[i]; break }
        }
        this.game.castSkill(ent, chosen, aimX, aimY)
      } else if (d < 96 && now >= ent.cds[0]) this.game.basicAttack(ent, aimX, aimY)
    }
  }

  findPvpTarget(): PlayerEnt | null {
    const ent = this.ent
    if (zoneAt(this.game.world, ent.x, ent.y).safe) return null
    const hpPct = ent.hp / Math.max(1, 90 + 28 * (ent.lv - 1))
    if (hpPct < 0.38) return null

    let best: PlayerEnt | null = null
    let bestScore = Infinity
    for (const p of this.game.players.values()) {
      if (!this.game.canPvp(ent, p)) continue
      const d = dist(p, ent)
      if (d > 520) continue
      const levelGap = p.lv - ent.lv
      if (levelGap > 2 + Math.round((1-this.personality.caution)*6) && hpPct < .72 + this.personality.caution*.18) continue
      const targetHpPct = p.hp / Math.max(1, 90 + 28 * (p.lv - 1))
      let alliesOnTarget = 0
      let nearbyAllyNeedsHelp = false
      for (const ally of this.game.players.values()) {
        if (ally.id === ent.id || ally.dead || ally.village !== ent.village || !ally.bot) continue
        if (ally.bot.pvpTargetId === p.id) {
          alliesOnTarget++
          if (dist(ally, ent) < 420) nearbyAllyNeedsHelp = true
        }
      }
      let score = d + Math.max(0, levelGap) * 34 + targetHpPct * 42 - Math.max(0, -levelGap) * 7
      if (nearbyAllyNeedsHelp) score -= 95 * (1 - this.personality.caution * .35)
      if (alliesOnTarget > 2) score += (alliesOnTarget - 2) * 120
      if (score < bestScore) {
        best = p
        bestScore = score
      }
    }
    return best
  }

  thinkPvp(target: PlayerEnt, dt: number, now: number) {
    const ent = this.ent
    const d = dist(target, ent)
    if (target.dead || d > 640 || !this.game.canPvp(ent, target)) {
      this.pvpTargetId = null
      return
    }

    const hpPct = ent.hp / Math.max(1, 90 + 28 * (ent.lv - 1))
    const targetHpPct = target.hp / Math.max(1, 90 + 28 * (target.lv - 1))
    const levelGap = target.lv - ent.lv

    if (hpPct < 0.38 && ent.pot > 0 && now >= ent.cds[5]) this.game.usePotion(ent)
    const retreatHp = .12 + this.personality.caution * .24
    const dangerousGap = 2 + Math.round(this.personality.caution * 5)
    if (hpPct < retreatHp || (levelGap >= dangerousGap && hpPct < .42 + this.personality.caution * .30)) {
      this.pvpTargetId = null
      this.targetId = null
      this.focusUntil = Math.min(this.focusUntil, now + 25000)
      this.setPurpose('recover', 'recuando de uma luta desfavorável')
      this.routeTo('vila', false)
      return
    }

    const idealRange = targetHpPct < 0.28 ? 70 : this.desiredRange
    if (d > idealRange) this.stepToward(target.x, target.y, BOT_SPEED * dt)
    else if (d < 48 && hpPct < targetHpPct && rnd() < 0.38) {
      const ang = Math.atan2(ent.y - target.y, ent.x - target.x)
      this.stepToward(ent.x + Math.cos(ang) * 72, ent.y + Math.sin(ang) * 72, BOT_SPEED * dt * 0.82)
    }

    if (now < this.nextCastAt) return
    this.nextCastAt = now + 380 + rnd() * 720
    const skills = SKILLS[ent.el]
    let chosen = -1
    let chosenScore = -Infinity
    for (let i = 0; i < 4; i++) {
      const skill = skills[i]
      if (now < ent.cds[1 + i] || ent.ch < skill.ch || d > skill.range * 0.94) continue
      let score = skill.mult + rnd() * 0.35
      if ((skill.archetype === 'proj' || skill.archetype === 'line') && d > 110) score += 0.9
      if (skill.archetype === 'dash' && d > 70 && d < skill.range) score += 1.05
      if (skill.archetype === 'aoe' && d < (skill.radius || 120) + 55) score += 1.15
      if (targetHpPct < 0.25) score += skill.mult * 0.35
      if (score > chosenScore) { chosen = i; chosenScore = score }
    }

    const aimX = target.x + (rnd() - .5) * 18
    const aimY = target.y + (rnd() - .5) * 18
    if (chosen >= 0 && rnd() < 0.88) {
      this.game.castSkill(ent, chosen, aimX, aimY)
    } else if (d < 100 && now >= ent.cds[0]) {
      this.game.basicAttack(ent, target.x, target.y)
    }
  }

  currentAnchor(): { x: number; y: number } {
    const list = GRIND_ANCHORS[this.zone]
    if (!list || !list.length) return ZONE_ANCHORS[this.zone] || ZONE_ANCHORS.vila
    if (!this.grindAnchor) {
      if (this.focus === 'explore') this.grindAnchor = pick(list)
      else if (this.focus === 'pvp') {
        const center = { x: this.game.world.w / 2, y: this.game.world.h / 2 }
        this.grindAnchor = [...list].sort((a,b)=>dist(a,center)-dist(b,center))[0] || list[0]
      } else {
        const entTile = { x: this.ent.x / TILE, y: this.ent.y / TILE }
        const nearest = [...list].sort((a,b)=>dist(a,entTile)-dist(b,entTile)).slice(0,Math.min(3,list.length))
        this.grindAnchor = pick(nearest)
      }
    }
    return this.grindAnchor
  }

  routeTo(zone: string, sameZoneOk: boolean) {
    void sameZoneOk
    const ent = this.ent
    if (zone !== 'vila') {
      if (zone !== this.zone) {
        this.lastZone = this.zone
        this.zoneChanges++
        this.grindAnchor = null
      }
      this.zone = zone
      this.grindAnchor = this.currentAnchor()
    }
    this.state = 'travel'
    this.routeI = 0
    this.targetId = null
    this.returningToVillage = zone === 'vila'

    const target = zone === 'vila' ? null : this.currentAnchor()
    const home = VILLAGE_SPAWNS[ent.village] || VILLAGE_SPAWNS.folha
    const targetX = target ? (target.x + .5) * TILE : home.x
    const targetY = target ? (target.y + .5) * TILE : home.y

    if (zone === 'vila' && this.purpose.kind !== 'recover' && this.purpose.kind !== 'social') {
      this.setPurpose('social', 'voltando à vila')
    }

    if (!this.routeToPoint(targetX, targetY)) {
      // Uma rota impossível nunca vira caminhada cega.
      this.state = 'rest'
      this.returningToVillage = false
      this.villageTask = 'depart'
      this.villageTaskUntil = Date.now() + 1000
      this.focusUntil = 0
    }
  }

  stepToward(tx: number, ty: number, step: number): boolean {
    const ent = this.ent
    const dx = tx - ent.x, dy = ty - ent.y
    const d = Math.hypot(dx, dy)
    if (d < 2 || step <= 0) return false

    const ox = ent.x, oy = ent.y
    const sx = (dx / d) * step, sy = (dy / d) * step

    if (this.game.canStand(ent.x + sx, ent.y + sy)) {
      ent.x += sx; ent.y += sy
    } else {
      // Tenta os eixos na ordem que mais aproxima do destino.
      const opts = Math.abs(dx) >= Math.abs(dy)
        ? [[sx,0],[0,sy]] as const
        : [[0,sy],[sx,0]] as const
      let moved = false
      for (const [mx,my] of opts) {
        if ((mx !== 0 || my !== 0) && this.game.canStand(ent.x + mx, ent.y + my)) {
          ent.x += mx; ent.y += my; moved = true; break
        }
      }
      if (!moved) {
        // Pequeno desvio lateral evita pressionar eternamente a mesma quina.
        const side = step * .72
        const px = -dy / d, py = dx / d
        const candidates = [[px*side,py*side],[-px*side,-py*side]] as const
        for (const [mx,my] of candidates) {
          if (this.game.canStand(ent.x + mx, ent.y + my)) {
            ent.x += mx; ent.y += my; break
          }
        }
      }
    }

    const movedX = ent.x - ox, movedY = ent.y - oy
    if (Math.hypot(movedX, movedY) > .25) {
      ent.dir = dir8(movedX, movedY)
      return true
    }
    return false
  }

  ambientChat() {
    let text = pick(CHAT.ambient)
    text = text.replace('{el}', EL_PT[this.ent.el] || 'fogo').replace('{lv}', String(this.ent.lv))
    this.game.chatOut(this.ent, text)
  }
}

function scheduleReply(bot: BotBrain, at: number, text: string) {
  if (bot.replyAt) return
  bot.replyAt = at; bot.replyText = text
}
const firstName = (n: string) => n.split(/[_.\- ]/)[0] || n

export function botGreetHuman(game: Game, human: PlayerEnt) {
  const bots = [...game.players.values()].filter((p) => p.kind === 'bot' && p.bot)
  if (!bots.length) return
  const shuffled = bots.sort(() => rnd() - 0.5)
  const n = 1 + (rnd() < 0.45 ? 1 : 0)
  for (let i = 0; i < n && i < shuffled.length; i++) {
    const b = shuffled[i].bot!
    scheduleReply(b, Date.now() + 2200 + rnd() * 7000, pick(CHAT.greetReply).replace('{name}', firstName(human.name)))
  }
}

export function scheduleBotReplies(game: Game, from: PlayerEnt, text: string) {
  const t = text.toLowerCase()
  const bots = [...game.players.values()].filter((p) => p.kind === 'bot' && p.bot && p.id !== from.id)
  if (!bots.length) return
  for (const p of bots) {
    const base = p.name.toLowerCase().split(/[_.]/)[0]
    if (base.length > 3 && t.includes(base)) {
      scheduleReply(p.bot!, Date.now() + 1500 + rnd() * 5000, pick(CHAT.mention)); return
    }
  }
  let pool: string[] | null = null
  if (/^(oi+|ola+|olá|eae|e ai|eaí|bom dia|boa tarde|boa noite|fala|salve|opa|e aí|ooi)/.test(t)) pool = CHAT.greetReply
  else if (/\b(party|pt|grupo|upar junto|upa comigo|time|squad)\b/.test(t)) pool = CHAT.party
  else if (/\b(boss|anci|anciao|anciã|zetsu anci)\b/.test(t)) pool = CHAT.boss
  else if (/\b(lag|bug|dc|caiu|travou|ping|lagou)\b/.test(t)) pool = CHAT.lag
  else if (/kkk{2,}|haha|rsrs|lol|hehe/.test(t)) pool = CHAT.laugh
  else if (t.includes('?')) pool = CHAT.answer
  else if (/\b(naruto|anime|manga|shippuden|boruto|episodio|ep)\b/.test(t)) pool = CHAT.ambient
  if (!pool) return
  const prob = from.kind === 'human' ? 0.55 : 0.14
  if (rnd() > prob) return
  const shuffled = bots.sort(() => rnd() - 0.5)
  const n = 1 + (rnd() < 0.3 ? 1 : 0)
  for (let i = 0; i < n && i < shuffled.length; i++) {
    const b = shuffled[i].bot!
    let reply = pick(pool)
    if (reply.includes('{name}')) reply = reply.replace('{name}', firstName(from.name))
    scheduleReply(b, Date.now() + 1600 + rnd() * 5500, reply)
  }
}
