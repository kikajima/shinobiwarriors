// ============================================================
// Shinobi Online — geração do mundo (mapa 64x64 tiles de 32px)
// ============================================================

import { MAP_SIZE } from './data'

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
  fountain: { x: number; y: number }
  shopNpc: { x: number; y: number }
}

// PRNG determinístico
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

// Âncoras de grind dos bots (tiles) — clareiras garantidas na geração
export const ZONE_ANCHORS: Record<string, { x: number; y: number }> = {
  vila: { x: 32, y: 35 },
  campo: { x: 50, y: 32 },
  floresta: { x: 32, y: 15 },
  lago: { x: 34, y: 46 },
  vale: { x: 15, y: 32 },
}

export const GRIND_ANCHORS: Record<string, { x: number; y: number }[]> = {
  campo: [
    { x: 48, y: 28 }, { x: 52, y: 33 }, { x: 56, y: 27 }, { x: 55, y: 37 },
  ],
  floresta: [
    { x: 30, y: 13 }, { x: 36, y: 11 }, { x: 42, y: 14 }, { x: 24, y: 15 },
  ],
  lago: [
    { x: 38, y: 48 }, { x: 40, y: 52 }, { x: 56, y: 50 }, { x: 58, y: 54 },
  ],
  vale: [
    { x: 13, y: 26 }, { x: 13, y: 38 }, { x: 17, y: 31 },
  ],
}

const ALL_ANCHORS: { x: number; y: number }[] = [
  ...Object.values(ZONE_ANCHORS),
  ...Object.values(GRIND_ANCHORS).flat(),
]

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
  const isGrass = (x: number, y: number) => {
    const t = T(x, y)
    return t === '.' || t === ','
  }

  // --- base: grama com ruído ---
  for (let y = 0; y < h; y++) {
    const row: string[] = []
    for (let x = 0; x < w; x++) row.push(rnd() < 0.24 ? ',' : '.')
    grid.push(row)
  }

  // --- lago ao sul (centro 48,54) ---
  for (let y = 42; y < h; y++) {
    for (let x = 36; x < w; x++) {
      const dx = x - 48
      const dy = (y - 54) * 1.15
      const d = Math.sqrt(dx * dx + dy * dy) + (rnd() - 0.5) * 2.2
      if (d < 6.4) setT(x, y, 'w')
      else if (d < 8.8 && isGrass(x, y)) setT(x, y, 's')
    }
  }

  // --- vale do fim: solo arenoso ---
  for (let y = 21; y <= 43; y++) {
    for (let x = 3; x <= 21; x++) {
      if (rnd() < 0.3 && isGrass(x, y)) setT(x, y, 's')
      else if (rnd() < 0.25) setT(x, y, ',')
    }
  }

  // --- capim alto na floresta ---
  for (let y = 3; y <= 18; y++) {
    for (let x = 4; x <= 58; x++) {
      if (rnd() < 0.1 && isGrass(x, y)) setT(x, y, 'g')
    }
  }

  // --- caminhos (2 tiles de largura) ---
  // E-W principal: y 32-33, x 16..48
  for (let x = 16; x <= 48; x++) {
    setT(x, 32, 'p')
    setT(x, 33, 'p')
  }
  // N-S principal: x 32-33, y 16..46
  for (let y = 16; y <= 46; y++) {
    setT(32, y, 'p')
    setT(33, y, 'p')
  }

  // --- praça da vila (pedra) ---
  for (let y = 28; y <= 36; y++) {
    for (let x = 28; x <= 36; x++) setT(x, y, 'c')
  }

  // --- flores na vila ---
  for (let y = 24; y <= 40; y++) {
    for (let x = 24; x <= 40; x++) {
      if (T(x, y) === '.' && rnd() < 0.07) setT(x, y, '"')
    }
  }

  // --- util: corredores que devem ficar livres de objetos ---
  const inClearBand = (x: number, y: number) =>
    (y >= 30 && y <= 35 && x >= 14 && x <= 50) ||
    (x >= 30 && x <= 35 && y >= 14 && y <= 50)

  const nearAnchor = (x: number, y: number, r: number) =>
    ALL_ANCHORS.some((a) => Math.abs(a.x - x) <= r && Math.abs(a.y - y) <= r)

  const inVillage = (x: number, y: number) => x >= 23 && x <= 41 && y >= 23 && y <= 41
  const inArena = (x: number, y: number) => x >= 4 && x <= 14 && y >= 27 && y <= 37

  // --- espalhar objetos ---
  const placeObject = (k: string, x: number, y: number) => {
    const [fw, fh] = OBJ_FOOTPRINT[k]
    for (let oy = 0; oy < fh; oy++)
      for (let ox = 0; ox < fw; ox++) blocked[(y + oy) * w + (x + ox)] = 1
    objects.push({ k, x, y })
  }
  /** estruturas da vila: limpa decoração e coloca (permite praça) */
  const placeStructure = (k: string, x: number, y: number) => {
    const [fw, fh] = OBJ_FOOTPRINT[k]
    for (let oy = 0; oy < fh; oy++)
      for (let ox = 0; ox < fw; ox++) {
        const tx = x + ox, ty = y + oy
        if (tx >= w || ty >= h) return false
        const t = T(tx, ty)
        if (t === 'w' || t === 'p' || blocked[ty * w + tx]) return false
        if (t === '"') setT(tx, ty, ',')
      }
    placeObject(k, x, y)
    return true
  }

  // floresta densa ao norte
  for (let y = 2; y <= 19; y++) {
    for (let x = 3; x <= 58; x++) {
      if (!isGrass(x, y) && T(x, y) !== 'g') continue
      if (inClearBand(x, y) || nearAnchor(x, y, 3)) continue
      if (rnd() < 0.16) placeObject(rnd() < 0.75 ? 'tree' : 'tree2', x, y)
    }
  }
  // campo de treinamento (leste): árvores esparsas
  for (let y = 21; y <= 43; y++) {
    for (let x = 44; x <= 62; x++) {
      if (!isGrass(x, y)) continue
      if (inClearBand(x, y) || nearAnchor(x, y, 3)) continue
      if (rnd() < 0.06) placeObject('tree', x, y)
      else if (rnd() < 0.05) placeObject('rock', x, y)
      else if (rnd() < 0.05) setT(x, y, '"')
    }
  }
  // vale do fim: rochas
  for (let y = 21; y <= 43; y++) {
    for (let x = 3; x <= 21; x++) {
      if (!isGrass(x, y) && T(x, y) !== 's' && T(x, y) !== ',') continue
      if (inClearBand(x, y) || nearAnchor(x, y, 3) || inArena(x, y)) continue
      if (rnd() < 0.1) placeObject('rock', x, y)
      else if (rnd() < 0.05) placeObject('deadtree', x, y)
    }
  }
  // lago: margens com árvores raras
  for (let y = 44; y <= 62; y++) {
    for (let x = 36; x <= 62; x++) {
      if (!isGrass(x, y)) continue
      if (inClearBand(x, y) || nearAnchor(x, y, 3)) continue
      if (rnd() < 0.05) placeObject('tree', x, y)
      else if (rnd() < 0.04) setT(x, y, '"')
    }
  }
  // resto do mundo: bem esparso
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!isGrass(x, y)) continue
      if (inVillage(x, y) || inClearBand(x, y) || nearAnchor(x, y, 3) || inArena(x, y)) continue
      const r = rnd()
      if (r < 0.03) placeObject('tree', x, y)
      else if (r < 0.05) placeObject('rock', x, y)
      else if (r < 0.09) setT(x, y, '"')
    }
  }

  // --- estruturas da vila ---
  const HOUSES: [number, number][] = [[25, 25], [38, 25], [25, 38], [38, 38]]
  for (const [hx, hy] of HOUSES) placeStructure('house', hx, hy)
  placeStructure('shop', 29, 26)
  placeStructure('fountain', 30, 31)

  // cerca da vila com portões (caminhos cruzam)
  for (let i = 24; i <= 40; i++) {
    const gates = (x: number, y: number) => {
      const isGate =
        (y === 24 && (x === 32 || x === 33)) ||
        (y === 40 && (x === 32 || x === 33)) ||
        (x === 24 && (y === 32 || y === 33)) ||
        (x === 40 && (y === 32 || y === 33))
      return !isGate
    }
    if (gates(i, 24) && !blocked[24 * w + i]) placeObject('fence', i, 24)
    if (gates(i, 40) && !blocked[40 * w + i]) placeObject('fence', i, 40)
    if (gates(24, i) && !blocked[i * w + 24]) placeObject('fence', 24, i)
    if (gates(40, i) && !blocked[i * w + 40]) placeObject('fence', 40, i)
  }

  // lanternas na praça
  for (const [lx, ly] of [[27, 27], [37, 27], [27, 37], [37, 37]] as [number, number][]) {
    if (!blocked[ly * w + lx]) placeObject('lantern', lx, ly)
  }

  // postes de treinamento no campo
  for (const [px, py] of [[46, 28], [48, 34], [52, 26], [54, 38], [50, 31]] as [number, number][]) {
    if (!blocked[py * w + px]) placeObject('post', px, py)
  }

  // placas nas entradas das zonas
  for (const [sx, sy] of [[43, 31], [21, 31], [31, 21], [31, 43]] as [number, number][]) {
    if (!blocked[sy * w + sx] && T(sx, sy) !== 'p') placeObject('sign', sx, sy)
  }

  const zones: Zone[] = [
    { n: 'Vila da Folha', x1: 23, y1: 23, x2: 41, y2: 41, safe: true },
    { n: 'Floresta Densa', x1: 0, y1: 0, x2: 63, y2: 20 },
    { n: 'Lago da Vila', x1: 34, y1: 44, x2: 63, y2: 63 },
    { n: 'Vale do Fim', x1: 0, y1: 21, x2: 22, y2: 43 },
    { n: 'Campo de Treinamento', x1: 42, y1: 21, x2: 63, y2: 43 },
    { n: 'Arredores da Vila', x1: 0, y1: 0, x2: 63, y2: 63 },
  ]

  const spawns: SpawnZone[] = [
    { monster: 'bandido', count: 10, x1: 46, y1: 24, x2: 60, y2: 40 },
    { monster: 'sapo', count: 5, x1: 45, y1: 41, x2: 61, y2: 44 },
    { monster: 'gennin', count: 9, x1: 8, y1: 13, x2: 56, y2: 19 },
    { monster: 'zetsu', count: 7, x1: 10, y1: 4, x2: 54, y2: 11 },
    { monster: 'sapo', count: 5, x1: 56, y1: 46, x2: 62, y2: 58 },
    { monster: 'zetsu', count: 4, x1: 36, y1: 46, x2: 40, y2: 58 },
    { monster: 'zetsu', count: 7, x1: 14, y1: 22, x2: 20, y2: 42 },
    { monster: 'boss', count: 1, x1: 9, y1: 32, x2: 9, y2: 32 },
  ]

  return {
    w,
    h,
    tiles: grid.map((row) => row.join('')),
    objects,
    zones,
    spawns,
    blocked,
    fountain: { x: 31 * 32, y: 32 * 32 },
    shopNpc: { x: 30 * 32 + 16, y: 28 * 32 + 20 },
  }
}

// zona pelo pixel (ordem importa)
export function zoneAt(world: World, px: number, py: number): Zone {
  const tx = Math.floor(px / 32)
  const ty = Math.floor(py / 32)
  for (const z of world.zones) {
    if (z.n === 'Arredores da Vila') continue
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
