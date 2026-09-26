import { Game } from './src/game'
import { addItem, countItem } from './src/inventory'
import {
  EQUIPMENT_ITEMS,
  EQUIPMENT_RARITIES,
  equipmentPower,
  equipmentStats,
  forgeCost,
  normalizeEquipment,
  statsForItem,
} from './src/equipment'

const slots = ['head','torso','boots','gloves','accessory','pants'] as const

// Catálogo completo: 6 famílias x 6 raridades.
for (const slot of slots) {
  for (const rarity of EQUIPMENT_RARITIES) {
    const id = 'gear_' + slot + '_' + rarity
    if (!EQUIPMENT_ITEMS[id]) throw new Error('equipamento ausente: ' + id)
  }
}

if (Object.keys(EQUIPMENT_ITEMS).length !== slots.length * EQUIPMENT_RARITIES.length) {
  throw new Error('catálogo de equipamentos incompleto')
}

const commonGloves = { id:'gear_gloves_common', upgrade:0 }
const uniqueGloves = { id:'gear_gloves_unique', upgrade:0 }
if (equipmentPower(uniqueGloves) <= equipmentPower(commonGloves)) {
  throw new Error('raridade única não ficou mais forte que comum')
}
if (equipmentPower({ ...commonGloves, upgrade:11 }) <= equipmentPower(commonGloves)) {
  throw new Error('forja +11 não aumentou o poder')
}
if (!forgeCost(commonGloves)) throw new Error('item +0 deveria possuir custo de forja')
if (forgeCost({ ...commonGloves, upgrade:11 }) !== null) throw new Error('item +11 ainda aceita forja')

// Normalização não aceita item no slot errado e limita +11.
const normalized = normalizeEquipment({
  head: { id:'gear_gloves_rare', upgrade:99 },
  gloves: { id:'gear_gloves_rare', upgrade:99 },
})
if (normalized.head) throw new Error('equipamento entrou em slot incompatível')
if (normalized.gloves?.upgrade !== 11) throw new Error('normalização não limitou forja a +11')

// Integração real com o Game.
const game = new Game({ emit(){} } as any)
const socket:any = {
  data:{},
  events:[] as any[],
  emit(ev:string,payload:any){ this.events.push({ev,payload}) },
}
const join = game.addHuman(socket,'EquipTester','fogo','folha')
if (!join.ok) throw new Error('falha ao criar jogador de teste')
const player:any = game.entOf(socket)
if (!player) throw new Error('jogador de teste ausente')

const baseAttack = game.attack(player)
const baseHp = game.maxHp(player)

// Equipar luvas aumenta ataque.
if (addItem(player.inventory,'gear_gloves_common',1) !== 1) throw new Error('não adicionou luvas')
const gloveInv = player.inventory.findIndex((s:any)=>s?.id==='gear_gloves_common')
if (!game.equipFromInventory(player,gloveInv)) throw new Error('não equipou luvas')
if (game.attack(player) <= baseAttack) throw new Error('luvas não aumentaram ataque')

// Torso aumenta HP real.
if (addItem(player.inventory,'gear_torso_rare',1) !== 1) throw new Error('não adicionou torso')
const torsoInv = player.inventory.findIndex((s:any)=>s?.id==='gear_torso_rare')
player.lv = 20
if (!game.equipFromInventory(player,torsoInv)) throw new Error('não equipou torso raro')
if (game.maxHp(player) <= baseHp) throw new Error('torso não aumentou HP')

// Dois acessórios são independentes.
addItem(player.inventory,'gear_accessory_common',2)
const a1 = player.inventory.findIndex((s:any)=>s?.id==='gear_accessory_common')
if (!game.equipFromInventory(player,a1,'accessory1')) throw new Error('não equipou acessório 1')
const a2 = player.inventory.findIndex((s:any)=>s?.id==='gear_accessory_common')
if (!game.equipFromInventory(player,a2,'accessory2')) throw new Error('não equipou acessório 2')
if (!player.equipment.accessory1 || !player.equipment.accessory2) throw new Error('slots duplos de acessório falharam')

// Compra no arsenal respeita nível e ryō.
const arsenal = game.world.shops.find((s:any)=>s.village===player.village&&s.kind==='equipment')
if (!arsenal) throw new Error('arsenal da vila ausente')
player.x=arsenal.x;player.y=arsenal.y;player.lv=80;player.gold=100000
const beforeUnique=countItem(player.inventory,'gear_boots_unique')
game.handleBuyEquipment(socket,{itemId:'gear_boots_unique'})
if (countItem(player.inventory,'gear_boots_unique') !== beforeUnique+1) throw new Error('compra de equipamento falhou')

// Forja consome materiais e incrementa o item equipado.
addItem(player.inventory,'iron_shard',30)
player.gold=100000
player.equipment.gloves={id:'gear_gloves_common',upgrade:0}
const cost0=forgeCost(player.equipment.gloves)!
const ironBefore=countItem(player.inventory,'iron_shard')
game.handleForge(socket,{slot:'gloves'})
if (player.equipment.gloves.upgrade !== 1) throw new Error('forja +1 falhou')
if (player.gold !== 100000-cost0.gold) throw new Error('forja não consumiu ryō corretamente')
if (countItem(player.inventory,'iron_shard') >= ironBefore) throw new Error('forja não consumiu material')

// +10 -> +11 usa materiais avançados e para no limite.
player.equipment.gloves={id:'gear_gloves_common',upgrade:10}
addItem(player.inventory,'zetsu_cell',20)
addItem(player.inventory,'ancient_core',5)
player.gold=100000
game.handleForge(socket,{slot:'gloves'})
if (player.equipment.gloves.upgrade !== 11) throw new Error('forja +11 falhou')
const goldAt11=player.gold
game.handleForge(socket,{slot:'gloves'})
if (player.equipment.gloves.upgrade !== 11 || player.gold !== goldAt11) throw new Error('forja ultrapassou +11')

// Stats agregados refletem todo o loadout.
const total=equipmentStats(player.equipment)
if (total.attack <= 0 || total.hp <= 0 || total.chakra <= 0) throw new Error('stats agregados inválidos')
if (statsForItem(player.equipment.gloves).attack <= statsForItem(commonGloves).attack) throw new Error('stats +11 não escalaram')

console.log('[equipment] OK: slots, raridades, loja, atributos e forja +11')
