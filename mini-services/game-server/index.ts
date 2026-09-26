// ============================================================
// Shinobi Online — servidor de jogo (porta 3003)
// Socket.IO usa /socket.io/; o Caddy encaminha esse caminho
// da porta pública 81 para este serviço.
// ============================================================

import { createServer } from 'http'
import { Server } from 'socket.io'
import { Game } from './src/game'

const httpServer = createServer()

const io = new Server(httpServer, {
  path: '/socket.io/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

const game = new Game(io)
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

io.on('connection', (socket) => {
  socket.emit('meta', { online: game.onlineCount() })

  socket.on('join', (data: { name?: string; element?: string; village?: string }) => {
    const res = game.addHuman(socket, String(data?.name || ''), (data?.element || 'fogo') as any, data?.village)
    if (!res.ok) socket.emit('joinError', { error: res.error })
  })

  socket.on('move', (d: { x?: number; y?: number; dir?: number } | undefined) => {
    if (!isFiniteNumber(d?.x) || !isFiniteNumber(d?.y)) return
    game.handleMove(socket, {
      x: d.x,
      y: d.y,
      dir: Number.isInteger(d.dir) ? Number(d.dir) : 0,
    })
  })

  socket.on('attack', (d: { tx?: number; ty?: number } | undefined) => {
    const ent = game.entOf(socket)
    if (!ent) return
    game.basicAttack(
      ent,
      isFiniteNumber(d?.tx) ? d.tx : ent.x,
      isFiniteNumber(d?.ty) ? d.ty : ent.y + 1,
    )
  })

  socket.on('skill', (d: { index?: number; tx?: number; ty?: number } | undefined) => {
    const ent = game.entOf(socket)
    if (!ent) return
    const idx = Math.max(0, Math.min(3, Math.floor(Number(d?.index) || 0)))
    game.castSkill(
      ent,
      idx,
      isFiniteNumber(d?.tx) ? d.tx : ent.x,
      isFiniteNumber(d?.ty) ? d.ty : ent.y + 1,
    )
  })

  socket.on('potion', () => {
    const ent = game.entOf(socket)
    if (ent) game.usePotion(ent)
  })

  socket.on('chat', (d?: { text?: string }) => game.handleChat(socket, d))

  socket.on('interact', () => game.handleInteract(socket))

  socket.on('buyPotion', () => game.handleBuyPotion(socket))

  socket.on('bountyTrack', () => game.handleBountyTrack(socket))
  socket.on('bountyAbandon', () => game.handleBountyAbandon(socket))

  socket.on('respawn', () => {
    const ent = game.entOf(socket)
    if (ent) game.respawnPlayer(ent)
  })

  socket.on('disconnect', () => {
    game.removeHuman(socket)
  })
})

// loop de simulação: 20Hz
setInterval(() => game.tick(), 50)

// meta broadcast (contagem online para telas de login)
setInterval(() => {
  io.emit('meta', { online: game.onlineCount() })
}, 15000)

setInterval(() => {
  console.log(`[status] online=${game.onlineCount()} monstros=${game.monsters.size}`)
}, 60000)

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[shinobi-online] servidor de jogo rodando na porta ${PORT}`)
})

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0))
})
