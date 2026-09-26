import { Game } from './src/game'
import { BOT_NAMES, MAX_LEVEL, MISSIONS, xpNeedOf } from './src/data'
import { BOT_FOCUS_TYPES, BOT_TARGET, botPersonalityForName } from './src/bots'

if (MAX_LEVEL !== 200) throw new Error(`MAX_LEVEL inválido: ${MAX_LEVEL}`)
if (BOT_TARGET !== 60) throw new Error(`BOT_TARGET deveria ser 60, veio ${BOT_TARGET}`)

const profiles = new Set(BOT_NAMES.map((name) => botPersonalityForName(name).primary))
for (const focus of BOT_FOCUS_TYPES) {
  if (!profiles.has(focus)) throw new Error(`perfil de bot ausente na população de nomes: ${focus}`)
}

const game = new Game({} as any)
const bots = [...game.players.values()].filter((p: any) => p.kind === 'bot')
if (bots.length !== BOT_TARGET) throw new Error(`esperava ${BOT_TARGET} bots iniciais, veio ${bots.length}`)

const preProgressed = bots.filter((p: any) => p.lv !== 1 || p.xp !== 0)
if (preProgressed.length) {
  throw new Error(`bots novos devem iniciar no nível 1/0 XP: ${preProgressed.map((p: any) => `${p.name}:Lv${p.lv}/${p.xp}`).join(', ')}`)
}

const villages = new Map<string, number>()
for (const b of bots) villages.set(b.village, (villages.get(b.village) || 0) + 1)
const counts = [...villages.values()]
if (villages.size !== 4 || Math.max(...counts) - Math.min(...counts) > 1) {
  throw new Error(`distribuição de vilas desequilibrada: ${JSON.stringify(Object.fromEntries(villages))}`)
}

const activeProfiles = new Set(bots.map((b: any) => b.bot?.personality?.primary).filter(Boolean))
if (activeProfiles.size < 4) {
  throw new Error(`pouca diversidade de personalidade entre bots conectados: ${[...activeProfiles].join(',')}`)
}

const bot: any = bots[0]
const primaryBefore = bot.bot.personality.primary
bot.bot.focusUntil = 0
bot.bot.chooseFocus(Date.now(), true)
if (bot.bot.personality.primary !== primaryBefore) {
  throw new Error('personalidade-base mudou ao trocar foco temporário')
}

game.gainXp(bot, xpNeedOf(1))
if (bot.lv !== 2) throw new Error(`bot não evoluiu organicamente por XP: Lv${bot.lv}`)

// Simula a última eliminação necessária da primeira missão.
bot.mi = 0
bot.mp = MISSIONS[0].need - 1
const goldBefore = bot.gold
game.progressMission(bot, 'bandido')
if (bot.mi !== 1 || bot.mp !== 0) throw new Error('bot não avançou a missão ao completar o objetivo')
if (bot.gold <= goldBefore) throw new Error('bot não recebeu recompensa da missão')

game.rememberBot(bot)
const profile = game.botProfiles.get(bot.name.toLowerCase())
if (!profile || profile.lv !== bot.lv || profile.xp !== bot.xp || profile.mi !== bot.mi || profile.village !== bot.village) {
  throw new Error('perfil persistente do bot não preservou sua progressão')
}

console.log(`[progression] OK: cap=${MAX_LEVEL}, bots=${bots.length}, perfis=${[...activeProfiles].join('/')}, vilas=${JSON.stringify(Object.fromEntries(villages))}`)
