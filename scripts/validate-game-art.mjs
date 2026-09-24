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
  if (!meta.hasAlpha) {
    console.warn(`[art] ${file} não informa canal alpha; verifique transparência do atlas.`)
  }
  console.log(`[art] OK ${file} ${meta.width}x${meta.height}`)
}
