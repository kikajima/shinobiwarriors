import { Game } from './src/game'
import { DESTRUCTIBLE_HP } from './src/world'

const game = new Game({} as any)
const attacker = [...game.players.values()][0]
if (!attacker) throw new Error('destruction test precisa de um ninja')

const obj = game.world.objects.find((o: any) =>
  ['tree', 'tree2', 'deadtree', 'rock'].includes(o.k) && typeof o.hp === 'number',
)
if (!obj) throw new Error('nenhum objeto destrutível encontrado')

const original = { id: obj.id, k: obj.k, x: obj.x, y: obj.y }
const beforeCount = game.world.objects.length
const tileIndex = obj.y * game.world.w + obj.x
if (game.world.blocked[tileIndex] !== 1) throw new Error('objeto destrutível deveria bloquear o tile')

const brokenAt = Date.now()
const ok = game.hitWorldObject(obj, 9999, attacker)
if (!ok) throw new Error('jutsu não conseguiu danificar objeto destrutível')
if (game.world.objects.some((o: any) => o.id === obj.id)) throw new Error('objeto destruído continuou no mundo')
if (game.world.objects.length !== beforeCount - 1) throw new Error('contagem de objetos não diminuiu')
if (game.world.blocked[tileIndex] !== 0) throw new Error('tile continuou bloqueado após destruição')

const scheduled = game.destroyedWorld.get(original.id)
if (!scheduled || scheduled.respawnAt <= brokenAt) throw new Error('objeto quebrado não recebeu timer individual de regeneração')

// Libera a região e força somente este timer a vencer.
for (const p of game.players.values()) { p.x = 16; p.y = 16 }
for (const m of game.monsters.values()) { m.x = 16; m.y = 16 }
scheduled.respawnAt = Date.now() - 1
game.lastWorldRegen = 0
game.updateWorldRespawns(Date.now())

const restored = game.world.objects.find((o: any) => o.id === original.id)
if (!restored) throw new Error('objeto não regenerou')
if (restored.k !== original.k || restored.x !== original.x || restored.y !== original.y) throw new Error('objeto regenerou em outro tile')
if (restored.hp !== DESTRUCTIBLE_HP[original.k]) throw new Error('objeto regenerou sem HP completo')
if (game.world.blocked[tileIndex] !== 1) throw new Error('colisão não voltou após regeneração')
if (game.destroyedWorld.has(original.id)) throw new Error('timer não foi removido após regeneração')

console.log(`[destruction] OK: ${original.k} regenerou organicamente no mesmo tile`)
