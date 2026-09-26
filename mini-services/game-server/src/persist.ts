// ============================================================
// Shinobi Online — persistência simples (JSON no disco)
// ============================================================

import {
  existsSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import type { SavedBotProfile, SavedPlayer } from './types'

const PLAYER_PATH = `${import.meta.dir}/save.json`
const BOT_PATH = `${import.meta.dir}/bots.json`

function loadJson<T>(path: string, label: string): Record<string, T> {
  try {
    if (!existsSync(path)) return {}
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn(`[persist] ${label} inválido; iniciando vazio.`)
      return {}
    }
    return parsed as Record<string, T>
  } catch (e) {
    console.warn(`[persist] falha ao carregar ${label}:`, e)
    return {}
  }
}

function saveJson<T>(path: string, data: Record<string, T>, label: string) {
  const tmpPath = `${path}.tmp`
  try {
    writeFileSync(tmpPath, JSON.stringify(data))
    try {
      renameSync(tmpPath, path)
    } catch (e: any) {
      if (e?.code !== 'EEXIST' && e?.code !== 'EPERM' && e?.code !== 'EACCES') throw e
      if (existsSync(path)) unlinkSync(path)
      renameSync(tmpPath, path)
    }
  } catch (e) {
    console.warn(`[persist] falha ao salvar ${label}:`, e)
    try {
      if (existsSync(tmpPath)) unlinkSync(tmpPath)
    } catch {
      // melhor esforço
    }
  }
}

export function loadSave(): Record<string, SavedPlayer> {
  return loadJson<SavedPlayer>(PLAYER_PATH, 'save.json')
}

export function saveReal(data: Record<string, SavedPlayer>) {
  saveJson(PLAYER_PATH, data, 'save.json')
}

export function loadBotSave(): Record<string, SavedBotProfile> {
  return loadJson<SavedBotProfile>(BOT_PATH, 'bots.json')
}

export function saveBotReal(data: Record<string, SavedBotProfile>) {
  saveJson(BOT_PATH, data, 'bots.json')
}
