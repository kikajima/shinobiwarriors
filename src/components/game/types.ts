// ============================================================
// Shinobi Online — tipos do protocolo (cliente)
// ============================================================

export type ElementId = 'fogo' | 'agua' | 'raio' | 'vento' | 'terra'

export interface MapData {
  w: number
  h: number
  tiles: string[]
  objects: { k: string; x: number; y: number }[]
  zones: { n: string; x1: number; y1: number; x2: number; y2: number; safe?: boolean }[]
  fountain: { x: number; y: number }
  shopNpc: { x: number; y: number }
}

export interface WelcomeData {
  id: number
  t: number
  online: number
  self: { n: string; el: ElementId; lv: number; xp: number; gold: number; pot: number; x: number; y: number }
  map: MapData
  skills: { name: string; archetype: string; cd: number; ch: number; range: number }[]
  missions: { name: string; monster: string; need: number }[]
  roster: RosterEnt[]
}

export interface RosterEnt {
  id: number
  n: string
  lv: number
  el: ElementId
  pal: number
}

export interface NfEnt {
  k: 'p' | 'm'
  id: number
  n?: string
  lv: number
  el?: ElementId
  pal?: number
  t?: string
}

export interface YouState {
  hp: number
  mh: number
  ch: number
  mc: number
  xp: number
  need: number
  lvl: number
  gold: number
  pot: number
  cds: number[]
  mi: number
  mp: number
  dm: number
}

export interface SnapshotData {
  t: number
  p: number[][]
  m: number[][]
  pr: number[][]
  nf: NfEnt[]
  you: YouState
}

export interface FxData {
  k: string
  el?: ElementId
  x: number
  y: number
  tx?: number
  ty?: number
  r?: number
  boss?: number
}

export interface DmgData {
  x: number
  y: number
  v: number
  c?: number
  h?: number
  tp?: number
}

export interface ChatMsg {
  id: number
  n: string
  lv: number
  el: ElementId
  text: string
}

export interface KillMsg {
  k: string
  klv: number
  v: string
  mlv: number
  g: number
  xp: number
}

export interface MissionMsg {
  i: number
  name?: string
  monster?: string
  need?: number
  prog?: number
  done?: boolean
  gold?: number
  xp?: number
}

export interface ShopMsg {
  open: boolean
  gold: number
  pot: number
  price: number
}

export const TILE = 32
export const MAP_SIZE = 64

// fórmulas espelhadas do servidor
export const maxHpOf = (lv: number) => 90 + 28 * (lv - 1)
export const atkOf = (lv: number) => 15 + 4.5 * (lv - 1)
export const xpNeedOf = (lv: number) => Math.round(70 * Math.pow(lv, 1.35))

export const EL_LIST: ElementId[] = ['fogo', 'agua', 'raio', 'vento', 'terra']

export const EL_COLORS: Record<ElementId, string[]> = {
  fogo: ['#ffdf8a', '#ffb347', '#ff6b35', '#e6392b'],
  agua: ['#dff6ff', '#9bd9f6', '#4aa8e0', '#2f7fb5'],
  raio: ['#ffffff', '#fff3a3', '#ffd23e', '#a8e02e'],
  vento: ['#eaffde', '#b8e986', '#8ecf5a', '#5ba832'],
  terra: ['#d9c39a', '#b09468', '#8a6d3f', '#6b4f2a'],
}

export const EL_NAMES: Record<ElementId, string> = {
  fogo: 'Fogo',
  agua: 'Água',
  raio: 'Raio',
  vento: 'Vento',
  terra: 'Terra',
}

export const MONSTER_NAMES: Record<string, string> = {
  bandido: 'Bandido',
  sapo: 'Sapo Selvagem',
  gennin: 'Gennin Renegado',
  zetsu: 'Zetsu Branco',
  boss: 'Zetsu Ancião',
}
