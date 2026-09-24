import type { LucideIcon } from 'lucide-react'
import { Flame, Droplets, Zap, Wind, Mountain } from 'lucide-react'

export type ElementId = 'fogo' | 'agua' | 'raio' | 'vento' | 'terra'
export type SkillArchetype = 'proj' | 'multi' | 'dash' | 'line' | 'aoe'

export interface SkillInfo {
  name: string
  desc: string
  archetype: SkillArchetype
}

export interface ElementInfo {
  id: ElementId
  name: string
  jutsuStyle: string
  desc: string
  color: string
  icon: LucideIcon
  skills: SkillInfo[]
}

export const ELEMENTS: ElementInfo[] = [
  {
    id: 'fogo',
    name: 'Fogo',
    jutsuStyle: 'Katon',
    desc: 'Ninjutsu de destruição. Dano alto e chamas persistentes.',
    color: '#ea580c',
    icon: Flame,
    skills: [
      { name: 'Bola de Fogo', desc: 'Uma bola de fogo grande e devastadora em linha reta.', archetype: 'proj' },
      { name: 'Flores de Fênix', desc: 'Três pequenas bolas de fogo disparadas em leque.', archetype: 'multi' },
      { name: 'Chamas do Dragão', desc: 'Rajada flamejante perfurante que atravessa os inimigos.', archetype: 'line' },
      { name: 'Mar de Chamas', desc: 'Óleo em chamas explode no ponto mirado.', archetype: 'aoe' },
    ],
  },
  {
    id: 'agua',
    name: 'Água',
    jutsuStyle: 'Suiton',
    desc: 'Ninjutsu versátil. Custos de chakra reduzidos.',
    color: '#06b6d4',
    icon: Droplets,
    skills: [
      { name: "Bala d'Água", desc: 'Um projétil de água pressurizada.', archetype: 'proj' },
      { name: "Presas d'Água", desc: 'Presas de água atacam em leque.', archetype: 'multi' },
      { name: "Dragão d'Água", desc: 'Um dragão de água perfura tudo em linha.', archetype: 'line' },
      { name: 'Grande Cachoeira', desc: 'Uma cachoeira esmagadora atinge a área.', archetype: 'aoe' },
    ],
  },
  {
    id: 'raio',
    name: 'Raio',
    jutsuStyle: 'Raiton',
    desc: 'Velocidade extrema. Recargas mais rápidas e perfuração.',
    color: '#facc15',
    icon: Zap,
    skills: [
      { name: 'Descarga Elétrica', desc: 'Um choque concentrado de chakra relâmpago.', archetype: 'proj' },
      { name: 'Chidori', desc: 'Investida elétrica que atravessa inimigos à frente.', archetype: 'dash' },
      { name: 'Trovão Perfurante', desc: 'Raio perfurante em alta velocidade.', archetype: 'line' },
      { name: 'Kirin', desc: 'Um relâmpago colossal cai no ponto mirado.', archetype: 'aoe' },
    ],
  },
  {
    id: 'vento',
    name: 'Vento',
    jutsuStyle: 'Fuuton',
    desc: 'Alcance superior. Lâminas de vento ágeis.',
    color: '#a3e635',
    icon: Wind,
    skills: [
      { name: 'Vendaval de Palma', desc: 'Uma lâmina de vento comprimida.', archetype: 'proj' },
      { name: 'Lâminas de Vendaval', desc: 'Três lâminas de vento em leque.', archetype: 'multi' },
      { name: 'Grande Avanço', desc: 'Uma rajada devastadora em linha reta.', archetype: 'line' },
      { name: 'Rasenshuriken', desc: 'Um vórtice de vento destrói a área mirada.', archetype: 'aoe' },
    ],
  },
  {
    id: 'terra',
    name: 'Terra',
    jutsuStyle: 'Doton',
    desc: 'Áreas amplas e impacto pesado.',
    color: '#a16207',
    icon: Mountain,
    skills: [
      { name: 'Pedra Voadora', desc: 'Rocha dura lançada em alta velocidade.', archetype: 'proj' },
      { name: 'Chuva de Rochas', desc: 'Uma chuva de pedras em leque.', archetype: 'multi' },
      { name: 'Estaca de Terra', desc: 'Estaca gigante perfura em linha.', archetype: 'line' },
      { name: 'Pântano do Submundo', desc: 'Um pântano engole a área mirada.', archetype: 'aoe' },
    ],
  },
]

export const ELEMENT_MAP: Record<ElementId, ElementInfo> = Object.fromEntries(
  ELEMENTS.map((e) => [e.id, e]),
) as Record<ElementId, ElementInfo>
