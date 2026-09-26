import { Game } from './src/game'
import { MAX_LEVEL, MISSIONS, xpNeedOf } from './src/data'

if (MAX_LEVEL !== 200) throw new Error(`MAX_LEVEL inválido: ${MAX_LEVEL}`)

const game = new Game({} as any)
const bots = [...game.players.values()].filter((p: any) => p.kind === 'bot')
if (!bots.length) throw new Error('nenhum bot encontrado')

const preProgressed = bots.filter((p: any) => p.lv !== 1 || p.xp !== 0)
if (preProgressed.length) {
  throw new Error(`bots novos devem iniciar no nível 1/0 XP: ${preProgressed.map((p: any) => `${p.name}:Lv${p.lv}/${p.xp}`).join(', ')}`)
}

const bot: any = bots[0]
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

console.log(`[progression] OK: cap=${MAX_LEVEL}, ${bots.length} bots começam Lv1 e evoluem por XP/missões`)
