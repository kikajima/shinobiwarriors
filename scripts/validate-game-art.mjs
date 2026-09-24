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

for (const [col, row] of terrainCells) {
  const stats = await sharp('public/game/gba/terrain.png')
    .extract({ left: col * 32, top: row * 32, width: 32, height: 32 })
    .ensureAlpha()
    .stats()

  const alpha = stats.channels[3]
  if (!alpha || alpha.min < 240) {
    throw new Error(
      `terrain (${col},${row}) contém transparência inesperada (alpha min=${alpha?.min ?? 'n/a'})`,
    )
  }
}

console.log(`[art] OK ${terrainCells.length} células de terreno catalogadas`)
