// ============================================================
// Shinobi Online — dados de jogo (servidor)
// ============================================================

export type ElementId = 'fogo' | 'agua' | 'raio' | 'vento' | 'terra'
export type VillageId = 'folha' | 'areia' | 'nevoa' | 'terra'
export const VILLAGE_IDS: VillageId[] = ['folha', 'areia', 'nevoa', 'terra']
export const VILLAGE_NAMES: Record<VillageId, string> = {
  folha: 'Vila da Folha',
  areia: 'Vila da Areia',
  nevoa: 'Vila da Névoa',
  terra: 'Vila da Terra',
}
export type SkillArchetype = 'proj' | 'multi' | 'dash' | 'line' | 'aoe'

export interface SkillDef {
  name: string
  archetype: SkillArchetype
  mult: number
  cd: number
  ch: number
  range: number
  radius?: number
  speed?: number
  count?: number
}

export const TILE = 32
export const MAP_SIZE = 256
export const MAX_LEVEL = 200
export const PLAYER_SPEED = 175
export const BOT_SPEED = 160

// ---------- Stats de jogador ----------
export const maxHpOf = (lv: number) => 90 + 28 * (lv - 1)
export const maxChOf = (lv: number) => 55 + 14 * (lv - 1)
export const atkOf = (lv: number) => 15 + 4.5 * (lv - 1)
export const xpNeedOf = (lv: number) => Math.round(70 * Math.pow(lv, 1.35))

export const BASIC = { cd: 550, range: 95, arc: 75 }
export const POTION = { healPct: 0.55, cd: 9000, price: 25, start: 3, max: 9 }
export const BOUNTY = {
  duration: 15 * 60 * 1000,
  trackCooldown: 12 * 1000,
  baseXp: 90,
  xpPerLevel: 14,
  baseGold: 80,
  goldPerLevel: 12,
}

export const CRIT_CHANCE = 0.15
export const CRIT_MULT = 1.5

// ---------- Skills ----------
const BASE: Record<SkillArchetype, Omit<SkillDef, 'name' | 'archetype'>> = {
  proj: { mult: 1.65, cd: 2600, ch: 10, range: 520, speed: 430 },
  multi: { mult: 0.75, cd: 6500, ch: 17, range: 480, speed: 380, count: 3 },
  dash: { mult: 2.3, cd: 7500, ch: 18, range: 175, speed: 900 },
  line: { mult: 1.45, cd: 8500, ch: 22, range: 560, speed: 640 },
  aoe: { mult: 1.95, cd: 12000, ch: 28, range: 320, radius: 130 },
}

const mod = (a: SkillArchetype, el: ElementId): Omit<SkillDef, 'name' | 'archetype'> => {
  const b = { ...BASE[a] }
  switch (el) {
    case 'fogo':
      // maior dano bruto + queimadura aplicada pelo servidor
      b.mult *= 1.18
      break
    case 'agua':
      // estilo eficiente: menos chakra e controle por lentidão
      b.ch = Math.max(1, Math.round(b.ch * 0.72))
      break
    case 'raio':
      // explosivo: recargas e projéteis mais rápidos + crítico extra
      b.cd = Math.round(b.cd * 0.78)
      if (b.speed) b.speed = Math.round(b.speed * 1.18)
      break
    case 'vento':
      // zoning: alcance e velocidade altos + empurrão
      b.range = Math.round(b.range * 1.30)
      if (b.speed) b.speed = Math.round(b.speed * 1.25)
      b.mult *= 0.96
      break
    case 'terra':
      // impacto pesado: área/dano maiores + breve atordoamento
      if (b.radius) b.radius = Math.round(b.radius * 1.35)
      b.mult *= 1.12
      b.cd = Math.round(b.cd * 1.06)
      break
  }
  return b
}

const S = (
  name: string,
  archetype: SkillArchetype,
  el: ElementId,
  overrides: Partial<SkillDef> = {},
): SkillDef => ({
  name,
  archetype,
  ...mod(archetype, el),
  ...overrides,
})

export const SKILLS: Record<ElementId, SkillDef[]> = {
  fogo: [
    S('Bola de Fogo', 'proj', 'fogo'),
    S('Flores de Fênix', 'multi', 'fogo', { count: 5, mult: 0.62 }),
    S('Chamas do Dragão', 'line', 'fogo'),
    S('Mar de Chamas', 'aoe', 'fogo'),
  ],
  agua: [
    S("Bala d'Água", 'proj', 'agua'),
    S("Presas d'Água", 'multi', 'agua'),
    S("Dragão d'Água", 'line', 'agua'),
    S('Grande Cachoeira', 'aoe', 'agua'),
  ],
  raio: [
    S('Descarga Elétrica', 'proj', 'raio'),
    S('Chidori', 'dash', 'raio'),
    S('Trovão Perfurante', 'line', 'raio'),
    S('Kirin', 'aoe', 'raio'),
  ],
  vento: [
    S('Vendaval de Palma', 'proj', 'vento'),
    S('Lâminas de Vendaval', 'multi', 'vento', { count: 5, mult: 0.58 }),
    S('Grande Avanço', 'line', 'vento'),
    S('Rasenshuriken', 'aoe', 'vento'),
  ],
  terra: [
    S('Pedra Voadora', 'proj', 'terra'),
    S('Chuva de Rochas', 'multi', 'terra', { count: 4, mult: 0.70 }),
    S('Estaca de Terra', 'line', 'terra'),
    S('Pântano do Submundo', 'aoe', 'terra'),
  ],
}

// ---------- Monstros ----------
export interface MonsterDef {
  name: string
  lv: number
  hp: number
  atk: number
  xp: number
  gold: [number, number]
  speed: number
  aggro: number
  respawn: number
  radius: number
  scale: number
  boss?: boolean
}

export const MONSTERS: Record<string, MonsterDef> = {
  bandido: { name: 'Bandido', lv: 2, hp: 105, atk: 7, xp: 38, gold: [4, 10], speed: 92, aggro: 165, respawn: 9000, radius: 18, scale: 1 },
  sapo: { name: 'Sapo Selvagem', lv: 4, hp: 230, atk: 12, xp: 62, gold: [6, 14], speed: 76, aggro: 155, respawn: 11000, radius: 20, scale: 1.12 },
  gennin: { name: 'Gennin Renegado', lv: 6, hp: 380, atk: 19, xp: 105, gold: [10, 22], speed: 108, aggro: 210, respawn: 13000, radius: 18, scale: 1 },
  zetsu: { name: 'Zetsu Branco', lv: 9, hp: 640, atk: 27, xp: 195, gold: [18, 34], speed: 96, aggro: 220, respawn: 18000, radius: 19, scale: 1.08 },
  boss: { name: 'Zetsu Ancião', lv: 12, hp: 4200, atk: 46, xp: 2200, gold: [260, 340], speed: 82, aggro: 280, respawn: 150000, radius: 34, scale: 1.65, boss: true },
}

// ---------- Missões ----------
export interface MissionDef {
  name: string
  monster: string
  need: number
  xp: number
  gold: number
  repeat?: boolean
}

export const MISSIONS: MissionDef[] = [
  { name: 'Primeiros passos de shinobi', monster: 'bandido', need: 5, xp: 150, gold: 60 },
  { name: 'Sapos importunando a vila', monster: 'sapo', need: 6, xp: 320, gold: 110 },
  { name: 'Caça aos renegados', monster: 'gennin', need: 8, xp: 750, gold: 240 },
  { name: 'A ameaça branca', monster: 'zetsu', need: 10, xp: 1600, gold: 420 },
  { name: 'O Ancião do Vale', monster: 'boss', need: 1, xp: 4200, gold: 1200 },
  { name: 'Patrulha da vila', monster: 'any', need: 15, xp: 2000, gold: 700, repeat: true },
]

// ---------- Nomes de bots ----------
export const BOT_NAMES = [
  'UchihaBrabo', 'HokageWannabe', 'narutofan2007', 'RamenLord', 'KunaiDoCaos',
  'JiraiyaDoRamen', 'GaaraDoCactos', 'TemariChan', 'ShikaNaraZzz', 'ChojiFritas',
  'InoYamanaka22', 'LeeVerdejao', 'NejiByakugan', 'TentenKunai', 'HinataS2',
  'KibaAkamaru', 'ShinoAbelhas', 'KakashiCopiador', 'GaiMocidade', 'MinatoFlash',
  'KushinaBR', 'ItachiSolitario', 'KisameTubarao', 'DeidaraExplosivo', 'SasoriMarionete',
  'HidanImortal', 'KakuzuContador', 'PainSeisCaminhos', 'KonanOrigami', 'TobiBoa',
  'OrochimaruBR', 'KabutoSpecs', 'AnkoDango', 'IrukaSensei', 'KonohamaruKun',
  'MoegiUdon', 'HanabiChan', 'KurenaiGenjutsu', 'AsumaFumaca', 'YamatoMadeira',
  'SaiPintor', 'HashiramaWood', 'TobiramaAgua', 'HiruzenSensei', 'TsunadeSama',
  'ShizuneTonton', 'ChiyoBaa', 'MeiTerumi', 'ChojuroEspada', 'xX_Ninja_Xx',
  'obaoba21', 'caiio_04', 'vitoria__ninja', 'pedroo.hanzo', 'lariTryHard',
  'dudu_shinobi', 'ana.hyuga', 'rickzin', 'thiaguinho_sw', 'malu.chan',
  'juju_sama', 'biel.kunai', 'sasuke_nao_va', 'oba_shinobi', 'zendayaDoKatana',
  'KuramaMode', 'BuntaSapo', 'SandaimeBR', 'ZabuzaNevoa', 'HakuIce',
  'KimimaroOssos', 'TayuyaFlauta', 'SakonUkon', 'JiroboForca', 'KidomaruAranha',
  'KurenaiSensei', 'EbisuSensei', 'TeuchiRamen', 'AyameLamen', 'GenninDoDeserto',
]

// ---------- Chat de bots (PT-BR, estilo casual) ----------
export const CHAT = {
  join: [
    'eae galera', 'opa, cheguei', 'salve shinobis', 'bom dia pessoal',
    'alguem on?', 'voltei kkk', 'opa gente boa', 'eai meu povo',
  ],
  farewell: [
    'flw galera', 'vou dormir, amanhã upo mais', 'até mais pessoal, bom jogo',
    'vou comer, ja volto', 'minha mãe chamou, flw', 'vou nessa, tmj',
  ],
  ambient: [
    'alguem on? to upando no campo', 'esse zetsu branco me deu trabalho kkk',
    'kkkkkkk', 'aff, quase morri pro sapo', 'upando meu {el} aqui',
    'to farmando ryō pra poções', 'esse boss é muito forte ainda',
    'vou pro campo 7 treinar', 'meu chakra acabou ja kkk',
    'lagou aqui, alguem mais?', 'ramen do ichiraku é o melhor',
    'o manga tava insano essa semana', 'viu o ultimo episodio de shippuden?',
    'recomenda algum anime depois de naruto?', 'gaara vs rock lee ainda é a melhor luta',
    'minato é insano rapaz, flash', 'to vendo se consigo party pro boss',
    'esse bandido é pão duro kkk', 'voltei do trabalho, so relaxar um poco',
    'depois disso vou assistir boruto, me julguem', 'quem lembra do clássico? saudade',
    'to quase pegando o dragão de agua', 'morri ontem pro anciao kkk ragei',
    'alguem sabe onde spawna mais zetsu?', 'no lago tem sapo sem conta',
    'fui no vale ontem... nunca mais', 'a fonte da vila cura geral, top',
    'comprei 5 poções na loja da vila', 'bora gente, upar no vale precisa de grupo',
    'treinando pro chunin shiken', 'meu melhor jutsu é esse mesmo kkk',
    'alguem viu o naruto? kkk to brincando', 'hoje o treino rendeu',
    'gente boa esse server', 'shippuden fillers me matam',
    'prefiro taijutsu na moral', 'meu clã é da folha, respeito',
  ],
  greetReply: [
    'eae {name}!', 'opa {name}, bom jogo', 'bem vindo {name}!',
    'eae {name}, tudo certinho?', 'opa, chegou gente boa', 'salve {name}',
    'bem vindo ao server {name}', 'eae {name}, qualquer coisa chama no chat',
  ],
  answer: [
    'acho que os zetsu spawnam mais na floresta funda', 'no lago amigo, margem leste',
    'chidori é skill 2 do elemento raio, investida', 'cada vila tem duas lojas de suprimentos perto da praça central',
    'o boss fica no vale do fim, levanta a cada 2 min', 'poção é 25 ryō, aperta E na loja',
    'upando bandido no campo é o mais rápido no começo', 'tem que apertar 1 a 4 pros jutsus',
    'a fonte da vila cura de graça', 'não sei kkkk nunca testei',
    'creio que sim, o TobiBoa que falou', 'melhor zona pra upar rapido é floresta',
  ],
  party: [
    'bora, te chamo', 'manda convite!', 'to no meio de um farm, dps te chamo',
    'bora upar no campo então', 'pra boss precisa de mais gente, chama no chat',
    'aceito, to chegando na vila', 'agora não, depois upamos juntos',
  ],
  boss: [
    'o anciao é nivel 12, cuidado', 'levanta a cada 2 minutos mais ou menos',
    'levei equipe de 3 e quase morremos kkk', 'dica: usa poção antes de chegar no vermelho',
    'ele bate uma area forte, sai do pé dele', 'leva uns 3 shinobis level 10+',
  ],
  lag: [
    'aqui ta ok', 'pegou leve agora', 'meu net ta uma merda hj',
    'reloguei e melhorou', 'kkkk clássico', 'aqui pegando também',
  ],
  laugh: ['kkkkkkk', 'kkkk verdade', 'hahahaha', 'mto bom', 'risos', 'KKKKK'],
  mention: [
    'falou meu nome? kkk', 'oi?', 'precisa de algo?', 'to aqui, so upando',
    'manda ver', 'fala aí', 'chama no chat',
  ],
  levelUp: [
    'FINALMENTE level {lv}!!', 'up level {lv} rapaz', '{lv} agora, o caminho do hokage continua',
    'level up! {lv}', 'aí sim, {lv}!',
  ],
  death: [
    'morri kkk', 'esse {mob} é forte demais', 'aff morri, volto ja',
    'rip mim, to voltando na vila', 'ganhei uns taps desse {mob} aki',
  ],
  potion: ['na hora essa poção', 'glub glub kkk', 'quase que ia pro chão'],
}

export const TIPS = [
  'Dica: aperte Q para usar poção em combate.',
  'Dica: a fonte da vila cura você de graça.',
  'Dica: missões dão ryō e XP — acompanhe no painel de missões.',
  'Dica: o Zetsu Ancião aguarda no Vale do Fim. Leve poções!',
  'Dica: as lojas de cada vila vendem poções por 25 ryō.',
  'Dica: mire com o mouse ou use mira automática no celular.',
  'Dica: cada elemento tem 4 jutsus diferentes. Experimente!',
]
