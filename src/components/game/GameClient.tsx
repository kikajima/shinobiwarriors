// ============================================================
// Shinobi Online — componente principal do jogo
// ============================================================

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Coins, Crosshair, FlaskConical, X } from 'lucide-react'

import { net } from './net'
import { audio } from './audio'
import { GameEngine, type HudState } from './engine'
import { loadGameArt, type GameArt } from './assets'
import { InputController } from './input'
import type { ChatEntry } from './ui/Chat'
import { nextChatKey } from './ui/Chat'
import { Chat } from './ui/Chat'
import { Hud, TopRightCluster, ZoneBanner, type GameAction, type SkillInfoLite } from './ui/Hud'
import { PlayersPanel } from './ui/PlayersPanel'
import { Minimap } from './ui/Minimap'
import { TouchControls } from './ui/TouchControls'
import { InventoryPanel } from './ui/InventoryPanel'
import { EquipmentShopPanel } from './ui/EquipmentShopPanel'
import LoginScreen from './ui/LoginScreen'
import { PixelPanel } from './ui/pixel'
import { Button } from '@/components/ui/button'
import { VILLAGE_IDS, VILLAGE_NAMES, type BountyCompleteMsg, type BountyMsg, type ElementId, type EquipmentShopMsg, type EquipmentSlot, type EquipmentStateMsg, type InventoryMsg, type InventorySlotView, type VillageId, type RosterEnt, type ShopMsg, type WelcomeData } from './types'

const SAVED_KEY = 'shinobi-online-save'
const VALID_ELEMENTS = new Set<ElementId>(['fogo', 'agua', 'raio', 'vento', 'terra'])
const VALID_VILLAGES = new Set<VillageId>(VILLAGE_IDS)
const MAX_CHAT_MESSAGES = 200

export default function GameClient() {
  const [phase, setPhase] = useState<'login' | 'playing'>('login')
  const [connected, setConnected] = useState(false)
  const [online, setOnline] = useState(0)
  const [loading, setLoading] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ name: string | null; element: ElementId | null; village: VillageId | null }>({ name: null, element: null, village: null })

  const [hud, setHud] = useState<HudState | null>(null)
  const [chatMsgs, setChatMsgs] = useState<ChatEntry[]>([])
  const [roster, setRoster] = useState<RosterEnt[]>([])
  const [chatOpen, setChatOpen] = useState(false)
  const [playersOpen, setPlayersOpen] = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [inventorySlots, setInventorySlots] = useState<InventorySlotView[]>([])
  const [equipmentState, setEquipmentState] = useState<EquipmentStateMsg | null>(null)
  const [equipmentShop, setEquipmentShop] = useState<EquipmentShopMsg | null>(null)
  const [muted, setMuted] = useState(false)
  const [deathBy, setDeathBy] = useState<string | null>(null)
  const [shop, setShop] = useState<ShopMsg | null>(null)
  const [bounty, setBounty] = useState<BountyMsg | null>(null)
  const [bountyDone, setBountyDone] = useState<BountyCompleteMsg | null>(null)
  const [missionDone, setMissionDone] = useState<{ name: string; gold: number; xp: number } | null>(null)
  const [zoneBanner, setZoneBanner] = useState<{ name: string; safe: boolean; key: number } | null>(null)
  const [isTouch, setIsTouch] = useState(false)
  const [art, setArt] = useState<GameArt | null>(null)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<GameEngine | null>(null)
  const inputRef = useRef<InputController | null>(null)
  const welcomeRef = useRef<WelcomeData | null>(null)
  const credsRef = useRef<{ name: string; element: ElementId; village: VillageId } | null>(null)
  const [engineVersion, setEngineVersion] = useState(0)

  useEffect(() => {
    void loadGameArt().then(setArt)

    const forcedTouch = new URLSearchParams(window.location.search).get('touch') === '1'
    const touch = forcedTouch || window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0
    setIsTouch(touch)
    try {
      const raw = localStorage.getItem(SAVED_KEY)
      if (raw) {
        const d = JSON.parse(raw)
        const name = typeof d?.name === 'string' ? d.name.trim().slice(0, 14) || null : null
        const element = VALID_ELEMENTS.has(d?.element) ? d.element : null
        const village = VALID_VILLAGES.has(d?.village) ? d.village : null
        setSaved({ name, element, village })
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
      setJoinError(null); setLoading(false); setPhase('playing'); setRoster(w.roster); setHud(null); setChatMsgs([]); setDeathBy(null); setShop(null); setEquipmentShop(null); setInventoryOpen(false); setInventorySlots(w.self.inventory || []); setEquipmentState({loadout:w.self.equipment,stats:w.self.equipmentStats,gold:w.self.gold,forgeCosts:{head:null,torso:null,boots:null,gloves:null,accessory1:null,accessory2:null,pants:null}}); setBounty(w.self.bounty ? { open:false, active:true, contract:w.self.bounty } : null); setBountyDone(null)
      setEngineVersion((v) => v + 1)
    }
    net.on('welcome', onWelcome)
    return () => net.off('welcome')
  }, [])

  useEffect(() => {
    const socket = net.connect()
    const onReconnect = () => {
      if (phase === 'playing' && credsRef.current) net.join(credsRef.current.name, credsRef.current.element, credsRef.current.village)
    }
    socket.on('connect', onReconnect)
    return () => { socket.off('connect', onReconnect) }
  }, [phase])

  useEffect(() => {
    if (phase !== 'playing' || !art) return
    const canvas = canvasRef.current
    const welcome = welcomeRef.current
    if (!canvas || !welcome) return

    const input = new InputController()
    input.attach(canvas)
    inputRef.current = input

    const engine = new GameEngine(canvas, welcome, input, art)
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
        case 'inventory': input.clearKeys(); setInventoryOpen((v) => !v); break
      }
    }
    input.onAction = dispatch as any

    const onSnapshot = (d: any) => engine.applySnapshot(d)
    const onFx = (d: any) => engine.applyFx(d)
    const onDmg = (d: any) => engine.applyDmg(d)
    net.on('snapshot', onSnapshot); net.on('fx', onFx); net.on('dmg', onDmg)
    const onObjDestroy = (d: { id: number; k: string; x: number; y: number }) => engine.destroyObject(d)
    const onObjRespawn = (d: { id: number; k: string; x: number; y: number; hp?: number }) => engine.restoreObject(d)
    net.on('objDestroy', onObjDestroy); net.on('objRespawn', onObjRespawn)

    const onPJoin = (d: RosterEnt) => setRoster((r) => (r.some((p) => p.id === d.id) ? r : [...r, d]))
    const onPLeave = (d: { id: number }) => setRoster((r) => r.filter((p) => p.id !== d.id))
    const onLvl = (d: { id: number; lv: number }) => setRoster((r) => r.map((p) => (p.id === d.id ? { ...p, lv: d.lv } : p)))
    net.on('pJoin', onPJoin); net.on('pLeave', onPLeave); net.on('lvl', onLvl)

    const pushChat = (entry: ChatEntry) => {
      setChatMsgs((messages) => [...messages.slice(-(MAX_CHAT_MESSAGES - 1)), entry])
    }
    const onChat = (d: any) => pushChat({ key: nextChatKey(), kind: 'chat', name: d.n, lv: d.lv, el: d.el, text: d.text })
    const onSys = (d: { t: string }) => pushChat({ key: nextChatKey(), kind: 'sys', text: d.t })
    const onMission = (d: any) => { if (d.done) { setMissionDone({ name: d.name, gold: d.gold, xp: d.xp }); audio.play('lvl') } }
    const onShop = (d: ShopMsg) => setShop(d.open ? d : null)
    const onBounty = (d: BountyMsg) => setBounty(d)
    const onBountyComplete = (d: BountyCompleteMsg) => { setBounty(null); setBountyDone(d); audio.play('lvl') }
    const onInventory = (d: InventoryMsg) => setInventorySlots(d.slots || [])
    const onEquipment = (d: EquipmentStateMsg) => setEquipmentState(d)
    const onEquipmentShop = (d: EquipmentShopMsg) => { setEquipmentShop(d.open ? d : null); setEquipmentState(d.equipment) }
    const onDead = (d: { by: string }) => setDeathBy(d.by)
    const onRevived = (d: { x: number; y: number }) => { setDeathBy(null); engine.setSelfPos(d.x, d.y) }
    net.on('chat', onChat); net.on('sys', onSys); net.on('mission', onMission); net.on('shop', onShop); net.on('bounty', onBounty); net.on('bountyComplete', onBountyComplete); net.on('inventory', onInventory); net.on('equipment', onEquipment); net.on('equipmentShop', onEquipmentShop); net.on('dead', onDead); net.on('revived', onRevived)

    const hudTimer = setInterval(() => {
      setHud(engine.buildHud())
      if (engine.online !== online) engine.setOnline(online)
    }, 100)
    const ro = new ResizeObserver(() => engine.resize())
    ro.observe(canvas)

    return () => {
      clearInterval(hudTimer); ro.disconnect(); engine.stop(); input.detach(); engineRef.current = null
      for (const e of ['snapshot','fx','dmg','objDestroy','objRespawn','pJoin','pLeave','lvl','chat','sys','mission','shop','bounty','bountyComplete','inventory','equipment','equipmentShop','dead','revived']) net.off(e)
    }
  }, [phase, engineVersion, art])

  useEffect(() => {
    if (!missionDone) return
    const t = setTimeout(() => setMissionDone(null), 5000)
    return () => clearTimeout(t)
  }, [missionDone])

  useEffect(() => {
    if (!bountyDone) return
    const t = setTimeout(() => setBountyDone(null), 5500)
    return () => clearTimeout(t)
  }, [bountyDone])

  const handlePlay = useCallback((name: string, element: ElementId, village: VillageId) => {
    const cleanName = name.trim().slice(0, 14)
    if (cleanName.length < 2 || !VALID_ELEMENTS.has(element) || !VALID_VILLAGES.has(village)) return

    audio.init(); credsRef.current = { name: cleanName, element, village }
    try { localStorage.setItem(SAVED_KEY, JSON.stringify({ name: cleanName, element, village })) } catch { /* ignora */ }
    setLoading(true); net.join(cleanName, element, village)
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
      <LoginScreen online={online} connected={connected} savedName={saved.name} savedElement={saved.element} savedVillage={saved.village} loading={loading} onPlay={handlePlay} />
      {joinError ? <div className="font-retro fixed bottom-16 left-1/2 z-[60] -translate-x-1/2 border-2 border-[#c03030] bg-[#1a1410] px-4 py-2 text-lg text-[#ff8080] shadow-[4px_4px_0_rgba(0,0,0,0.5)]">{joinError}</div> : null}
    </div>
  }

  return <div className="fixed inset-0 select-none overflow-hidden bg-[#0f0d0a]">
    <canvas ref={canvasRef} className="absolute inset-0 h-full w-full image-pixel" style={{ touchAction: 'none' }} aria-label="Mundo do jogo" />
    <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_52%,rgba(0,0,0,0.42)_100%)]" />
    {hud && welcome ? <>
      <Hud hud={hud} skills={welcome.skills as SkillInfoLite[]} element={welcome.self.el} online={online} muted={muted} deathBy={deathBy} isTouch={isTouch} playersOpen={playersOpen} onToggleMute={toggleMute} onTogglePlayers={() => setPlayersOpen((p) => !p)} onToggleChat={() => setChatOpen((c) => !c)} onAction={dispatchAction} onRespawn={handleRespawn} />
      <TopRightCluster online={online} muted={muted} playersOpen={playersOpen} chatOpen={chatOpen} inventoryOpen={inventoryOpen} isTouch={isTouch} onToggleMute={toggleMute} onTogglePlayers={() => setPlayersOpen((p) => !p)} onToggleChat={() => setChatOpen((c) => !c)} onToggleInventory={() => { inputRef.current?.clearKeys(); setInventoryOpen((v) => !v) }} />
      {isTouch ? <TouchControls hud={hud} skills={welcome.skills as SkillInfoLite[]} element={welcome.self.el} onAction={dispatchAction} onJoystick={handleJoystick} /> : null}
      <Chat messages={chatMsgs} open={chatOpen || !isTouch} isTouch={isTouch} onSend={handleSendChat} onOpen={() => setChatOpen(true)} onClose={() => setChatOpen(false)} onFocusChange={handleFocusChange} />
      <PlayersPanel players={roster} selfId={welcome.id} open={playersOpen} /><Minimap engine={engineRef.current} />
      {zoneBanner ? <ZoneBanner key={zoneBanner.key} zone={zoneBanner.name} safe={zoneBanner.safe} /> : null}
    </> : <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"><div className="font-pixel animate-pulse text-[10px] tracking-widest text-[#e8d5a9]">CARREGANDO MUNDO...</div></div>}
    {welcome ? <InventoryPanel open={inventoryOpen} slots={inventorySlots} capacity={welcome.inventoryCapacity || 24} itemDefs={welcome.items || []} equipment={equipmentState} onClose={() => setInventoryOpen(false)} onUse={(slot) => net.inventoryUse(slot)} onEquip={(slot,target) => net.equipItem(slot,target)} onUnequip={(slot) => net.unequipItem(slot)} /> : null}
    {welcome && equipmentShop ? <EquipmentShopPanel shop={equipmentShop} level={hud?.lvl || welcome.self.lv} inventory={inventorySlots} itemDefs={welcome.items || []} onClose={() => setEquipmentShop(null)} onBuy={(id) => net.buyEquipment(id)} onForge={(slot: EquipmentSlot) => net.forgeEquipment(slot)} /> : null}
    {shop ? <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0f0d0a99] p-4"><PixelPanel className="w-[min(400px,92vw)] !p-4" title={shop.name || "LOJA DE SUPRIMENTOS"}>
      <button type="button" onClick={() => setShop(null)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center border border-[#3a2f22] text-[#a89b7d]" aria-label="Fechar"><X className="h-4 w-4" /></button>
      <div className="font-retro mt-3 space-y-2 text-[15px] text-[#e8d5a9]"><div className="flex items-center gap-2"><FlaskConical className="h-5 w-5 text-[#e88a8a]" /><span className="flex-1">Poção de cura (55% do HP)</span><span className="flex items-center gap-1 text-[#f0d060]"><Coins className="h-4 w-4" />{shop.price}</span></div>
      <div className="flex justify-between border-t border-dotted border-[#3a2f22] pt-2 text-[#a89b7d]"><span>Seu ouro: <span className="text-[#f0d060]">{shop.gold} ryō</span></span><span>Poções: <span className="text-[#e88a8a]">{shop.pot}/9</span></span></div>
      <Button onClick={() => net.buyPotion()} disabled={shop.gold < shop.price || shop.pot >= 9} className="h-auto w-full rounded-none border-2 border-[#f97316] bg-[#f97316] py-2.5 font-pixel text-[9px] text-[#1a0e05] shadow-[4px_4px_0_rgba(0,0,0,0.5)] hover:bg-[#ea580c] disabled:opacity-50">COMPRAR POÇÃO</Button></div>
    </PixelPanel></div> : null}
    {bounty?.active && !bounty.open && bounty.contract ? <div className="pointer-events-auto absolute bottom-28 left-3 z-30 max-w-[310px] border-2 border-[#7a3328] bg-[#1a1410e8] px-3 py-2 shadow-[3px_3px_0_rgba(0,0,0,0.5)]"><div className="font-pixel text-[8px] tracking-wider text-[#ff8a80]">CAÇADA ATIVA</div><div className="font-retro mt-1 text-[15px] text-[#e8d5a9]">{bounty.contract.targetName} · Nv{bounty.contract.targetLv}</div><button type="button" onClick={() => net.bountyTrack()} className="font-retro mt-1 border border-[#7a3328] px-2 py-0.5 text-[13px] text-[#ffb0a8]"><Crosshair className="mr-1 inline h-3 w-3" />Rastrear</button></div> : null}
    {bounty?.open ? <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0f0d0a99] p-4"><PixelPanel className="w-[min(440px,94vw)] !p-4" title="OFICIAL DE CAÇADAS">
      <button type="button" onClick={() => setBounty((b) => b ? { ...b, open: false } : null)} className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center border border-[#3a2f22] text-[#a89b7d]" aria-label="Fechar"><X className="h-4 w-4" /></button>
      {bounty.contract ? <div className="font-retro mt-3 space-y-3 text-[15px] text-[#e8d5a9]">
        <div className="border-2 border-[#5a2822] bg-[#241512] p-3"><div className="font-pixel text-[8px] tracking-wider text-[#ff8a80]">ALVO PROCURADO</div><div className="mt-2 text-xl text-[#fff0dc]">{bounty.contract.targetName}</div><div className="text-[#bfae91]">Nv{bounty.contract.targetLv} · {VILLAGE_NAMES[bounty.contract.targetVillage]}</div></div>
        <div className="flex justify-between border-y border-dotted border-[#4a3528] py-2"><span>Recompensa:</span><span className="text-[#f0d060]">+{bounty.contract.rewardGold} ryō · +{bounty.contract.rewardXp} XP</span></div>
        {bounty.clue ? <div className="border border-[#39506a] bg-[#121b24] p-2 text-[#9bd9f6]"><Crosshair className="mr-1 inline h-4 w-4" />Pista: {bounty.clue.distance}, direção {bounty.clue.direction}, região <span className="text-[#dff6ff]">{bounty.clue.zone}</span>{bounty.clue.safe ? ' (zona segura)' : ''}.</div> : null}
        {bounty.error ? <div className="border border-[#7a3328] bg-[#2b1512] p-2 text-[#ff9b91]">{bounty.error}</div> : null}
        <div className="grid grid-cols-2 gap-2"><Button onClick={() => net.bountyTrack()} className="h-auto rounded-none border-2 border-[#d65b4a] bg-[#8f3028] py-2 font-pixel text-[8px] text-white hover:bg-[#a83a30]"><Crosshair className="mr-1 h-4 w-4" />RASTREAR</Button><Button onClick={() => net.bountyAbandon()} className="h-auto rounded-none border-2 border-[#5a4a32] bg-[#211a12] py-2 font-pixel text-[8px] text-[#c8baa0] hover:bg-[#2d2318]">ABANDONAR</Button></div>
      </div> : <div className="font-retro mt-4 text-center text-[16px] text-[#c8baa0]">{bounty.error || 'Não há contratos disponíveis agora.'}</div>}
    </PixelPanel></div> : null}
    {bountyDone ? <div className="pointer-events-none absolute left-1/2 top-[30%] z-40 -translate-x-1/2 text-center" style={{ animation: 'zone-banner 5.5s ease forwards' }}><PixelPanel className="!p-4"><div className="font-pixel text-[10px] tracking-widest text-[#ff8a80]">CAÇADA CONCLUÍDA!</div><div className="font-retro mt-2 text-lg text-[#e8d5a9]">{bountyDone.target}</div><div className="font-retro mt-1 text-[15px] text-[#f0d060]">+{bountyDone.gold} ryō · +{bountyDone.xp} XP</div></PixelPanel></div> : null}
    {missionDone ? <div className="pointer-events-none absolute left-1/2 top-1/4 z-40 -translate-x-1/2 text-center" style={{ animation: 'zone-banner 5s ease forwards' }}><PixelPanel className="!p-4"><div className="font-pixel text-[10px] tracking-widest text-[#7dff7d]">MISSÃO CONCLUÍDA!</div><div className="font-retro mt-2 text-lg text-[#e8d5a9]">{missionDone.name}</div><div className="font-retro mt-1 text-[15px] text-[#f0d060]">+{missionDone.gold} ryō • +{missionDone.xp} XP</div></PixelPanel></div> : null}
    {!connected ? <div className="pointer-events-none absolute inset-x-0 top-1/2 z-50 flex justify-center"><div className="font-pixel border-2 border-[#f0d060] bg-[#1a1410] px-4 py-3 text-[9px] tracking-wider text-[#f0d060] shadow-[4px_4px_0_rgba(0,0,0,0.5)]">RECONECTANDO AO SERVIDOR...</div></div> : null}
  </div>
}
