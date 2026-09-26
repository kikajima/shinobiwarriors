import { Game } from './src/game'
import { POTION, maxChOf, maxHpOf } from './src/data'
import {
  INVENTORY_CAPACITY,
  addItem,
  countItem,
  normalizeInventory,
  rollLoot,
} from './src/inventory'

// Migração: saves antigos tinham apenas "pot".
const migrated = normalizeInventory(undefined, 3)
if (migrated.length !== INVENTORY_CAPACITY) throw new Error('capacidade incorreta')
if (countItem(migrated, 'healing_potion') !== 3) throw new Error('migração de poções falhou')

// Entradas desconhecidas do save não podem entrar no inventário.
const sanitized = normalizeInventory([{ id: 'item_inexistente', qty: 999 }], 0)
if (sanitized.some(Boolean)) throw new Error('inventário aceitou item desconhecido')

// Stack e overflow por slots.
const materials = normalizeInventory(undefined, 0)
const added = addItem(materials, 'iron_shard', 65)
if (added !== 65) throw new Error('não adicionou materiais')
if (countItem(materials, 'iron_shard') !== 65) throw new Error('contagem de stack incorreta')
const ironStacks = materials.filter((s: any) => s?.id === 'iron_shard').map((s: any) => s.qty)
if (ironStacks.join(',') !== '30,30,5') throw new Error(`stack inesperado: ${ironStacks.join(',')}`)

// Boss sempre possui os materiais garantidos quando o RNG retorna zero.
const bossLoot = rollLoot('boss', () => 0)
if (!bossLoot.some((d) => d.id === 'ancient_core')) throw new Error('boss sem núcleo garantido')
if (!bossLoot.some((d) => d.id === 'zetsu_cell')) throw new Error('boss sem células garantidas')

// Integração com entidades reais do Game.
const game = new Game({} as any)
const bot: any = [...game.players.values()].find((p: any) => p.kind === 'bot')
if (!bot) throw new Error('sem bot para teste')
if (!Array.isArray(bot.inventory) || bot.inventory.length !== INVENTORY_CAPACITY) throw new Error('bot sem inventário')
if (bot.pot !== countItem(bot.inventory, 'healing_potion')) throw new Error('contador legado de poção dessincronizado')

// Poção via hotkey/IA agora consome o item do inventário.
bot.hp = 1
bot.cds[5] = 0
const potionBefore = countItem(bot.inventory, 'healing_potion')
if (potionBefore <= 0) throw new Error('bot de teste sem poções')
if (!game.usePotion(bot)) throw new Error('uso de poção falhou')
if (countItem(bot.inventory, 'healing_potion') !== potionBefore - 1) throw new Error('poção não saiu do inventário')
if (bot.pot !== potionBefore - 1) throw new Error('pot não sincronizou após uso')
if (bot.hp <= 1 || bot.hp > maxHpOf(bot.lv)) throw new Error('cura da poção inválida')

// Consumível genérico pelo slot.
if (game.giveItem(bot, 'chakra_pill', 1) !== 1) throw new Error('não adicionou pílula de chakra')
const chakraSlot = bot.inventory.findIndex((s: any) => s?.id === 'chakra_pill')
if (chakraSlot < 0) throw new Error('pílula não apareceu no inventário')
bot.ch = 0
bot.cds[5] = 0
if (!game.useInventorySlot(bot, chakraSlot)) throw new Error('uso de item pelo slot falhou')
if (bot.ch <= 0 || bot.ch > maxChOf(bot.lv)) throw new Error('recuperação de chakra inválida')
if (bot.inventory[chakraSlot]?.id === 'chakra_pill') throw new Error('pílula não foi consumida')

// A loja continua respeitando o limite global antigo de poções.
while (countItem(bot.inventory, 'healing_potion') < POTION.max) addItem(bot.inventory, 'healing_potion', 1)
game.syncPotionCount(bot)
if (bot.pot !== POTION.max) throw new Error('limite de poções não sincronizado')

console.log('[inventory] OK: migração, stacks, consumíveis, bots e loot')
