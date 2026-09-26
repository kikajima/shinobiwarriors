import { Game } from './src/game'
import { BOT_FOCUS_TYPES, botPersonalityForName } from './src/bots'
import { BOT_NAMES } from './src/data'

const game = new Game({} as any)
const bots = [...game.players.values()].filter((p: any) => p.kind === 'bot' && p.bot)
if (bots.length < 50) throw new Error(`população simulada baixa demais: ${bots.length}`)

for (const b of bots) {
  if (!b.bot.purpose?.label || !b.bot.purpose?.kind) {
    throw new Error(`bot sem propósito explícito: ${b.name}`)
  }
}

const primaryCounts = new Map<string, number>()
for (const name of BOT_NAMES) {
  const p = botPersonalityForName(name)
  primaryCounts.set(p.primary, (primaryCounts.get(p.primary) || 0) + 1)
}
for (const focus of BOT_FOCUS_TYPES) {
  if ((primaryCounts.get(focus) || 0) < 5) {
    throw new Error(`perfil ${focus} sub-representado: ${primaryCounts.get(focus) || 0}`)
  }
}

// Comportamentos temporários não são classes rígidas: o mesmo bot pode escolher
// focos diferentes ao longo de várias decisões contextuais.
const sample: any = bots[0]
const seen = new Set<string>()
for (let i = 0; i < 80; i++) {
  sample.bot.focusUntil = 0
  seen.add(sample.bot.chooseFocus(Date.now() + i * 1000, true))
}
if (seen.size < 2) throw new Error(`foco temporário ficou rígido: ${[...seen].join(',')}`)

// PvP coletivo inteligente: ajuda um aliado, mas não deve selecionar aliado como inimigo.
const a: any = bots[0]
const rival: any = bots.find((b: any) => b.village !== a.village)
const ally: any = bots.find((b: any) => b.id !== a.id && b.village === a.village)
if (!rival || !ally) throw new Error('amostra insuficiente para teste de PvP coletivo')
a.x = ally.x = 100
a.y = ally.y = 100
rival.x = 150
rival.y = 100
a.dead = ally.dead = rival.dead = false
ally.bot.pvpTargetId = rival.id
const target = a.bot.findPvpTarget()
if (!target || target.id !== rival.id) throw new Error('bot não ajudou aliado contra rival próximo')

console.log(`[bot-ai] OK: população=${bots.length}, focos temporários=${[...seen].join('/')}`)
