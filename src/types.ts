export type DamageType = 'physical' | 'magical' | 'pure';

export type HeroId =
  | 'sniper'
  | 'crystal_maiden'
  | 'sven'
  | 'venomancer'
  | 'lina'
  | 'earthshaker'
  | 'drow_ranger'
  | 'zeus';

export type ItemId = 'desolator' | 'daedalus' | 'moon_shard' | 'octarine_core';

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type Difficulty = 'hard' | 'immortal';

export type BossKind =
  | 'centaur_boss'
  | 'golem_boss'
  | 'dragon_boss'
  | 'shadow_fiend_boss'
  | 'doom_boss'
  | 'frost_wyrm_boss'
  | 'obsidian_boss'
  | 'roshan';

export type TargetPriority = 'first' | 'strongest' | 'closest';

export type GamePhase = 'title' | 'playing' | 'victory' | 'defeat';

export interface Vec2 {
  x: number;
  y: number;
}

export interface BuildPad {
  id: number;
  x: number;
  y: number;
  occupiedByTowerId: number | null;
}

export interface ItemDefinition {
  id: ItemId;
  name: string;
  cost: number;
  icon: string;
  shortDesc: string;
  fullDesc: string;
  color: string;
}

export interface HeroLevelStats {
  level: number;
  upgradeCost: number;
  damage: number;
  attackRate: number;
  range: number;
  abilityPower: number;
  splashRadius: number;
  titleSuffix: string;
}

export interface HeroDefinition {
  id: HeroId;
  hotkey: string;
  name: string;
  role: string;
  damageType: DamageType;
  cost: number;
  primaryColor: string;
  accentColor: string;
  icon: string;
  maxMana: number;
  manaPerAttack: number;
  manaPerSecond: number;
  projectileSpeed: number;
  abilityName: string;
  abilityDesc: string;
  aghanimsDesc: string;
  levels: HeroLevelStats[];
}

export interface TowerInstance {
  id: number;
  padId: number;
  heroId: HeroId;
  x: number;
  y: number;
  level: number; // 1..4
  totalInvested: number;
  kills: number;
  totalDamage: number;
  items: ItemId[]; // max 2 Secret Shop items
  targetPriority: TargetPriority;
  attackCooldown: number;
  mana: number;
  facingAngle: number;
  attackAnimTimer: number;
  buffTimer: number; // Sven God's Strength
  slowedByRoshanTimer: number; // Roshan Slam slow
  auraBoosted: boolean; // Crystal Maiden Arcane Aura
  precisionBoosted: boolean; // Drow Ranger Precision Aura
}

export interface CreepDefinition {
  type: string;
  name: string;
  maxHp: number;
  speed: number;
  armor: number;
  magicResist: number;
  bounty: number;
  radius: number;
  color: string;
  accentColor: string;
  livesCost: number;
  isBoss?: boolean;
  bossKind?: BossKind;
  bossTitle?: string;
  trait?: string;
}

export interface CreepInstance {
  id: number;
  def: CreepDefinition;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  waypointIndex: number;
  distanceTraveled: number;
  dead: boolean;
  reachedEnd: boolean;
  // Status effects
  stunTimer: number;
  slowTimer: number;
  slowFactor: number;
  poisonTimer: number;
  poisonDps: number;
  poisonSourceTowerId: number | null;
  armorDebuffTimer: number;
  armorDebuffAmount: number;
  hitFlashTimer: number;
  // Boss mechanics
  isBoss: boolean;
  bossKind?: BossKind;
  spellBlockCooldown: number;
  slamCooldown: number;
  enraged: boolean;
  aegisReviveFlash: number;
}

export interface WaveSpawnGroup {
  creep: CreepDefinition;
  count: number;
  interval: number;
  delayBefore: number;
}

export interface WaveDefinition {
  waveNumber: number;
  title: string;
  subtitle: string;
  intel: string;
  bonusGold: number;
  isBossWave?: boolean;
  groups: WaveSpawnGroup[];
}

export interface Projectile {
  id: number;
  sourceTowerId: number;
  heroId: HeroId;
  x: number;
  y: number;
  targetCreepId: number;
  targetX: number;
  targetY: number;
  speed: number;
  damage: number;
  damageType: DamageType;
  color: string;
  radius: number;
  isUltimate?: boolean;
  isHeadshot?: boolean;
  isCrit?: boolean;
  applyDesolator?: boolean;
  splashRadius?: number;
  slowFactor?: number;
  slowDuration?: number;
  poisonDps?: number;
  poisonDuration?: number;
  stunDuration?: number;
}

export interface VisualEffect {
  id: number;
  kind:
    | 'ring'
    | 'beam'
    | 'sky_bolt'
    | 'sunstrike_pillar'
    | 'cleave'
    | 'explosion'
    | 'spell_block'
    | 'aegis_roar';
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  radius: number;
  maxRadius: number;
  color: string;
  angle?: number;
  age: number;
  duration: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  duration: number;
  large?: boolean;
}

export interface GameSnapshot {
  phase: GamePhase;
  difficulty: Difficulty;
  season: Season;
  gold: number;
  lives: number;
  maxLives: number;
  waveIndex: number; // 0..40
  totalWaves: number;
  waveActive: boolean;
  autoWave: boolean;
  paused: boolean;
  speed: 1 | 2 | 3;
  totalKills: number;
  selectedHeroToBuy: HeroId | null;
  selectedTowerId: number | null;
  glyphCooldown: number;
  glyphActiveTimer: number;
  sunstrikeCooldown: number;
  sunstrikeTargeting: boolean;
  boss: {
    active: boolean;
    name: string;
    hp: number;
    maxHp: number;
    statusText: string;
    enraged: boolean;
    isFinalBoss: boolean;
  } | null;
}
