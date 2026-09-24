export interface AtlasFrame {
  x: number
  y: number
  w: number
  h: number
}

export const TERRAIN_ATLAS_URL = '/game/gba/terrain.png'
export const OBJECT_ATLAS_URL = '/game/gba/objects.png'

const tile = (col: number, row: number): AtlasFrame => ({
  x: col * 32,
  y: row * 32,
  w: 32,
  h: 32,
})

/**
 * Legenda do mapa -> atlas GBA.
 *
 * O servidor continua enviando os mesmos caracteres:
 *   .  grama
 *   ,  grama variante
 *   "  flores
 *   g  capim alto
 *   s  areia
 *   p  terra/caminho
 *   c  pedra/pavimento
 *   w  água
 *
 * IMPORTANTE: terrain.png NÃO é uma sequência linear de todos esses tipos.
 * As células abaixo foram catalogadas visualmente, uma por uma.
 */
export const TERRAIN_FRAMES: Record<string, AtlasFrame[]> = {
  // Linha 0: sete variações de grama e duas células decoradas.
  '.': [tile(0, 0), tile(1, 0), tile(2, 0), tile(3, 0)],
  ',': [tile(4, 0), tile(7, 0)],

  // Flores sobre grama.
  '"': [tile(5, 0), tile(6, 0)],

  // Capim alto ocupa as células (7,0) e (0,1).
  // Repetir (7,0) entre ',' e 'g' é intencional: funciona como transição.
  g: [tile(7, 0), tile(0, 1)],

  // Linha 1: areia clara.
  s: [tile(1, 1), tile(2, 1)],

  // Terra/caminho marrom.
  p: [tile(3, 1), tile(4, 1)],

  // Pavimento de pedra.
  c: [tile(5, 1), tile(6, 1)],

  // Água animada: última célula da linha 1 + primeira da linha 2.
  w: [tile(7, 1), tile(0, 2)],
}

/**
 * Bounds reais dos elementos opacos de objects.png.
 * As caixas não incluem grandes margens transparentes; o renderer continua
 * ancorando o objeto pela base/footprint do mapa.
 */
export const OBJECT_FRAMES: Record<string, AtlasFrame> = {
  tree:     { x: 6,   y: 8,   w: 40, h: 61 },
  tree2:    { x: 62,  y: 8,   w: 40, h: 61 },
  deadtree: { x: 117, y: 10,  w: 32, h: 52 },
  rock:     { x: 162, y: 2,   w: 28, h: 19 },
  fence:    { x: 200, y: 3,   w: 32, h: 21 },
  post:     { x: 243, y: 1,   w: 15, h: 35 },
  lantern:  { x: 271, y: 1,   w: 15, h: 43 },
  sign:     { x: 299, y: 2,   w: 23, h: 32 },

  house:    { x: 8,   y: 104, w: 81, h: 77 },
  shop:     { x: 112, y: 100, w: 81, h: 81 },
  fountain: { x: 215, y: 104, w: 55, h: 51 },
}
