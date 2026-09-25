import { Game } from './src/game'

const game = new Game({} as any)
const attacker = [...game.players.values()][0]
if (!attacker) throw new Error('destruction test precisa de um ninja')

const obj = game.world.objects.find((o: any) =>
  ['tree', 'tree2', 'deadtree', 'rock'].includes(o.k) && typeof o.hp === 'number',
)
if (!obj) throw new Error('nenhum objeto destrutível encontrado')

const beforeCount = game.world.objects.length
const tileIndex = obj.y * game.world.w + obj.x
if (game.world.blocked[tileIndex] !== 1) throw new Error('objeto destrutível deveria bloquear o tile')

const ok = game.hitWorldObject(obj, 9999, attacker)
if (!ok) throw new Error('jutsu não conseguiu danificar objeto destrutível')
if (game.world.objects.some((o: any) => o.id === obj.id)) throw new Error('objeto destruído continuou no mundo')
if (game.world.objects.length !== beforeCount - 1) throw new Error('contagem de objetos não diminuiu')
if (game.world.blocked[tileIndex] !== 0) throw new Error('tile continuou bloqueado após destruição')

console.log(`[destruction] OK: ${obj.k} removido e colisão liberada`)
