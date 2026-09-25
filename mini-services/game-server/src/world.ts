// ============================================================
// Shinobi Online — mundo 128x128 (4x a área do mapa original)
// Quatro vilas/facções: Folha, Areia, Névoa e Terra.
// ============================================================

import { MAP_SIZE, type VillageId } from './data'

export interface WorldObj {
  k: string
  x: number
  y: number
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
  shopNpc: { x: number; y: number }
}

export const VILLAGE_CENTERS: Record<VillageId, { x: number; y: number; name: string }> = {
  folha: { x: 28, y: 28, name: 'Vila da Folha' },
  areia: { x: 100, y: 28, name: 'Vila da Areia' },
  nevoa: { x: 28, y: 100, name: 'Vila da Névoa' },
  terra: { x: 100, y: 100, name: 'Vila da Terra' },
}

export const VILLAGE_SPAWNS: Record<VillageId, { x: number; y: number }> = Object.fromEntries(
  Object.entries(VILLAGE_CENTERS).map(([id, c]) => [
    id,
    { x: (c.x + 0.5) * 32, y: (c.y + 4.5) * 32 },
  ]),
) as Record<VillageId, { x: number; y: number }>

// Âncoras de grind continuam sendo conceitos de IA, mas agora se espalham pelo mundo.
export const ZONE_ANCHORS: Record<string, { x: number; y: number }> = {
  vila: { x: 28, y: 32 },
  campo: { x: 64, y: 28 },
  floresta: { x: 24, y: 8 },
  lago: { x: 28, y: 118 },
  vale: { x: 100, y: 116 },
}

export const GRIND_ANCHORS: Record<string, { x: number; y: number }[]> = {
  campo: [
    { x: 44, y: 28 }, { x: 84, y: 28 }, { x: 44, y: 100 }, { x: 84, y: 100 },
    { x: 28, y: 44 }, { x: 100, y: 44 }, { x: 28, y: 84 }, { x: 100, y: 84 },
  ],
  floresta: [
    { x: 14, y: 10 }, { x: 42, y: 10 }, { x: 12, y: 52 }, { x: 48, y: 48 },
    { x: 78, y: 12 }, { x: 114, y: 14 },
  ],
  lago: [
    { x: 10, y: 78 }, { x: 46, y: 78 }, { x: 12, y: 116 }, { x: 48, y: 116 },
    { x: 78, y: 78 }, { x: 116, y: 80 },
  ],
  vale: [
    { x: 78, y: 112 }, { x: 116, y: 112 }, { x: 80, y: 86 }, { x: 116, y: 86 },
    { x: 64, y: 64 },
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

const OBJ_FOOTPRINT: Record<string, [number, number]> = {
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

export function genWorld(): World {
  const w = MAP_SIZE
  const h = MAP_SIZE
  const rnd = mulberry32(1337)
  const grid: string[][] = []
  const objects: WorldObj[] = []
  const blocked = new Uint8Array(w * h)

  const T = (x: number, y: number) => grid[y]?.[x] ?? ''
  const setT = (x: number, y: number, c: string) => {
    if (x >= 0 && x < w && y >= 0 && y < h) grid[y][x] = c
  }
  const inBounds = (x: number, y: number) => x >= 0 && x < w && y >= 0 && y < h
  const isWalkTile = (x: number, y: number) => !['w'].includes(T(x, y))

  for (let y = 0; y < h; y++) {
    const row: string[] = []
    for (let x = 0; x < w; x++) row.push(rnd() < 0.24 ? ',' : '.')
    grid.push(row)
  }

  // --- quatro biomas ---
  // Areia (NE)
  for (let y = 0; y < 64; y++) {
    for (let x = 64; x < 128; x++) {
      if (rnd() < 0.82) setT(x, y, 's')
      else setT(x, y, rnd() < 0.5 ? ',' : '.')
    }
  }

  // Névoa (SW): terreno úmido, capim e lagoas rasas.
  for (let y = 64; y < 128; y++) {
    for (let x = 0; x < 64; x++) {
      if (rnd() < 0.12) setT(x, y, 'g')
    }
  }
  const mistPonds = [
    [12, 78, 7], [46, 78, 6], [10, 116, 6], [48, 114, 8], [42, 96, 5],
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

  // Terra (SE): solo seco/pedregoso.
  for (let y = 64; y < 128; y++) {
    for (let x = 64; x < 128; x++) {
      const r = rnd()
      setT(x, y, r < 0.46 ? 's' : r < 0.72 ? ',' : '.')
    }
  }

  // Folha (NW): capim mais denso.
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      if (rnd() < 0.09) setT(x, y, 'g')
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

  // Estradas ligando vilas e fronteira central.
  roadH(28, 28, 100)
  roadH(64, 28, 100)
  roadH(100, 28, 100)
  roadV(28, 28, 100)
  roadV(64, 28, 100)
  roadV(100, 28, 100)

  const villageRects = Object.values(VILLAGE_CENTERS).map((c) => ({
    x1: c.x - 10, y1: c.y - 10, x2: c.x + 10, y2: c.y + 10,
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
    if (!force && !canPlace(k, x, y)) return false
    for (let oy = 0; oy < fh; oy++) {
      for (let ox = 0; ox < fw; ox++) {
        const tx = x + ox, ty = y + oy
        if (!inBounds(tx, ty)) return false
        blocked[ty * w + tx] = 1
      }
    }
    objects.push({ k, x, y })
    return true
  }

  const fountains: { x: number; y: number; village: VillageId }[] = []

  const placeVillage = (id: VillageId) => {
    const c = VILLAGE_CENTERS[id]

    // Praça central caminhável.
    for (let y = c.y - 4; y <= c.y + 4; y++) {
      for (let x = c.x - 4; x <= c.x + 4; x++) setT(x, y, 'c')
    }
    // Caminhos atravessam a praça.
    roadH(c.y, c.x - 10, c.x + 10)
    roadV(c.x, c.y - 10, c.y + 10)

    const houses: [number, number][] = [
      [c.x - 8, c.y - 7], [c.x + 5, c.y - 7],
      [c.x - 8, c.y + 6], [c.x + 5, c.y + 6],
    ]
    for (const [x, y] of houses) placeObject('house', x, y, true)

    const fx = c.x + 4, fy = c.y - 2
    placeObject('fountain', fx, fy, true)
    fountains.push({ x: (fx + 1) * 32, y: (fy + 1) * 32, village: id })

    const r = 10
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

    for (const [dx, dy] of [[-5, -5], [6, -5], [-5, 6], [6, 6]] as [number, number][]) {
      placeObject('lantern', c.x + dx, c.y + dy, true)
    }
    placeObject('sign', c.x, c.y + 9, true)
  }

  ;(['folha', 'areia', 'nevoa', 'terra'] as VillageId[]).forEach(placeVillage)

  // Mantém um único comerciante/NPC: Ichiraku continua na Folha.
  placeObject('shop', 24, 20, true)
  const shopNpc = { x: 25.5 * 32, y: 22.6 * 32 }

  // Decoração regional, sem entupir vilas/estradas/âncoras.
  for (let y = 2; y < h - 2; y++) {
    for (let x = 2; x < w - 2; x++) {
      if (inVillage(x, y) || nearAnchor(x, y, 3)) continue
      if (T(x, y) === 'p' || T(x, y) === 'c' || T(x, y) === 'w') continue
      if (blocked[y * w + x]) continue

      const qx = x < 64 ? 0 : 1
      const qy = y < 64 ? 0 : 1
      const r = rnd()
      if (qx === 0 && qy === 0) {
        if (r < 0.075) placeObject(rnd() < 0.75 ? 'tree' : 'tree2', x, y)
        else if (r < 0.095) placeObject('rock', x, y)
        else if (r < 0.13) setT(x, y, '"')
      } else if (qx === 1 && qy === 0) {
        if (r < 0.055) placeObject('rock', x, y)
        else if (r < 0.072) placeObject('deadtree', x, y)
      } else if (qx === 0 && qy === 1) {
        if (r < 0.045) placeObject(rnd() < 0.7 ? 'tree2' : 'tree', x, y)
        else if (r < 0.07) setT(x, y, 'g')
      } else {
        if (r < 0.082) placeObject('rock', x, y)
        else if (r < 0.105) placeObject('deadtree', x, y)
      }
    }
  }

  // Área central de conflito, com postes e placas.
  for (const [x, y] of [[58, 58], [70, 58], [58, 70], [70, 70], [64, 60], [64, 68]] as [number, number][]) {
    if (!blocked[y * w + x] && T(x, y) !== 'p') placeObject('post', x, y)
  }

  const zones: Zone[] = [
    { n: 'Vila da Folha', x1: 18, y1: 18, x2: 38, y2: 38, safe: true, village: 'folha' },
    { n: 'Vila da Areia', x1: 90, y1: 18, x2: 110, y2: 38, safe: true, village: 'areia' },
    { n: 'Vila da Névoa', x1: 18, y1: 90, x2: 38, y2: 110, safe: true, village: 'nevoa' },
    { n: 'Vila da Terra', x1: 90, y1: 90, x2: 110, y2: 110, safe: true, village: 'terra' },
    { n: 'Fronteiras Shinobi', x1: 56, y1: 0, x2: 71, y2: 127 },
    { n: 'Fronteiras Shinobi', x1: 0, y1: 56, x2: 127, y2: 71 },
    { n: 'Florestas da Folha', x1: 0, y1: 0, x2: 63, y2: 63 },
    { n: 'Deserto da Areia', x1: 64, y1: 0, x2: 127, y2: 63 },
    { n: 'Pântanos da Névoa', x1: 0, y1: 64, x2: 63, y2: 127 },
    { n: 'Montanhas da Terra', x1: 64, y1: 64, x2: 127, y2: 127 },
    { n: 'Terras Neutras', x1: 0, y1: 0, x2: 127, y2: 127 },
  ]

  // 188 mobs: ~4x o mapa original, espalhados pelos quatro territórios.
  const spawns: SpawnZone[] = [
    // Folha / NW
    { monster: 'bandido', count: 12, x1: 39, y1: 20, x2: 57, y2: 48 },
    { monster: 'sapo', count: 10, x1: 5, y1: 42, x2: 17, y2: 57 },
    { monster: 'gennin', count: 12, x1: 5, y1: 5, x2: 57, y2: 15 },
    { monster: 'zetsu', count: 12, x1: 5, y1: 18, x2: 15, y2: 52 },
    // Areia / NE
    { monster: 'bandido', count: 12, x1: 70, y1: 20, x2: 88, y2: 48 },
    { monster: 'sapo', count: 10, x1: 112, y1: 42, x2: 123, y2: 57 },
    { monster: 'gennin', count: 12, x1: 70, y1: 5, x2: 123, y2: 15 },
    { monster: 'zetsu', count: 12, x1: 113, y1: 18, x2: 123, y2: 52 },
    // Névoa / SW
    { monster: 'bandido', count: 12, x1: 39, y1: 78, x2: 57, y2: 108 },
    { monster: 'sapo', count: 10, x1: 5, y1: 70, x2: 17, y2: 88 },
    { monster: 'gennin', count: 12, x1: 5, y1: 113, x2: 57, y2: 123 },
    { monster: 'zetsu', count: 12, x1: 5, y1: 76, x2: 15, y2: 110 },
    // Terra / SE
    { monster: 'bandido', count: 12, x1: 70, y1: 78, x2: 88, y2: 108 },
    { monster: 'sapo', count: 10, x1: 112, y1: 70, x2: 123, y2: 88 },
    { monster: 'gennin', count: 12, x1: 70, y1: 113, x2: 123, y2: 123 },
    { monster: 'zetsu', count: 12, x1: 113, y1: 76, x2: 123, y2: 110 },
    // Chefes na fronteira central
    { monster: 'boss', count: 1, x1: 62, y1: 50, x2: 62, y2: 50 },
    { monster: 'boss', count: 1, x1: 76, y1: 64, x2: 76, y2: 64 },
    { monster: 'boss', count: 1, x1: 64, y1: 76, x2: 64, y2: 76 },
    { monster: 'boss', count: 1, x1: 50, y1: 64, x2: 50, y2: 64 },
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
    shopNpc,
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
  const t = world.tiles[ty][tx]
  if (t === 'w') return false
  return world.blocked[ty * world.w + tx] === 0
}

export function walkable(world: World, px: number, py: number): boolean {
  return tileWalkable(world, Math.floor(px / 32), Math.floor(py / 32))
}
