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
import type { SavedPlayer } from './types'

const PATH = `${import.meta.dir}/save.json`
const TMP_PATH = `${PATH}.tmp`

export function loadSave(): Record<string, SavedPlayer> {
  try {
    if (!existsSync(PATH)) return {}

    const parsed = JSON.parse(readFileSync(PATH, 'utf8'))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      console.warn('[persist] save.json inválido; iniciando save vazio.')
      return {}
    }

    return parsed as Record<string, SavedPlayer>
  } catch (e) {
    console.warn('[persist] falha ao carregar save.json:', e)
    return {}
  }
}

export function saveReal(data: Record<string, SavedPlayer>) {
  try {
    writeFileSync(TMP_PATH, JSON.stringify(data))

    try {
      renameSync(TMP_PATH, PATH)
    } catch (e: any) {
      if (e?.code !== 'EEXIST' && e?.code !== 'EPERM' && e?.code !== 'EACCES') throw e
      if (existsSync(PATH)) unlinkSync(PATH)
      renameSync(TMP_PATH, PATH)
    }
  } catch (e) {
    console.warn('[persist] falha ao salvar save.json:', e)
    try {
      if (existsSync(TMP_PATH)) unlinkSync(TMP_PATH)
    } catch {
      // melhor esforço: erro de limpeza não deve derrubar o servidor
    }
  }
}
