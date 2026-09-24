// ============================================================
// Shinobi Online — IA dos bots (simulam jogadores reais)
// Comportamentos: grind, viagem, descanso, poções, chat casual,
// respostas contextuais, level up, morte e reconexão.
// ============================================================

import type { Game } from './game'
import type { MonsterEnt, PlayerEnt } from './types'
import { BOT_SPEED, CHAT, SKILLS } from './data'
import { GRIND_ANCHORS, ZONE_ANCHORS, walkable } from './world'

const rnd = Math.random
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]

export const BOT_TARGET = 30

const zoneForLevel = (lv: number): string =>
  lv < 4 ? 'campo' : lv < 7 ? 'floresta' : lv < 10 ? 'lago' : 'vale'

const EL_PT: Record<string, string> = { fogo: 'fogo', agua: 'agua', raio: 'raio', vento: 'vento', terra: 'terra' }

export class BotBrain {
  game: Game
  ent: PlayerEnt
  state: 'grind' | 'travel' | 'rest' = 'travel'
  zone: string
  route: { x: number; y: number }[] = []
  routeI = 0
  targetId: number | null = null
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

  constructor(game: Game, ent: PlayerEnt) {
    this.game = game
    this.ent = ent
    this.zone = zoneForLevel(ent.lv)
    const now = Date.now()
    this.nextChatAt = now + 15000 + rnd() * 90000
    this.routeTo(this.zone, true)
  }

  inCombat() {
    return this.state === 'grind' && this.targetId != null
  }

  onLevelUp() {
    if (rnd() < 0.3) {
      this.game.chatOut(this.ent, pick(CHAT.levelUp).replace('{lv}', String(this.ent.lv)))
      const nz = zoneForLevel(this.ent.lv)
      if (nz !== this.zone && rnd() < 0.7) this.zone = nz
    }
  }

  onDeath(src: MonsterEnt) {
    this.respawnAt = Date.now() + 6000 + rnd() * 6000
    this.targetId = null
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
    const vila = ZONE_ANCHORS.vila
    const wx = ent.x + Math.cos(this.wanderAng) * 30 * dt
    const wy = ent.y + Math.sin(this.wanderAng) * 30 * dt
    if (walkable(this.game.world, wx, wy) && dist({ x: wx, y: wy }, vila) < 260) {
      ent.x = wx; ent.y = wy
    }
  }

  thinkTravel(dt: number, now: number) {
    void now
    const ent = this.ent
    const wp = this.route[this.routeI]
    if (!wp) {
      this.state = 'grind'
      this.grindUntil = Date.now() + 240000 + rnd() * 300000
      this.targetId = null
      return
    }
    this.stepToward(wp.x, wp.y, BOT_SPEED * dt)
    if (dist(ent, wp) < 30) this.routeI++

    if (Date.now() >= this.stuckCheckAt) {
      this.stuckCheckAt = Date.now() + 2600
      if (dist(ent, this.stuckPos) < 14) {
        this.stuckCount++
        if (this.stuckCount >= 3) {
          this.routeI++
          this.stuckCount = 0
        } else {
          const ang = Math.atan2(wp.y - ent.y, wp.x - ent.x) + (rnd() < 0.5 ? 1.5 : -1.5)
          this.route.unshift({ x: ent.x + Math.cos(ang) * 110, y: ent.y + Math.sin(ang) * 110 })
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
        this.zone = rnd() < 0.6 ? zoneForLevel(ent.lv) : pick(['campo', 'floresta', 'lago', 'vale'])
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
      let bestD = Infinity
      for (const m of monsters.values()) {
        if (m.dead || m.lv > ent.lv + 4) continue
        const d = dist(m, ent)
        if (d < 460 && d < bestD) { best = m; bestD = d }
      }
      if (best) { target = best; this.targetId = best.id }
    }

    if (!target) {
      if (now >= this.wanderAt) {
        this.wanderAt = now + 1500 + rnd() * 2500
        this.wanderAng = rnd() * Math.PI * 2
      }
      const anchor = this.currentAnchor()
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

  currentAnchor(): { x: number; y: number } {
    const list = GRIND_ANCHORS[this.zone]
    if (!list || !list.length) return ZONE_ANCHORS[this.zone] || ZONE_ANCHORS.vila
    return list[Math.floor(rnd() * list.length)]
  }

  routeTo(zone: string, sameZoneOk: boolean) {
    const ent = this.ent
    this.zone = zone === 'vila' ? this.zone : zone
    this.state = 'travel'; this.routeI = 0; this.targetId = null
    const zA = ZONE_ANCHORS[zone === 'vila' ? 'vila' : this.zone] || ZONE_ANCHORS.vila
    const gA = this.currentAnchor()
    const gpx = { x: gA.x * 32, y: gA.y * 32 }
    if (zone === 'vila') { this.route = [{ x: zA.x * 32, y: zA.y * 32 }]; return }
    const zoneAnchorPx = { x: zA.x * 32, y: zA.y * 32 }
    const dToZone = dist(ent, zoneAnchorPx)
    if (sameZoneOk && dToZone < 700) this.route = [gpx]
    else if (dToZone < 700) this.route = [gpx]
    else {
      const vila = ZONE_ANCHORS.vila
      this.route = [{ x: vila.x * 32, y: vila.y * 32 }, zoneAnchorPx, gpx]
    }
  }

  stepToward(tx: number, ty: number, step: number) {
    const ent = this.ent
    const w = this.game.world
    const dx = tx - ent.x, dy = ty - ent.y
    const d = Math.hypot(dx, dy)
    if (d < 2 || step <= 0) return
    const sx = (dx / d) * step, sy = (dy / d) * step
    if (Math.abs(dx) > Math.abs(dy)) ent.dir = dx > 0 ? 3 : 2
    else ent.dir = dy > 0 ? 0 : 1
    if (walkable(w, ent.x + sx * 1.6, ent.y + sy * 1.6)) { ent.x += sx; ent.y += sy }
    else {
      const ang = Math.atan2(dy, dx)
      for (const off of [0.9, -0.9, 1.7, -1.7]) {
        const a = ang + off
        const nx = ent.x + Math.cos(a) * step, ny = ent.y + Math.sin(a) * step
        if (walkable(w, nx, ny)) { ent.x = nx; ent.y = ny; return }
      }
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
