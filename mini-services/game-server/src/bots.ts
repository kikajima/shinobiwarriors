// ============================================================
// Shinobi Online — IA dos bots (simulam jogadores reais)
// Comportamentos: grind, viagem, descanso, poções, chat casual,
// respostas contextuais, level up, morte e reconexão.
// ============================================================

import type { Game } from './game'
import type { MonsterEnt, PlayerEnt } from './types'
import { BOT_SPEED, CHAT, MISSIONS, SKILLS } from './data'
import { GRIND_ANCHORS, ZONE_ANCHORS, VILLAGE_SPAWNS, tileWalkable, walkable, zoneAt, type World } from './world'

const rnd = Math.random
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
const dir8 = (dx: number, dy: number): number => { const oct=(Math.round(Math.atan2(dy,dx)/(Math.PI/4))+8)%8; return (oct+6)%8 }
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]

export const BOT_TARGET = 30

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
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]] as const

  while (head < tail && prev[goal] === -1) {
    const cur = queue[head++], cx = cur % w, cy = Math.floor(cur / w)
    for (const [dx, dy] of dirs) {
      const nx = cx + dx, ny = cy + dy
      if (!tileWalkable(world, nx, ny)) continue
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
  pvpAggression = 0.28 + rnd() * 0.52
  nextCastAt = 0
  wanderAt = 0
  wanderAng = 0
  restUntil = 0
  grindUntil = 0
  nextChatAt = 0
  replyAt = 0
  replyText = ''
  chattiness = 0.3 + rnd() * 0.7
  desiredRange = 100 + rnd() * 55
  respawnAt = 0
  stuckCheckAt = 0
  stuckPos = { x: 0, y: 0 }
  stuckCount = 0
  grindAnchor: { x: number; y: number } | null = null
  returningToVillage = false

  constructor(game: Game, ent: PlayerEnt) {
    this.game = game
    this.ent = ent
    this.zone = zoneForBot(ent)
    const now = Date.now()
    this.nextChatAt = now + 15000 + rnd() * 90000
    this.routeTo(this.zone, true)
  }

  inCombat() {
    return (this.state === 'grind' && this.targetId != null) || this.pvpTargetId != null
  }

  onLevelUp() {
    if (rnd() < 0.3) this.game.chatOut(this.ent, pick(CHAT.levelUp).replace('{lv}', String(this.ent.lv)))
    const nz = zoneForBot(this.ent)
    if (nz !== this.zone) this.zone = nz
  }

  onMissionAdvance() {
    this.targetId = null
    const nz = zoneForBot(this.ent)
    this.zone = nz
    this.routeTo(nz, false)
  }

  onPvpHit(src: PlayerEnt) {
    if (src.id === this.ent.id || src.dead) return
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
        this.state = 'rest'
        this.restUntil = now + 4000 + rnd() * 8000
        this.route = []
        this.routeI = 0
      }
      return
    }

    if (this.replyAt && now >= this.replyAt) {
      this.replyAt = 0
      if (now - ent.lastChatAt > 8000) this.game.chatOut(ent, this.replyText)
    }
    if (now >= this.nextChatAt) {
      this.nextChatAt = now + 50000 + rnd() * 240000 * (1.4 - this.chattiness)
      if (rnd() < 0.3 + this.chattiness * 0.55) this.ambientChat()
    }

    const rival = this.pvpTargetId != null ? this.game.players.get(this.pvpTargetId) : undefined
    if (rival && now < this.pvpUntil && this.game.canPvp(ent, rival)) {
      this.thinkPvp(rival, dt, now)
      return
    }
    this.pvpTargetId = null

    if (this.state !== 'rest' && now >= this.nextPvpScanAt && !zoneAt(this.game.world, ent.x, ent.y).safe) {
      this.nextPvpScanAt = now + 1200 + rnd() * 1800
      const candidate = this.findPvpTarget()
      if (candidate) {
        const d = dist(candidate, ent)
        if (d < 150 || rnd() < this.pvpAggression) {
          this.pvpTargetId = candidate.id
          this.pvpUntil = now + 9000 + rnd() * 8000
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
    if (ent.pot < 3) ent.pot = 4
    if (now >= this.restUntil) {
      this.routeTo(this.zone, false)
      return
    }
    if (now >= this.wanderAt) {
      this.wanderAt = now + 2000 + rnd() * 4000
      this.wanderAng = rnd() * Math.PI * 2
    }
    const vila = VILLAGE_SPAWNS[ent.village] || VILLAGE_SPAWNS.folha
    const wx = ent.x + Math.cos(this.wanderAng) * 30 * dt
    const wy = ent.y + Math.sin(this.wanderAng) * 30 * dt
    if (this.game.canStand(wx, wy) && dist({ x: wx, y: wy }, vila) < 260) {
      ent.x = wx; ent.y = wy
    }
  }

  thinkTravel(dt: number, now: number) {
    void now
    const ent = this.ent
    const wp = this.route[this.routeI]
    if (!wp) {
      this.targetId = null
      if (this.returningToVillage) {
        this.returningToVillage = false
        this.state = 'rest'
        this.restUntil = Date.now() + 5000 + rnd() * 9000
      } else {
        this.state = 'grind'
        this.grindUntil = Date.now() + 240000 + rnd() * 300000
      }
      return
    }
    this.stepToward(wp.x, wp.y, BOT_SPEED * dt)
    if (dist(ent, wp) < 30) this.routeI++

    if (Date.now() >= this.stuckCheckAt) {
      this.stuckCheckAt = Date.now() + 2600
      if (dist(ent, this.stuckPos) < 14) {
        this.stuckCount++
        if (this.stuckCount >= 2) {
          const goal = this.route[this.route.length - 1]
          const reroute = goal ? findBotPath(this.game.world, ent.x, ent.y, goal.x, goal.y) : []
          if (reroute.length) {
            this.route = reroute
            this.routeI = 0
          } else {
            this.routeI++
          }
          this.stuckCount = 0
        }
      } else this.stuckCount = 0
      this.stuckPos = { x: ent.x, y: ent.y }
    }
  }

  thinkGrind(dt: number, now: number) {
    const ent = this.ent
    const monsters = this.game.monsters

    if (now >= this.grindUntil) {
      this.grindUntil = now + 240000 + rnd() * 300000
      if (rnd() < 0.35) {
        const missionZone = missionZoneFor(ent)
        this.zone = missionZone && rnd() < 0.88 ? missionZone : (rnd() < 0.65 ? zoneForLevel(ent.lv) : pick(['campo', 'floresta', 'lago', 'vale']))
        this.routeTo(this.zone, false)
        return
      }
      this.routeTo(this.zone, true)
      return
    }

    let target: MonsterEnt | undefined = this.targetId != null ? monsters.get(this.targetId) : undefined
    if (target && (target.dead || dist(target, ent) > 620)) { target = undefined; this.targetId = null }
    if (!target) {
      let best: MonsterEnt | undefined
      let bestScore = Infinity
      const mission = MISSIONS[ent.mi]
      for (const m of monsters.values()) {
        if (m.dead) continue
        const missionMatch = !mission || mission.monster === 'any' || mission.monster === m.t
        if (!missionMatch && mission?.monster !== 'any') continue
        if (m.lv > ent.lv + (missionMatch ? 7 : 4)) continue
        const d = dist(m, ent)
        if (d >= 500) continue
        const score = d + Math.max(0, m.lv - ent.lv) * 8
        if (score < bestScore) { best = m; bestScore = score }
      }
      if (best) { target = best; this.targetId = best.id }
    }

    if (!target) {
      if (now >= this.wanderAt) {
        this.wanderAt = now + 1500 + rnd() * 2500
        this.wanderAng = rnd() * Math.PI * 2
      }
      const anchorTile = this.currentAnchor()
      const anchor = { x: (anchorTile.x + .5) * TILE, y: (anchorTile.y + .5) * TILE }
      const d = dist(ent, anchor)
      if (d > 140) {
        this.stepToward(anchor.x + (rnd() - 0.5) * 90, anchor.y + (rnd() - 0.5) * 90, BOT_SPEED * dt)
      } else if (rnd() < 0.4) {
        const wx = ent.x + Math.cos(this.wanderAng) * 55 * dt
        const wy = ent.y + Math.sin(this.wanderAng) * 55 * dt
        if (walkable(this.game.world, wx, wy)) { ent.x = wx; ent.y = wy }
      }
      return
    }

    const d = dist(target, ent)
    const hpPct = ent.hp / (90 + 28 * (ent.lv - 1))
    if (hpPct < 0.34 && ent.pot > 0 && now >= ent.cds[5]) {
      this.game.usePotion(ent)
      if (rnd() < 0.2) this.game.chatOut(ent, pick(CHAT.potion))
    }
    if (hpPct < 0.15 && rnd() < 0.02) {
      this.state = 'travel'
      this.routeTo('vila', false)
      this.targetId = null
      if (rnd() < 0.3) this.game.chatOut(ent, 'aff to fora daqui, volto ja')
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
      if (levelGap > 5 && hpPct < 0.82) continue
      const targetHpPct = p.hp / Math.max(1, 90 + 28 * (p.lv - 1))
      const score = d + Math.max(0, levelGap) * 34 + targetHpPct * 42 - Math.max(0, -levelGap) * 7
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
    if (hpPct < 0.20 || (levelGap >= 4 && hpPct < 0.55)) {
      this.pvpTargetId = null
      this.targetId = null
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
    if (!this.grindAnchor) this.grindAnchor = pick(list)
    return this.grindAnchor
  }

  routeTo(zone: string, sameZoneOk: boolean) {
    void sameZoneOk
    const ent = this.ent
    if (zone !== 'vila') {
      if (zone !== this.zone) this.grindAnchor = null
      this.zone = zone
      // escolhe uma clareira estável até a próxima viagem
      this.grindAnchor = pick(GRIND_ANCHORS[this.zone] || [ZONE_ANCHORS[this.zone] || ZONE_ANCHORS.vila])
    }
    this.state = 'travel'
    this.routeI = 0
    this.targetId = null
    this.returningToVillage = zone === 'vila'

    const target = zone === 'vila' ? null : this.currentAnchor()
    const home = VILLAGE_SPAWNS[ent.village] || VILLAGE_SPAWNS.folha
    const targetX = target ? (target.x + .5) * TILE : home.x
    const targetY = target ? (target.y + .5) * TILE : home.y
    this.route = findBotPath(this.game.world, ent.x, ent.y, targetX, targetY)
    if (!this.route.length) this.route = [{ x: targetX, y: targetY }]
  }

  stepToward(tx: number, ty: number, step: number) {
    const ent = this.ent
    const dx = tx - ent.x, dy = ty - ent.y
    const d = Math.hypot(dx, dy)
    if (d < 2 || step <= 0) return
    const sx = (dx / d) * step, sy = (dy / d) * step
    ent.dir = dir8(dx, dy)

    if (this.game.canStand(ent.x + sx, ent.y + sy)) {
      ent.x += sx; ent.y += sy
    } else if (this.game.canStand(ent.x + sx, ent.y)) {
      ent.x += sx
    } else if (this.game.canStand(ent.x, ent.y + sy)) {
      ent.y += sy
    }
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
