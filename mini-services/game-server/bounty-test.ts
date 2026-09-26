import { Game } from './src/game'
import { BOUNTY, maxHpOf } from './src/data'
import { VILLAGE_SPAWNS, zoneAt } from './src/world'

const game = new Game({} as any)

if (game.world.bountyNpcs.length !== 4) {
  throw new Error(`esperava 4 Oficiais de Caçadas, veio ${game.world.bountyNpcs.length}`)
}
for (const npc of game.world.bountyNpcs) {
  if (!game.canStand(npc.x, npc.y)) throw new Error(`NPC de bounty bloqueado: ${npc.village}`)
  if (!zoneAt(game.world, npc.x, npc.y).safe) throw new Error(`NPC de bounty fora da vila: ${npc.village}`)
}

const bots: any[] = [...game.players.values()].filter((p: any) => p.kind === 'bot')
const hunter = bots[0]
if (!hunter) throw new Error('sem bot caçador')
hunter.lv = 6
hunter.hp = maxHpOf(hunter.lv)
hunter.pot = 5

const baseNow = Date.now()
const contract = game.assignBounty(hunter, baseNow)
if (!contract) throw new Error('não foi possível atribuir bounty')
if (contract.targetVillage === hunter.village) throw new Error('bounty selecionou aliado da mesma vila')
if (contract.expiresAt !== baseNow + BOUNTY.duration) throw new Error('duração da bounty incorreta')

const target: any = game.playerByName(contract.targetName)
if (!target) throw new Error('alvo atribuído não está online')
if (target.id === hunter.id) throw new Error('bot recebeu bounty em si mesmo')

// Tracking entrega pista e respeita cooldown.
hunter.x = 128.5 * 32
hunter.y = 112.5 * 32
target.x = 128.5 * 32
target.y = 145.5 * 32
target.dead = false
const clue1 = game.trackBounty(hunter, baseNow, true)
if (!clue1.ok || !clue1.zone || !clue1.direction || !clue1.distance) throw new Error('tracking não retornou pista útil')
const clueCooldown = game.trackBounty(hunter, baseNow + 1, true)
if (clueCooldown.ok || !clueCooldown.cooldown) throw new Error('tracking ignorou cooldown')
const clue2 = game.trackBounty(hunter, baseNow + BOUNTY.trackCooldown + 1, true)
if (!clue2.ok) throw new Error('tracking não liberou após cooldown')

// Bot visita o NPC, pega contrato e usa tracking para sair em perseguição.
const hunter2: any = bots.find((b) => b.id !== hunter.id && b.village !== target.village) || bots[1]
if (!hunter2) throw new Error('sem segundo bot')
hunter2.lv = 6
hunter2.pot = 5
hunter2.bounty = null
const npc = game.world.bountyNpcs.find((n: any) => n.village === hunter2.village)
if (!npc) throw new Error('NPC da vila do segundo bot ausente')
hunter2.x = npc.x
hunter2.y = npc.y
hunter2.bot.villageTask = 'bounty'
const botNow = Date.now()
hunter2.bot.thinkRest(.05, botNow)
if (!hunter2.bounty) throw new Error('bot não pegou contrato no Oficial de Caçadas')

const hunted: any = game.playerByName(hunter2.bounty.targetName)
if (!hunted) throw new Error('alvo do bot não encontrado')
hunted.dead = false
hunted.x = 128.5 * 32
hunted.y = 150.5 * 32
hunter2.x = 128.5 * 32
hunter2.y = 105.5 * 32
hunter2.bounty.nextTrackAt = 0
hunter2.bot.nextBountyPlanAt = 0
hunter2.bot.focus = 'pvp'
if (!hunter2.bot.planBountyHunt(botNow + BOUNTY.trackCooldown + 1)) throw new Error('bot não planejou perseguição da bounty')
if (hunter2.bot.purpose.kind !== 'bounty' || !hunter2.bot.route.length) throw new Error('bot não criou rota de bounty')

// Se o alvo se refugiar na vila, a última pista do bot deve virar um ponto de
// espera fora da safe zone. Durante o cooldown ele não pode perseguir a posição
// interna do alvo e voltar a invadir/atacar de dentro da vila.
const safeSpawn = VILLAGE_SPAWNS[hunted.village]
hunted.x = safeSpawn.x
hunted.y = safeSpawn.y
hunted.dead = false
hunter2.bounty.nextTrackAt = 0
hunter2.bot.nextBountyPlanAt = 0
hunter2.bot.route = []
hunter2.bot.routeI = 0
const safePlanNow = botNow + BOUNTY.trackCooldown * 2 + 5
if (!hunter2.bot.planBountyHunt(safePlanNow)) throw new Error('bot não criou ponto de espera para alvo em safe zone')
const safeLastKnown = hunter2.bot.bountyLastKnown
if (!safeLastKnown || zoneAt(game.world, safeLastKnown.x, safeLastKnown.y).safe) {
  throw new Error('bot guardou posição interna da vila como última pista da bounty')
}
hunter2.bot.route = []
hunter2.bot.routeI = 0
hunter2.bot.nextBountyPlanAt = 0
if (!hunter2.bot.planBountyHunt(safePlanNow + 1)) throw new Error('bot perdeu a espera externa durante cooldown do tracking')
const cooldownGoal = hunter2.bot.route[hunter2.bot.route.length - 1]
if (!cooldownGoal || zoneAt(game.world, cooldownGoal.x, cooldownGoal.y).safe) {
  throw new Error('cooldown do tracking levou o bot de volta para dentro da safe zone')
}

// Abate PvP paga recompensa base em XP+ryō e bônus do contrato.
const victim: any = hunted
hunter2.x = 128.5 * 32
hunter2.y = 120.5 * 32
victim.x = 128.5 * 32
victim.y = 121.5 * 32
victim.dead = false
victim.hp = maxHpOf(victim.lv)
const goldBefore = hunter2.gold
const levelBefore = hunter2.lv
const xpBefore = hunter2.xp
const expectedBonusGold = hunter2.bounty.rewardGold
game.killPlayerPvp(victim, hunter2)
if (hunter2.gold <= goldBefore) throw new Error('abate PvP não concedeu ryō')
if (hunter2.lv === levelBefore && hunter2.xp <= xpBefore) throw new Error('abate PvP não concedeu XP')
if (hunter2.bounty) throw new Error('bounty não foi concluída após matar o alvo')
if (hunter2.gold < goldBefore + expectedBonusGold) throw new Error('bônus de ryō da bounty não foi pago')

console.log('[bounty] OK: NPC, rival, tracking, bot hunter e recompensas PvP')
