import { Game } from './src/game'

const game = new Game({} as any)
const players = [...game.players.values()]
const attacker = players[0]
const target = players[1]

if (!attacker || !target) throw new Error('PvP test precisa de dois jogadores')

attacker.dead = false
target.dead = false
attacker.village = 'folha'
target.village = 'areia'

// Área externa à Vila da Folha (tile ~3,3): PvP deve funcionar.
attacker.x = 100
attacker.y = 100
target.x = 140
target.y = 100
attacker.hp = 200
target.hp = 200

if (!game.canPvp(attacker, target)) {
  throw new Error('PvP deveria estar ativo fora da zona segura')
}

const hpBefore = target.hp
const hit = game.hitPlayer(target, attacker, 20, 1, false)
if (!hit || target.hp >= hpBefore) {
  throw new Error('Golpe PvP não reduziu HP fora da zona segura')
}

// Aliados da mesma vila nunca podem causar dano entre si, mesmo fora da zona segura.
target.village = attacker.village
target.hp = 200
const allyHpBefore = target.hp
if (game.canPvp(attacker, target) || game.hitPlayer(target, attacker, 20, 1, false) || target.hp !== allyHpBefore) {
  throw new Error('PvP entre jogadores da mesma vila não foi bloqueado')
}
target.village = 'areia'

// XP PvP: recompensa rival, mas bloqueia farm repetido da mesma vítima por 3 minutos.
const rival = players[2]
if (!rival) throw new Error('PvP test precisa de um terceiro ninja')
attacker.lv = 5
rival.lv = 6
attacker.village = 'folha'
rival.village = 'terra'
const reward1 = game.pvpXpReward(attacker, rival, 1_000_000)
const rewardRepeat = game.pvpXpReward(attacker, rival, 1_001_000)
const rewardAfterCooldown = game.pvpXpReward(attacker, rival, 1_181_000)
if (reward1 <= 0 || rewardRepeat !== 0 || rewardAfterCooldown <= 0) {
  throw new Error(`anti-farm PvP inválido: ${reward1}/${rewardRepeat}/${rewardAfterCooldown}`)
}

// Centro da Vila da Folha (zona safe): PvP deve ser completamente bloqueado.
attacker.x = 52.5 * 32
attacker.y = 55 * 32
target.x = 54 * 32
target.y = 55 * 32
attacker.dead = false
target.dead = false
target.hp = 200

if (game.canPvp(attacker, target)) {
  throw new Error('PvP não pode ficar ativo dentro da Vila da Folha')
}

const safeHpBefore = target.hp
const safeHit = game.hitPlayer(target, attacker, 20, 1, false)
if (safeHit || target.hp !== safeHpBefore) {
  throw new Error('Zona segura permitiu dano PvP')
}

console.log('[pvp] OK: facções rivais, aliados, zona segura e XP anti-farm')
