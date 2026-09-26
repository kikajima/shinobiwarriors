import { Game } from './src/game'
import { POTION, maxChOf, maxHpOf } from './src/data'
import { addItem, countItem, removeItem } from './src/inventory'

const game = new Game({} as any)
const bot: any = [...game.players.values()].find((p: any) => p.kind === 'bot' && p.bot)
if (!bot) throw new Error('nenhum bot disponível')

const setPotionCount = (qty: number) => {
  const current = countItem(bot.inventory, 'healing_potion')
  if (current > 0) removeItem(bot.inventory, 'healing_potion', current)
  if (qty > 0) addItem(bot.inventory, 'healing_potion', qty)
  game.syncPotionCount(bot)
}

// Fonte: recuperação real e física na vila.
const fountain = game.world.fountains.find((f: any) => f.village === bot.village)
if (!fountain) throw new Error('fonte da vila não encontrada')
bot.x = fountain.x
bot.y = fountain.y
bot.hp = 1
bot.ch = 1
if (!game.botUseFountain(bot)) throw new Error('bot não conseguiu usar a fonte')
if (bot.hp !== maxHpOf(bot.lv) || bot.ch !== maxChOf(bot.lv)) {
  throw new Error('fonte não recuperou HP/chakra do bot')
}

// Loja: paga com ryō, respeita estoque desejado e reserva.
const shop = game.world.shops.find((s: any) => s.village === bot.village)
if (!shop) throw new Error('loja da vila não encontrada')
bot.x = shop.x
bot.y = shop.y
setPotionCount(0)
bot.gold = 200
const bought = game.botBuyPotions(bot, 5, 50)
if (bought !== 5 || bot.pot !== 5 || bot.gold !== 200 - 5 * POTION.price) {
  throw new Error(`compra inválida: bought=${bought} pot=${bot.pot} gold=${bot.gold}`)
}

// Reserva de ryō é respeitada quando já existe pelo menos uma poção.
setPotionCount(2)
bot.gold = 100
const reserved = game.botBuyPotions(bot, 6, 80)
if (reserved !== 0 || bot.pot !== 2 || bot.gold !== 100) {
  throw new Error('bot gastou a reserva de ryō sem necessidade')
}

// Com zero poções, compra uma unidade de emergência mesmo usando parte da reserva.
setPotionCount(0)
bot.gold = 100
const emergency = game.botBuyPotions(bot, 6, 80)
if (emergency !== 1 || bot.pot !== 1 || bot.gold !== 75) {
  throw new Error('compra de emergência não funcionou')
}

// Sem dinheiro não existe reposição mágica de poções.
setPotionCount(0)
bot.gold = 0
bot.hp = maxHpOf(bot.lv)
bot.ch = maxChOf(bot.lv)
bot.bot.beginVillageRoutine(Date.now())
bot.bot.villageTask = 'shop'
bot.bot.thinkRest(.05, Date.now())
if (bot.pot !== 0) throw new Error('bot recebeu poção grátis na vila')

// Missão forte demais deve ser adiada em favor de treino.
bot.mi = 4 // boss
bot.lv = 1
setPotionCount(POTION.max)
if (bot.bot.missionReady()) throw new Error('bot Lv1 considerou missão do boss segura')
bot.bot.focus = 'mission'
bot.bot.focusUntil = Date.now() + 60000
bot.bot.startFocusedActivity(Date.now())
if (bot.bot.purpose.kind === 'mission' || bot.bot.purpose.kind === 'pvp') {
  throw new Error(`bot iniciante escolheu objetivo inadequado: ${bot.bot.purpose.kind}`)
}

// Ao chegar ao nível adequado, a missão do boss passa a ser considerada.
bot.lv = 10
setPotionCount(4)
if (!bot.bot.missionReady()) throw new Error('bot preparado não liberou missão do boss')

// Pausa social é curta: depois do preparo o bot deve sair para progredir.
bot.x = fountain.x
bot.y = fountain.y
bot.hp = maxHpOf(bot.lv)
bot.ch = maxChOf(bot.lv)
setPotionCount(bot.bot.desiredPotionStock())
bot.bot.beginVillageRoutine(Date.now())
bot.bot.villageTask = 'social'
bot.bot.villageTaskUntil = Date.now() - 1
bot.bot.thinkRest(.05, Date.now())
if (bot.bot.state === 'rest' && bot.bot.villageTask === 'social') {
  throw new Error('bot ficou estacionado socializando na vila')
}

console.log(`[bot-economy] OK: fonte, compras, reserva, missão segura e saída da vila`)
