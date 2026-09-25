// Validação estrutural do mundo 128x128 e das quatro vilas.
import { genWorld, walkable, VILLAGE_SPAWNS } from './src/world'
import { findBotPath } from './src/bots'

const world = genWorld()
if (world.w !== 128 || world.h !== 128) throw new Error(`mapa deveria ser 128x128, veio ${world.w}x${world.h}`)
if (world.tiles.length !== 128 || world.tiles.some((r) => r.length !== 128)) throw new Error('grade de tiles inválida')
if (world.fountains.length !== 4) throw new Error(`esperava 4 fontes, veio ${world.fountains.length}`)

const villages = ['folha', 'areia', 'nevoa', 'terra'] as const
for (const id of villages) {
  const spawn = VILLAGE_SPAWNS[id]
  if (!walkable(world, spawn.x, spawn.y)) throw new Error(`spawn bloqueado: ${id}`)
  const zone = world.zones.find((z) => z.village === id)
  if (!zone?.safe) throw new Error(`zona segura ausente: ${id}`)
}

const totalMobs = world.spawns.reduce((sum, z) => sum + z.count, 0)
if (totalMobs < 180) throw new Error(`densidade de mobs baixa: ${totalMobs}`)
console.log(`world=${world.w}x${world.h} objects=${world.objects.length} plannedMobs=${totalMobs}`)

// Toda vila deve conseguir alcançar a fronteira central e as outras vilas.
const center = { x: 64.5 * 32, y: 64.5 * 32 }
for (const id of villages) {
  const start = VILLAGE_SPAWNS[id]
  const toCenter = findBotPath(world, start.x, start.y, center.x, center.y)
  if (!toCenter.length) throw new Error(`sem rota ${id} -> centro`)
  for (const other of villages) {
    if (other === id) continue
    const end = VILLAGE_SPAWNS[other]
    const route = findBotPath(world, start.x, start.y, end.x, end.y)
    if (!route.length) throw new Error(`sem rota ${id} -> ${other}`)
  }
}

console.log('map/pathfinding 4-villages OK')
