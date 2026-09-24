'use client'

import { buildObjects, buildTiles, PIX_SCALE } from './sprites'
import type { ElementId } from './types'
import {
  OBJECT_ATLAS_URL,
  OBJECT_FRAMES,
  PLAYER_FIRE_ATLAS_URL,
  PLAYER_FIRE_FRAMES,
  TERRAIN_ATLAS_URL,
  TERRAIN_FRAMES,
  type AtlasFrame,
} from './art-manifest'

export interface GameArt {
  tiles: Record<string, HTMLCanvasElement[]>
  objects: Record<string, HTMLCanvasElement>
  players: Partial<Record<ElementId, HTMLCanvasElement[][]>>
  source: 'gba-atlas' | 'procedural-fallback'
}

let cachedArt: Promise<GameArt> | null = null

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Falha ao carregar asset: ${src}`))
    image.src = src
  })
}

/**
 * O renderer legado espera canvases em PIX_SCALE e depois converte para o
 * tamanho lógico. Mantemos esse contrato durante a migração para não misturar
 * mudança de arte com mudança de física/renderização.
 */
function cropFrame(source: CanvasImageSource, frame: AtlasFrame): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = frame.w * PIX_SCALE
  canvas.height = frame.h * PIX_SCALE
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    source,
    frame.x, frame.y, frame.w, frame.h,
    0, 0, canvas.width, canvas.height,
  )
  return canvas
}

const BASE_HAIR = [
  [44, 33, 28],
  [66, 45, 32],
  [100, 64, 39],
] as const
const BASE_SKIN = [
  [190, 126, 76],
  [238, 181, 119],
  [255, 210, 152],
] as const

const HAIR_VARIANTS = [
  [[35,28,25],[55,42,36],[86,63,48]],
  [[62,36,20],[94,55,28],[139,86,42]],
  [[117,82,20],[181,132,30],[226,181,66]],
  [[95,28,25],[146,43,35],[207,70,48]],
  [[88,91,101],[137,141,151],[202,205,211]],
  [[91,45,66],[145,72,101],[211,119,151]],
  [[56,57,69],[86,89,106],[133,138,157]],
  [[30,53,75],[45,81,113],[77,126,161]],
] as const

const SKIN_VARIANTS = [
  [[190,126,76],[238,181,119],[255,210,152]],
  [[151,94,61],[205,139,91],[238,178,123]],
  [[103,66,48],[163,105,70],[211,151,102]],
] as const

function sameRgb(data: Uint8ClampedArray, i: number, rgb: readonly number[]) {
  return data[i] === rgb[0] && data[i + 1] === rgb[1] && data[i + 2] === rgb[2]
}

function recolorFrame(source: HTMLCanvasElement, pal: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, 0, 0)

  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const hair = HAIR_VARIANTS[Math.abs(pal) % HAIR_VARIANTS.length]
  const skin = SKIN_VARIANTS[Math.floor(Math.abs(pal) / HAIR_VARIANTS.length) % SKIN_VARIANTS.length]

  for (let i = 0; i < image.data.length; i += 4) {
    if (image.data[i + 3] === 0) continue
    for (let shade = 0; shade < 3; shade++) {
      if (sameRgb(image.data, i, BASE_HAIR[shade])) {
        image.data[i] = hair[shade][0]
        image.data[i + 1] = hair[shade][1]
        image.data[i + 2] = hair[shade][2]
        break
      }
      if (sameRgb(image.data, i, BASE_SKIN[shade])) {
        image.data[i] = skin[shade][0]
        image.data[i + 1] = skin[shade][1]
        image.data[i + 2] = skin[shade][2]
        break
      }
    }
  }

  ctx.putImageData(image, 0, 0)
  return canvas
}

export function makePlayerVariant(
  frames: HTMLCanvasElement[][],
  pal: number,
): HTMLCanvasElement[][] {
  if (pal === 0) return frames
  return frames.map((direction) => direction.map((frame) => recolorFrame(frame, pal)))
}

async function loadAtlasArt(): Promise<GameArt> {
  const [terrainAtlas, objectAtlas] = await Promise.all([
    loadImage(TERRAIN_ATLAS_URL),
    loadImage(OBJECT_ATLAS_URL),
  ])
  const firePlayerAtlas = await loadImage(PLAYER_FIRE_ATLAS_URL).catch((error) => {
    console.warn('[art] player Fogo GBA indisponível; usando sprite procedural.', error)
    return null
  })

  const tiles: Record<string, HTMLCanvasElement[]> = {}
  for (const [key, frames] of Object.entries(TERRAIN_FRAMES)) {
    tiles[key] = frames.map((frame) => cropFrame(terrainAtlas, frame))
  }

  const objects: Record<string, HTMLCanvasElement> = {}
  for (const [key, frame] of Object.entries(OBJECT_FRAMES)) {
    objects[key] = cropFrame(objectAtlas, frame)
  }

  const players: Partial<Record<ElementId, HTMLCanvasElement[][]>> = {}
  if (firePlayerAtlas) {
    players.fogo = PLAYER_FIRE_FRAMES.map((direction) =>
      direction.map((frame) => cropFrame(firePlayerAtlas, frame)),
    )
  }

  return { tiles, objects, players, source: 'gba-atlas' }
}

export function loadGameArt(): Promise<GameArt> {
  if (!cachedArt) {
    cachedArt = loadAtlasArt().catch((error) => {
      console.warn('[art] atlas GBA indisponível; usando arte procedural de fallback.', error)
      return {
        tiles: buildTiles(),
        objects: buildObjects(),
        players: {},
        source: 'procedural-fallback' as const,
      }
    })
  }
  return cachedArt
}
