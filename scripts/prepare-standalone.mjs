import { cpSync, existsSync, mkdirSync } from 'node:fs'

const standalone = '.next/standalone'

if (!existsSync(standalone)) {
  throw new Error('Next.js não gerou .next/standalone. Verifique output: "standalone" em next.config.ts.')
}

mkdirSync(`${standalone}/.next`, { recursive: true })

if (existsSync('.next/static')) {
  cpSync('.next/static', `${standalone}/.next/static`, { recursive: true, force: true })
}

if (existsSync('public')) {
  cpSync('public', `${standalone}/public`, { recursive: true, force: true })
}

console.log('Standalone preparado com assets estáticos e public/.')
