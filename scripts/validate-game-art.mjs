import sharp from 'sharp'

const expected = [
  ['public/game/gba/terrain.png', 256, 128],
  ['public/game/gba/objects.png', 512, 256],
]

for (const [file, width, height] of expected) {
  const meta = await sharp(file).metadata()
  if (meta.width !== width || meta.height !== height) {
    throw new Error(`${file}: esperado ${width}x${height}, recebido ${meta.width}x${meta.height}`)
  }
  console.log(`[art] OK ${file} ${meta.width}x${meta.height}`)
}

// Células de terreno realmente usadas pelo manifest.
// Cada célula precisa ser praticamente opaca; isso impede mapear sem querer
// uma região vazia/transparente do atlas e recriar "buracos pretos" no mapa.
const terrainCells = [
  [0,0],[1,0],[2,0],[3,0],[4,0],[5,0],[6,0],[7,0],
  [0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],
  [0,2],
]

const terrain = sharp('public/game/gba/terrain.png')
for (const [col, row] of terrainCells) {
  const { data, info } = await terrain
    .clone()
    .extract({ left: col * 32, top: row * 32, width: 32, height: 32 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  let opaque = 0
  for (let i = 3; i < data.length; i += info.channels) {
    if (data[i] > 240) opaque++
  }
  const ratio = opaque / (32 * 32)
  if (ratio < 0.96) {
    throw new Error(`terrain (${col},${row}) tem apenas ${(ratio*100).toFixed(1)}% de cobertura alpha`)
  }
}

console.log(`[art] OK ${terrainCells.length} células de terreno catalogadas`)
