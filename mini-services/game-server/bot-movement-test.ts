import { Game } from './src/game'
import { findBotPath } from './src/bots'
import { VILLAGE_SPAWNS } from './src/world'

const game = new Game({} as any)
const bot: any = [...game.players.values()].find((p: any) => p.kind === 'bot' && p.bot)
if (!bot) throw new Error('nenhum bot para testar movimento')

const center = { x: 128.5 * 32, y: 128.5 * 32 }
for (const [village, start] of Object.entries(VILLAGE_SPAWNS)) {
  const route = findBotPath(game.world, start.x, start.y, center.x, center.y)
  if (!route.length) throw new Error(`rota vazia: ${village} -> centro`)
  // Amostra cada segmento; a rota comprimida não pode atravessar obstáculos.
  let ax = start.x, ay = start.y
  for (const wp of route) {
    const d = Math.hypot(wp.x - ax, wp.y - ay)
    const steps = Math.max(1, Math.ceil(d / 12))
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      const x = ax + (wp.x - ax) * t
      const y = ay + (wp.y - ay) * t
      if (!game.canStand(x, y)) throw new Error(`rota atravessa obstáculo: ${village} em ${Math.round(x)},${Math.round(y)}`)
    }
    ax = wp.x; ay = wp.y
  }
}

// Direção do sprite deve refletir o deslocamento REAL feito, não o destino pedido.
bot.x = center.x
bot.y = center.y
const ox = bot.x, oy = bot.y
const moved = bot.bot.stepToward(bot.x + 100, bot.y + 100, 22)
if (!moved) throw new Error('bot não conseguiu dar passo em área livre')
const dx = bot.x - ox, dy = bot.y - oy
const oct = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8
const expectedDir = (oct + 6) % 8
if (bot.dir !== expectedDir) {
  throw new Error(`direção não acompanha movimento real: dir=${bot.dir}, esperado=${expectedDir}, delta=${dx.toFixed(1)},${dy.toFixed(1)}`)
}

// Toda viagem deve ter propósito e rota válida; nunca fallback cego em linha reta.
bot.bot.focus = 'mission'
bot.bot.focusUntil = Date.now() + 60_000
bot.bot.startFocusedActivity(Date.now())
if (!bot.bot.purpose?.label) throw new Error('atividade iniciou sem propósito')
if (bot.bot.state === 'travel' && !bot.bot.route.length) throw new Error('bot entrou em travel sem rota válida')
if (bot.bot.state === 'travel' && !bot.bot.routeGoal) throw new Error('bot entrou em travel sem objetivo de rota')

console.log(`[bot-movement] OK: propósito="${bot.bot.purpose.label}", waypoints=${bot.bot.route.length}, dir=${bot.dir}`)
