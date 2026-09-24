// ============================================================
// Shinobi Online — componente principal do jogo
// ============================================================

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Coins, FlaskConical, X } from 'lucide-react'

import { net } from './net'
import { audio } from './audio'
import { GameEngine, type HudState } from './engine'
import { InputController } from './input'
import type { ChatEntry } from './ui/Chat'
import { nextChatKey } from './ui/Chat'
import { Chat } from './ui/Chat'
import { Hud, TopRightCluster, ZoneBanner, type GameAction, type SkillInfoLite } from './ui/Hud'
import { PlayersPanel } from './ui/PlayersPanel'
import { Minimap } from './ui/Minimap'
import { TouchControls } from './ui/TouchControls'
import LoginScreen from './ui/LoginScreen'
import { PixelPanel } from './ui/pixel'
import { Button } from '@/components/ui/button'
import type { ElementId, RosterEnt, ShopMsg, WelcomeData } from './types'

const SAVED_KEY = 'shinobi-online-save'
const VALID_ELEMENTS = new Set<ElementId>(['fogo', 'agua', 'raio', 'vento', 'terra'])
const MAX_CHAT_MESSAGES = 200

export default function GameClient() {
  const [phase, setPhase] = useState<'login' | 'playing'>('login')
  const [connected, setConnected] = useState(false)
  const [online, setOnline] = useState(0)
  const [loading, setLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ name: string | null; element: ElementId | null }>({ name: null, element: null })

  const [hud, setHud] = useState<HudState | null>(null)
  const [chatMsgs, setChatMsgs] = useState<ChatEntry[]>([])
  const [roster, setRoster] = useState<RosterEnt[]>([])
  const [chatOpen, setChatOpen] = useState(false)
  const [playersOpen, setPlayersOpen] = useState(false)
  const [muted, setMuted] = useState(false)
  const [deathBy, setDeathBy] = useState<string | null>(null)
  const [shop, setShop] = useState<ShopMsg | null>(null)
  const [missionDone, setMissionDone] = useState<{ name: string; gold: number; xp: number } | null>(null)
  const [zoneBanner, setZoneBanner] = useState<{ name: string; safe: boolean; key: number } | null>(null)
  const [isTouch, setIsTouch] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const inputRef = useRef<InputController | null>(null)
  const welcomeRef = useRef<WelcomeData | null>(null)
  const credsRef = useRef<{ name: string; element: ElementId } | null>(null)
  const [engineVersion, setEngineVersion] = useState(0)

  useEffect(() => {
    const forcedTouch = new URLSearchParams(window.location.search).get('touch') === '1'
    const touch = forcedTouch || window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0
    setIsTouch(touch)
    try {
      const raw = localStorage.getItem(SAVED_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        const name = typeof d?.name === 'string' ? d.name.trim().slice(0, 14) || null : null
        const element = VALID_ELEMENTS.has(d?.element) ? d.element : null
        setSaved({ name, element })
      }
    } catch {
      localStorage.removeItem(SAVED_KEY)
    }

    const socket = net.connect()
    const onConnect = () => setConnected(true)
    const onDisconnect = () => { setConnected(false); inputRef.current?.clearKeys() }
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    net.on('meta', (d) => setOnline(d.online))
    net.on('joinError', (d) => { setLoading(false); setJoinError(d.error || 'Erro ao entrar no jogo.') })
    return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); net.disconnect() }
  }, [])

  useEffect(() => {
    const onWelcome = (w: WelcomeData) => {
      welcomeRef.current = w
      setJoinError(null); setLoading(false); setPhase('playing'); setRoster(w.roster); setHud(null); setChatMsgs([]); setDeathBy(null); setShop(null)
      setEngineVersion((v) => v + 1)
    }
    net.on('welcome', onWelcome)
    return () => net.off('welcome')
  }, [])

  useEffect(() => {
    const socket = net.connect()
    const onReconnect = () => {
      if (phase === 'playing' && credsRef.current) net.join(credsRef.current.name, credsRef.current.element)
    }
    socket.on('connect', onReconnect)
    return () => { socket.off('connect', onReconnect) }
  }, [phase])

  useEffect(() => {
    if (phase !== 'playing') return
    const canvas = canvasRef.current
    const welcome = welcomeRef.current
    if (!canvas || !welcome) return

    const input = new InputController()
    input.attach(canvas)
    inputRef.current = input

    const engine = new GameEngine(canvas, welcome, input)
    engineRef.current = engine
    ;(window as any).__engine = engine
    engine.setOnline(online)
    engine.onZoneChange = (name, safe) => setZoneBanner({ name, safe, key: Date.now() })
    engine.start()
    setHud(engine.buildHud())

    const dispatch = (a: string) => {
      switch (a) {
        case 'attack': engine.basicAttack(); break
        case 'skill0': engine.castSkill(0); break
        case 'skill1': engine.castSkill(1); break
        case 'skill2': engine.castSkill(2); break
        case 'skill3': engine.castSkill(3); break
        case 'potion': engine.drinkPotion(); break
        case 'interact': engine.interact(); break
      }
    }
    input.onAction = dispatch as any

    const onSnapshot = (d: any) => engine.applySnapshot(d)
    const onFx = (d: any) => engine.applyFx(d)
    const onDmg = (d: any) => engine.applyDmg(d)
    net.on('snapshot', onSnapshot); net.on('fx', onFx); net.on('dmg', onDmg)

    const onPJoin = (d: RosterEnt) => setRoster((r) => (r.some((p) => p.id === d.id) ? r : [...r, d]))
    const onPLeave = (d: { id: number }) => setRoster((r) => r.filter((p) => p.id !== d.id))
    const onLvl = (d: { id: number; lv: number }) => setRoster((r) => r.map((p) => (p.id === d.id ? { ...p, lv: d.lv } : p)))
    net.on('pJoin', onPJoin); net.on('pLeave', onPLeave); net.on('lvl', onLvl)

    const pushChat = (entry: ChatEntry) => {
      setChatMsgs((messages) => [...messages.slice(-(MAX_CHAT_MESSAGES - 1)), entry])
    }
    const onChat = (d: any) => pushChat({ key: nextChatKey(), kind: 'chat', name: d.n, lv: d.lv, el: d.el, text: d.text })
    const onSys = (d: { t: string }) => pushChat({ key: nextChatKey(), kind: 'sys', text: d.t })
    const onKill = (d: any) => pushChat({ key: nextChatKey(), kind: 'kill', name: d.k, text: `${d.v} (Nv${d.mlv}) +${d.g} ryō` })
    const onMission = (d: any) => { if (d.done) { setMissionDone({ name: d.name, gold: d.gold, xp: d.xp }); audio.play('lvl') } }
    const onShop = (d: ShopMsg) => setShop(d.open ? d : null)
    const onDead = (d: { by: string }) => setDeathBy(d.by)
    const onRevived = (d: { x: number; y: number }) => { setDeathBy(null); engine.setSelfPos(d.x, d.y) }
    net.on('chat', onChat); net.on('sys', onSys); net.on('kill', onKill); net.on('mission', onMission); net.on('shop', onShop); net.on('dead', onDead); net.on('revived', onRevived)

    const hudTimer = setInterval(() => {
      setHud(engine.buildHud())
      if (engine.online !== online) engine.setOnline(online)
    }, 100)
    const ro = new ResizeObserver(() => engine.resize())
    ro.observe(canvas)

    return () => {
      clearInterval(hudTimer); ro.disconnect(); engine.stop(); input.detach(); engineRef.current = null
      for (const e of ['snapshot','fx','dmg','pJoin','pLeave','lvl','chat','sys','kill','mission','shop','dead','revived']) net.off(e)
    }
  }, [phase, engineVersion])

  useEffect(() => {
    if (!missionDone) return
    const t = setTimeout(() => setMissionDone(null), 5000)
    return () => clearTimeout(t)
  }, [missionDone])

  const handlePlay = useCallback((name: string, element: ElementId) => {
    const cleanName = name.trim().slice(0, 14)
    if (cleanName.length < 2 || !VALID_ELEMENTS.has(element)) return

    audio.init(); credsRef.current = { name: cleanName, element }
    try { localStorage.setItem(SAVED_KEY, JSON.stringify({ name: cleanName, element })) } catch { /* ignora */ }
    setLoading(true); net.join(cleanName, element)
  }, [])

  const dispatchAction = useCallback((a: GameAction) => {
    const engine = engineRef.current
    if (!engine) return
    switch (a) {
      case 'attack': engine.basicAttack(); break
      case 'skill0': engine.castSkill(0); break
      case 'skill1': engine.castSkill(1); break
      case 'skill2': engine.castSkill(2); break
      case 'skill3': engine.castSkill(3); break
      case 'potion': engine.drinkPotion(); break
      case 'interact': engine.interact(); break
    }
  }, [])

  const handleRespawn = useCallback(() => net.respawn(), [])
  const handleSendChat = useCallback((text: string) => net.chat(text), [])
  const handleJoystick = useCallback((x: number, y: number) => inputRef.current?.setJoystick(x, y), [])
  const handleFocusChange = useCallback((focused: boolean) => { if (inputRef.current) inputRef.current.enabled = !focused }, [])
  const toggleMute = useCallback(() => { const m = !muted; setMuted(m); audio.muted = m; if (!m) audio.init() }, [muted])

  const welcome = welcomeRef.current
  if (phase === 'login') {
    return <div className="fixed inset-0 overflow-hidden bg-[#0f0d0a]">
      <LoginScreen online={online} connected={connected} savedName={saved.name} savedElement={saved.element} loading={loading} onPlay={handlePlay} />
      {joinError ? <div className="font-retro fixed bottom-16 left-1/2 z-[60] -translate-x-1/2 border-2 border-[#c03030] bg-[#1a1410] px-4 py-2 text-lg text-[#ff8080] shadow-[4px_4px_0_rgba(0,0,0,0.5)]">{joinError}</div> : null}
    </div>
  }

  return <div className="fixed inset-0 select-none overflow-hidden bg-[#0f0d0a]">
    <canvas ref={canvasRef} className="absolute inset-0 h-full w-full image-pixel" style={{ touchAction: 'none' }} aria-label="Mundo do jogo" />
    <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_52%,rgba(0,0,0,0.42)_100%)]" />
    {hud && welcome ? <>
      <Hud hud={hud} skills={welcome.skills as SkillInfoLite[]} element={welcome.self.el} online={online} muted={muted} deathBy={deathBy} isTouch={isTouch} playersOpen={playersOpen} onToggleMute={toggleMute} onTogglePlayers={() => setPlayersOpen((p) => !p)} onToggleChat={() => setChatOpen((c) => !c)} onAction={dispatchAction} onRespawn={handleRespawn} />
      <TopRightCluster online={online} muted={muted} playersOpen={playersOpen} chatOpen={chatOpen} isTouch={isTouch} onToggleMute={toggleMute} onTogglePlayers={() => setPlayersOpen((p) => !p)} onToggleChat={() => setChatOpen((c) => !c)} />
      {isTouch ? <TouchControls hud={hud} skills={welcome.skills as SkillInfoLite[]} element={welcome.self.el} onAction={dispatchAction} onJoystick={handleJoystick} /> : null}
      <Chat messages={chatMsgs} open={chatOpen || !isTouch} isTouch={isTouch} onSend={handleSendChat} onOpen={() => setChatOpen(true)} onClose={() => setChatOpen(false)} onFocusChange={handleFocusChange} />
      <PlayersPanel players={roster} selfId={welcome.id} open={playersOpen} /><Minimap engine={engineRef.current} />
      {zoneBanner ? <ZoneBanner key={zoneBanner.key} zone={zoneBanner.name} safe={zoneBanner.safe} /> : null}
    </> : <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"><div className="font-pixel animate-pulse text-[10px] tracking-widest text-[#e8d5a9]">CARREGANDO MUNDO...</div></div>}
    {shop ? <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0f0d0a99] p-4"><PixelPanel className="w-[min(400px,92vw)] !p-4" title="ICHIRAKU RAMEN">
      <button type="button" onClick={() => setShop(null)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center border border-[#3a2f22] text-[#a89b7d]" aria-label="Fechar"><X className="h-4 w-4" /></button>
      <div className="font-retro mt-3 space-y-2 text-[15px] text-[#e8d5a9]"><div className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-[#e88a8a]" /><span className="flex-1">Poção de cura (55% do HP)</span><span className="flex items-center gap-1 text-[#f0d060]"><Coins className="h-4 w-4" />{shop.price}</span></div>
      <div className="flex justify-between border-t border-dotted border-[#3a2f22] pt-2 text-[#a89b7d]"><span>Seu ouro: <span className="text-[#f0d060]">{shop.gold} ryō</span></span><span>Poções: <span className="text-[#e88a8a]">{shop.pot}/9</span></span></div>
      <Button onClick={() => net.buyPotion()} disabled={shop.gold < shop.price || shop.pot >= 9} className="h-auto w-full rounded-none border-2 border-[#f97316] bg-[#f97316] py-2.5 font-pixel text-[9px] text-[#1a0e05] shadow-[4px_4px_0_rgba(0,0,0,0.5)] hover:bg-[#ea580c] disabled:opacity-50">COMPRAR POÇÃO</Button></div>
    </PixelPanel></div> : null}
    {missionDone ? <div className="pointer-events-none absolute left-1/2 top-1/4 z-40 -translate-x-1/2 text-center" style={{ animation: 'zone-banner 5s ease forwards' }}><PixelPanel className="!p-4"><div className="font-pixel text-[10px] tracking-widest text-[#7dff7d]">MISSÃO CONCLUÍDA!</div><div className="font-retro mt-2 text-lg text-[#e8d5a9]">{missionDone.name}</div><div className="font-retro mt-1 text-[15px] text-[#f0d060]">+{missionDone.gold} ryō • +{missionDone.xp} XP</div></PixelPanel></div> : null}
    {!connected ? <div className="pointer-events-none absolute inset-x-0 top-1/2 z-50 flex justify-center"><div className="font-pixel border-2 border-[#f0d060] bg-[#1a1410] px-4 py-3 text-[9px] tracking-wider text-[#f0d060] shadow-[4px_4px_0_rgba(0,0,0,0.5)]">RECONECTANDO AO SERVIDOR...</div></div> : null}
  </div>
}
