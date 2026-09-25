import { Game } from './src/game'
import { MAX_LEVEL } from './src/data'

if (MAX_LEVEL !== 200) throw new Error(`MAX_LEVEL inválido: ${MAX_LEVEL}`)

const game = new Game({} as any)
const bots = [...game.players.values()].filter((p: any) => p.kind === 'bot')
if (!bots.length) throw new Error('nenhum bot encontrado')
const invalid = bots.filter((p: any) => p.lv < 45 || p.lv > 55)
if (invalid.length) throw new Error(`bots fora da faixa 45-55: ${invalid.map((p: any) => p.lv).join(',')}`)

const min = Math.min(...bots.map((p: any) => p.lv))
const max = Math.max(...bots.map((p: any) => p.lv))
console.log(`[progression] OK: cap=${MAX_LEVEL}, bots=${bots.length}, faixa observada=${min}-${max}`)
