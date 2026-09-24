import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import sharp from 'sharp'

const expected = [
  ['public/game/gba/terrain.png', 256, 128],
  ['public/game/gba/objects.png', 512, 256],
  ['public/game/gba/player-fire.png', 96, 160],
  ['public/game/gba/player-fire-actions.png', 96, 40],
  ['public/game/gba/player-water.png', 96, 160],
  ['public/game/gba/player-lightning.png', 96, 160],
  ['public/game/gba/player-wind.png', 96, 160],
  ['public/game/gba/player-earth.png', 96, 160],
]

for (const [file, width, height] of expected) {
  const meta = await sharp(file).metadata()
  if (meta.width !== width || meta.height !== height) {
    throw new Error(`${file}: esperado ${width}x${height}, recebido ${meta.width}x${meta.height}`)
  }
  console.log(`[art] OK ${file} ${meta.width}x${meta.height}`)
}

// terrain.png tem conteúdo válido nas linhas 0 e 1 e na célula (0,2).
// O restante da linha 2 e toda a linha 3 são transparentes.
// Lemos o manifest usado pelo jogo para impedir que uma coordenada vazia
// volte a ser mapeada como grama/caminho/etc.
const allowedTerrainCells = new Set([
  '0,0','1,0','2,0','3,0','4,0','5,0','6,0','7,0',
  '0,1','1,1','2,1','3,1','4,1','5,1','6,1','7,1',
  '0,2',
])

const manifest = readFileSync('src/components/game/art-manifest.ts', 'utf8')
const used = [...manifest.matchAll(/tile\(\s*(\d+)\s*,\s*(\d+)\s*\)/g)]
  .map((match) => `${match[1]},${match[2]}`)

if (!used.length) throw new Error('Nenhuma célula de terreno encontrada no art-manifest.ts')

for (const cell of used) {
  if (!allowedTerrainCells.has(cell)) {
    throw new Error(`art-manifest.ts aponta para célula de terreno vazia: (${cell})`)
  }
}

console.log(`[art] OK ${used.length} referências de terreno apontam apenas para células catalogadas`)


const playerHashes = {
  'public/game/gba/player-fire.png': '146786e840083b7bfdc5429c04b6345939503605d9de33ba18e1f1a8c450a355',
  'public/game/gba/player-fire-actions.png': '94b9aa775c519bdd2f3ff00308e7860f8797f2a64f83cc25574b0f3fc2da8155',
  'public/game/gba/player-water.png': 'a0d469f9eaf4f5c4b79759bb08cbc78ccd803f65cd4a32644c1b5d20c469ef9c',
  'public/game/gba/player-lightning.png': '8aaef7d5fb8bbf075d4419ac711a4ef1da31ee51929cde85e36dbce7ce060380',
  'public/game/gba/player-wind.png': 'f075db39079a9d14e7acd3249cea40e87dd68fd96e8aba250e04cfe7c35129e0',
  'public/game/gba/player-earth.png': '150023113873560ac9ac109c30b7fa52d8f92c968a3773e5ed1c01c66092213b',
}

for (const [file, expectedHash] of Object.entries(playerHashes)) {
  const bytes = readFileSync(file)
  const actualHash = createHash('sha256').update(bytes).digest('hex')
  if (actualHash !== expectedHash) {
    throw new Error(`${file} hash inválido: ${actualHash}`)
  }
  console.log(`[art] OK ${file} hash`)
}
