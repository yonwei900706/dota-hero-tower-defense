import { CreepDefinition, WaveDefinition } from '../types';

function makeCreep(
  type: string,
  name: string,
  maxHp: number,
  speed: number,
  armor: number,
  magicResist: number,
  bounty: number,
  radius: number,
  color: string,
  accentColor: string,
  livesCost = 1
): CreepDefinition {
  return {
    type,
    name,
    maxHp,
    speed,
    armor,
    magicResist,
    bounty,
    radius,
    color,
    accentColor,
    livesCost,
  };
}

export const WAVES: WaveDefinition[] = [
  // ===================== 🌸 SPRING (WAVES 1–10) =====================
  {
    waveNumber: 1,
    title: 'Wave 1 [Spring]: Dire Melee Creeps',
    subtitle: 'Dire footmen march across the blooming Spring valley.',
    intel: '14x Dire Melee Creeps • Balanced opener. Place Sniper, Sven, or Drow Ranger.',
    bonusGold: 45,
    groups: [
      {
        count: 14,
        interval: 0.9,
        delayBefore: 0,
        creep: makeCreep('melee_creep', 'Dire Melee Creep', 135, 72, 1, 0, 14, 13, '#dc2626', '#fca5a5'),
      },
    ],
  },
  {
    waveNumber: 2,
    title: 'Wave 2 [Spring]: Dire Ranged Creeps',
    subtitle: 'Swifter ranged acolytes advance in formation.',
    intel: '16x Dire Ranged Creeps • Faster movement, 10% Magic Resist.',
    bonusGold: 55,
    groups: [
      {
        count: 16,
        interval: 0.78,
        delayBefore: 0,
        creep: makeCreep('ranged_creep', 'Dire Ranged Creep', 180, 86, 1, 0.1, 15, 12, '#9333ea', '#d8b4fe'),
      },
    ],
  },
  {
    waveNumber: 3,
    title: 'Wave 3 [Spring]: Kobold Taskmasters',
    subtitle: 'Speed Aura! A swift swarm rushes across the river.',
    intel: '22x Kobold Taskmasters • Fast swarm (112 spd)! Slows & AoE are essential.',
    bonusGold: 65,
    groups: [
      {
        count: 22,
        interval: 0.54,
        delayBefore: 0,
        creep: makeCreep('kobold', 'Kobold Taskmaster', 215, 112, 0, 0, 14, 11, '#ca8a04', '#fde047'),
      },
    ],
  },
  {
    waveNumber: 4,
    title: 'Wave 4 [Spring]: Dire Siege Catapults',
    subtitle: 'Fortified Armor! Physical attacks deal reduced damage.',
    intel: '12x Dire Siege Catapults • High Armor (13). Magic heroes (Lina, Zeus, CM) shred them!',
    bonusGold: 80,
    groups: [
      {
        count: 12,
        interval: 1.25,
        delayBefore: 0,
        creep: makeCreep('catapult', 'Dire Siege Catapult', 480, 60, 13, 0, 26, 17, '#78716c', '#f97316', 2),
      },
    ],
  },
  {
    waveNumber: 5,
    title: 'MINI-BOSS (W5): CENTAUR WARLORD',
    subtitle: 'The Centaur Warlord charges in with Stampede fury!',
    intel: 'MINI-BOSS: Centaur Warlord (4,600 HP) + 7 Centaurs • Triggers Stampede speed burst at 50% HP!',
    bonusGold: 160,
    isBossWave: true,
    groups: [
      {
        count: 7,
        interval: 1.05,
        delayBefore: 0,
        creep: makeCreep('centaur', 'Centaur Conqueror', 680, 74, 4, 0.12, 32, 17, '#b91c1c', '#fbbf24', 2),
      },
      {
        count: 1,
        interval: 1,
        delayBefore: 2.0,
        creep: {
          ...makeCreep('centaur_boss', 'Centaur Warlord', 4600, 58, 8, 0.2, 240, 24, '#991b1b', '#facc15', 5),
          isBoss: true,
          bossKind: 'centaur_boss',
          bossTitle: '🐎 SPRING MINI-BOSS: CENTAUR WARLORD',
        },
      },
    ],
  },
  {
    waveNumber: 6,
    title: 'Wave 6 [Spring]: Mud Golems',
    subtitle: 'Spell-hardened stone! High Magic Resistance.',
    intel: '18x Mud Golems • 55% Magic Resistance! Physical DPS (Sniper, Sven, Drow) excels.',
    bonusGold: 110,
    groups: [
      {
        count: 18,
        interval: 0.85,
        delayBefore: 0,
        creep: makeCreep('mud_golem', 'Mud Golem', 820, 68, 2, 0.55, 25, 15, '#92400e', '#d97706'),
      },
    ],
  },
  {
    waveNumber: 7,
    title: 'Wave 7 [Spring]: Hellbear Smashers',
    subtitle: 'Frenzied jungle bruisers storm the bridges!',
    intel: '16x Hellbear Smashers • Fast (90 spd) and tanky. Pair Earthshaker stuns with slows.',
    bonusGold: 125,
    groups: [
      {
        count: 16,
        interval: 0.85,
        delayBefore: 0,
        creep: makeCreep('hellbear', 'Hellbear Smasher', 1150, 90, 5, 0.2, 30, 16, '#991b1b', '#fb923c', 2),
      },
    ],
  },
  {
    waveNumber: 8,
    title: 'Wave 8 [Spring]: Satyr Tormentors',
    subtitle: 'Arcane forest demons advance in tight packs.',
    intel: '20x Satyr Tormentors • Medium speed, balanced defenses. Zeus & Sven Cleave dominate!',
    bonusGold: 140,
    groups: [
      {
        count: 20,
        interval: 0.68,
        delayBefore: 0,
        creep: makeCreep('satyr', 'Satyr Tormentor', 1380, 84, 6, 0.25, 28, 15, '#7c3aed', '#c4b5fd'),
      },
    ],
  },
  {
    waveNumber: 9,
    title: 'Wave 9 [Spring]: Wildwing Rippers',
    subtitle: 'Swift storm-beasts sweep across the river!',
    intel: '24x Wildwing Rippers • Blazing fast (108 spd) swarm! Keep slows active.',
    bonusGold: 155,
    groups: [
      {
        count: 24,
        interval: 0.54,
        delayBefore: 0,
        creep: makeCreep('wildwing', 'Wildwing Ripper', 1320, 108, 4, 0.15, 26, 14, '#0d9488', '#5eead4'),
      },
    ],
  },
  {
    waveNumber: 10,
    title: 'BOSS (W10): GRANITE GOLEM COLOSSUS',
    subtitle: 'An ancient spell-proof stone titan ends Spring!',
    intel: 'BOSS: Granite Golem Colossus (14,500 HP) • 60% Magic Resist! Equip Desolator/Daedalus on Physical carries!',
    bonusGold: 260,
    isBossWave: true,
    groups: [
      {
        count: 8,
        interval: 0.95,
        delayBefore: 0,
        creep: makeCreep('mud_golem', 'Ancient Rock Golem', 1750, 66, 6, 0.5, 34, 16, '#78350f', '#f59e0b', 2),
      },
      {
        count: 1,
        interval: 1,
        delayBefore: 2.2,
        creep: {
          ...makeCreep('golem_boss', 'Granite Golem Colossus', 14500, 48, 8, 0.6, 420, 26, '#57534e', '#f59e0b', 6),
          isBoss: true,
          bossKind: 'golem_boss',
          bossTitle: '🪨 SPRING BOSS: GRANITE GOLEM COLOSSUS',
        },
      },
    ],
  },

  // ===================== ☀️ SUMMER (WAVES 11–20) =====================
  {
    waveNumber: 11,
    title: 'Wave 11 [Summer]: Dire Super Creeps',
    subtitle: 'Summer heats up as Dire Super Creeps march in force!',
    intel: '20x Dire Super Creeps • High HP & armor. Push core heroes toward Level 3–4 Aghanim’s!',
    bonusGold: 185,
    groups: [
      {
        count: 20,
        interval: 0.72,
        delayBefore: 0,
        creep: makeCreep('mega_creep', 'Dire Super Creep', 2250, 82, 8, 0.2, 34, 15, '#991b1b', '#f87171', 2),
      },
    ],
  },
  {
    waveNumber: 12,
    title: 'Wave 12 [Summer]: Ancient Prowlers & Drakes',
    subtitle: 'Mixed Ancient pack storms the sun-drenched highlands.',
    intel: '16x Ancient Prowlers + 14x Black Drakes • Mixed armor & flying speed.',
    bonusGold: 205,
    groups: [
      {
        count: 16,
        interval: 0.78,
        delayBefore: 0,
        creep: makeCreep('prowler', 'Ancient Prowler', 2700, 84, 9, 0.25, 38, 16, '#6d28d9', '#c084fc', 2),
      },
      {
        count: 14,
        interval: 0.65,
        delayBefore: 1.6,
        creep: makeCreep('black_drake', 'Ancient Black Drake', 2050, 104, 5, 0.35, 34, 14, '#334155', '#38bdf8'),
      },
    ],
  },
  {
    waveNumber: 13,
    title: 'Wave 13 [Summer]: Ancient Thunderhides',
    subtitle: 'Frenzied armored lizards stampede down the lane.',
    intel: '18x Ancient Thunderhides • Fast (94 spd) + sturdy (10 Armor).',
    bonusGold: 225,
    groups: [
      {
        count: 18,
        interval: 0.8,
        delayBefore: 0,
        creep: makeCreep('thunderhide', 'Ancient Thunderhide', 3300, 94, 10, 0.2, 42, 17, '#0f766e', '#2dd4bf', 2),
      },
    ],
  },
  {
    waveNumber: 14,
    title: 'Wave 14 [Summer]: Armored Siege Division',
    subtitle: 'Heavy catapult battery escorted by Dire knights.',
    intel: '14x Heavy Catapults (17 Armor) + 14x Dire Knights • Magic & Pure damage melt catapults!',
    bonusGold: 250,
    groups: [
      {
        count: 14,
        interval: 1.0,
        delayBefore: 0,
        creep: makeCreep('catapult', 'Dire Heavy Catapult', 3900, 64, 17, 0.1, 48, 18, '#57534e', '#fb923c', 2),
      },
      {
        count: 14,
        interval: 0.8,
        delayBefore: 1.5,
        creep: makeCreep('mega_creep', 'Dire Knight', 3100, 88, 9, 0.3, 40, 15, '#7f1d1d', '#fca5a5', 2),
      },
    ],
  },
  {
    waveNumber: 15,
    title: 'MINI-BOSS (W15): ANCIENT ELDER DRAGON',
    subtitle: 'The Elder Black Dragon descends with dragonhide armor!',
    intel: 'MINI-BOSS: Ancient Elder Dragon (28,500 HP, 17 Armor) + 6 Black Dragons • Pure nukes & Desolator shine!',
    bonusGold: 360,
    isBossWave: true,
    groups: [
      {
        count: 6,
        interval: 1.1,
        delayBefore: 0,
        creep: makeCreep('black_dragon', 'Ancient Black Dragon', 4300, 82, 11, 0.25, 58, 19, '#1e293b', '#f59e0b', 3),
      },
      {
        count: 1,
        interval: 1,
        delayBefore: 2.0,
        creep: {
          ...makeCreep('dragon_boss', 'Ancient Elder Dragon', 28500, 62, 17, 0.28, 650, 27, '#0f172a', '#f59e0b', 7),
          isBoss: true,
          bossKind: 'dragon_boss',
          bossTitle: '🐉 SUMMER MINI-BOSS: ANCIENT ELDER DRAGON',
        },
      },
    ],
  },
  {
    waveNumber: 16,
    title: 'Wave 16 [Summer]: Dire Mega Creeps',
    subtitle: 'Full Mega Creep wave storms the Radiant lanes!',
    intel: '24x Dire Mega Creeps • Relentless armored army. Max out Aghanim’s upgrades!',
    bonusGold: 280,
    groups: [
      {
        count: 24,
        interval: 0.62,
        delayBefore: 0,
        creep: makeCreep('mega_creep', 'Dire Mega Creep', 4400, 88, 10, 0.25, 42, 16, '#7f1d1d', '#ef4444', 2),
      },
    ],
  },
  {
    waveNumber: 17,
    title: 'Wave 17 [Summer]: Obsidian Destroyers',
    subtitle: 'Arcane constructs with heavy Magic Resistance!',
    intel: '18x Obsidian Destroyers • 60% Magic Resist! Daedalus + Desolator + Drow Aura melt them.',
    bonusGold: 310,
    groups: [
      {
        count: 18,
        interval: 0.8,
        delayBefore: 0,
        creep: makeCreep('obsidian', 'Obsidian Destroyer', 5700, 82, 7, 0.6, 52, 17, '#1e1b4b', '#38bdf8', 2),
      },
    ],
  },
  {
    waveNumber: 18,
    title: 'Wave 18 [Summer]: Chaos Cavalry',
    subtitle: 'Phantasm horsemen charge at blinding speed!',
    intel: '22x Chaos Horsemen • High speed (106) + 5,300 HP! Keep stuns & slows up.',
    bonusGold: 340,
    groups: [
      {
        count: 22,
        interval: 0.65,
        delayBefore: 0,
        creep: makeCreep('centaur', 'Chaos Horseman', 5300, 106, 9, 0.25, 48, 17, '#4c0519', '#fb7185', 2),
      },
    ],
  },
  {
    waveNumber: 19,
    title: 'Wave 19 [Summer]: Sunfire Dragons',
    subtitle: 'Blazing dragons scorch the Summer valley!',
    intel: '16x Sunfire Dragons • High HP (7,600) & 13 Armor. Prepare for Wave 20 Boss!',
    bonusGold: 390,
    groups: [
      {
        count: 16,
        interval: 0.92,
        delayBefore: 0,
        creep: makeCreep('black_dragon', 'Sunfire Dragon', 7600, 86, 13, 0.35, 68, 20, '#7c2d12', '#fb923c', 3),
      },
    ],
  },
  {
    waveNumber: 20,
    title: 'BOSS (W20): SHADOW FIEND OVERLORD',
    subtitle: 'The Demon of Souls rises at the end of Summer!',
    intel: 'BOSS: Shadow Fiend Overlord (48,000 HP) + 10 Demon Escorts • Fast boss with Soul Enrage at 45% HP!',
    bonusGold: 520,
    isBossWave: true,
    groups: [
      {
        count: 10,
        interval: 0.78,
        delayBefore: 0,
        creep: makeCreep('mega_creep', 'Shadow Demon', 5600, 92, 10, 0.3, 52, 16, '#18181b', '#ef4444', 2),
      },
      {
        count: 1,
        interval: 1,
        delayBefore: 2.2,
        creep: {
          ...makeCreep('shadow_fiend_boss', 'Shadow Fiend Overlord', 48000, 68, 13, 0.35, 950, 28, '#18181b', '#dc2626', 8),
          isBoss: true,
          bossKind: 'shadow_fiend_boss',
          bossTitle: '🔥 SUMMER BOSS: SHADOW FIEND OVERLORD',
        },
      },
    ],
  },

  // ===================== 🍂 AUTUMN (WAVES 21–30) =====================
  {
    waveNumber: 21,
    title: 'Wave 21 [Autumn]: Crimson Vanguard',
    subtitle: 'Autumn leaves fall as the Dire elite surge forward.',
    intel: '24x Crimson Vanguard • 7,200 HP armored marchers. Equip 3rd Secret Shop items!',
    bonusGold: 360,
    groups: [
      {
        count: 24,
        interval: 0.62,
        delayBefore: 0,
        creep: makeCreep('mega_creep', 'Crimson Vanguard', 7200, 90, 11, 0.25, 48, 16, '#991b1b', '#f97316', 2),
      },
    ],
  },
  {
    waveNumber: 22,
    title: 'Wave 22 [Autumn]: Harvest Golems',
    subtitle: 'Spell-proof colossi march through the crimson mist.',
    intel: '20x Harvest Golems • 65% Magic Resist! Heavy Physical + Desolator required.',
    bonusGold: 390,
    groups: [
      {
        count: 20,
        interval: 0.78,
        delayBefore: 0,
        creep: makeCreep('mud_golem', 'Harvest Golem', 9200, 74, 8, 0.65, 56, 17, '#78350f', '#fbbf24', 2),
      },
    ],
  },
  {
    waveNumber: 23,
    title: 'Wave 23 [Autumn]: Phantom Raiders',
    subtitle: 'Blazingly fast phantom riders dart across the bridges!',
    intel: '28x Phantom Raiders • Extreme speed (116)! Crystal Maiden + Drow + Earthshaker lock them down.',
    bonusGold: 420,
    groups: [
      {
        count: 28,
        interval: 0.48,
        delayBefore: 0,
        creep: makeCreep('kobold', 'Phantom Raider', 6800, 116, 7, 0.3, 44, 14, '#7c2d12', '#fde047', 2),
      },
    ],
  },
  {
    waveNumber: 24,
    title: 'Wave 24 [Autumn]: Hellfire Catapults',
    subtitle: 'Fortified siege juggernauts roll through Autumn.',
    intel: '16x Hellfire Catapults • 20 Armor (heavy physical reduction)! Zeus, Lina, & Pure damage shine.',
    bonusGold: 450,
    groups: [
      {
        count: 16,
        interval: 0.92,
        delayBefore: 0,
        creep: makeCreep('catapult', 'Hellfire Catapult', 11200, 68, 20, 0.15, 68, 19, '#44403c', '#f97316', 3),
      },
    ],
  },
  {
    waveNumber: 25,
    title: 'MINI-BOSS (W25): DOOM BRINGER',
    subtitle: 'The Lord of Hell marches with his burning demon host!',
    intel: 'MINI-BOSS: Doom Bringer (72,000 HP, 16 Armor) + 8 Demon Knights • Scorched Earth speed surge at 45% HP!',
    bonusGold: 620,
    isBossWave: true,
    groups: [
      {
        count: 8,
        interval: 0.9,
        delayBefore: 0,
        creep: makeCreep('centaur', 'Infernal Centaur', 9600, 92, 12, 0.3, 64, 18, '#7f1d1d', '#f97316', 2),
      },
      {
        count: 1,
        interval: 1,
        delayBefore: 2.2,
        creep: {
          ...makeCreep('doom_boss', 'Doom Bringer', 72000, 56, 16, 0.35, 1300, 29, '#450a0a', '#ef4444', 10),
          isBoss: true,
          bossKind: 'doom_boss',
          bossTitle: '👹 AUTUMN MINI-BOSS: DOOM BRINGER',
        },
      },
    ],
  },
  {
    waveNumber: 26,
    title: 'Wave 26 [Autumn]: Ancient Drakeswarm',
    subtitle: 'A sky-darkening flock of Ancient Drakes!',
    intel: '26x Ancient Drakes • Fast flying units (108 spd) with 40% Magic Resist.',
    bonusGold: 460,
    groups: [
      {
        count: 26,
        interval: 0.52,
        delayBefore: 0,
        creep: makeCreep('black_drake', 'Elder Drake', 8800, 108, 9, 0.4, 48, 15, '#1e293b', '#f59e0b', 2),
      },
    ],
  },
  {
    waveNumber: 27,
    title: 'Wave 27 [Autumn]: Abyssal Bruisers',
    subtitle: 'Colossal demon brutes smash through the valley.',
    intel: '20x Abyssal Bruisers • 13,500 HP each with 13 Armor & 30% Magic Resist.',
    bonusGold: 500,
    groups: [
      {
        count: 20,
        interval: 0.78,
        delayBefore: 0,
        creep: makeCreep('hellbear', 'Abyssal Bruiser', 13500, 90, 13, 0.3, 62, 18, '#7f1d1d', '#fb923c', 2),
      },
    ],
  },
  {
    waveNumber: 28,
    title: 'Wave 28 [Autumn]: Arcane Titans',
    subtitle: 'Spell-immune constructs advance relentlessly.',
    intel: '20x Arcane Titans • 70% Magic Resist! Pure & Physical Crits (Sniper/Sven/Drow) are vital.',
    bonusGold: 540,
    groups: [
      {
        count: 20,
        interval: 0.78,
        delayBefore: 0,
        creep: makeCreep('obsidian', 'Arcane Titan', 15200, 82, 10, 0.7, 66, 18, '#1e1b4b', '#818cf8', 2),
      },
    ],
  },
  {
    waveNumber: 29,
    title: 'Wave 29 [Autumn]: Elder Dragonflight',
    subtitle: 'An elite wing of Ancient Dragons heralds Winter.',
    intel: '18x Elder Dragons • 16,500 HP & 15 Armor. Use Sunstrike & Glyph wisely!',
    bonusGold: 600,
    groups: [
      {
        count: 18,
        interval: 0.88,
        delayBefore: 0,
        creep: makeCreep('black_dragon', 'Elder Dragon', 16500, 88, 15, 0.35, 76, 20, '#18181b', '#fbbf24', 3),
      },
    ],
  },
  {
    waveNumber: 30,
    title: 'BOSS (W30): ANCIENT FROST WYRM',
    subtitle: 'The Frozen Wyrm brings Winter to the battlefield!',
    intel: 'BOSS: Ancient Frost Wyrm (96,000 HP, 18 Armor, 55% Magic Resist) + 8 Frost Drakes • Bring Pure damage & Desolators!',
    bonusGold: 800,
    isBossWave: true,
    groups: [
      {
        count: 8,
        interval: 0.85,
        delayBefore: 0,
        creep: makeCreep('black_dragon', 'Frost Wyvern', 13500, 92, 13, 0.45, 72, 19, '#0369a1', '#bae6fd', 3),
      },
      {
        count: 1,
        interval: 1,
        delayBefore: 2.4,
        creep: {
          ...makeCreep('frost_wyrm_boss', 'Ancient Frost Wyrm', 96000, 62, 18, 0.55, 1800, 30, '#0284c7', '#e0f2fe', 10),
          isBoss: true,
          bossKind: 'frost_wyrm_boss',
          bossTitle: '❄️ AUTUMN BOSS: ANCIENT FROST WYRM',
        },
      },
    ],
  },

  // ===================== ❄️ WINTER (WAVES 31–40) =====================
  {
    waveNumber: 31,
    title: 'Wave 31 [Winter]: Frostbitten Legion',
    subtitle: 'Snow falls as the Frozen Dire Legion marches!',
    intel: '26x Frostbitten Soldiers • 16,000 HP each with 14 Armor.',
    bonusGold: 580,
    groups: [
      {
        count: 26,
        interval: 0.58,
        delayBefore: 0,
        creep: makeCreep('mega_creep', 'Frostbitten Soldier', 16000, 94, 14, 0.35, 62, 16, '#0c4a6e', '#7dd3fc', 2),
      },
    ],
  },
  {
    waveNumber: 32,
    title: 'Wave 32 [Winter]: Glacial Golems',
    subtitle: 'Frozen stone titans immune to weak magic!',
    intel: '22x Glacial Golems • 21,000 HP & 70% Magic Resist! Physical Carries with Daedalus shine.',
    bonusGold: 620,
    groups: [
      {
        count: 22,
        interval: 0.72,
        delayBefore: 0,
        creep: makeCreep('mud_golem', 'Glacial Golem', 21000, 76, 12, 0.7, 72, 18, '#334155', '#38bdf8', 2),
      },
    ],
  },
  {
    waveNumber: 33,
    title: 'Wave 33 [Winter]: Blizzard Horsemen',
    subtitle: 'A blinding winter cavalry charge!',
    intel: '26x Blizzard Horsemen • Ultra-fast (116 spd) & 17,500 HP! Stack stuns & slows.',
    bonusGold: 660,
    groups: [
      {
        count: 26,
        interval: 0.52,
        delayBefore: 0,
        creep: makeCreep('centaur', 'Blizzard Horseman', 17500, 116, 12, 0.35, 66, 17, '#1e3a8a', '#93c5fd', 2),
      },
    ],
  },
  {
    waveNumber: 34,
    title: 'Wave 34 [Winter]: Frost Siege Engine',
    subtitle: 'Armored winter siege tanks roll across the frozen river!',
    intel: '18x Frost Siege Engines • 24 Armor! Pure damage (Aghs Lina/Sniper/Zeus) melts them.',
    bonusGold: 720,
    groups: [
      {
        count: 18,
        interval: 0.85,
        delayBefore: 0,
        creep: makeCreep('catapult', 'Frost Siege Engine', 24500, 70, 24, 0.2, 84, 19, '#475569', '#38bdf8', 3),
      },
    ],
  },
  {
    waveNumber: 35,
    title: 'MINI-BOSS (W35): OBSIDIAN FROST TITAN',
    subtitle: 'A colossus of ice and obsidian shakes the frozen arena!',
    intel: 'MINI-BOSS: Obsidian Frost Titan (125,000 HP, 65% Magic Resist) + 10 Obsidian Destroyers!',
    bonusGold: 950,
    isBossWave: true,
    groups: [
      {
        count: 10,
        interval: 0.78,
        delayBefore: 0,
        creep: makeCreep('obsidian', 'Obsidian Guard', 22000, 88, 13, 0.6, 82, 18, '#1e1b4b', '#38bdf8', 2),
      },
      {
        count: 1,
        interval: 1,
        delayBefore: 2.4,
        creep: {
          ...makeCreep('obsidian_boss', 'Obsidian Frost Titan', 125000, 54, 16, 0.65, 2200, 30, '#0f172a', '#38bdf8', 10),
          isBoss: true,
          bossKind: 'obsidian_boss',
          bossTitle: '💎 WINTER MINI-BOSS: OBSIDIAN FROST TITAN',
        },
      },
    ],
  },
  {
    waveNumber: 36,
    title: 'Wave 36 [Winter]: Dire Apex Legion',
    subtitle: 'The strongest footmen of the Dire storm every bridge.',
    intel: '28x Dire Apex Soldiers • 25,000 HP, 15 Armor, 35% Magic Resist.',
    bonusGold: 780,
    groups: [
      {
        count: 28,
        interval: 0.52,
        delayBefore: 0,
        creep: makeCreep('mega_creep', 'Dire Apex Soldier', 25000, 96, 15, 0.35, 72, 16, '#7f1d1d', '#fca5a5', 2),
      },
    ],
  },
  {
    waveNumber: 37,
    title: 'Wave 37 [Winter]: Stormwing Ancients',
    subtitle: 'Fast ancient dragons dive through the blizzard!',
    intel: '22x Stormwing Dragons • 28,000 HP & 102 speed!',
    bonusGold: 840,
    groups: [
      {
        count: 22,
        interval: 0.68,
        delayBefore: 0,
        creep: makeCreep('black_dragon', 'Stormwing Dragon', 28000, 102, 15, 0.4, 84, 20, '#0f172a', '#38bdf8', 3),
      },
    ],
  },
  {
    waveNumber: 38,
    title: 'Wave 38 [Winter]: Abyssal Juggernauts',
    subtitle: 'Unstoppable armored warlords march on the Ancient!',
    intel: '22x Abyssal Juggernauts • 34,000 HP, 18 Armor, 40% Magic Resist.',
    bonusGold: 900,
    groups: [
      {
        count: 22,
        interval: 0.72,
        delayBefore: 0,
        creep: makeCreep('hellbear', 'Abyssal Juggernaut', 34000, 90, 18, 0.4, 92, 19, '#450a0a', '#f97316', 3),
      },
    ],
  },
  {
    waveNumber: 39,
    title: 'Wave 39 [Winter]: Roshan’s Honor Guard',
    subtitle: 'The final vanguard before the Immortal Emperor awakens!',
    intel: '20x Roshan Honor Dragons • 38,000 HP! Finish all Aghanim’s & 3-item builds before Wave 40!',
    bonusGold: 1200,
    groups: [
      {
        count: 20,
        interval: 0.78,
        delayBefore: 0,
        creep: makeCreep('black_dragon', 'Honor Guard Dragon', 38000, 94, 17, 0.4, 110, 20, '#18181b', '#facc15', 3),
      },
    ],
  },
  {
    waveNumber: 40,
    title: 'FINAL BOSS (W40): ROSHAN — THE IMMORTAL EMPEROR',
    subtitle: 'The Immortal Lord emerges in the dead of Winter with his Dragon Legion!',
    intel:
      'FINAL BOSS: ROSHAN (165,000 HP) • Faster Linken’s Spell Block (6s), Roshan Slam, & Aegis Enrage at 40% HP (+18,000 HP + speed surge)!',
    bonusGold: 3000,
    isBossWave: true,
    groups: [
      {
        count: 10,
        interval: 0.78,
        delayBefore: 0,
        creep: makeCreep('black_dragon', 'Roshan Dragon Guard', 30000, 92, 16, 0.35, 100, 19, '#450a0a', '#f97316', 3),
      },
      {
        count: 1,
        interval: 1,
        delayBefore: 2.5,
        creep: {
          ...makeCreep('roshan', 'Roshan', 165000, 48, 18, 0.42, 5000, 32, '#450a0a', '#f97316', 20),
          isBoss: true,
          bossKind: 'roshan',
          bossTitle: '🔥 FINAL BOSS (W40): ROSHAN — THE IMMORTAL EMPEROR',
        },
      },
      {
        count: 10,
        interval: 0.82,
        delayBefore: 3.5,
        creep: makeCreep('mega_creep', 'Roshan Mega Vanguard', 28000, 96, 15, 0.35, 90, 17, '#7f1d1d', '#ef4444', 2),
      },
    ],
  },
];
