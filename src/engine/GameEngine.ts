import { HERO_MAP } from '../data/heroes';
import { ITEM_MAP } from '../data/items';
import { INITIAL_BUILD_PADS, PAD_RADIUS, PATH_WAYPOINTS } from '../data/map';
import { HERO_TALENTS, RELIC_DEFS, RELIC_MAP, RIVER_RUNE_SPOTS, RUNE_DEFS } from '../data/mechanics';
import { WAVES } from '../data/waves';
import {
  ActiveRune,
  ActiveRuneBuff,
  BuildPad,
  BurstEvent,
  CreepDefinition,
  CreepInstance,
  DamageType,
  Difficulty,
  FloatingText,
  GamePhase,
  GameSnapshot,
  HeroId,
  ItemId,
  Projectile,
  RelicId,
  RuneKind,
  Season,
  SynergyId,
  TalentChoice,
  TargetPriority,
  TimeOfDay,
  TowerInstance,
  VisualEffect,
} from '../types';
import { sound } from './Audio';

interface ActiveSpawnQueue {
  creep: CreepDefinition;
  remaining: number;
  interval: number;
  timer: number;
}

const STARTING_GOLD = 260;
const HARD_LIVES = 15;
const IMMORTAL_LIVES = 10;
const SELL_REFUND_RATE = 0.75;
const AURA_RADIUS = 195;
const ROSHAN_SLAM_RADIUS = 190;
const ROSHAN_SLAM_COOLDOWN = 6.0;
const ROSHAN_SPELL_BLOCK_CD = 6.0;
const GLYPH_COOLDOWN = 60;
const GLYPH_DURATION = 5;
const SUNSTRIKE_COOLDOWN = 35;

const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

export class GameEngine {
  public phase: GamePhase = 'title';
  public difficulty: Difficulty = 'hard';
  public seasonOverride: Season | null = null;
  public timeOfDayOverride: TimeOfDay | null = null;
  public gold = STARTING_GOLD;
  public lives = HARD_LIVES;
  public maxLives = HARD_LIVES;
  public waveIndex = 0; // 0..40
  public waveActive = false;
  public autoWave = false;
  public paused = false;
  public speed: 1 | 2 | 3 = 1;
  public totalKills = 0;
  public elapsedTime = 0;

  // Global tactical spells
  public glyphCooldown = 0;
  public glyphActiveTimer = 0;
  public sunstrikeCooldown = 0;
  public sunstrikeTargeting = false;

  // Dota 2 Runes, Relics, Killstreaks & 3D Particle Bursts
  public activeRunes: ActiveRune[] = [];
  public activeRuneBuffs: ActiveRuneBuff[] = [];
  public pendingRelicChoices: RelicId[] | null = null;
  public ownedRelics: RelicId[] = [];
  public burstEvents: BurstEvent[] = [];
  public killstreakBanner: { text: string; color: string; id: number } | null = null;

  public selectedHeroToBuy: HeroId | null = null;
  public selectedTowerId: number | null = null;
  public hoveredPadId: number | null = null;

  public pads: BuildPad[] = [];
  public towers: TowerInstance[] = [];
  public creeps: CreepInstance[] = [];
  public projectiles: Projectile[] = [];
  public effects: VisualEffect[] = [];
  public floatingTexts: FloatingText[] = [];

  private spawnQueues: ActiveSpawnQueue[] = [];
  private autoWaveTimer = 0;
  private hudThrottleTimer = 0;
  private runeSpawnTimer = -1;
  private streakCount = 0;
  private streakTimer = 0;
  private bossDrumTimer = 0;
  private nextId = 1;
  private onStateChange: () => void;

  constructor(onStateChange: () => void) {
    this.onStateChange = onStateChange;
    this.reset(false);
  }

  public setDifficulty(diff: Difficulty): void {
    this.difficulty = diff;
    this.maxLives = diff === 'immortal' ? IMMORTAL_LIVES : HARD_LIVES;
    if (this.phase === 'title') {
      this.lives = this.maxLives;
    }
    this.onStateChange();
  }

  public getActiveSeason(): Season {
    if (this.seasonOverride) return this.seasonOverride;
    if (this.waveIndex <= 10) return 'spring';
    if (this.waveIndex <= 20) return 'summer';
    if (this.waveIndex <= 30) return 'autumn';
    return 'winter';
  }

  public cycleSeasonPreview(): void {
    const cur = this.getActiveSeason();
    const idx = SEASON_ORDER.indexOf(cur);
    this.seasonOverride = SEASON_ORDER[(idx + 1) % SEASON_ORDER.length];
    this.onStateChange();
  }

  public getActiveTimeOfDay(): TimeOfDay {
    if (this.timeOfDayOverride) return this.timeOfDayOverride;
    if (this.waveIndex <= 0) return 'day';
    return Math.floor((this.waveIndex - 1) / 4) % 2 === 1 ? 'night' : 'day';
  }

  public toggleTimeOfDayPreview(): void {
    const cur = this.getActiveTimeOfDay();
    this.timeOfDayOverride = cur === 'day' ? 'night' : 'day';
    this.onStateChange();
  }

  public getActiveSynergies(): SynergyId[] {
    const counts = new Set(this.towers.map((t) => t.heroId));
    const list: SynergyId[] = [];
    if (counts.has('lina') && counts.has('crystal_maiden') && counts.has('zeus')) {
      list.push('elemental');
    }
    if (counts.has('sniper') && counts.has('drow_ranger')) {
      list.push('marksman');
    }
    if (counts.has('sven') && counts.has('earthshaker')) {
      list.push('frontline');
    }
    if (counts.has('venomancer') && (counts.has('crystal_maiden') || counts.has('drow_ranger'))) {
      list.push('plague_frost');
    }
    return list;
  }

  public hasRuneBuff(kind: Exclude<RuneKind, 'bounty'>): boolean {
    return this.activeRuneBuffs.some((b) => b.kind === kind && b.remaining > 0);
  }

  public drainBurstEvents(): BurstEvent[] {
    if (this.burstEvents.length === 0) return [];
    const copy = this.burstEvents;
    this.burstEvents = [];
    return copy;
  }

  public reset(startPlaying = true): void {
    this.phase = startPlaying ? 'playing' : 'title';
    this.gold = STARTING_GOLD;
    this.maxLives = this.difficulty === 'immortal' ? IMMORTAL_LIVES : HARD_LIVES;
    this.lives = this.maxLives;
    this.seasonOverride = null;
    this.timeOfDayOverride = null;
    this.waveIndex = 0;
    this.waveActive = false;
    this.autoWave = false;
    this.paused = false;
    this.speed = 1;
    this.totalKills = 0;
    this.elapsedTime = 0;
    this.glyphCooldown = 0;
    this.glyphActiveTimer = 0;
    this.sunstrikeCooldown = 0;
    this.sunstrikeTargeting = false;
    this.activeRunes = [];
    this.activeRuneBuffs = [];
    this.pendingRelicChoices = null;
    this.ownedRelics = [];
    this.burstEvents = [];
    this.killstreakBanner = null;
    this.selectedHeroToBuy = null;
    this.selectedTowerId = null;
    this.hoveredPadId = null;
    this.autoWaveTimer = 0;
    this.runeSpawnTimer = -1;
    this.streakCount = 0;
    this.streakTimer = 0;
    this.bossDrumTimer = 0;
    this.pads = INITIAL_BUILD_PADS.map((p) => ({
      ...p,
      occupiedByTowerId: null,
    }));
    this.towers = [];
    this.creeps = [];
    this.projectiles = [];
    this.effects = [];
    this.floatingTexts = [];
    this.spawnQueues = [];
    this.nextId = 1;
    this.onStateChange();
  }

  public getSnapshot(): GameSnapshot {
    const bossCreep = this.creeps.find((c) => c.isBoss && !c.dead && !c.reachedEnd);
    let bossSnap: GameSnapshot['boss'] = null;
    if (bossCreep) {
      let statusText = 'BOSS ACTIVE';
      if (bossCreep.bossKind === 'roshan') {
        if (bossCreep.enraged) {
          statusText =
            bossCreep.spellBlockCooldown <= 0
              ? '🔥 AEGIS ENRAGED • SPELL BLOCK READY'
              : '🔥 AEGIS ENRAGED';
        } else {
          statusText =
            bossCreep.spellBlockCooldown <= 0
              ? '🛡️ SPELL BLOCK READY'
              : 'SPELL BLOCK RECHARGING';
        }
      } else if (bossCreep.bossKind === 'centaur_boss') {
        statusText = bossCreep.enraged ? '⚡ STAMPEDE ACTIVE!' : 'ARMORED WARLORD';
      } else if (bossCreep.bossKind === 'golem_boss') {
        statusText = '🪨 60% MAGIC RESIST';
      } else if (bossCreep.bossKind === 'dragon_boss') {
        statusText = '🐉 DRAGONHIDE ARMOR (17)';
      } else if (bossCreep.bossKind === 'shadow_fiend_boss') {
        statusText = bossCreep.enraged ? '🔥 SOUL ENRAGE ACTIVE!' : 'SHADOW OVERLORD';
      } else if (bossCreep.bossKind === 'doom_boss') {
        statusText = bossCreep.enraged ? '👹 SCORCHED EARTH!' : 'ARMORED DEMON LORD';
      } else if (bossCreep.bossKind === 'frost_wyrm_boss') {
        statusText = '❄️ 18 ARMOR • 55% MAGIC RESIST';
      } else if (bossCreep.bossKind === 'obsidian_boss') {
        statusText = '💎 65% MAGIC RESIST COLOSSUS';
      }

      bossSnap = {
        active: true,
        name: bossCreep.def.bossTitle ?? bossCreep.def.name,
        hp: Math.max(0, Math.ceil(bossCreep.hp)),
        maxHp: bossCreep.maxHp,
        statusText,
        enraged: bossCreep.enraged,
        isFinalBoss: bossCreep.bossKind === 'roshan',
      };
    }

    return {
      phase: this.phase,
      difficulty: this.difficulty,
      season: this.getActiveSeason(),
      timeOfDay: this.getActiveTimeOfDay(),
      gold: Math.floor(this.gold),
      lives: this.lives,
      maxLives: this.maxLives,
      waveIndex: this.waveIndex,
      totalWaves: WAVES.length,
      waveActive: this.waveActive,
      autoWave: this.autoWave,
      paused: this.paused,
      speed: this.speed,
      totalKills: this.totalKills,
      selectedHeroToBuy: this.selectedHeroToBuy,
      selectedTowerId: this.selectedTowerId,
      glyphCooldown: Math.ceil(this.glyphCooldown),
      glyphActiveTimer: this.glyphActiveTimer,
      sunstrikeCooldown: Math.ceil(this.sunstrikeCooldown),
      sunstrikeTargeting: this.sunstrikeTargeting,
      activeSynergies: this.getActiveSynergies(),
      activeRuneBuffs: this.activeRuneBuffs.map((b) => ({ ...b })),
      pendingRelicChoices: this.pendingRelicChoices ? [...this.pendingRelicChoices] : null,
      ownedRelics: [...this.ownedRelics],
      killstreakBanner: this.killstreakBanner,
      boss: bossSnap,
    };
  }

  public selectHeroToBuy(heroId: HeroId | null): void {
    if (this.phase !== 'playing') return;
    this.sunstrikeTargeting = false;
    if (heroId && this.selectedHeroToBuy === heroId) {
      this.selectedHeroToBuy = null;
    } else {
      this.selectedHeroToBuy = heroId;
      if (heroId) this.selectedTowerId = null;
    }
    this.onStateChange();
  }

  public selectTower(towerId: number | null): void {
    this.sunstrikeTargeting = false;
    this.selectedTowerId = towerId;
    if (towerId !== null) {
      this.selectedHeroToBuy = null;
    }
    this.onStateChange();
  }

  public setTowerTargetPriority(towerId: number, priority: TargetPriority): void {
    const tower = this.towers.find((t) => t.id === towerId);
    if (!tower) return;
    tower.targetPriority = priority;
    this.onStateChange();
  }

  public activateGlyph(): void {
    if (this.phase !== 'playing' || this.glyphCooldown > 0) return;
    const hasArcaneRing = this.ownedRelics.includes('arcane_ring');
    this.glyphCooldown = hasArcaneRing ? Math.round(GLYPH_COOLDOWN * 0.8) : GLYPH_COOLDOWN;
    this.glyphActiveTimer = GLYPH_DURATION;
    sound.playUpgrade(true);
    const end = PATH_WAYPOINTS[PATH_WAYPOINTS.length - 1];
    this.addEffect({
      kind: 'ring',
      x: end.x,
      y: end.y,
      radius: 20,
      maxRadius: 150,
      color: '#34d399',
      duration: 0.7,
    });
    this.spawnFloatingText(780, 140, 'GLYPH OF FORTIFICATION! (+35% ATK SPD)', '#34d399', true);
    this.onStateChange();
  }

  public toggleSunstrikeTargeting(): void {
    if (this.phase !== 'playing' || this.sunstrikeCooldown > 0) return;
    this.sunstrikeTargeting = !this.sunstrikeTargeting;
    if (this.sunstrikeTargeting) {
      this.selectedHeroToBuy = null;
      this.selectedTowerId = null;
    }
    this.onStateChange();
  }

  private castSunstrikeAt(x: number, y: number): void {
    this.sunstrikeTargeting = false;
    const hasArcaneRing = this.ownedRelics.includes('arcane_ring');
    this.sunstrikeCooldown = hasArcaneRing ? Math.round(SUNSTRIKE_COOLDOWN * 0.8) : SUNSTRIKE_COOLDOWN;
    const radius = 120;
    const pureDamage = 480 + this.waveIndex * 90;

    sound.playLaguna();
    this.burstEvents.push({
      kind: 'fire',
      x,
      y,
      color: '#f97316',
      count: 24,
    });
    this.addEffect({
      kind: 'sunstrike_pillar',
      x,
      y,
      radius: 24,
      maxRadius: radius,
      color: '#f97316',
      duration: 0.65,
    });
    this.addEffect({
      kind: 'explosion',
      x,
      y,
      radius: 18,
      maxRadius: radius,
      color: '#fef08a',
      duration: 0.55,
    });
    this.spawnFloatingText(x, y - 34, `SUNSTRIKE! (${pureDamage} PURE)`, '#facc15', true);

    for (const c of this.creeps) {
      if (c.dead || c.reachedEnd) continue;
      if (Math.hypot(c.x - x, c.y - y) <= radius) {
        this.applyDamage(c, pureDamage, 'pure', null, false);
      }
    }
    this.onStateChange();
  }

  public handleCanvasClick(x: number, y: number): void {
    if (this.phase !== 'playing') return;

    if (this.sunstrikeTargeting) {
      this.castSunstrikeAt(x, y);
      return;
    }

    // Check if clicked on an active River Power Rune
    for (let i = 0; i < this.activeRunes.length; i++) {
      const rune = this.activeRunes[i];
      if (Math.hypot(x - rune.x, y - rune.y) <= 46) {
        this.claimRiverRune(i);
        return;
      }
    }

    // Check if clicked on an existing tower
    for (const tower of this.towers) {
      const dist = Math.hypot(x - tower.x, y - tower.y);
      if (dist <= PAD_RADIUS + 5) {
        this.selectTower(tower.id);
        return;
      }
    }

    // Check if clicked on an empty build pad while buying a hero
    if (this.selectedHeroToBuy) {
      const pad = this.findPadAt(x, y);
      if (pad && pad.occupiedByTowerId === null) {
        this.placeHero(pad, this.selectedHeroToBuy);
        return;
      }
    }

    this.selectedTowerId = null;
    this.onStateChange();
  }

  public handleCanvasHover(x: number, y: number): void {
    const pad = this.findPadAt(x, y);
    this.hoveredPadId = pad ? pad.id : null;
  }

  private findPadAt(x: number, y: number): BuildPad | null {
    for (const pad of this.pads) {
      if (Math.hypot(x - pad.x, y - pad.y) <= PAD_RADIUS + 5) {
        return pad;
      }
    }
    return null;
  }

  private placeHero(pad: BuildPad, heroId: HeroId): void {
    const def = HERO_MAP[heroId];
    if (this.gold < def.cost) {
      this.spawnFloatingText(pad.x, pad.y - 16, 'Not enough gold!', '#f87171');
      return;
    }

    this.gold -= def.cost;
    const tower: TowerInstance = {
      id: this.nextId++,
      padId: pad.id,
      heroId,
      x: pad.x,
      y: pad.y,
      level: 1,
      totalInvested: def.cost,
      kills: 0,
      totalDamage: 0,
      items: [],
      talent: null,
      targetPriority: 'first',
      attackCooldown: 0,
      mana: 0,
      facingAngle: 0,
      attackAnimTimer: 0,
      buffTimer: 0,
      slowedByRoshanTimer: 0,
      auraBoosted: false,
      precisionBoosted: false,
    };

    pad.occupiedByTowerId = tower.id;
    this.towers.push(tower);
    this.selectedTowerId = tower.id;
    this.selectedHeroToBuy = null;
    this.addEffect({
      kind: 'ring',
      x: tower.x,
      y: tower.y,
      radius: 10,
      maxRadius: 42,
      color: def.primaryColor,
      duration: 0.35,
    });
    sound.playPlace();
    this.onStateChange();
  }

  public buyItemForSelectedTower(itemId: ItemId): void {
    if (this.phase !== 'playing' || this.selectedTowerId === null) return;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return;
    if (tower.items.length >= 3 || tower.items.includes(itemId)) return;

    const item = ITEM_MAP[itemId];
    if (this.gold < item.cost) {
      this.spawnFloatingText(tower.x, tower.y - 24, 'Not enough gold!', '#f87171');
      return;
    }

    this.gold -= item.cost;
    tower.totalInvested += item.cost;
    tower.items.push(itemId);
    sound.playUpgrade(false);
    this.addEffect({
      kind: 'ring',
      x: tower.x,
      y: tower.y,
      radius: 12,
      maxRadius: 52,
      color: item.color,
      duration: 0.45,
    });
    this.spawnFloatingText(tower.x, tower.y - 26, `+ ${item.name.toUpperCase()}!`, item.color);
    this.onStateChange();
  }

  public chooseTowerTalent(towerId: number, choice: TalentChoice): void {
    if (this.phase !== 'playing') return;
    const tower = this.towers.find((t) => t.id === towerId);
    if (!tower || tower.level < 3 || tower.talent !== null) return;
    tower.talent = choice;
    const talentName = HERO_TALENTS[tower.heroId][choice].name;
    sound.playUpgrade(true);
    this.addEffect({
      kind: 'ring',
      x: tower.x,
      y: tower.y,
      radius: 12,
      maxRadius: 56,
      color: '#fde047',
      duration: 0.45,
    });
    this.spawnFloatingText(tower.x, tower.y - 28, `TALENT: ${talentName.toUpperCase()}!`, '#fde047');
    this.onStateChange();
  }

  public chooseRelic(relicId: RelicId): void {
    if (!this.pendingRelicChoices || !this.pendingRelicChoices.includes(relicId)) return;
    this.ownedRelics.push(relicId);
    this.pendingRelicChoices = null;
    const relic = RELIC_MAP[relicId];

    if (relicId === 'aegis_fragment') {
      this.maxLives += 3;
      this.lives += 3;
    }

    sound.playRelicSelect();
    this.spawnFloatingText(780, 180, `RELIC ACQUIRED: ${relic.name.toUpperCase()}!`, relic.color, true);
    this.onStateChange();
  }

  private spawnRiverRune(): void {
    const spot = RIVER_RUNE_SPOTS[Math.floor(Math.random() * RIVER_RUNE_SPOTS.length)];
    const kinds: RuneKind[] = ['double_damage', 'arcane', 'bounty', 'haste'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    // Replace if spot already occupied
    this.activeRunes = this.activeRunes.filter((r) => Math.hypot(r.x - spot.x, r.y - spot.y) > 25);
    this.activeRunes.push({
      id: this.nextId++,
      kind,
      x: spot.x,
      y: spot.y,
      ttl: 28,
      maxTtl: 28,
    });
    const def = RUNE_DEFS[kind];
    this.spawnFloatingText(spot.x, spot.y - 24, `${def.icon} ${def.name.toUpperCase()} SPAWNED!`, def.color, true);
    this.onStateChange();
  }

  private claimRiverRune(index: number): void {
    const rune = this.activeRunes[index];
    if (!rune) return;
    this.activeRunes.splice(index, 1);
    const def = RUNE_DEFS[rune.kind];
    sound.playRunePickup();
    this.burstEvents.push({
      kind: 'lightning',
      x: rune.x,
      y: rune.y,
      color: def.color,
      count: 16,
    });
    this.addEffect({
      kind: 'ring',
      x: rune.x,
      y: rune.y,
      radius: 14,
      maxRadius: 72,
      color: def.color,
      duration: 0.45,
    });

    if (rune.kind === 'bounty') {
      const bonus = 150 + this.waveIndex * 25;
      this.gold += bonus;
      this.burstEvents.push({
        kind: 'gold_coins',
        x: rune.x,
        y: rune.y,
        color: '#facc15',
        count: 12,
      });
      this.spawnFloatingText(rune.x, rune.y - 22, `BOUNTY RUNE! +${bonus}g`, '#facc15', true);
    } else {
      const existing = this.activeRuneBuffs.find((b) => b.kind === rune.kind);
      if (existing) {
        existing.remaining = 15;
      } else {
        this.activeRuneBuffs.push({ kind: rune.kind, remaining: 15, duration: 15 });
      }
      if (rune.kind === 'arcane') {
        this.glyphCooldown = Math.max(0, this.glyphCooldown - 15);
        this.sunstrikeCooldown = Math.max(0, this.sunstrikeCooldown - 15);
      }
      this.spawnFloatingText(rune.x, rune.y - 22, `${def.name.toUpperCase()}!`, def.color, true);
    }
    this.onStateChange();
  }

  public upgradeSelectedTower(): void {
    if (this.phase !== 'playing' || this.selectedTowerId === null) return;
    const tower = this.towers.find((t) => t.id === this.selectedTowerId);
    if (!tower) return;
    const def = HERO_MAP[tower.heroId];
    if (tower.level >= def.levels.length) return;

    const nextStats = def.levels[tower.level];
    if (this.gold < nextStats.upgradeCost) {
      this.spawnFloatingText(tower.x, tower.y - 24, 'Need more gold!', '#f87171');
      return;
    }

    this.gold -= nextStats.upgradeCost;
    tower.totalInvested += nextStats.upgradeCost;
    tower.level += 1;

    const isAghs = tower.level === 4;
    this.addEffect({
      kind: 'ring',
      x: tower.x,
      y: tower.y,
      radius: 12,
      maxRadius: isAghs ? 72 : 48,
      color: isAghs ? '#38bdf8' : '#fbbf24',
      duration: isAghs ? 0.65 : 0.4,
    });
    this.spawnFloatingText(
      tower.x,
      tower.y - 28,
      isAghs ? "AGHANIM'S UPGRADE!" : `LEVEL ${tower.level}!`,
      isAghs ? '#38bdf8' : '#fbbf24',
      isAghs
    );
    sound.playUpgrade(isAghs);
    this.onStateChange();
  }

  public sellSelectedTower(): void {
    if (this.phase !== 'playing' || this.selectedTowerId === null) return;
    const idx = this.towers.findIndex((t) => t.id === this.selectedTowerId);
    if (idx === -1) return;

    const tower = this.towers[idx];
    const refund = Math.floor(tower.totalInvested * SELL_REFUND_RATE);
    this.gold += refund;

    const pad = this.pads.find((p) => p.id === tower.padId);
    if (pad) pad.occupiedByTowerId = null;

    this.towers.splice(idx, 1);
    this.selectedTowerId = null;
    this.spawnFloatingText(tower.x, tower.y - 16, `+${refund}g`, '#fbbf24');
    sound.playSell();
    this.onStateChange();
  }

  public startNextWave(): void {
    if (this.phase !== 'playing') return;
    if (this.waveActive || this.pendingRelicChoices) return;
    if (this.waveIndex >= WAVES.length) return;

    const waveDef = WAVES[this.waveIndex];
    this.waveIndex += 1;
    this.waveActive = true;
    this.autoWaveTimer = 0;

    // Auto-clear Day/Night override every 4 waves
    if (this.waveIndex > 1 && (this.waveIndex - 1) % 4 === 0) {
      this.timeOfDayOverride = null;
    }

    // Spawn River Power Rune on Wave 1 and every 3 waves
    if (this.waveIndex === 1 || this.waveIndex % 3 === 1) {
      this.runeSpawnTimer = 2.5;
    }

    // Auto-clear manual season preview when crossing into a new 10-wave season
    if (this.waveIndex === 11 || this.waveIndex === 21 || this.waveIndex === 31) {
      this.seasonOverride = null;
      const seasonLabels: Record<Season, string> = {
        spring: '🌸 SPRING',
        summer: '☀️ SUMMER BEGINS!',
        autumn: '🍂 AUTUMN BEGINS!',
        winter: '❄️ WINTER HAS ARRIVED!',
      };
      this.spawnFloatingText(780, 180, seasonLabels[this.getActiveSeason()], '#fde047', true);
    }

    this.spawnQueues = waveDef.groups.map((g) => ({
      creep: g.creep,
      remaining: g.count,
      interval: g.interval,
      timer: g.delayBefore,
    }));

    if (waveDef.isBossWave) {
      sound.playRoshanRoar();
      const label =
        waveDef.waveNumber === 40
          ? 'ROSHAN HAS AWAKENED!'
          : `BOSS WAVE ${waveDef.waveNumber}!`;
      this.spawnFloatingText(
        PATH_WAYPOINTS[0].x + 170,
        PATH_WAYPOINTS[0].y + 10,
        label,
        '#f97316',
        true
      );
    }

    this.onStateChange();
  }

  public togglePause(): void {
    if (this.phase !== 'playing') return;
    this.paused = !this.paused;
    this.onStateChange();
  }

  public toggleSpeed(): void {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
    this.onStateChange();
  }

  public toggleAutoWave(): void {
    this.autoWave = !this.autoWave;
    this.onStateChange();
  }

  public update(rawDt: number): void {
    if (this.phase !== 'playing' || this.paused || this.pendingRelicChoices) return;

    const dt = Math.min(rawDt, 0.05) * this.speed;
    this.elapsedTime += dt;

    // Cooldowns for global tactical spells
    let cooldownChanged = false;
    if (this.glyphCooldown > 0) {
      this.glyphCooldown = Math.max(0, this.glyphCooldown - dt);
      cooldownChanged = true;
    }
    if (this.glyphActiveTimer > 0) {
      this.glyphActiveTimer = Math.max(0, this.glyphActiveTimer - dt);
      cooldownChanged = true;
    }
    if (this.sunstrikeCooldown > 0) {
      this.sunstrikeCooldown = Math.max(0, this.sunstrikeCooldown - dt);
      cooldownChanged = true;
    }

    // Active River Runes & Buff timers
    if (this.runeSpawnTimer > 0) {
      this.runeSpawnTimer -= dt;
      if (this.runeSpawnTimer <= 0) {
        this.runeSpawnTimer = -1;
        this.spawnRiverRune();
      }
    }
    for (const r of this.activeRunes) {
      r.ttl -= dt;
    }
    const prevRunesLen = this.activeRunes.length;
    this.activeRunes = this.activeRunes.filter((r) => r.ttl > 0);
    if (this.activeRunes.length !== prevRunesLen) cooldownChanged = true;

    for (const b of this.activeRuneBuffs) {
      b.remaining -= dt;
      cooldownChanged = true;
    }
    this.activeRuneBuffs = this.activeRuneBuffs.filter((b) => b.remaining > 0);

    // Killstreak timer decay
    if (this.streakTimer > 0) {
      this.streakTimer -= dt;
      if (this.streakTimer <= 0) {
        this.streakCount = 0;
        if (this.killstreakBanner) {
          this.killstreakBanner = null;
          cooldownChanged = true;
        }
      }
    }

    // Boss War Drums cadence
    if (this.creeps.some((c) => c.isBoss && !c.dead && !c.reachedEnd)) {
      this.bossDrumTimer -= rawDt;
      if (this.bossDrumTimer <= 0) {
        this.bossDrumTimer = 1.35;
        sound.playBossDrum();
      }
    } else {
      this.bossDrumTimer = 0;
    }

    // Auto-wave countdown
    if (this.autoWave && !this.waveActive && this.waveIndex > 0 && this.waveIndex < WAVES.length) {
      this.autoWaveTimer += dt;
      if (this.autoWaveTimer >= 2.2) {
        this.startNextWave();
      }
    }

    this.updateSpawning(dt);
    this.updateCreeps(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateEffects(dt);
    this.checkWaveCompletion();

    this.hudThrottleTimer += rawDt;
    if (cooldownChanged && this.hudThrottleTimer >= 0.25) {
      this.hudThrottleTimer = 0;
      this.onStateChange();
    }
  }

  private updateSpawning(dt: number): void {
    if (!this.waveActive) return;

    for (const q of this.spawnQueues) {
      if (q.remaining <= 0) continue;
      q.timer -= dt;
      if (q.timer <= 0) {
        this.spawnCreep(q.creep);
        q.remaining -= 1;
        q.timer = q.interval;
      }
    }
  }

  private spawnCreep(def: CreepDefinition): void {
    const start = PATH_WAYPOINTS[0];
    const hpMult = this.difficulty === 'immortal' ? 1.55 : 1.0;
    const speedMult = this.difficulty === 'immortal' ? 1.15 : 1.0;
    const scaledHp = Math.round(def.maxHp * hpMult);
    const scaledDef: CreepDefinition =
      speedMult === 1.0 ? def : { ...def, speed: Math.round(def.speed * speedMult) };

    const creep: CreepInstance = {
      id: this.nextId++,
      def: scaledDef,
      x: start.x,
      y: start.y,
      hp: scaledHp,
      maxHp: scaledHp,
      waypointIndex: 1,
      distanceTraveled: 0,
      dead: false,
      reachedEnd: false,
      stunTimer: 0,
      slowTimer: 0,
      slowFactor: 0,
      poisonTimer: 0,
      poisonDps: 0,
      poisonSourceTowerId: null,
      armorDebuffTimer: 0,
      armorDebuffAmount: 0,
      hitFlashTimer: 0,
      isBoss: Boolean(def.isBoss),
      bossKind: def.bossKind,
      spellBlockCooldown: 0,
      slamCooldown: ROSHAN_SLAM_COOLDOWN * 0.7,
      enraged: false,
      aegisReviveFlash: 0,
    };
    this.creeps.push(creep);
    if (creep.isBoss) {
      this.onStateChange();
    }
  }

  private updateCreeps(dt: number): void {
    let bossChanged = false;
    const hasPlagueSynergy = this.getActiveSynergies().includes('plague_frost');
    const hasSkadiRelic = this.ownedRelics.includes('skadi_aura');

    for (const creep of this.creeps) {
      if (creep.dead || creep.reachedEnd) continue;

      if (creep.hitFlashTimer > 0) creep.hitFlashTimer -= dt;
      if (creep.aegisReviveFlash > 0) creep.aegisReviveFlash -= dt;

      // Armor debuff decay (Desolator)
      if (creep.armorDebuffTimer > 0) {
        creep.armorDebuffTimer -= dt;
        if (creep.armorDebuffTimer <= 0) creep.armorDebuffAmount = 0;
      }

      // Poison DoT (+35% if slowed with Plague & Frost synergy)
      if (creep.poisonTimer > 0) {
        creep.poisonTimer -= dt;
        const poisonMult = hasPlagueSynergy && (creep.slowTimer > 0 || hasSkadiRelic) ? 1.35 : 1.0;
        const dmg = creep.poisonDps * poisonMult * dt;
        this.applyDamage(creep, dmg, 'magical', creep.poisonSourceTowerId, false);
        if (creep.dead) continue;
      }

      // Slow decay
      if (creep.slowTimer > 0) {
        creep.slowTimer -= dt;
        if (creep.slowTimer <= 0) creep.slowFactor = 0;
      }

      // Boss mechanics
      if (creep.isBoss) {
        bossChanged = true;
        if (creep.bossKind === 'roshan') {
          if (creep.spellBlockCooldown > 0) {
            creep.spellBlockCooldown = Math.max(0, creep.spellBlockCooldown - dt);
          }
          creep.slamCooldown -= dt;
          if (creep.slamCooldown <= 0 && creep.stunTimer <= 0) {
            creep.slamCooldown = creep.enraged ? ROSHAN_SLAM_COOLDOWN * 0.75 : ROSHAN_SLAM_COOLDOWN;
            this.triggerRoshanSlam(creep);
          }
        }
      }

      // Stun check
      if (creep.stunTimer > 0) {
        creep.stunTimer -= dt;
        continue;
      }

      // Movement along waypoints
      let moveSpeed = creep.def.speed;
      if (creep.enraged) {
        moveSpeed *= creep.bossKind === 'centaur_boss' ? 1.45 : 1.32;
      }
      const baseSlow = Math.max(creep.slowFactor, hasSkadiRelic ? 0.14 : 0);
      if (baseSlow > 0) {
        const effectiveSlow = creep.isBoss ? baseSlow * 0.55 : baseSlow;
        moveSpeed *= Math.max(0.28, 1 - effectiveSlow);
      }

      let remainingMove = moveSpeed * dt;
      while (remainingMove > 0 && creep.waypointIndex < PATH_WAYPOINTS.length) {
        const target = PATH_WAYPOINTS[creep.waypointIndex];
        const dx = target.x - creep.x;
        const dy = target.y - creep.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= remainingMove) {
          creep.x = target.x;
          creep.y = target.y;
          creep.distanceTraveled += dist;
          remainingMove -= dist;
          creep.waypointIndex += 1;
        } else {
          creep.x += (dx / dist) * remainingMove;
          creep.y += (dy / dist) * remainingMove;
          creep.distanceTraveled += remainingMove;
          remainingMove = 0;
        }
      }

      // Reached Radiant Ancient
      if (creep.waypointIndex >= PATH_WAYPOINTS.length) {
        creep.reachedEnd = true;
        if (this.glyphActiveTimer > 0) {
          this.spawnFloatingText(creep.x - 10, creep.y - 24, 'BLOCKED BY GLYPH!', '#34d399', true);
        } else {
          this.lives = Math.max(0, this.lives - creep.def.livesCost);
          sound.playAncientHit();
          this.spawnFloatingText(
            creep.x - 10,
            creep.y - 24,
            `-${creep.def.livesCost} ANCIENT HP`,
            '#ef4444',
            true
          );
        }
        this.addEffect({
          kind: 'explosion',
          x: creep.x,
          y: creep.y,
          radius: 15,
          maxRadius: 55,
          color: this.glyphActiveTimer > 0 ? '#34d399' : '#ef4444',
          duration: 0.45,
        });
        if (this.lives <= 0) {
          this.phase = 'defeat';
          sound.playDefeat();
        }
        this.onStateChange();
      }
    }

    this.creeps = this.creeps.filter((c) => !c.dead && !c.reachedEnd);

    if (bossChanged) {
      this.onStateChange();
    }
  }

  private triggerRoshanSlam(roshan: CreepInstance): void {
    sound.playEchoSlam();
    this.addEffect({
      kind: 'ring',
      x: roshan.x,
      y: roshan.y,
      radius: 16,
      maxRadius: ROSHAN_SLAM_RADIUS,
      color: '#f97316',
      duration: 0.5,
    });
    let affected = 0;
    for (const tower of this.towers) {
      if (Math.hypot(tower.x - roshan.x, tower.y - roshan.y) <= ROSHAN_SLAM_RADIUS) {
        tower.slowedByRoshanTimer = 2.6;
        affected++;
      }
    }
    if (affected > 0) {
      this.spawnFloatingText(roshan.x, roshan.y - 36, 'ROSHAN SLAM!', '#fb923c', true);
    }
  }

  private updateTowers(dt: number): void {
    const cmTowers = this.towers.filter((t) => t.heroId === 'crystal_maiden');
    const drowTowers = this.towers.filter((t) => t.heroId === 'drow_ranger');
    const synergies = this.getActiveSynergies();
    const hasElemental = synergies.includes('elemental');
    const hasMarksman = synergies.includes('marksman');
    const hasArcaneRune = this.hasRuneBuff('arcane');
    const hasHasteRune = this.hasRuneBuff('haste');
    const hasArcaneRing = this.ownedRelics.includes('arcane_ring');

    for (const tower of this.towers) {
      const def = HERO_MAP[tower.heroId];
      const stats = def.levels[tower.level - 1];

      if (tower.attackAnimTimer > 0) tower.attackAnimTimer -= dt;
      if (tower.buffTimer > 0) tower.buffTimer -= dt;
      if (tower.slowedByRoshanTimer > 0) tower.slowedByRoshanTimer -= dt;

      // Crystal Maiden Arcane Aura + Octarine Core + Elemental Synergy + Arcane Ring + Arcane Rune
      let manaMultiplier = tower.items.includes('octarine_core') ? 1.55 : 1.0;
      if (hasElemental) manaMultiplier *= 1.2;
      if (hasArcaneRing) manaMultiplier *= 1.25;
      if (hasArcaneRune) manaMultiplier *= 2.0;

      tower.auraBoosted = false;
      for (const cm of cmTowers) {
        if (cm.id === tower.id) continue;
        if (Math.hypot(cm.x - tower.x, cm.y - tower.y) <= AURA_RADIUS) {
          let boost = cm.level === 4 ? 1.9 : 1.5;
          if (cm.talent === 'right') boost += 0.4;
          manaMultiplier *= boost;
          tower.auraBoosted = true;
          break;
        }
      }

      // Drow Ranger Precision Aura (+damage to nearby allies)
      let precisionMult = 1.0;
      tower.precisionBoosted = false;
      for (const drow of drowTowers) {
        if (drow.id === tower.id) continue;
        if (Math.hypot(drow.x - tower.x, drow.y - tower.y) <= AURA_RADIUS) {
          const drowStats = HERO_MAP.drow_ranger.levels[drow.level - 1];
          precisionMult = Math.max(precisionMult, 1 + drowStats.abilityPower);
          tower.precisionBoosted = true;
        }
      }

      if (this.creeps.length > 0) {
        tower.mana = Math.min(def.maxMana, tower.mana + def.manaPerSecond * manaMultiplier * dt);
      }

      // Attack speed multipliers (Moon Shard + Mjollnir + Glyph + Haste Rune + Lina Fiery Soul + Roshan Slam)
      let rateMult = tower.slowedByRoshanTimer > 0 ? 0.65 : 1.0;
      if (tower.items.includes('moon_shard')) rateMult *= 1.45;
      if (tower.items.includes('mjollnir')) rateMult *= 1.25;
      if (this.glyphActiveTimer > 0) rateMult *= 1.35;
      if (hasHasteRune) rateMult *= 1.6;
      if (tower.heroId === 'lina' && tower.talent === 'left') rateMult *= 1.35;

      tower.attackCooldown -= dt * rateMult;

      // Range bonuses (Sniper Longbarrel talent + Marksman synergy)
      let effectiveRange = stats.range;
      if (tower.heroId === 'sniper' && tower.talent === 'left') effectiveRange += 90;
      if (hasMarksman && (tower.heroId === 'sniper' || tower.heroId === 'drow_ranger')) {
        effectiveRange *= 1.2;
      }

      if (tower.attackCooldown <= 0) {
        const target = this.acquireTarget(tower, effectiveRange);
        if (target) {
          tower.facingAngle = Math.atan2(target.y - tower.y, target.x - tower.x);
          tower.attackAnimTimer = 0.16;
          tower.attackCooldown = 1 / stats.attackRate;
          tower.mana = Math.min(def.maxMana, tower.mana + def.manaPerAttack * manaMultiplier);

          if (tower.mana >= def.maxMana) {
            tower.mana = 0;
            this.castHeroAbility(tower, target, precisionMult);
          } else {
            this.performBasicAttack(tower, target, precisionMult);
          }
        }
      }
    }
  }

  private acquireTarget(tower: TowerInstance, range: number): CreepInstance | null {
    let best: CreepInstance | null = null;
    let bestScore = -Infinity;

    for (const c of this.creeps) {
      if (c.dead || c.reachedEnd) continue;
      const dist = Math.hypot(c.x - tower.x, c.y - tower.y);
      if (dist > range + c.def.radius * 0.5) continue;

      let score = 0;
      if (tower.targetPriority === 'first') {
        score = c.distanceTraveled;
      } else if (tower.targetPriority === 'strongest') {
        score = c.hp;
      } else {
        score = -dist;
      }

      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  private performBasicAttack(
    tower: TowerInstance,
    target: CreepInstance,
    precisionMult: number
  ): void {
    const def = HERO_MAP[tower.heroId];
    const stats = def.levels[tower.level - 1];
    const synergies = this.getActiveSynergies();
    const hasDeso = tower.items.includes('desolator');
    const hasMjollnir = tower.items.includes('mjollnir');
    const hasRapier = tower.items.includes('divine_rapier');
    const hasPaladin = this.ownedRelics.includes('paladin_sword');
    const hasDDRune = this.hasRuneBuff('double_damage');

    const critChance =
      (tower.items.includes('daedalus') ? 0.25 : 0) +
      (synergies.includes('marksman') && (tower.heroId === 'sniper' || tower.heroId === 'drow_ranger')
        ? 0.15
        : 0);
    const isCrit = critChance > 0 && Math.random() < critChance;

    let dmgMult = precisionMult * (isCrit ? 2.2 : 1.0);
    if (hasRapier) dmgMult *= 2.5;
    if (hasPaladin) dmgMult *= 1.2;
    if (hasDDRune) dmgMult *= 2.0;
    if (tower.heroId === 'drow_ranger' && tower.talent === 'left') dmgMult *= 1.3;
    if (def.damageType === 'magical' && synergies.includes('elemental')) dmgMult *= 1.25;

    const baseDmg = stats.damage * dmgMult;
    const procMjollnir =
      (hasMjollnir && Math.random() < 0.25) ||
      (this.ownedRelics.includes('mjollnir_blessing') && Math.random() < 0.15);

    if (tower.heroId === 'sniper') {
      const headshotChance = tower.talent === 'right' ? 0.55 : 0.35;
      const isHeadshot = Math.random() < headshotChance;
      const dmg = isHeadshot ? baseDmg * 1.6 : baseDmg;
      sound.playSniper();
      this.projectiles.push({
        id: this.nextId++,
        sourceTowerId: tower.id,
        heroId: tower.heroId,
        x: tower.x,
        y: tower.y,
        targetCreepId: target.id,
        targetX: target.x,
        targetY: target.y,
        speed: def.projectileSpeed,
        damage: dmg,
        damageType: 'physical',
        color: isCrit ? '#ef4444' : isHeadshot ? '#fbbf24' : '#fde68a',
        radius: isCrit || isHeadshot ? 5.5 : 3.5,
        isHeadshot,
        isCrit,
        applyDesolator: hasDeso,
        applyMjollnir: procMjollnir,
        stunDuration: isHeadshot ? 0.25 : 0,
      });
    } else if (tower.heroId === 'drow_ranger') {
      sound.playSniper();
      this.projectiles.push({
        id: this.nextId++,
        sourceTowerId: tower.id,
        heroId: tower.heroId,
        x: tower.x,
        y: tower.y,
        targetCreepId: target.id,
        targetX: target.x,
        targetY: target.y,
        speed: def.projectileSpeed,
        damage: baseDmg,
        damageType: 'physical',
        color: isCrit ? '#ef4444' : '#818cf8',
        radius: isCrit ? 5.5 : 4.2,
        isCrit,
        applyDesolator: hasDeso,
        applyMjollnir: procMjollnir,
        slowFactor: tower.level === 4 ? 0.42 : 0.3,
        slowDuration: 2.5,
      });
    } else if (tower.heroId === 'crystal_maiden') {
      sound.playFrost();
      const slowExtra = tower.talent === 'left' ? 0.15 : 0;
      this.projectiles.push({
        id: this.nextId++,
        sourceTowerId: tower.id,
        heroId: tower.heroId,
        x: tower.x,
        y: tower.y,
        targetCreepId: target.id,
        targetX: target.x,
        targetY: target.y,
        speed: def.projectileSpeed,
        damage: baseDmg,
        damageType: 'magical',
        color: '#38bdf8',
        radius: 5,
        isCrit,
        applyDesolator: hasDeso,
        applyMjollnir: procMjollnir,
        slowFactor: (tower.level === 4 ? 0.38 : 0.26) + slowExtra,
        slowDuration: 2.2,
      });
    } else if (tower.heroId === 'sven') {
      sound.playCleave();
      const buffMult = tower.buffTimer > 0 ? 1 + stats.abilityPower : 1;
      const dmg = baseDmg * buffMult;
      let cleaveRad = stats.splashRadius;
      if (synergies.includes('frontline')) cleaveRad *= 1.35;
      if (tower.talent === 'left') cleaveRad *= 1.4;
      this.addEffect({
        kind: 'cleave',
        x: tower.x,
        y: tower.y,
        radius: cleaveRad,
        maxRadius: cleaveRad,
        color: tower.buffTimer > 0 ? '#ef4444' : '#60a5fa',
        angle: tower.facingAngle,
        duration: 0.22,
      });
      if (isCrit) {
        this.spawnFloatingText(target.x, target.y - 22, 'CRIT!', '#ef4444');
        this.burstEvents.push({ kind: 'crit', x: target.x, y: target.y, color: '#ef4444', count: 8 });
      }
      if (procMjollnir) {
        this.triggerChainLightning(tower.x, tower.y, target, 180, 3, tower.id);
      }
      for (const c of this.creeps) {
        if (c.dead || c.reachedEnd) continue;
        const dToTarget = Math.hypot(c.x - target.x, c.y - target.y);
        if (c.id === target.id || dToTarget <= cleaveRad) {
          if (hasDeso) this.applyDesolator(c);
          if (synergies.includes('frontline')) this.applyArmorPierce(c, 4);
          const factor = c.id === target.id ? 1.0 : tower.level === 4 ? 0.85 : 0.65;
          this.applyDamage(c, dmg * factor, 'physical', tower.id, false);
          if (tower.talent === 'right' && c.id === target.id) {
            this.applyStun(c, 0.3, false);
          }
        }
      }
    } else if (tower.heroId === 'venomancer') {
      sound.playPoison();
      const poisonDps = stats.abilityPower * (tower.talent === 'left' ? 1.45 : 1.0);
      this.projectiles.push({
        id: this.nextId++,
        sourceTowerId: tower.id,
        heroId: tower.heroId,
        x: tower.x,
        y: tower.y,
        targetCreepId: target.id,
        targetX: target.x,
        targetY: target.y,
        speed: def.projectileSpeed,
        damage: baseDmg,
        damageType: 'magical',
        color: '#4ade80',
        radius: 5,
        isCrit,
        applyDesolator: hasDeso,
        applyMjollnir: procMjollnir,
        slowFactor: 0.24,
        slowDuration: 3.0,
        poisonDps,
        poisonDuration: 4.0,
      });
    } else if (tower.heroId === 'lina') {
      sound.playCleave();
      this.projectiles.push({
        id: this.nextId++,
        sourceTowerId: tower.id,
        heroId: tower.heroId,
        x: tower.x,
        y: tower.y,
        targetCreepId: target.id,
        targetX: target.x,
        targetY: target.y,
        speed: def.projectileSpeed,
        damage: baseDmg,
        damageType: 'magical',
        color: '#f97316',
        radius: 5.5,
        isCrit,
        applyDesolator: hasDeso,
        applyMjollnir: procMjollnir,
        splashRadius: stats.splashRadius,
      });
    } else if (tower.heroId === 'earthshaker') {
      sound.playCleave();
      let slamRad = stats.splashRadius * 0.72;
      if (synergies.includes('frontline')) slamRad *= 1.35;
      this.addEffect({
        kind: 'ring',
        x: target.x,
        y: target.y,
        radius: 10,
        maxRadius: slamRad,
        color: '#f59e0b',
        duration: 0.3,
      });
      this.burstEvents.push({ kind: 'rock', x: target.x, y: target.y, color: '#d97706', count: 9 });
      if (procMjollnir) {
        this.triggerChainLightning(tower.x, tower.y, target, 180, 3, tower.id);
      }
      const stunDur = (tower.level >= 3 ? 0.55 : 0.4) + (tower.talent === 'left' ? 0.45 : 0);
      for (const c of this.creeps) {
        if (c.dead || c.reachedEnd) continue;
        if (Math.hypot(c.x - target.x, c.y - target.y) <= slamRad) {
          if (hasDeso) this.applyDesolator(c);
          if (synergies.includes('frontline')) this.applyArmorPierce(c, 4);
          this.applyDamage(c, baseDmg, 'physical', tower.id, false);
          this.applyStun(c, stunDur, false);
        }
      }
    } else if (tower.heroId === 'zeus') {
      const maxBounces = (tower.level === 4 ? 6 : 4) + (tower.talent === 'left' ? 2 : 0);
      this.triggerChainLightning(tower.x, tower.y, target, baseDmg, maxBounces, tower.id, stats.splashRadius, hasDeso);
    }
  }

  private triggerChainLightning(
    startX: number,
    startY: number,
    firstTarget: CreepInstance,
    damage: number,
    maxBounces: number,
    towerId: number,
    jumpRadius = 150,
    applyDeso = false
  ): void {
    sound.playLaguna();
    const hitIds = new Set<number>();
    let cur: CreepInstance | null = firstTarget;
    let prevX = startX;
    let prevY = startY;

    for (let b = 0; b < maxBounces && cur; b++) {
      hitIds.add(cur.id);
      this.addEffect({
        kind: 'beam',
        x: prevX,
        y: prevY,
        targetX: cur.x,
        targetY: cur.y,
        radius: 3.5,
        maxRadius: 5,
        color: '#38bdf8',
        duration: 0.22,
      });
      this.burstEvents.push({ kind: 'lightning', x: cur.x, y: cur.y, color: '#38bdf8', count: 5 });
      if (applyDeso) this.applyDesolator(cur);
      this.applyDamage(cur, damage * Math.pow(0.88, b), 'magical', towerId, false);

      prevX = cur.x;
      prevY = cur.y;

      let nextTarget: CreepInstance | null = null;
      let minDist = jumpRadius;
      for (const cand of this.creeps) {
        if (cand.dead || cand.reachedEnd || hitIds.has(cand.id)) continue;
        const d = Math.hypot(cand.x - prevX, cand.y - prevY);
        if (d < minDist) {
          minDist = d;
          nextTarget = cand;
        }
      }
      cur = nextTarget;
    }
  }

  private applyArmorPierce(creep: CreepInstance, amount: number): void {
    creep.armorDebuffAmount = Math.max(creep.armorDebuffAmount, amount);
    creep.armorDebuffTimer = Math.max(creep.armorDebuffTimer, 3.0);
  }

  private castHeroAbility(
    tower: TowerInstance,
    fallbackTarget: CreepInstance,
    precisionMult: number
  ): void {
    const def = HERO_MAP[tower.heroId];
    const stats = def.levels[tower.level - 1];
    const isAghs = tower.level === 4;
    const hasDeso = tower.items.includes('desolator');
    const synergies = this.getActiveSynergies();
    let globalMult = 1.0;
    if (this.ownedRelics.includes('paladin_sword')) globalMult *= 1.2;
    if (this.hasRuneBuff('double_damage')) globalMult *= 2.0;
    const spellMult = globalMult * (synergies.includes('elemental') ? 1.25 : 1.0);

    if (tower.heroId === 'sniper') {
      let best = fallbackTarget;
      const range = stats.range + (tower.talent === 'left' ? 90 : 0);
      for (const c of this.creeps) {
        if (c.dead || c.reachedEnd) continue;
        if (Math.hypot(c.x - tower.x, c.y - tower.y) <= range * 1.35) {
          if (c.hp > best.hp) best = c;
        }
      }
      sound.playAssassinate();
      this.projectiles.push({
        id: this.nextId++,
        sourceTowerId: tower.id,
        heroId: 'sniper',
        x: tower.x,
        y: tower.y,
        targetCreepId: best.id,
        targetX: best.x,
        targetY: best.y,
        speed: 980,
        damage: stats.abilityPower * globalMult,
        damageType: isAghs ? 'pure' : 'magical',
        color: isAghs ? '#38bdf8' : '#facc15',
        radius: 7.5,
        isUltimate: true,
        applyDesolator: hasDeso,
        stunDuration: isAghs ? 1.2 : 0.5,
      });
      this.spawnFloatingText(tower.x, tower.y - 24, 'ASSASSINATE!', '#facc15');
    } else if (tower.heroId === 'drow_ranger') {
      sound.playFrost();
      const arrowCount = (isAghs ? 6 : 4) + (tower.talent === 'right' ? 2 : 0);
      const targets = this.creeps
        .filter(
          (c) => !c.dead && !c.reachedEnd && Math.hypot(c.x - tower.x, c.y - tower.y) <= stats.range * 1.25
        )
        .slice(0, arrowCount);
      const drowDmg =
        stats.damage * precisionMult * globalMult * (tower.talent === 'left' ? 1.3 : 1.0) * (isAghs ? 1.85 : 1.45);
      for (const t of targets) {
        this.projectiles.push({
          id: this.nextId++,
          sourceTowerId: tower.id,
          heroId: 'drow_ranger',
          x: tower.x,
          y: tower.y,
          targetCreepId: t.id,
          targetX: t.x,
          targetY: t.y,
          speed: 740,
          damage: drowDmg,
          damageType: isAghs ? 'pure' : 'physical',
          color: '#38bdf8',
          radius: 5.5,
          applyDesolator: hasDeso,
          slowFactor: 0.45,
          slowDuration: 3.2,
        });
      }
      this.spawnFloatingText(tower.x, tower.y - 24, 'MULTISHOT!', '#818cf8');
    } else if (tower.heroId === 'crystal_maiden') {
      sound.playFrost();
      this.burstEvents.push({
        kind: 'frost',
        x: fallbackTarget.x,
        y: fallbackTarget.y,
        color: '#38bdf8',
        count: 16,
      });
      this.addEffect({
        kind: 'explosion',
        x: fallbackTarget.x,
        y: fallbackTarget.y,
        radius: 16,
        maxRadius: stats.splashRadius,
        color: '#38bdf8',
        duration: 0.45,
      });
      const slow = (isAghs ? 0.55 : 0.42) + (tower.talent === 'left' ? 0.15 : 0);
      for (const c of this.creeps) {
        if (c.dead || c.reachedEnd) continue;
        if (Math.hypot(c.x - fallbackTarget.x, c.y - fallbackTarget.y) <= stats.splashRadius) {
          this.applyDamage(c, stats.abilityPower * spellMult, 'magical', tower.id, false);
          c.slowFactor = Math.max(c.slowFactor, slow);
          c.slowTimer = Math.max(c.slowTimer, isAghs ? 4.2 : 3.2);
        }
      }
      this.spawnFloatingText(
        tower.x,
        tower.y - 24,
        isAghs ? 'FREEZING FIELD!' : 'CRYSTAL NOVA!',
        '#38bdf8'
      );
    } else if (tower.heroId === 'sven') {
      tower.buffTimer = isAghs ? 6.5 : 5.0;
      this.addEffect({
        kind: 'ring',
        x: tower.x,
        y: tower.y,
        radius: 12,
        maxRadius: 56,
        color: '#ef4444',
        duration: 0.45,
      });
      this.spawnFloatingText(tower.x, tower.y - 26, "GOD'S STRENGTH!", '#ef4444');
      this.performBasicAttack(tower, fallbackTarget, precisionMult);
    } else if (tower.heroId === 'venomancer') {
      sound.playPoison();
      const galeRad = stats.splashRadius * (tower.talent === 'right' ? 1.4 : 1.0);
      const poisonDps = stats.abilityPower * (tower.talent === 'left' ? 1.45 : 1.0);
      this.burstEvents.push({
        kind: 'venom',
        x: fallbackTarget.x,
        y: fallbackTarget.y,
        color: '#4ade80',
        count: 16,
      });
      this.addEffect({
        kind: 'ring',
        x: fallbackTarget.x,
        y: fallbackTarget.y,
        radius: 14,
        maxRadius: galeRad,
        color: '#22c55e',
        duration: 0.5,
      });
      for (const c of this.creeps) {
        if (c.dead || c.reachedEnd) continue;
        if (Math.hypot(c.x - fallbackTarget.x, c.y - fallbackTarget.y) <= galeRad) {
          this.applyDamage(c, stats.damage * 1.5 * spellMult, 'magical', tower.id, false);
          c.poisonDps = Math.max(c.poisonDps, poisonDps * (isAghs ? 1.7 : 1.35));
          c.poisonTimer = Math.max(c.poisonTimer, 5.5);
          c.poisonSourceTowerId = tower.id;
          c.slowFactor = Math.max(c.slowFactor, 0.35);
          c.slowTimer = Math.max(c.slowTimer, 3.5);
        }
      }
      this.spawnFloatingText(
        tower.x,
        tower.y - 24,
        isAghs ? 'POISON NOVA!' : 'VENOMOUS GALE!',
        '#4ade80'
      );
    } else if (tower.heroId === 'lina') {
      const candidates = this.creeps
        .filter(
          (c) => !c.dead && !c.reachedEnd && Math.hypot(c.x - tower.x, c.y - tower.y) <= stats.range * 1.18
        )
        .sort((a, b) => b.hp - a.hp);
      const hitCount = tower.talent === 'right' ? 2 : 1;
      const targets = candidates.length > 0 ? candidates.slice(0, hitCount) : [fallbackTarget];
      sound.playLaguna();
      const dmgType: DamageType = isAghs ? 'pure' : 'magical';
      for (const t of targets) {
        this.addEffect({
          kind: 'beam',
          x: tower.x,
          y: tower.y,
          targetX: t.x,
          targetY: t.y,
          radius: isAghs ? 8 : 5,
          maxRadius: 10,
          color: isAghs ? '#38bdf8' : '#fef08a',
          duration: 0.32,
        });
        this.burstEvents.push({ kind: 'lightning', x: t.x, y: t.y, color: '#fef08a', count: 12 });
        this.applyDamage(t, stats.abilityPower * spellMult, dmgType, tower.id, true);
      }
      this.spawnFloatingText(
        tower.x,
        tower.y - 24,
        tower.talent === 'right' ? 'TWIN LAGUNA!' : 'LAGUNA BLADE!',
        isAghs ? '#38bdf8' : '#f97316'
      );
    } else if (tower.heroId === 'earthshaker') {
      sound.playEchoSlam();
      let echoRad = stats.splashRadius;
      if (synergies.includes('frontline')) echoRad *= 1.35;
      const inRadius = this.creeps.filter(
        (c) => !c.dead && !c.reachedEnd && Math.hypot(c.x - tower.x, c.y - tower.y) <= echoRad
      );
      const echoBonus = inRadius.length * (isAghs ? 80 : 45);
      const totalDmg = (stats.abilityPower + echoBonus) * spellMult * (tower.talent === 'right' ? 1.5 : 1.0);
      const stunDur = (isAghs ? 1.65 : 1.15) + (tower.talent === 'left' ? 0.45 : 0);
      this.burstEvents.push({ kind: 'rock', x: tower.x, y: tower.y, color: '#f59e0b', count: 20 });
      this.addEffect({
        kind: 'explosion',
        x: tower.x,
        y: tower.y,
        radius: 16,
        maxRadius: echoRad,
        color: '#f59e0b',
        duration: 0.55,
      });
      for (const c of inRadius) {
        this.applyDamage(c, totalDmg, 'magical', tower.id, true);
        this.applyStun(c, stunDur, true);
      }
      this.spawnFloatingText(
        tower.x,
        tower.y - 26,
        `ECHO SLAM! (x${inRadius.length})`,
        '#fbbf24',
        true
      );
    } else if (tower.heroId === 'zeus') {
      sound.playLaguna();
      const dmgType: DamageType = isAghs ? 'pure' : 'magical';
      for (const c of this.creeps) {
        if (c.dead || c.reachedEnd) continue;
        this.addEffect({
          kind: 'sky_bolt',
          x: c.x,
          y: c.y,
          radius: 6,
          maxRadius: 28,
          color: isAghs ? '#38bdf8' : '#fef08a',
          duration: 0.42,
        });
        this.burstEvents.push({ kind: 'lightning', x: c.x, y: c.y, color: '#fef08a', count: 6 });
        this.applyDamage(c, stats.abilityPower * spellMult, dmgType, tower.id, false);
        if (tower.talent === 'right') {
          this.applyStun(c, 0.8, false);
        }
      }
      this.spawnFloatingText(tower.x, tower.y - 28, "THUNDERGOD'S WRATH!", '#fef08a', true);
    }
  }

  private applyDesolator(creep: CreepInstance): void {
    creep.armorDebuffAmount = Math.max(creep.armorDebuffAmount, 6);
    creep.armorDebuffTimer = 4.0;
  }

  private updateProjectiles(dt: number): void {
    const remaining: Projectile[] = [];

    for (const p of this.projectiles) {
      const target = this.creeps.find((c) => c.id === p.targetCreepId && !c.dead && !c.reachedEnd);
      if (target) {
        p.targetX = target.x;
        p.targetY = target.y;
      }

      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.speed * dt;

      if (dist <= step + 6) {
        this.resolveProjectileHit(p, target ?? null);
      } else {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
        remaining.push(p);
      }
    }

    this.projectiles = remaining;
  }

  private resolveProjectileHit(p: Projectile, directTarget: CreepInstance | null): void {
    if (p.splashRadius && p.splashRadius > 0) {
      this.burstEvents.push({ kind: 'fire', x: p.targetX, y: p.targetY, color: p.color, count: 10 });
      this.addEffect({
        kind: 'explosion',
        x: p.targetX,
        y: p.targetY,
        radius: 8,
        maxRadius: p.splashRadius,
        color: p.color,
        duration: 0.25,
      });
      if (p.applyMjollnir && directTarget && !directTarget.dead) {
        this.triggerChainLightning(p.targetX, p.targetY, directTarget, 180, 3, p.sourceTowerId);
      }
      for (const c of this.creeps) {
        if (c.dead || c.reachedEnd) continue;
        if (Math.hypot(c.x - p.targetX, c.y - p.targetY) <= p.splashRadius) {
          if (p.applyDesolator) this.applyDesolator(c);
          const mult = directTarget && c.id === directTarget.id ? 1.0 : 0.65;
          this.applyDamage(c, p.damage * mult, p.damageType, p.sourceTowerId, Boolean(p.isUltimate));
        }
      }
      return;
    }

    if (!directTarget || directTarget.dead) return;

    if (p.applyDesolator) this.applyDesolator(directTarget);
    if (p.applyMjollnir) {
      this.triggerChainLightning(p.targetX, p.targetY, directTarget, 180, 3, p.sourceTowerId);
    }

    this.applyDamage(
      directTarget,
      p.damage,
      p.damageType,
      p.sourceTowerId,
      Boolean(p.isUltimate)
    );

    if (p.isCrit) {
      this.spawnFloatingText(directTarget.x, directTarget.y - 22, 'CRIT!', '#ef4444');
      this.burstEvents.push({ kind: 'crit', x: directTarget.x, y: directTarget.y, color: '#ef4444', count: 8 });
    } else if (p.isHeadshot) {
      this.spawnFloatingText(directTarget.x, directTarget.y - 18, 'HEADSHOT!', '#fbbf24');
    }
    if (p.slowFactor && p.slowDuration) {
      directTarget.slowFactor = Math.max(directTarget.slowFactor, p.slowFactor);
      directTarget.slowTimer = Math.max(directTarget.slowTimer, p.slowDuration);
    }
    if (p.poisonDps && p.poisonDuration) {
      directTarget.poisonDps = Math.max(directTarget.poisonDps, p.poisonDps);
      directTarget.poisonTimer = Math.max(directTarget.poisonTimer, p.poisonDuration);
      directTarget.poisonSourceTowerId = p.sourceTowerId;
    }
    if (p.stunDuration && p.stunDuration > 0) {
      this.applyStun(directTarget, p.stunDuration, Boolean(p.isUltimate));
    }
  }

  private applyStun(creep: CreepInstance, duration: number, isHeavySpell: boolean): void {
    if (creep.dead) return;
    if (creep.isBoss) {
      if (creep.bossKind === 'roshan' && isHeavySpell && creep.spellBlockCooldown <= 0) {
        creep.spellBlockCooldown = ROSHAN_SPELL_BLOCK_CD;
        this.addEffect({
          kind: 'spell_block',
          x: creep.x,
          y: creep.y,
          radius: 18,
          maxRadius: 48,
          color: '#38bdf8',
          duration: 0.45,
        });
        this.spawnFloatingText(creep.x, creep.y - 34, 'SPELL BLOCKED!', '#38bdf8');
        return;
      }
      creep.stunTimer = Math.max(creep.stunTimer, duration * 0.4);
      return;
    }
    creep.stunTimer = Math.max(creep.stunTimer, duration);
  }

  private applyDamage(
    creep: CreepInstance,
    rawDamage: number,
    damageType: DamageType,
    sourceTowerId: number | null,
    isHeavySpell: boolean
  ): void {
    if (creep.dead || creep.reachedEnd) return;

    // Roshan Spell Block absorbs heavy spell nukes
    if (creep.bossKind === 'roshan' && isHeavySpell && creep.spellBlockCooldown <= 0) {
      creep.spellBlockCooldown = ROSHAN_SPELL_BLOCK_CD;
      this.addEffect({
        kind: 'spell_block',
        x: creep.x,
        y: creep.y,
        radius: 18,
        maxRadius: 48,
        color: '#38bdf8',
        duration: 0.45,
      });
      this.spawnFloatingText(creep.x, creep.y - 34, 'SPELL BLOCKED!', '#38bdf8');
      return;
    }

    let multiplier = 1.0;
    if (damageType === 'physical') {
      const effectiveArmor = creep.def.armor - creep.armorDebuffAmount;
      multiplier = 1 - (0.06 * effectiveArmor) / (1 + 0.06 * Math.abs(effectiveArmor));
    } else if (damageType === 'magical') {
      multiplier = 1 - creep.def.magicResist;
    }

    const finalDmg = Math.max(1, rawDamage * multiplier);
    creep.hp -= finalDmg;
    creep.hitFlashTimer = 0.09;

    if (sourceTowerId !== null) {
      const tower = this.towers.find((t) => t.id === sourceTowerId);
      if (tower) tower.totalDamage += finalDmg;
    }

    // Mini-Boss Enrage triggers (Centaur Stampede / Shadow Fiend / Doom Bringer)
    if (
      (creep.bossKind === 'centaur_boss' ||
        creep.bossKind === 'shadow_fiend_boss' ||
        creep.bossKind === 'doom_boss') &&
      !creep.enraged &&
      creep.hp > 0 &&
      creep.hp <= creep.maxHp * 0.48
    ) {
      creep.enraged = true;
      sound.playRoshanRoar();
      this.addEffect({
        kind: 'ring',
        x: creep.x,
        y: creep.y,
        radius: 16,
        maxRadius: 95,
        color: '#facc15',
        duration: 0.55,
      });
      const shout =
        creep.bossKind === 'centaur_boss'
          ? 'CENTAUR STAMPEDE!'
          : creep.bossKind === 'shadow_fiend_boss'
          ? 'REQUIEM ENRAGE!'
          : 'SCORCHED EARTH!';
      this.spawnFloatingText(creep.x, creep.y - 38, shout, '#facc15', true);
    }

    // Wave 40 Roshan Aegis Enrage at 40% HP
    if (
      creep.bossKind === 'roshan' &&
      !creep.enraged &&
      creep.hp > 0 &&
      creep.hp <= creep.maxHp * 0.4
    ) {
      creep.enraged = true;
      creep.aegisReviveFlash = 1.0;
      const healAmt = Math.round(creep.maxHp * 0.12);
      creep.hp = Math.min(creep.maxHp, creep.hp + healAmt);
      sound.playRoshanRoar();
      this.addEffect({
        kind: 'aegis_roar',
        x: creep.x,
        y: creep.y,
        radius: 20,
        maxRadius: 140,
        color: '#f97316',
        duration: 0.75,
      });
      this.spawnFloatingText(
        creep.x,
        creep.y - 42,
        `AEGIS ENRAGE! +${healAmt.toLocaleString()} HP`,
        '#f97316',
        true
      );
    }

    if (creep.hp <= 0) {
      creep.dead = true;
      const goldMult = this.ownedRelics.includes('philosopher_stone') ? 1.18 : 1.0;
      const earned = Math.round(creep.def.bounty * goldMult);
      this.gold += earned;
      this.totalKills += 1;

      if (sourceTowerId !== null) {
        const tower = this.towers.find((t) => t.id === sourceTowerId);
        if (tower) tower.kills += 1;
      }

      // 3D Gold coin burst on kill
      this.burstEvents.push({
        kind: 'gold_coins',
        x: creep.x,
        y: creep.y,
        color: '#facc15',
        count: creep.isBoss ? 18 : 5,
      });

      // Killstreak tracking
      this.streakCount += 1;
      this.streakTimer = 2.4;
      if (this.streakCount === 5) {
        this.killstreakBanner = { text: 'KILLING SPREE!', color: '#38bdf8', id: this.nextId++ };
        sound.playKillstreak();
      } else if (this.streakCount === 10) {
        this.killstreakBanner = { text: 'MEGA KILL!', color: '#c084fc', id: this.nextId++ };
        sound.playKillstreak();
      } else if (this.streakCount === 16) {
        this.killstreakBanner = { text: 'ULTRA KILL!', color: '#f97316', id: this.nextId++ };
        sound.playKillstreak();
      } else if (this.streakCount === 24) {
        this.killstreakBanner = { text: 'RAMPAGE!', color: '#ef4444', id: this.nextId++ };
        sound.playKillstreak();
      }

      sound.playGold();
      this.spawnFloatingText(
        creep.x,
        creep.y - 12,
        `+${earned}g`,
        '#facc15',
        creep.isBoss
      );
      if (creep.isBoss) {
        this.addEffect({
          kind: 'explosion',
          x: creep.x,
          y: creep.y,
          radius: 24,
          maxRadius: 135,
          color: '#fbbf24',
          duration: 0.9,
        });
        this.spawnFloatingText(
          creep.x,
          creep.y - 42,
          `${creep.def.name.toUpperCase()} SLAIN!`,
          '#fbbf24',
          true
        );
      }
      this.onStateChange();
    }
  }

  private checkWaveCompletion(): void {
    if (!this.waveActive) return;

    const anyPendingSpawns = this.spawnQueues.some((q) => q.remaining > 0);
    if (!anyPendingSpawns && this.creeps.length === 0) {
      this.waveActive = false;
      this.autoWaveTimer = 0;
      const completedWave = WAVES[this.waveIndex - 1];
      if (completedWave) {
        this.gold += completedWave.bonusGold;
        this.spawnFloatingText(
          780,
          110,
          `WAVE ${completedWave.waveNumber} CLEARED! +${completedWave.bonusGold}g`,
          '#fbbf24',
          true
        );

        // Offer 3 Neutral Loot Relics after slaying a Mini-Boss (Waves 5..35)
        if (completedWave.isBossWave && completedWave.waveNumber < WAVES.length) {
          const available = RELIC_DEFS.map((r) => r.id).filter((id) => !this.ownedRelics.includes(id));
          const pool = available.length >= 3 ? available : RELIC_DEFS.map((r) => r.id);
          const shuffled = [...pool].sort(() => Math.random() - 0.5);
          this.pendingRelicChoices = shuffled.slice(0, 3);
        }
      }

      if (this.waveIndex >= WAVES.length && this.lives > 0) {
        this.phase = 'victory';
        sound.playVictory();
      }
      this.onStateChange();
    }
  }

  private updateEffects(dt: number): void {
    for (const fx of this.effects) {
      fx.age += dt;
    }
    this.effects = this.effects.filter((fx) => fx.age < fx.duration);

    for (const ft of this.floatingTexts) {
      ft.age += dt;
      ft.y -= 26 * dt;
    }
    this.floatingTexts = this.floatingTexts.filter((ft) => ft.age < ft.duration);
  }

  private addEffect(fx: Omit<VisualEffect, 'id' | 'age'>): void {
    this.effects.push({
      ...fx,
      id: this.nextId++,
      age: 0,
    });
  }

  private spawnFloatingText(
    x: number,
    y: number,
    text: string,
    color: string,
    large = false
  ): void {
    this.floatingTexts.push({
      id: this.nextId++,
      x,
      y,
      text,
      color,
      age: 0,
      duration: large ? 1.45 : 0.95,
      large,
    });
  }
}
