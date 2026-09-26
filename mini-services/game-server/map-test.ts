// Validação estrutural do mundo 256x256 e das quatro vilas.
import { MAX_LEVEL } from './src/data'
import { genWorld, walkable, VILLAGE_SPAWNS } from './src/world'
import { findBotPath } from './src/bots'

const world = genWorld()
if (world.w !== 256 || world.h !== 256) throw new Error(`mapa deveria ser 256x256, veio ${world.w}x${world.h}`)
if (world.tiles.length !== 256 || world.tiles.some((r) => r.length !== 256)) throw new Error('grade de tiles inválida')
if (MAX_LEVEL !== 200) throw new Error(`level cap deveria ser 200, veio ${MAX_LEVEL}`)
if (world.fountains.length !== 4) throw new Error(`esperava 4 fontes, veio ${world.fountains.length}`)
if (world.shops.length !== 12) throw new Error(`esperava 12 lojas, veio ${world.shops.length}`)

const villages = ['folha', 'areia', 'nevoa', 'terra'] as const
for (const id of villages) {
  const spawn = VILLAGE_SPAWNS[id]
  if (!walkable(world, spawn.x, spawn.y)) throw new Error(`spawn bloqueado: ${id}`)
  const zone = world.zones.find((z) => z.village === id)
  if (!zone?.safe) throw new Error(`zona segura ausente: ${id}`)
  const shops = world.shops.filter((s) => s.village === id)
  if (shops.length !== 3) throw new Error(`${id} deveria ter 3 lojas, veio ${shops.length}`)
  if (shops.filter((s) => s.kind === 'supply').length !== 2) throw new Error(`${id} deveria ter 2 lojas de suprimentos`)
  if (shops.filter((s) => s.kind === 'equipment').length !== 1) throw new Error(`${id} deveria ter 1 arsenal`)
  if (shops.some((s) => !walkable(world, s.x, s.y))) throw new Error(`NPC de loja bloqueado em ${id}`)
}

const objectIds = new Set(world.objects.map((o) => o.id))
if (objectIds.size !== world.objects.length) throw new Error('IDs de objetos do mundo não são únicos')
const destructibles = world.objects.filter((o) => typeof o.hp === 'number')
if (destructibles.length < 500) throw new Error(`pouco cenário destrutível para mapa grande: ${destructibles.length}`)

const totalMobs = world.spawns.reduce((sum, z) => sum + z.count, 0)
if (totalMobs < 650) throw new Error(`densidade de mobs baixa: ${totalMobs}`)
console.log(`world=${world.w}x${world.h} objects=${world.objects.length} destructibles=${destructibles.length} plannedMobs=${totalMobs} shops=${world.shops.length}`)

const center = { x: 128.5 * 32, y: 128.5 * 32 }
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

console.log('map/pathfinding 256x256 + 4 villages OK')
