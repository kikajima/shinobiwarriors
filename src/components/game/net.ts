// ============================================================
// Shinobi Online — camada de rede (Socket.IO)
// O navegador fala sempre com a mesma origem; o Caddy encaminha
// /socket.io/ para o game server na porta 3003.
// ============================================================

'use client'

import { io, type Socket } from 'socket.io-client'
import type {
  ChatMsg, DmgData, FxData, KillMsg, MapData, MissionMsg, RosterEnt,
  ShopMsg, SnapshotData, WelcomeData,
} from './types'

export type NetEvents = {
  meta: (d: { online: number }) => void
  welcome: (d: WelcomeData) => void
  joinError: (d: { error: string }) => void
  snapshot: (d: SnapshotData) => void
  fx: (d: FxData) => void
  dmg: (d: DmgData) => void
  chat: (d: ChatMsg) => void
  sys: (d: { t: string }) => void
  lvl: (d: { id: number; lv: number; n: string }) => void
  kill: (d: KillMsg) => void
  mission: (d: MissionMsg) => void
  shop: (d: ShopMsg) => void
  dead: (d: { by: string }) => void
  revived: (d: { x: number; y: number }) => void
  pJoin: (d: RosterEnt) => void
  pLeave: (d: { id: number }) => void
  objDestroy: (d: { id: number; k: string; x: number; y: number }) => void
}

export class NetClient {
  socket: Socket | null = null

  connect(): Socket {
    // idempotente: reutiliza a instância existente (mesmo ainda conectando)
    if (this.socket) return this.socket
    this.socket = io('/', {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1200,
      timeout: 12000,
    })
    return this.socket
  }

  on<K extends keyof NetEvents>(ev: K, cb: NetEvents[K]) {
    this.socket?.on(ev, cb as any)
  }

  off(ev: string) {
    this.socket?.off(ev)
  }

  get connected() {
    return !!this.socket?.connected
  }

  join(name: string, element: string, village: string) {
    this.socket?.emit('join', { name, element, village })
  }

  move(x: number, y: number, dir: number) {
    this.socket?.emit('move', { x, y, dir })
  }

  attack(tx: number, ty: number) {
    this.socket?.emit('attack', { tx, ty })
  }

  skill(index: number, tx: number, ty: number) {
    this.socket?.emit('skill', { index, tx, ty })
  }

  potion() {
    this.socket?.emit('potion', {})
  }

  chat(text: string) {
    this.socket?.emit('chat', { text })
  }

  interact() {
    this.socket?.emit('interact', {})
  }

  buyPotion() {
    this.socket?.emit('buyPotion', {})
  }

  respawn() {
    this.socket?.emit('respawn', {})
  }

  disconnect() {
    this.socket?.disconnect()
    this.socket = null
  }
}

export const net = new NetClient()
