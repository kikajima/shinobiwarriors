'use client'

import { useState } from 'react'
import { Keyboard, Loader2, Smartphone, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { ELEMENTS, ELEMENT_MAP, type ElementId } from './element-data'
import { VILLAGE_COLORS, VILLAGE_NAMES, type VillageId } from '../types'
import { PixelPanel } from './pixel'

export interface LoginScreenProps {
  online: number
  connected: boolean
  savedName: string | null
  savedElement: ElementId | null
  savedVillage: VillageId | null
  loading?: boolean
  onPlay: (name: string, element: ElementId, village: VillageId) => void
}

const PC_CONTROLS = [
  'WASD ou setas — mover',
  'Clique ou Espaço — ataque de kunai',
  '1 a 4 — jutsus (hotkeys)',
  'Q — poção',
  'E — interagir',
  'Enter — chat',
]

const MOBILE_CONTROLS = [
  'Joystick virtual — mover',
  'Botões de jutsu na tela',
  'Toque no inimigo próximo — mira automática',
  'Ícone de balão — chat',
]

/**
 * Tela de login / criação de personagem do Shinobi Online.
 * Overlay fullscreen (fixed inset-0 z-50) sobre o canvas do jogo.
 * Tema retrô pixel-art: laranja / carvão / pergaminho (sem azul no chrome).
 */
export default function LoginScreen({
  online,
  connected,
  savedName,
  savedElement,
  savedVillage,
  loading = false,
  onPlay,
}: LoginScreenProps) {
  const [name, setName] = useState(savedName ?? '')
  const [selectedElement, setSelectedElement] = useState<ElementId>(savedElement ?? 'fogo')
  const [selectedVillage, setSelectedVillage] = useState<VillageId>(savedVillage ?? 'folha')

  const selectedInfo = ELEMENT_MAP[selectedElement]
  const trimmedName = name.trim()
  const canPlay = trimmedName.length >= 2 && connected

  const handlePlay = () => {
    if (!canPlay || loading) return
    onPlay(trimmedName, selectedElement, selectedVillage)
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[#0f0d0a]"
      style={{
        // Scanlines CRT sutis + vinheta radial + gradiente carvão (camadas de cima para baixo)
        backgroundImage:
          'repeating-linear-gradient(0deg, rgba(0,0,0,0.08) 0px, rgba(0,0,0,0.08) 1px, transparent 1px, transparent 3px), radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%), linear-gradient(180deg, #0f0d0a 0%, #1a1410 100%)',
      }}
    >
      <div className="relative flex min-h-screen w-full flex-col">
        <main className="flex w-full flex-1 flex-col items-center gap-6 px-4 pb-10 pt-8 sm:gap-8 sm:pt-12">
          {/* ===== Cabeçalho ===== */}
          <header className="flex flex-col items-center gap-3 text-center">
            <h1 className="font-pixel text-3xl tracking-[0.15em] text-[#f97316] [text-shadow:3px_3px_0_#7c2d12] sm:text-5xl">
              SHINOBI ONLINE
            </h1>
            <p className="font-retro text-lg text-[#e8d5a9]">
              Crônicas das Quatro Vilas • MMORPG de fã
            </p>
            {connected ? (
              <div
                role="status"
                className="inline-flex items-center gap-2 border-2 border-green-700 bg-[#0f0d0a]/80 px-3 py-1.5 font-retro text-sm"
              >
                <span aria-hidden="true" className="size-2 animate-pulse bg-green-500" />
                <span className="text-[#e8d5a9]">{online} shinobis online</span>
                <span aria-hidden="true" className="text-[#6b5f4a]">
                  •
                </span>
                <span className="text-[#a89b7d]">Servidor BR • Guerra das Vilas</span>
              </div>
            ) : (
              <div
                role="status"
                className="inline-flex items-center gap-2 border-2 border-yellow-700 bg-[#0f0d0a]/80 px-3 py-1.5 font-retro text-sm"
              >
                <WifiOff size={14} className="text-yellow-500" aria-hidden="true" />
                <span aria-hidden="true" className="size-2 animate-pulse bg-yellow-500" />
                <span className="text-[#e8d5a9]">Conectando ao servidor...</span>
              </div>
            )}
          </header>

          {/* ===== Nome do shinobi ===== */}
          <section className="w-full max-w-md" aria-label="Nome do shinobi">
            <label
              htmlFor="shinobi-name"
              className="mb-2 block font-pixel text-[9px] tracking-wider text-[#a89b7d]"
            >
              NOME DO SHINOBI
            </label>
            <Input
              id="shinobi-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handlePlay()
                }
              }}
              maxLength={14}
              placeholder="ex: UchihaBrabo"
              autoFocus
              autoComplete="off"
              className="h-12 rounded-none border-2 border-[#3a2f22] bg-[#0f0d0a] font-retro text-lg text-[#e8d5a9] placeholder:text-[#6b5f4a] focus-visible:border-[#f97316] focus-visible:ring-[#f97316] md:text-lg"
            />
          </section>

          {/* ===== Seletor de elemento ===== */}
          <section className="w-full max-w-5xl" aria-labelledby="elemento-label">
            <h2
              id="elemento-label"
              className="mb-2 font-pixel text-[9px] tracking-wider text-[#a89b7d]"
            >
              ESCOLHA SEU ELEMENTO
            </h2>
            <div
              role="radiogroup"
              aria-labelledby="elemento-label"
              className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
            >
              {ELEMENTS.map((el) => {
                const Icon = el.icon
                const isSelected = selectedElement === el.id
                return (
                  <div
                    key={el.id}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() => setSelectedElement(el.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedElement(el.id)
                      }
                    }}
                    className={cn(
                      'min-h-[44px] cursor-pointer select-none border-2 bg-[#211a12] p-3 text-left shadow-[4px_4px_0_rgba(0,0,0,0.5)] transition-all duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f97316]',
                      'hover:scale-[1.02] hover:border-[#a89b7d]',
                      isSelected
                        ? 'scale-[1.03] border-[#f97316] shadow-[0_0_0_2px_rgba(249,115,22,0.35),4px_4px_0_rgba(0,0,0,0.5)]'
                        : 'border-[#3a2f22]',
                    )}
                  >
                    <Icon
                      size={28}
                      color={el.color}
                      strokeWidth={2.5}
                      aria-hidden="true"
                      className="mb-1.5"
                    />
                    <div className="font-retro text-xl font-bold leading-none text-[#e8d5a9]">
                      {el.name}
                    </div>
                    <span
                      className="mt-1.5 inline-block border px-1.5 py-0.5 font-retro text-xs leading-none"
                      style={{ color: el.color, borderColor: el.color }}
                    >
                      {el.jutsuStyle}
                    </span>
                    <p className="mt-2 line-clamp-2 font-retro text-base leading-tight text-[#a89b7d]">
                      {el.desc}
                    </p>
                  </div>
                )
              })}
            </div>
          </section>


          {/* ===== Seletor de vila ===== */}
          <section className="w-full max-w-5xl" aria-labelledby="vila-label">
            <h2 id="vila-label" className="mb-2 font-pixel text-[9px] tracking-wider text-[#a89b7d]">
              ESCOLHA SUA VILA
            </h2>
            <div role="radiogroup" aria-labelledby="vila-label" className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {(['folha', 'areia', 'nevoa', 'terra'] as VillageId[]).map((village) => {
                const selected = selectedVillage === village
                const descriptions: Record<VillageId, string> = {
                  folha: 'Florestas e campos verdes.',
                  areia: 'Deserto aberto e terreno seco.',
                  nevoa: 'Pântanos, água e névoa.',
                  terra: 'Montanhas e solo rochoso.',
                }
                return (
                  <button
                    key={village}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setSelectedVillage(village)}
                    className={cn(
                      'min-h-[82px] border-2 bg-[#211a12] p-3 text-left shadow-[4px_4px_0_rgba(0,0,0,0.5)] transition-all',
                      selected ? 'scale-[1.02] border-[#f97316]' : 'border-[#3a2f22] hover:border-[#a89b7d]',
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="h-3 w-3 border border-black" style={{ background: VILLAGE_COLORS[village] }} />
                      <span className="font-retro text-xl font-bold text-[#e8d5a9]">{VILLAGE_NAMES[village]}</span>
                    </div>
                    <p className="font-retro text-base leading-tight text-[#a89b7d]">{descriptions[village]}</p>
                  </button>
                )
              })}
            </div>
            <p className="mt-2 font-retro text-sm text-[#8f8065]">
              Sua vila define aliados, local de renascimento e facção no PvP. Shinobis da mesma vila não causam dano entre si.
            </p>
          </section>

          {/* ===== Jutsus do elemento selecionado ===== */}
          <PixelPanel
            title={`JUTSUS DE ${selectedInfo.name.toUpperCase()} — ${selectedInfo.jutsuStyle.toUpperCase()}`}
            className="w-full max-w-5xl"
          >
            <div
              key={selectedElement}
              className="grid animate-in fade-in grid-cols-1 gap-x-6 gap-y-4 slide-in-from-bottom-2 duration-300 sm:grid-cols-2"
            >
              {selectedInfo.skills.map((skill) => (
                <div key={skill.name} className="min-w-0">
                  <div className="font-retro text-lg leading-tight" style={{ color: selectedInfo.color }}>
                    {skill.name}
                  </div>
                  <div className="font-retro text-base leading-tight text-[#a89b7d]">{skill.desc}</div>
                </div>
              ))}
            </div>
          </PixelPanel>

          {/* ===== Botão jogar ===== */}
          <section className="flex w-full max-w-md flex-col items-center gap-2" aria-label="Entrar no jogo">
            <Button
              type="button"
              onClick={handlePlay}
              disabled={!canPlay || loading}
              className="h-auto w-full rounded-none border-2 border-[#f97316] bg-[#f97316] py-4 font-pixel text-xs text-[#1a0e05] shadow-[6px_6px_0_rgba(0,0,0,0.5)] transition-all hover:bg-[#ea580c] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0_rgba(0,0,0,0.5)] disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#f97316] sm:py-5 sm:text-sm"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                  PREPARANDO...
                </>
              ) : (
                'ENTRAR NO JOGO'
              )}
            </Button>
            {savedName ? (
              <p className="text-center font-retro text-base text-[#a89b7d]">
                Continuando como {savedName} • {VILLAGE_NAMES[selectedVillage]}
              </p>
            ) : null}
          </section>

          {/* ===== Como jogar ===== */}
          <PixelPanel title="COMO JOGAR" className="w-full max-w-3xl">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-retro text-lg text-[#e8d5a9]">
                  <Keyboard size={20} className="text-[#f97316]" aria-hidden="true" />
                  PC
                </h3>
                <ul className="space-y-1">
                  {PC_CONTROLS.map((item) => (
                    <li key={item} className="font-retro text-base text-[#a89b7d]">
                      <span aria-hidden="true" className="mr-1.5 text-[#f97316]">
                        ▪
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-retro text-lg text-[#e8d5a9]">
                  <Smartphone size={20} className="text-[#f97316]" aria-hidden="true" />
                  Celular
                </h3>
                <ul className="space-y-1">
                  {MOBILE_CONTROLS.map((item) => (
                    <li key={item} className="font-retro text-base text-[#a89b7d]">
                      <span aria-hidden="true" className="mr-1.5 text-[#f97316]">
                        ▪
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-4 border-t border-dotted border-[#3a2f22] pt-3 font-retro text-base text-[#6b5f4a]">
              Dica: as vilas são zonas seguras. Fora delas, o PvP é entre vilas rivais.
            </p>
          </PixelPanel>
        </main>

        {/* ===== Footer ===== */}
        <footer className="mt-auto border-t-2 border-[#3a2f22] bg-[#0f0d0a]/95 py-3 text-center">
          <p className="font-retro text-base text-[#6b5f4a]">
            Jogo de fã, sem fins lucrativos • Naruto © Masashi Kishimoto / Shueisha
          </p>
        </footer>
      </div>
    </div>
  )
}
