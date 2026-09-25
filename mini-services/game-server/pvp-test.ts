import { Game } from './src/game'

const game = new Game({} as any)
const players = [...game.players.values()]
const attacker = players[0]
const target = players[1]

if (!attacker || !target) throw new Error('PvP test precisa de dois jogadores')

attacker.dead = false
target.dead = false

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

// Centro da Vila da Folha (zona safe): PvP deve ser completamente bloqueado.
attacker.x = 32.5 * 32
attacker.y = 35 * 32
target.x = 34 * 32
target.y = 35 * 32
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

console.log('[pvp] OK: dano fora da vila e bloqueio em zona segura')
