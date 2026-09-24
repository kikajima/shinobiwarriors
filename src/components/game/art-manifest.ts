export interface AtlasFrame {
  x: number
  y: number
  w: number
  h: number
}

export const TERRAIN_ATLAS_URL = '/game/gba/terrain.png'
export const OBJECT_ATLAS_URL = '/game/gba/objects.png'

const tile = (x: number, y: number): AtlasFrame => ({ x: x * 32, y: y * 32, w: 32, h: 32 })

/**
 * Mantém o protocolo atual do mapa (. , " g s p c w), mas troca a origem
 * visual por frames de um atlas real. Isso permite melhorar a arte sem alterar
 * o servidor, pathfinding ou os saves.
 */
export const TERRAIN_FRAMES: Record<string, AtlasFrame[]> = {
  '.': [tile(0, 0), tile(1, 0), tile(2, 0)],
  ',': [tile(3, 0), tile(4, 0)],
  '"': [tile(5, 0), tile(6, 0)],
  g: [tile(7, 0), tile(0, 1)],
  s: [tile(1, 1), tile(2, 1)],
  p: [tile(3, 1), tile(4, 1)],
  c: [tile(5, 1), tile(6, 1)],
  w: [tile(7, 1), tile(0, 2)],
}

export const OBJECT_FRAMES: Record<string, AtlasFrame> = {
  tree: { x: 0, y: 0, w: 48, h: 72 },
  tree2: { x: 56, y: 0, w: 48, h: 72 },
  deadtree: { x: 112, y: 0, w: 40, h: 64 },
  rock: { x: 160, y: 0, w: 32, h: 24 },
  fence: { x: 200, y: 0, w: 32, h: 24 },
  post: { x: 240, y: 0, w: 20, h: 36 },
  lantern: { x: 268, y: 0, w: 20, h: 44 },
  sign: { x: 296, y: 0, w: 28, h: 34 },
  house: { x: 0, y: 96, w: 96, h: 88 },
  shop: { x: 104, y: 92, w: 96, h: 92 },
  fountain: { x: 210, y: 96, w: 64, h: 64 },
}
