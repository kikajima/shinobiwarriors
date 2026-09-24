// Smoke test do servidor de jogo
import { io } from 'socket.io-client'

const socket = io('http://localhost:3003', { path: '/', transports: ['websocket'] })

let snapshots = 0
let chats = 0
let dmg = 0
let fx = 0

socket.on('connect', () => {
  console.log('connected:', socket.id)
  socket.emit('join', { name: 'TesteKage', element: 'fogo' })
})

socket.on('meta', (d) => console.log('meta:', JSON.stringify(d)))

socket.on('welcome', (d) => {
  console.log('welcome: id=', d.id, 'self=', JSON.stringify(d.self), 'skills=', d.skills.length, 'map tiles=', d.map.tiles.length, 'objects=', d.map.objects.length, 'roster=', d.roster.length)
  setTimeout(() => {
    socket.emit('move', { x: d.self.x + 300, y: d.self.y, dir: 3 })
    socket.emit('skill', { index: 0, tx: d.self.x + 200, ty: d.self.y })
    socket.emit('chat', { text: 'oi galera, alguem on?' })
    socket.emit('potion', {})
    socket.emit('interact', {})
  }, 500)
})

socket.on('joinError', (d) => console.log('joinError:', JSON.stringify(d)))
socket.on('snapshot', (d) => {
  snapshots++
  if (snapshots === 20) {
    console.log('snapshot@20: t=', d.t, 'p=', d.p.length, 'm=', d.m.length, 'pr=', d.pr.length, 'nf=', d.nf.length, 'you=', JSON.stringify(d.you).slice(0, 200))
  }
})
socket.on('chat', (d) => {
  chats++
  if (chats <= 3) console.log('chat:', d.n, '(lv' + d.lv + '):', d.text)
})
socket.on('sys', (d) => console.log('sys:', d.t))
socket.on('dmg', () => dmg++)
socket.on('fx', () => fx++)
socket.on('kill', (d) => console.log('kill:', d.k, '->', d.v, '+', d.g, 'ryō'))
socket.on('lvl', (d) => console.log('lvl:', d.n, d.lv))
socket.on('mission', (d) => console.log('mission:', JSON.stringify(d)))
socket.on('shop', (d) => console.log('shop:', JSON.stringify(d)))
socket.on('dead', () => console.log('dead!'))
socket.on('revived', (d) => console.log('revived:', JSON.stringify(d)))

setTimeout(() => {
  console.log(`--- resumo: snapshots=${snapshots} chats=${chats} dmg=${dmg} fx=${fx}`)
  process.exit(0)
}, 12000)
