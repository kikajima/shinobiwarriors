// Visualização ASCII do mundo gerado
import { genWorld, walkable } from './src/world'
import { findBotPath } from './src/bots'

const world = genWorld()
console.log(`tiles=${world.tiles.length} (esperado 64)`)
console.log(`row length=${world.tiles[0].length} (esperado 64)`)
console.log(`objects=${world.objects.length}`)
const byKind: Record<string, number> = {}
for (const o of world.objects) byKind[o.k] = (byKind[o.k] || 0) + 1
console.log('objetos por tipo:', JSON.stringify(byKind))

// desenha mapa: tiles + objetos (X) + spawns (letras)
const chars: Record<string, string> = { bandido: 'b', sapo: 's', gennin: 'g', zetsu: 'z', boss: 'B' }
const grid = world.tiles.map((r) => r.split(''))
for (const o of world.objects) {
  const c = o.k === 'house' ? 'H' : o.k === 'shop' ? 'L' : o.k === 'fountain' ? 'F' : o.k === 'fence' ? 'x' : 'T'
  grid[o.y][o.x] = c
}
for (const sz of world.spawns) {
  const n = chars[sz.monster]
  grid[Math.floor((sz.y1 + sz.y2) / 2)][Math.floor((sz.x1 + sz.x2) / 2)] = n
}
console.log('    ' + Array.from({ length: 64 }, (_, i) => (i % 10 === 0 ? '|' : ' ')).join(''))
for (let y = 0; y < 64; y++) {
  console.log(String(y).padStart(3) + ' ' + grid[y].join(''))
}

// valida walkable nos anchors
const probes: Array<[string, number, number]> = [
  ['vila', 32.5, 35], ['campo', 50, 32], ['floresta', 32, 15], ['lago', 34, 46], ['vale', 15, 32],
]
for (const [n, x, y] of probes) {
  const ok = walkable(world, x * 32, y * 32)
  console.log(`walkable ${n}:`, ok)
  if (!ok) throw new Error(`anchor bloqueada: ${n}`)
}

const village = { x: 32.5 * 32, y: 35.5 * 32 }
for (const [name, x, y] of probes.filter(([name]) => name !== 'vila')) {
  const route = findBotPath(world, village.x, village.y, (x + .5) * 32, (y + .5) * 32)
  console.log(`route vila -> ${name}: ${route.length} waypoints`)
  if (!route.length) throw new Error(`sem rota caminhável da vila para ${name}`)
  for (const point of route) {
    if (!walkable(world, point.x, point.y)) {
      throw new Error(`rota para ${name} contém waypoint bloqueado em ${point.x},${point.y}`)
    }
  }
}

console.log('map/pathfinding OK')
