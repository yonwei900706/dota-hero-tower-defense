import { ItemDefinition, ItemId } from '../types';

export const SECRET_SHOP_ITEMS: ItemDefinition[] = [
  {
    id: 'desolator',
    name: 'Desolator',
    cost: 220,
    icon: '🗡️',
    shortDesc: '-6 Armor',
    fullDesc: 'Attacks corrupt target armor by -6 for 4s (stacks huge Physical DPS vs bosses!).',
    color: '#ef4444',
  },
  {
    id: 'daedalus',
    name: 'Daedalus',
    cost: 260,
    icon: '⚔️',
    shortDesc: '25% 2.2x Crit',
    fullDesc: '25% chance on basic attacks to Critical Strike for 2.2x damage!',
    color: '#f59e0b',
  },
  {
    id: 'moon_shard',
    name: 'Moon Shard',
    cost: 200,
    icon: '🌙',
    shortDesc: '+45% Atk Spd',
    fullDesc: 'Grants +45% Attack Speed (faster DPS and faster mana gain).',
    color: '#38bdf8',
  },
  {
    id: 'octarine_core',
    name: 'Octarine Core',
    cost: 240,
    icon: '🔮',
    shortDesc: '+55% Mana',
    fullDesc: 'Grants +55% Mana Regen & Mana on attack for rapid-fire Ultimates!',
    color: '#c084fc',
  },
  {
    id: 'mjollnir',
    name: 'Mjollnir',
    cost: 280,
    icon: '⚡',
    shortDesc: '+25% Spd & Chain',
    fullDesc: '+25% Attack Speed and 25% chance on hit to unleash Chain Lightning across 3 creeps for 180 Magic damage!',
    color: '#38bdf8',
  },
  {
    id: 'divine_rapier',
    name: 'Divine Rapier',
    cost: 550,
    icon: '👑',
    shortDesc: '+150% Damage',
    fullDesc: 'Grants a massive +150% Attack Damage for late-game Boss slaying!',
    color: '#facc15',
  },
];

export const ITEM_MAP: Record<ItemId, ItemDefinition> = SECRET_SHOP_ITEMS.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<ItemId, ItemDefinition>
);
