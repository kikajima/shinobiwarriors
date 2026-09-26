// ============================================================
// Shinobi Online — mundo 256x256
// Quatro territórios, quatro vilas, fronteiras e comércio.
// ============================================================

import { MAP_SIZE, type VillageId } from './data'

export interface WorldObj {
  id: number
  k: string
  x: number
  y: number
  hp?: number
}

export interface Zone {
  n: string
  x1: number
  y1: number
  x2: number
  y2: number
  safe?: boolean
  village?: VillageId
}

export interface SpawnZone {
  monster: string
  count: number
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface ShopPoint {
  id: number
  name: string
  x: number
  y: number
  village: VillageId
}

export interface World {
  w: number
  h: number
  tiles: string[]
  objects: WorldObj[]
  zones: Zone[]
  spawns: SpawnZone[]
  blocked: Uint8Array
  fountains: { x: number; y: number; village: VillageId }[]
  fountain: { x: number; y: number }
  shops: ShopPoint[]
  shopNpc: { x: number; y: number }
}

export const VILLAGE_CENTERS: Record<VillageId, { x: number; y: number; name: string }> = {
  folha: { x: 52, y: 52, name: 'Vila da Folha' },
  areia: { x: 204, y: 52, name: 'Vila da Areia' },
  nevoa: { x: 52, y: 204, name: 'Vila da Névoa' },
  terra: { x: 204, y: 204, name: 'Vila da Terra' },
}

export const VILLAGE_SPAWNS: Record<VillageId, { x: number; y: number }> = Object.fromEntries(
  Object.entries(VILLAGE_CENTERS).map(([id, c]) => [
    id,
    { x: (c.x + 0.5) * 32, y: (c.y + 6.5) * 32 },
  ]),
) as Record<VillageId, { x: number; y: number }>

export const VILLAGE_EXITS: Record<VillageId, { x: number; y: number; side: 'north' | 'south' | 'west' | 'east' }[]> =
  Object.fromEntries(
    Object.entries(VILLAGE_CENTERS).map(([id, c]) => [id, [
      { x: (c.x + 0.5) * 32, y: (c.y - 15.5) * 32, side: 'north' as const },
      { x: (c.x + 0.5) * 32, y: (c.y + 15.5) * 32, side: 'south' as const },
      { x: (c.x - 15.5) * 32, y: (c.y + 0.5) * 32, side: 'west' as const },
      { x: (c.x + 15.5) * 32, y: (c.y + 0.5) * 32, side: 'east' as const },
    ]]),
  ) as Record<VillageId, { x: number; y: number; side: 'north' | 'south' | 'west' | 'east' }[]>

export const ZONE_ANCHORS: Record<string, { x: number; y: number }> = {
  vila: { x: 52, y: 58 },
  campo: { x: 128, y: 52 },
  floresta: { x: 42, y: 18 },
  lago: { x: 52, y: 234 },
  vale: { x: 204, y: 232 },
}

export const GRIND_ANCHORS: Record<string, { x: number; y: number }[]> = {
  campo: [
    { x: 82, y: 52 }, { x: 174, y: 52 }, { x: 82, y: 204 }, { x: 174, y: 204 },
    { x: 52, y: 82 }, { x: 204, y: 82 }, { x: 52, y: 174 }, { x: 204, y: 174 },
    { x: 112, y: 112 }, { x: 144, y: 112 }, { x: 112, y: 144 }, { x: 144, y: 144 },
  ],
  floresta: [
    { x: 18, y: 18 }, { x: 86, y: 18 }, { x: 18, y: 92 }, { x: 92, y: 92 },
    { x: 154, y: 18 }, { x: 236, y: 18 }, { x: 162, y: 92 }, { x: 236, y: 92 },
  ],
  lago: [
    { x: 18, y: 154 }, { x: 86, y: 154 }, { x: 18, y: 236 }, { x: 92, y: 236 },
    { x: 154, y: 154 }, { x: 236, y: 154 },
  ],
  vale: [
    { x: 154, y: 232 }, { x: 236, y: 232 }, { x: 162, y: 174 }, { x: 236, y: 174 },
    { x: 128, y: 104 }, { x: 128, y: 152 }, { x: 104, y: 128 }, { x: 152, y: 128 },
  ],
}

const ALL_ANCHORS = [
  ...Object.values(ZONE_ANCHORS),
  ...Object.values(GRIND_ANCHORS).flat(),
  ...Object.values(VILLAGE_CENTERS),
]

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const OBJ_FOOTPRINT: Record<string, [number, number]> = {
  tree: [1, 1],
  tree2: [1, 1],
  deadtree: [1, 1],
  rock: [1, 1],
  fence: [1, 1],
  post: [1, 1],
  lantern: [1, 1],
  sign: [1, 1],
  house: [3, 2],
  shop: [3, 2],
  fountain: [2, 2],
}

export const DESTRUCTIBLE_HP: Record<string, number> = {
  tree: 45,
  tree2: 55,
  deadtree: 30,
  rock: 85,
}

// Janelas de regeneração por objeto, contadas a partir da quebra.
export const DESTRUCTIBLE_REGEN_MS: Record<string, [number, number]> = {
  deadtree: [150_000, 270_000],
  tree: [240_000, 420_000],
  tree2: [300_000, 480_000],
  rock: [360_000, 600_000],
}

export function genWorld(): World {
  const w = MAP_SIZE
  const h = MAP_SIZE
  const half = Math.floor(MAP_SIZE / 2)
  const rnd = mulberry32(1337)
  const grid: string[][] = []
  const objects: WorldObj[] = []
  let nextObjectId = 1
  const blocked = new Uint8Array(w * h)

  const T = (x: number, y: number) => grid[y]?.[x] ?? ''
  const setT = (x: number, y: number, c: string) => {
    if (x >= 0 && x < w && y >= 0 && y < h) grid[y][x] = c
  }
  const inBounds = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h
  const isWalkTile = (x: number, y: number) => T(x, y) !== 'w'

  for (let y = 0; y < h; y++) {
    const row: string[] = []
    for (let x = 0; x < w; x++) row.push(rnd() < 0.24 ? ',' : '.')
    grid.push(row)
  }

  // Areia (NE)
  for (let y = 0; y < half; y++) {
    for (let x = half; x < w; x++) {
      setT(x, y, rnd() < 0.84 ? 's' : rnd() < 0.5 ? ',' : '.')
    }
  }

  // Névoa (SW)
  for (let y = half; y < h; y++) {
    for (let x = 0; x < half; x++) {
      if (rnd() < 0.14) setT(x, y, 'g')
    }
  }
  const mistPonds = [
    [18, 156, 8], [54, 160, 7], [94, 156, 9],
    [20, 232, 8], [58, 234, 10], [100, 228, 7],
    [38, 190, 6], [88, 202, 8],
  ] as const
  for (const [cx, cy, r] of mistPonds) {
    for (let y = cy - r - 2; y <= cy + r + 2; y++) {
      for (let x = cx - r - 2; x <= cx + r + 2; x++) {
        if (!inBounds(x, y)) continue
        const d = Math.hypot(x - cx, (y - cy) * 1.15) + (rnd() - 0.5) * 1.5
        if (d < r) setT(x, y, 'w')
        else if (d < r + 1.8) setT(x, y, 's')
      }
    }
  }

  // Terra (SE)
  for (let y = half; y < h; y++) {
    for (let x = half; x < w; x++) {
      const r = rnd()
      setT(x, y, r < 0.50 ? 's' : r < 0.74 ? ',' : '.')
    }
  }

  // Folha (NW)
  for (let y = 0; y < half; y++) {
    for (let x = 0; x < half; x++) {
      if (rnd() < 0.10) setT(x, y, 'g')
    }
  }

  const roadH = (y: number, x1: number, x2: number) => {
    for (let x = x1; x <= x2; x++) {
      setT(x, y, 'p')
      setT(x, y + 1, 'p')
    }
  }
  const roadV = (x: number, y1: number, y2: number) => {
    for (let y = y1; y <= y2; y++) {
      setT(x, y, 'p')
      setT(x + 1, y, 'p')
    }
  }

  // Rede principal liga as quatro vilas à fronteira central.
  roadH(52, 52, 204)
  roadH(128, 52, 204)
  roadH(204, 52, 204)
  roadV(52, 52, 204)
  roadV(128, 52, 204)
  roadV(204, 52, 204)

  const villageRects = Object.values(VILLAGE_CENTERS).map((c) => ({
    x1: c.x - 14, y1: c.y - 14, x2: c.x + 14, y2: c.y + 14,
  }))
  const inVillage = (x: number, y: number) =>
    villageRects.some((v) => x >= v.x1 && x <= v.x2 && y >= v.y1 && y <= v.y2)
  const nearAnchor = (x: number, y: number, r: number) =>
    ALL_ANCHORS.some((a) => Math.abs(a.x - x) <= r && Math.abs(a.y - y) <= r)

  const canPlace = (k: string, x: number, y: number) => {
    const [fw, fh] = OBJ_FOOTPRINT[k]
    for (let oy = 0; oy < fh; oy++) {
      for (let ox = 0; ox < fw; ox++) {
        const tx = x + ox, ty = y + oy
        if (!inBounds(tx, ty) || !isWalkTile(tx, ty) || blocked[ty * w + tx]) return false
        if (T(tx, ty) === 'p' || T(tx, ty) === 'c') return false
      }
    }
    return true
  }

  const placeObject = (k: string, x: number, y: number, force = false) => {
    const [fw, fh] = OBJ_FOOTPRINT[k]
    if (!force && !canPlace(k, x, y)) return null
    for (let oy = 0; oy < fh; oy++) {
      for (let ox = 0; ox < fw; ox++) {
        const tx = x + ox, ty = y + oy
        if (!inBounds(tx, ty)) return null
        blocked[ty * w + tx] = 1
      }
    }
    const hp = DESTRUCTIBLE_HP[k]
    const obj: WorldObj = { id: nextObjectId++, k, x, y, ...(hp ? { hp } : {}) }
    objects.push(obj)
    return obj
  }

  const fountains: { x: number; y: number; village: VillageId }[] = []
  const shops: ShopPoint[] = []
  let nextShopId = 1

  const shopNames: Record<VillageId, [string, string]> = {
    folha: ['Ichiraku Ramen', 'Armazém da Folha'],
    areia: ['Mercado do Deserto', 'Casa de Chá da Areia'],
    nevoa: ['Suprimentos da Névoa', 'Casa de Chá da Névoa'],
    terra: ['Armazém da Pedra', 'Casa de Chá da Terra'],
  }

  const placeVillage = (id: VillageId) => {
    const c = VILLAGE_CENTERS[id]

    for (let y = c.y - 6; y <= c.y + 6; y++) {
      for (let x = c.x - 6; x <= c.x + 6; x++) setT(x, y, 'c')
    }
    roadH(c.y, c.x - 14, c.x + 14)
    roadV(c.x, c.y - 14, c.y + 14)

    const houses: [number, number][] = [
      [c.x - 12, c.y - 11], [c.x - 3, c.y - 11], [c.x + 9, c.y - 11],
      [c.x - 12, c.y + 9], [c.x - 3, c.y + 9], [c.x + 9, c.y + 9],
    ]
    for (const [x, y] of houses) placeObject('house', x, y, true)

    const shopDefs: [number, number, string][] = [
      [c.x - 10, c.y - 5, shopNames[id][0]],
      [c.x + 7, c.y - 5, shopNames[id][1]],
    ]
    for (const [x, y, name] of shopDefs) {
      placeObject('shop', x, y, true)
      shops.push({
        id: nextShopId++,
        name,
        x: (x + 1.5) * 32,
        y: (y + 2.65) * 32,
        village: id,
      })
    }

    const fx = c.x + 5, fy = c.y + 3
    placeObject('fountain', fx, fy, true)
    fountains.push({ x: (fx + 1) * 32, y: (fy + 1) * 32, village: id })

    const r = 14
    for (let i = c.x - r; i <= c.x + r; i++) {
      const gate = i === c.x || i === c.x + 1
      if (!gate) {
        if (!blocked[(c.y - r) * w + i]) placeObject('fence', i, c.y - r, true)
        if (!blocked[(c.y + r) * w + i]) placeObject('fence', i, c.y + r, true)
      }
    }
    for (let i = c.y - r; i <= c.y + r; i++) {
      const gate = i === c.y || i === c.y + 1
      if (!gate) {
        if (!blocked[i * w + (c.x - r)]) placeObject('fence', c.x - r, i, true)
        if (!blocked[i * w + (c.x + r)]) placeObject('fence', c.x + r, i, true)
      }
    }

    for (const [dx, dy] of [
      [-8, -8], [0, -8], [8, -8],
      [-8, 7], [0, 7], [8, 7],
    ] as [number, number][]) {
      const tx = c.x + dx, ty = c.y + dy
      if (!blocked[ty * w + tx]) placeObject('lantern', tx, ty, true)
    }
    placeObject('sign', c.x, c.y + 13, true)
  }

  ;(['folha', 'areia', 'nevoa', 'terra'] as VillageId[]).forEach(placeVillage)

  // Decoração regional. Densidade controlada para o mapa grande.
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if (inVillage(x, y) || nearAnchor(x, y, 3)) continue
      if (T(x, y) === 'p' || T(x, y) === 'c' || T(x, y) === 'w') continue
      if (blocked[y * w + x]) continue

      const qx = x < half ? 0 : 1
      const qy = y < half ? 0 : 1
      const r = rnd()
      if (qx === 0 && qy === 0) {
        if (r < 0.040) placeObject(rnd() < 0.76 ? 'tree' : 'tree2', x, y)
        else if (r < 0.052) placeObject('rock', x, y)
        else if (r < 0.082) setT(x, y, '"')
      } else if (qx === 1 && qy === 0) {
        if (r < 0.032) placeObject('rock', x, y)
        else if (r < 0.043) placeObject('deadtree', x, y)
      } else if (qx === 0 && qy === 1) {
        if (r < 0.031) placeObject(rnd() < 0.7 ? 'tree2' : 'tree', x, y)
        else if (r < 0.044) placeObject('rock', x, y)
        else if (r < 0.075) setT(x, y, 'g')
      } else {
        if (r < 0.044) placeObject('rock', x, y)
        else if (r < 0.058) placeObject('deadtree', x, y)
      }
    }
  }

  for (const [x, y] of [
    [116, 116], [140, 116], [116, 140], [140, 140],
    [128, 112], [128, 144], [112, 128], [144, 128],
  ] as [number, number][]) {
    if (!blocked[y * w + x] && T(x, y) !== 'p') placeObject('post', x, y)
  }

  const zones: Zone[] = [
    { n: 'Vila da Folha', x1: 38, y1: 38, x2: 66, y2: 66, safe: true, village: 'folha' },
    { n: 'Vila da Areia', x1: 190, y1: 38, x2: 218, y2: 66, safe: true, village: 'areia' },
    { n: 'Vila da Névoa', x1: 38, y1: 190, x2: 66, y2: 218, safe: true, village: 'nevoa' },
    { n: 'Vila da Terra', x1: 190, y1: 190, x2: 218, y2: 218, safe: true, village: 'terra' },
    { n: 'Fronteiras Shinobi', x1: 120, y1: 0, x2: 135, y2: 255 },
    { n: 'Fronteiras Shinobi', x1: 0, y1: 120, x2: 255, y2: 135 },
    { n: 'Florestas da Folha', x1: 0, y1: 0, x2: 127, y2: 127 },
    { n: 'Deserto da Areia', x1: 128, y1: 0, x2: 255, y2: 127 },
    { n: 'Pântanos da Névoa', x1: 0, y1: 128, x2: 127, y2: 255 },
    { n: 'Montanhas da Terra', x1: 128, y1: 128, x2: 255, y2: 255 },
    { n: 'Terras Neutras', x1: 0, y1: 0, x2: 255, y2: 255 },
  ]

  // Mantém densidade aproximada do mapa 128x128 (~4x mais mobs).
  const spawns: SpawnZone[] = [
    // Folha
    { monster: 'bandido', count: 42, x1: 68, y1: 34, x2: 116, y2: 112 },
    { monster: 'sapo', count: 36, x1: 8, y1: 70, x2: 34, y2: 116 },
    { monster: 'gennin', count: 44, x1: 8, y1: 8, x2: 116, y2: 30 },
    { monster: 'zetsu', count: 44, x1: 8, y1: 34, x2: 32, y2: 112 },
    // Areia
    { monster: 'bandido', count: 42, x1: 140, y1: 34, x2: 188, y2: 112 },
    { monster: 'sapo', count: 36, x1: 220, y1: 70, x2: 247, y2: 116 },
    { monster: 'gennin', count: 44, x1: 140, y1: 8, x2: 247, y2: 30 },
    { monster: 'zetsu', count: 44, x1: 222, y1: 34, x2: 247, y2: 112 },
    // Névoa
    { monster: 'bandido', count: 42, x1: 68, y1: 144, x2: 116, y2: 188 },
    { monster: 'sapo', count: 36, x1: 8, y1: 140, x2: 34, y2: 188 },
    { monster: 'gennin', count: 44, x1: 8, y1: 222, x2: 116, y2: 247 },
    { monster: 'zetsu', count: 44, x1: 8, y1: 144, x2: 32, y2: 220 },
    // Terra
    { monster: 'bandido', count: 42, x1: 140, y1: 144, x2: 188, y2: 188 },
    { monster: 'sapo', count: 36, x1: 220, y1: 140, x2: 247, y2: 188 },
    { monster: 'gennin', count: 44, x1: 140, y1: 222, x2: 247, y2: 247 },
    { monster: 'zetsu', count: 44, x1: 222, y1: 144, x2: 247, y2: 220 },
    // Chefes na fronteira
    { monster: 'boss', count: 2, x1: 124, y1: 92, x2: 132, y2: 112 },
    { monster: 'boss', count: 2, x1: 144, y1: 124, x2: 164, y2: 132 },
    { monster: 'boss', count: 2, x1: 124, y1: 144, x2: 132, y2: 164 },
    { monster: 'boss', count: 2, x1: 92, y1: 124, x2: 112, y2: 132 },
  ]

  return {
    w,
    h,
    tiles: grid.map((row) => row.join('')),
    objects,
    zones,
    spawns,
    blocked,
    fountains,
    fountain: fountains[0],
    shops,
    shopNpc: shops[0],
  }
}

export function zoneAt(world: World, px: number, py: number): Zone {
  const tx = Math.floor(px / 32)
  const ty = Math.floor(py / 32)
  for (const z of world.zones) {
    if (z.n === 'Terras Neutras') continue
    if (tx >= z.x1 && tx <= z.x2 && ty >= z.y1 && ty <= z.y2) return z
  }
  return world.zones[world.zones.length - 1]
}

export function tileWalkable(world: World, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return false
  if (world.tiles[ty][tx] === 'w') return false
  return world.blocked[ty * world.w + tx] === 0
}

export function walkable(world: World, px: number, py: number): boolean {
  return tileWalkable(world, Math.floor(px / 32), Math.floor(py / 32))
}

export function destroyWorldObject(world: World, id: number): WorldObj | null {
  const index = world.objects.findIndex((o) => o.id === id)
  if (index < 0) return null
  const obj = world.objects[index]
  if (!DESTRUCTIBLE_HP[obj.k]) return null

  world.objects.splice(index, 1)
  const [fw, fh] = OBJ_FOOTPRINT[obj.k] || [1, 1]
  for (let oy = 0; oy < fh; oy++) {
    for (let ox = 0; ox < fw; ox++) {
      const tx = obj.x + ox, ty = obj.y + oy
      if (tx >= 0 && ty >= 0 && tx < world.w && ty < world.h) {
        world.blocked[ty * world.w + tx] = 0
      }
    }
  }
  return obj
}

export function restoreWorldObject(world: World, obj: WorldObj): boolean {
  if (world.objects.some((o) => o.id === obj.id)) return false
  const [fw, fh] = OBJ_FOOTPRINT[obj.k] || [1, 1]
  for (let oy = 0; oy < fh; oy++) {
    for (let ox = 0; ox < fw; ox++) {
      const tx = obj.x + ox, ty = obj.y + oy
      if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return false
      if (world.tiles[ty][tx] === 'w' || world.blocked[ty * world.w + tx]) return false
    }
  }
  obj.hp = DESTRUCTIBLE_HP[obj.k]
  world.objects.push(obj)
  for (let oy = 0; oy < fh; oy++) {
    for (let ox = 0; ox < fw; ox++) {
      world.blocked[(obj.y + oy) * world.w + (obj.x + ox)] = 1
    }
  }
  return true
}
