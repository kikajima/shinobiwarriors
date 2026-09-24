import { readFileSync } from 'node:fs'
import sharp from 'sharp'

const expected = [
  ['public/game/gba/terrain.png', 256, 128],
  ['public/game/gba/objects.png', 512, 256],
  ['public/game/gba/player-fire.png', 96, 160],
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
