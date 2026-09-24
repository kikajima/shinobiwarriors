// ============================================================
// Shinobi Online — persistência simples (JSON no disco)
// ============================================================

import type { SavedPlayer } from './types'

const PATH = `${import.meta.dir}/save.json`

export function loadSave(): Record<string, SavedPlayer> {
  try {
    // leitura síncrona via readFileSync
    const fs = require('fs')
    if (fs.existsSync(PATH)) {
      return JSON.parse(fs.readFileSync(PATH, 'utf8'))
    }
  } catch (e) {
    console.warn('[persist] falha ao carregar save.json:', e)
  }
  return {}
}

export function saveReal(data: Record<string, SavedPlayer>) {
  try {
    const fs = require('fs')
    fs.writeFileSync(`${PATH}.tmp`, JSON.stringify(data))
    fs.renameSync(`${PATH}.tmp`, PATH)
  } catch (e) {
    console.warn('[persist] falha ao salvar save.json:', e)
  }
}
