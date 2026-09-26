import { Game } from './src/game'
import { VILLAGE_EXITS, zoneAt, walkable } from './src/world'

const game = new Game({} as any)

// Todas as saídas precisam existir, ser caminháveis e já estar fora da safe zone.
for (const [village, exits] of Object.entries(VILLAGE_EXITS)) {
  if (exits.length !== 4) throw new Error(`${village}: esperava 4 saídas, veio ${exits.length}`)
  for (const exit of exits) {
    if (!walkable(game.world, exit.x, exit.y)) {
      throw new Error(`${village}/${exit.side}: saída bloqueada`)
    }
    if (zoneAt(game.world, exit.x, exit.y).safe) {
      throw new Error(`${village}/${exit.side}: saída ainda está dentro da zona segura`)
    }
  }
}

const bot: any = [...game.players.values()].find((p: any) => p.kind === 'bot' && p.bot)
const monster: any = [...game.monsters.values()].find((m: any) => !m.dead)
if (!bot || !monster) throw new Error('amostra insuficiente')

const south = VILLAGE_EXITS[bot.village].find((e) => e.side === 'south')!
if (!south) throw new Error('saída sul ausente')

// Fica dois tiles para dentro do portão, ainda em safe zone.
// O monstro fica do lado de fora, próximo o bastante para reproduzir o bug antigo.
bot.x = south.x
bot.y = south.y - 64
if (!zoneAt(game.world, bot.x, bot.y).safe) throw new Error('posição de teste do bot deveria ser segura')
monster.x = south.x
monster.y = south.y
monster.spawnX = monster.x
monster.spawnY = monster.y
monster.dead = false
monster.hp = monster.maxHp

bot.bot.state = 'travel'
bot.bot.targetId = monster.id
bot.bot.purpose = { kind: 'hunt', label: 'teste de saída segura', since: Date.now(), targetId: monster.id }
if (!bot.bot.routeToPoint(monster.x, monster.y)) throw new Error('não encontrou rota pelo portão')

const crossesFormalExit = bot.bot.route.some((p: any) =>
  Math.hypot(p.x - south.x, p.y - south.y) < 18
)
if (!crossesFormalExit) throw new Error('rota para fora da vila não passou pelo portão formal')

// Mesmo com o alvo muito perto, não pode trocar para combate antes de sair.
bot.bot.thinkTravel(.05, Date.now())
if (bot.bot.state !== 'travel') {
  throw new Error(`bot iniciou combate ainda na vila: state=${bot.bot.state}`)
}

// Trava autoritativa: ataque básico e jutsu de dentro da safe zone não causam nada.
const hpBefore = monster.hp
game.basicAttack(bot, monster.x, monster.y)
if (monster.hp !== hpBefore) throw new Error('ataque básico saiu de dentro da zona segura')

const chBefore = bot.ch
const projectilesBefore = game.projectiles.size
const cast = game.castSkill(bot, 0, monster.x, monster.y)
if (cast !== false || bot.ch !== chBefore || game.projectiles.size !== projectilesBefore || monster.hp !== hpBefore) {
  throw new Error('jutsu foi iniciado de dentro da zona segura')
}

// Depois de cruzar o portão, o mesmo alvo pode ser engajado normalmente.
bot.x = south.x
bot.y = south.y
if (zoneAt(game.world, bot.x, bot.y).safe) throw new Error('bot deveria estar fora da safe zone')
bot.bot.state = 'travel'
bot.bot.targetId = monster.id
bot.bot.purpose = { kind: 'hunt', label: 'combate externo', since: Date.now(), targetId: monster.id }
bot.bot.thinkTravel(.05, Date.now())
if (bot.bot.state !== 'grind') throw new Error('bot não iniciou combate depois de sair da vila')

console.log('[bot-safe-zone] OK: portões formais + nenhum ataque de dentro da vila')
