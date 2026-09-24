'use client'

import { buildObjects, buildTiles, PIX_SCALE } from './sprites'
import {
  OBJECT_ATLAS_URL,
  OBJECT_FRAMES,
  TERRAIN_ATLAS_URL,
  TERRAIN_FRAMES,
  type AtlasFrame,
} from './art-manifest'

export interface GameArt {
  tiles: Record<string, HTMLCanvasElement[]>
  objects: Record<string, HTMLCanvasElement>
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

async function loadAtlasArt(): Promise<GameArt> {
  const [terrainAtlas, objectAtlas] = await Promise.all([
    loadImage(TERRAIN_ATLAS_URL),
    loadImage(OBJECT_ATLAS_URL),
  ])

  const tiles: Record<string, HTMLCanvasElement[]> = {}
  for (const [key, frames] of Object.entries(TERRAIN_FRAMES)) {
    tiles[key] = frames.map((frame) => cropFrame(terrainAtlas, frame))
  }

  const objects: Record<string, HTMLCanvasElement> = {}
  for (const [key, frame] of Object.entries(OBJECT_FRAMES)) {
    objects[key] = cropFrame(objectAtlas, frame)
  }

  return { tiles, objects, source: 'gba-atlas' }
}

export function loadGameArt(): Promise<GameArt> {
  if (!cachedArt) {
    cachedArt = loadAtlasArt().catch((error) => {
      console.warn('[art] atlas GBA indisponível; usando arte procedural de fallback.', error)
      return {
        tiles: buildTiles(),
        objects: buildObjects(),
        source: 'procedural-fallback' as const,
      }
    })
  }
  return cachedArt
}
