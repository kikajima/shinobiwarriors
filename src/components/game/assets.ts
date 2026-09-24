'use client'

import { buildObjects, buildTiles, PIX_SCALE } from './sprites'
import type { ElementId } from './types'
import {
  OBJECT_ATLAS_URL,
  OBJECT_FRAMES,
  PLAYER_FIRE_ATLAS_URL,
  PLAYER_WATER_ATLAS_URL,
  PLAYER_LIGHTNING_ATLAS_URL,
  PLAYER_WIND_ATLAS_URL,
  PLAYER_EARTH_ATLAS_URL,
  PLAYER_FRAMES,
  type PlayerAnimName,
  TERRAIN_ATLAS_URL,
  TERRAIN_FRAMES,
  type AtlasFrame,
} from './art-manifest'

export interface PlayerSpriteSet {
  move: HTMLCanvasElement[][]
  attack?: HTMLCanvasElement[][]
  cast?: HTMLCanvasElement[][]
  hurt?: HTMLCanvasElement[][]
}

export interface GameArt {
  tiles: Record<string, HTMLCanvasElement[]>
  objects: Record<string, HTMLCanvasElement>
  players: Partial<Record<ElementId, PlayerSpriteSet>>
  source: 'gba-atlas' | 'procedural-fallback'
}

export type { PlayerAnimName } from './art-manifest'

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

function cropMatrix(
  source: CanvasImageSource,
  frames: AtlasFrame[][],
): HTMLCanvasElement[][] {
  return frames.map((direction) => direction.map((frame) => cropFrame(source, frame)))
}

function cloneFrame(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, 0, 0)
  return canvas
}

function shiftedFrame(source: HTMLCanvasElement, dx: number, dy: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(source, dx * PIX_SCALE, dy * PIX_SCALE)
  return canvas
}

function fireAttackFrame(source: HTMLCanvasElement, dir: number, phase: number): HTMLCanvasElement {
  const dirs = [[0,1],[0,-1],[-1,0],[1,0]] as const
  const [dx,dy] = dirs[dir] || dirs[0]
  const canvas = phase === 1 ? shiftedFrame(source, dx, dy) : cloneFrame(source)
  const ctx = canvas.getContext('2d')!
  const S = PIX_SCALE
  ctx.imageSmoothingEnabled = false
  ctx.lineCap = 'square'
  ctx.lineJoin = 'miter'

  const lines = [
    [[18,25],[20,30],[19,34]],
    [[14,17],[12,12],[13,8]],
    [[10,22],[5,21],[2,19]],
    [[22,22],[27,21],[30,19]],
  ] as const
  const trails = [
    [[17,25],[23,29]], [[10,16],[16,10]], [[9,18],[2,23]], [[23,18],[30,23]],
  ] as const
  const pts = lines[dir] || lines[0]
  ctx.strokeStyle = '#eeb577'
  ctx.lineWidth = 2*S
  ctx.beginPath(); ctx.moveTo(pts[0][0]*S,pts[0][1]*S)
  ctx.lineTo(pts[1][0]*S,pts[1][1]*S); ctx.lineTo(pts[2][0]*S,pts[2][1]*S); ctx.stroke()
  ctx.strokeStyle = '#d6dadc'; ctx.lineWidth = S
  ctx.beginPath(); ctx.moveTo(pts[1][0]*S,pts[1][1]*S); ctx.lineTo(pts[2][0]*S,pts[2][1]*S); ctx.stroke()
  if (phase === 1) {
    const tr = trails[dir] || trails[0]
    ctx.strokeStyle = '#ffd169'; ctx.lineWidth = 2*S
    ctx.beginPath(); ctx.moveTo(tr[0][0]*S,tr[0][1]*S); ctx.lineTo(tr[1][0]*S,tr[1][1]*S); ctx.stroke()
  }
  return canvas
}

function fireCastFrame(source: HTMLCanvasElement, dir: number, phase: number): HTMLCanvasElement {
  const canvas = cloneFrame(source)
  const ctx = canvas.getContext('2d')!
  const S = PIX_SCALE
  const hands = [[[13,24],[18,24]],[[13,20],[18,20]],[[11,22],[13,23]],[[20,22],[18,23]]] as const
  const pair = hands[dir] || hands[0]
  if (phase === 0) {
    ctx.fillStyle='#eeb577'
    for(const [x,y] of pair) ctx.fillRect((x-1)*S,(y-1)*S,3*S,3*S)
  } else {
    const cx=Math.round((pair[0][0]+pair[1][0])/2),cy=Math.round((pair[0][1]+pair[1][1])/2)
    ctx.fillStyle=phase===1?'#ff751a':'#ffad37'
    ctx.fillRect((cx-2)*S,(cy-2)*S,5*S,5*S)
    ctx.fillStyle='#ffefa0';ctx.fillRect(cx*S,cy*S,S,S)
    if(phase===2){
      ctx.fillStyle='#ff751a'
      if(dir===2)ctx.fillRect(4*S,18*S,8*S,2*S)
      else if(dir===3)ctx.fillRect(21*S,18*S,8*S,2*S)
      else ctx.fillRect(15*S,(dir===1?7:12)*S,2*S,7*S)
    }
  }
  return canvas
}

function fireHurtFrame(source: HTMLCanvasElement, dir: number, phase: number): HTMLCanvasElement {
  const recoil = [[0,-1],[0,1],[1,0],[-1,0]] as const
  const [dx,dy]=recoil[dir]||recoil[0]
  const canvas=shiftedFrame(source,dx*(phase===1?2:1),dy*(phase===1?2:1))
  const ctx=canvas.getContext('2d')!,S=PIX_SCALE
  ctx.globalCompositeOperation='source-atop'
  ctx.fillStyle=phase===1?'rgba(255,80,55,.48)':'rgba(255,145,90,.22)'
  ctx.fillRect(0,0,canvas.width,canvas.height)
  ctx.globalCompositeOperation='source-over'
  if(phase===1){
    ctx.fillStyle='#fff0b8'
    const sparks=[[[16,8],[13,6],[19,6]],[[16,32],[13,34],[19,34]],[[26,20],[29,17],[29,23]],[[6,20],[3,17],[3,23]]] as const
    for(const [x,y] of sparks[dir]||sparks[0])ctx.fillRect(x*S,y*S,S,S)
  }
  return canvas
}

function buildFireCombatSet(move: HTMLCanvasElement[][]): PlayerSpriteSet {
  const attack=move.map((direction,dir)=>[0,1,2].map((phase)=>fireAttackFrame(direction[phase===1?1:0],dir,phase)))
  const cast=move.map((direction,dir)=>[0,1,2].map((phase)=>fireCastFrame(direction[0],dir,phase)))
  const hurt=move.map((direction,dir)=>[0,1,2].map((phase)=>fireHurtFrame(direction[0],dir,phase)))
  return { move, attack, cast, hurt }
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

async function loadOptionalPlayerAtlas(
  element: ElementId,
  url: string,
): Promise<[ElementId, HTMLImageElement | null]> {
  try {
    return [element, await loadImage(url)]
  } catch (error) {
    console.warn(`[art] player ${element} GBA indisponível; usando sprite procedural.`, error)
    return [element, null]
  }
}

async function loadAtlasArt(): Promise<GameArt> {
  const [terrainAtlas, objectAtlas] = await Promise.all([
    loadImage(TERRAIN_ATLAS_URL),
    loadImage(OBJECT_ATLAS_URL),
  ])
  const playerAtlases = await Promise.all([
    loadOptionalPlayerAtlas('fogo', PLAYER_FIRE_ATLAS_URL),
    loadOptionalPlayerAtlas('agua', PLAYER_WATER_ATLAS_URL),
    loadOptionalPlayerAtlas('raio', PLAYER_LIGHTNING_ATLAS_URL),
    loadOptionalPlayerAtlas('vento', PLAYER_WIND_ATLAS_URL),
    loadOptionalPlayerAtlas('terra', PLAYER_EARTH_ATLAS_URL),
  ])

  const tiles: Record<string, HTMLCanvasElement[]> = {}
  for (const [key, frames] of Object.entries(TERRAIN_FRAMES)) {
    tiles[key] = frames.map((frame) => cropFrame(terrainAtlas, frame))
  }

  const objects: Record<string, HTMLCanvasElement> = {}
  for (const [key, frame] of Object.entries(OBJECT_FRAMES)) {
    objects[key] = cropFrame(objectAtlas, frame)
  }

  const players: Partial<Record<ElementId, PlayerSpriteSet>> = {}
  for (const [element, atlas] of playerAtlases) {
    if (!atlas) continue
    const move = cropMatrix(atlas, PLAYER_FRAMES)
    players[element] = element === 'fogo' ? buildFireCombatSet(move) : { move }
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
