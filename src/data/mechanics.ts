import { HeroId, RelicId, RuneKind, SynergyId, Vec2 } from '../types';

export interface SynergyDefinition {
  id: SynergyId;
  name: string;
  icon: string;
  desc: string;
  color: string;
}

export const SYNERGY_DEFS: SynergyDefinition[] = [
  {
    id: 'elemental',
    name: 'Elemental Masters',
    icon: '🔥',
    desc: 'Lina + Crystal Maiden + Zeus: +25% Spell Damage & +20% Mana Regen',
    color: '#f97316',
  },
  {
    id: 'marksman',
    name: 'Marksman Corps',
    icon: '🎯',
    desc: 'Sniper + Drow Ranger: +20% Attack Range & +15% Crit Chance',
    color: '#fbbf24',
  },
  {
    id: 'frontline',
    name: 'Iron Frontline',
    icon: '🛡️',
    desc: 'Sven + Earthshaker: +35% Cleave/Stun Radius & +4 Armor Pierce',
    color: '#60a5fa',
  },
  {
    id: 'plague_frost',
    name: 'Plague & Frost',
    icon: '☣️',
    desc: 'Venomancer + CM or Drow: Slowed enemies take +35% Poison DoT damage',
    color: '#4ade80',
  },
];

export const SYNERGY_MAP: Record<SynergyId, SynergyDefinition> = SYNERGY_DEFS.reduce(
  (acc, s) => {
    acc[s.id] = s;
    return acc;
  },
  {} as Record<SynergyId, SynergyDefinition>
);

export interface TalentOption {
  name: string;
  desc: string;
}

export const HERO_TALENTS: Record<HeroId, { left: TalentOption; right: TalentOption }> = {
  sniper: {
    left: { name: 'Longbarrel', desc: '+90 Attack Range' },
    right: { name: 'Eagle Eye', desc: '+20% Headshot Proc' },
  },
  crystal_maiden: {
    left: { name: 'Deep Freeze', desc: '+15% Frost Slow' },
    right: { name: 'Brilliance', desc: '+40% Aura Mana Boost' },
  },
  sven: {
    left: { name: 'Titan Cleave', desc: '+40% Cleave Radius' },
    right: { name: 'Storm Bolt', desc: '0.3s Stun on Attack' },
  },
  venomancer: {
    left: { name: 'Lethal Toxin', desc: '+45% Poison DPS' },
    right: { name: 'Plague Spread', desc: '+40% Gale Radius' },
  },
  lina: {
    left: { name: 'Fiery Soul', desc: '+35% Attack Speed' },
    right: { name: 'Twin Laguna', desc: 'Laguna hits 2 Targets' },
  },
  earthshaker: {
    left: { name: 'Aftershock', desc: '+0.45s Stun Duration' },
    right: { name: 'Fissure Echo', desc: '+50% Echo Slam Dmg' },
  },
  drow_ranger: {
    left: { name: 'Marksmanship', desc: '+30% Attack Damage' },
    right: { name: 'Multishot+', desc: '+2 Extra Volley Arrows' },
  },
  zeus: {
    left: { name: 'Static Field', desc: '+2 Chain Bounces' },
    right: { name: 'Heavenly Wrath', desc: 'Ult Stuns 0.8s' },
  },
};

export interface RelicDefinition {
  id: RelicId;
  name: string;
  icon: string;
  desc: string;
  color: string;
}

export const RELIC_DEFS: RelicDefinition[] = [
  {
    id: 'philosopher_stone',
    name: "Philosopher's Stone",
    icon: '🪨',
    desc: '+18% Bonus Gold from every creep kill.',
    color: '#fbbf24',
  },
  {
    id: 'aegis_fragment',
    name: 'Aegis Fragment',
    icon: '🛡️',
    desc: 'Restore +3 Ancient HP and increase Max HP by +3.',
    color: '#34d399',
  },
  {
    id: 'skadi_aura',
    name: 'Eye of Skadi Aura',
    icon: '❄️',
    desc: 'All enemies on the battlefield are permanently slowed by 14%.',
    color: '#38bdf8',
  },
  {
    id: 'mjollnir_blessing',
    name: 'Mjollnir Blessing',
    icon: '⚡',
    desc: 'All heroes gain a 15% chance on hit to proc Chain Lightning.',
    color: '#7dd3fc',
  },
  {
    id: 'arcane_ring',
    name: 'Arcane Ring',
    icon: '💍',
    desc: '+25% Mana Regen for all heroes and -20% Glyph/Sunstrike CD.',
    color: '#c084fc',
  },
  {
    id: 'paladin_sword',
    name: "Paladin's Blessing",
    icon: '🗡️',
    desc: '+20% Attack & Spell Damage for all deployed heroes.',
    color: '#f87171',
  },
];

export const RELIC_MAP: Record<RelicId, RelicDefinition> = RELIC_DEFS.reduce(
  (acc, r) => {
    acc[r.id] = r;
    return acc;
  },
  {} as Record<RelicId, RelicDefinition>
);

export interface RuneDefinition {
  kind: RuneKind;
  name: string;
  icon: string;
  color: string;
  hex: number;
  shortDesc: string;
}

export const RUNE_DEFS: Record<RuneKind, RuneDefinition> = {
  double_damage: {
    kind: 'double_damage',
    name: 'Double Damage',
    icon: '🔵',
    color: '#38bdf8',
    hex: 0x38bdf8,
    shortDesc: '2x Hero Damage (15s)',
  },
  arcane: {
    kind: 'arcane',
    name: 'Arcane Rune',
    icon: '🟣',
    color: '#c084fc',
    hex: 0xc084fc,
    shortDesc: '2x Mana & -15s Spells (15s)',
  },
  bounty: {
    kind: 'bounty',
    name: 'Bounty Rune',
    icon: '🟡',
    color: '#facc15',
    hex: 0xfacc15,
    shortDesc: 'Instant Gold Jackpot',
  },
  haste: {
    kind: 'haste',
    name: 'Haste Rune',
    icon: '🔴',
    color: '#ef4444',
    hex: 0xef4444,
    shortDesc: '+60% Atk Speed (15s)',
  },
};

// River Power Rune spawn spots inside the river corridor (between the 3 bridges)
export const RIVER_RUNE_SPOTS: Vec2[] = [
  { x: 675, y: 555 },
  { x: 808, y: 290 },
  { x: 540, y: 800 },
];
