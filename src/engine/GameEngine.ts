import { HERO_MAP } from '../data/heroes';
import { ITEM_MAP } from '../data/items';
import { INITIAL_BUILD_PADS, PAD_RADIUS, PATH_WAYPOINTS } from '../data/map';
import { WAVES } from '../data/waves';
import {
  BuildPad,
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
  Season,
  TargetPriority,
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

  public reset(startPlaying = true): void {
    this.phase = startPlaying ? 'playing' : 'title';
    this.gold = STARTING_GOLD;
    this.maxLives = this.difficulty === 'immortal' ? IMMORTAL_LIVES : HARD_LIVES;
    this.lives = this.maxLives;
    this.seasonOverride = null;
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
    this.selectedHeroToBuy = null;
    this.selectedTowerId = null;
    this.hoveredPadId = null;
    this.autoWaveTimer = 0;
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
    this.glyphCooldown = GLYPH_COOLDOWN;
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
    this.sunstrikeCooldown = SUNSTRIKE_COOLDOWN;
    const radius = 120;
    const pureDamage = 480 + this.waveIndex * 90;

    sound.playLaguna();
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
    if (this.waveActive) return;
    if (this.waveIndex >= WAVES.length) return;

    const waveDef = WAVES[this.waveIndex];
    this.waveIndex += 1;
    this.waveActive = true;
    this.autoWaveTimer = 0;

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
    if (this.phase !== 'playing' || this.paused) return;

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

    for (const creep of this.creeps) {
      if (creep.dead || creep.reachedEnd) continue;

      if (creep.hitFlashTimer > 0) creep.hitFlashTimer -= dt;
      if (creep.aegisReviveFlash > 0) creep.aegisReviveFlash -= dt;

      // Armor debuff decay (Desolator)
      if (creep.armorDebuffTimer > 0) {
        creep.armorDebuffTimer -= dt;
        if (creep.armorDebuffTimer <= 0) creep.armorDebuffAmount = 0;
      }

      // Poison DoT
      if (creep.poisonTimer > 0) {
        creep.poisonTimer -= dt;
        const dmg = creep.poisonDps * dt;
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
      if (creep.slowFactor > 0) {
        const effectiveSlow = creep.isBoss ? creep.slowFactor * 0.55 : creep.slowFactor;
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

    for (const tower of this.towers) {
      const def = HERO_MAP[tower.heroId];
      const stats = def.levels[tower.level - 1];

      if (tower.attackAnimTimer > 0) tower.attackAnimTimer -= dt;
      if (tower.buffTimer > 0) tower.buffTimer -= dt;
      if (tower.slowedByRoshanTimer > 0) tower.slowedByRoshanTimer -= dt;

      // Crystal Maiden Arcane Aura + Octarine Core mana multiplier
      let manaMultiplier = tower.items.includes('octarine_core') ? 1.55 : 1.0;
      tower.auraBoosted = false;
      for (const cm of cmTowers) {
        if (cm.id === tower.id) continue;
        if (Math.hypot(cm.x - tower.x, cm.y - tower.y) <= AURA_RADIUS) {
          const boost = cm.level === 4 ? 1.9 : 1.5;
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

      // Attack speed multipliers (Moon Shard + Glyph + Roshan Slam)
      let rateMult = tower.slowedByRoshanTimer > 0 ? 0.65 : 1.0;
      if (tower.items.includes('moon_shard')) rateMult *= 1.45;
      if (this.glyphActiveTimer > 0) rateMult *= 1.35;

      tower.attackCooldown -= dt * rateMult;

      if (tower.attackCooldown <= 0) {
        const target = this.acquireTarget(tower, stats.range);
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
    const hasDeso = tower.items.includes('desolator');
    const isCrit = tower.items.includes('daedalus') && Math.random() < 0.25;
    const baseDmg = stats.damage * precisionMult * (isCrit ? 2.2 : 1.0);

    if (tower.heroId === 'sniper') {
      const isHeadshot = Math.random() < 0.35;
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
        slowFactor: tower.level === 4 ? 0.42 : 0.3,
        slowDuration: 2.5,
      });
    } else if (tower.heroId === 'crystal_maiden') {
      sound.playFrost();
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
        slowFactor: tower.level === 4 ? 0.38 : 0.26,
        slowDuration: 2.2,
      });
    } else if (tower.heroId === 'sven') {
      sound.playCleave();
      const dmgMult = tower.buffTimer > 0 ? 1 + stats.abilityPower : 1;
      const dmg = baseDmg * dmgMult;
      this.addEffect({
        kind: 'cleave',
        x: tower.x,
        y: tower.y,
        radius: stats.splashRadius,
        maxRadius: stats.splashRadius,
        color: tower.buffTimer > 0 ? '#ef4444' : '#60a5fa',
        angle: tower.facingAngle,
        duration: 0.22,
      });
      if (isCrit) {
        this.spawnFloatingText(target.x, target.y - 22, 'CRIT!', '#ef4444');
      }
      for (const c of this.creeps) {
        if (c.dead || c.reachedEnd) continue;
        const dToTarget = Math.hypot(c.x - target.x, c.y - target.y);
        if (c.id === target.id || dToTarget <= stats.splashRadius) {
          if (hasDeso) this.applyDesolator(c);
          const factor = c.id === target.id ? 1.0 : tower.level === 4 ? 0.85 : 0.65;
          this.applyDamage(c, dmg * factor, 'physical', tower.id, false);
        }
      }
    } else if (tower.heroId === 'venomancer') {
      sound.playPoison();
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
        slowFactor: 0.24,
        slowDuration: 3.0,
        poisonDps: stats.abilityPower,
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
        splashRadius: stats.splashRadius,
      });
    } else if (tower.heroId === 'earthshaker') {
      sound.playCleave();
      this.addEffect({
        kind: 'ring',
        x: target.x,
        y: target.y,
        radius: 10,
        maxRadius: stats.splashRadius * 0.72,
        color: '#f59e0b',
        duration: 0.3,
      });
      for (const c of this.creeps) {
        if (c.dead || c.reachedEnd) continue;
        if (Math.hypot(c.x - target.x, c.y - target.y) <= stats.splashRadius * 0.72) {
          if (hasDeso) this.applyDesolator(c);
          this.applyDamage(c, baseDmg, 'physical', tower.id, false);
          this.applyStun(c, tower.level >= 3 ? 0.55 : 0.4, false);
        }
      }
    } else if (tower.heroId === 'zeus') {
      // Arc Lightning: chains across up to 4 creeps (6 with Aghanim's)
      sound.playLaguna();
      const maxBounces = tower.level === 4 ? 6 : 4;
      const hitIds = new Set<number>();
      let cur: CreepInstance | null = target;
      let prevX = tower.x;
      let prevY = tower.y;

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
        if (hasDeso) this.applyDesolator(cur);
        this.applyDamage(cur, baseDmg * Math.pow(0.88, b), 'magical', tower.id, false);

        prevX = cur.x;
        prevY = cur.y;

        // Find next closest unhit creep within splashRadius
        let nextTarget: CreepInstance | null = null;
        let minDist = stats.splashRadius;
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

    if (tower.heroId === 'sniper') {
      let best = fallbackTarget;
      for (const c of this.creeps) {
        if (c.dead || c.reachedEnd) continue;
        if (Math.hypot(c.x - tower.x, c.y - tower.y) <= stats.range * 1.35) {
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
        damage: stats.abilityPower,
        damageType: isAghs ? 'pure' : 'magical',
        color: isAghs ? '#38bdf8' : '#facc15',
        radius: 7.5,
        isUltimate: true,
        applyDesolator: hasDeso,
        stunDuration: isAghs ? 1.2 : 0.5,
      });
      this.spawnFloatingText(tower.x, tower.y - 24, 'ASSASSINATE!', '#facc15');
    } else if (tower.heroId === 'drow_ranger') {
      // Multishot Frost Volley at up to 4 creeps (6 with Aghs)
      sound.playFrost();
      const targets = this.creeps
        .filter(
          (c) => !c.dead && !c.reachedEnd && Math.hypot(c.x - tower.x, c.y - tower.y) <= stats.range * 1.2
        )
        .slice(0, isAghs ? 6 : 4);
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
          damage: stats.damage * precisionMult * (isAghs ? 1.85 : 1.45),
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
      this.addEffect({
        kind: 'explosion',
        x: fallbackTarget.x,
        y: fallbackTarget.y,
        radius: 16,
        maxRadius: stats.splashRadius,
        color: '#38bdf8',
        duration: 0.45,
      });
      const slow = isAghs ? 0.55 : 0.42;
      for (const c of this.creeps) {
        if (c.dead || c.reachedEnd) continue;
        if (Math.hypot(c.x - fallbackTarget.x, c.y - fallbackTarget.y) <= stats.splashRadius) {
          this.applyDamage(c, stats.abilityPower, 'magical', tower.id, false);
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
      this.addEffect({
        kind: 'ring',
        x: fallbackTarget.x,
        y: fallbackTarget.y,
        radius: 14,
        maxRadius: stats.splashRadius,
        color: '#22c55e',
        duration: 0.5,
      });
      for (const c of this.creeps) {
        if (c.dead || c.reachedEnd) continue;
        if (Math.hypot(c.x - fallbackTarget.x, c.y - fallbackTarget.y) <= stats.splashRadius) {
          this.applyDamage(c, stats.damage * 1.5, 'magical', tower.id, false);
          c.poisonDps = Math.max(c.poisonDps, stats.abilityPower * (isAghs ? 1.7 : 1.35));
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
      let best = fallbackTarget;
      for (const c of this.creeps) {
        if (c.dead || c.reachedEnd) continue;
        if (Math.hypot(c.x - tower.x, c.y - tower.y) <= stats.range * 1.15) {
          if (c.hp > best.hp) best = c;
        }
      }
      sound.playLaguna();
      this.addEffect({
        kind: 'beam',
        x: tower.x,
        y: tower.y,
        targetX: best.x,
        targetY: best.y,
        radius: isAghs ? 8 : 5,
        maxRadius: 10,
        color: isAghs ? '#38bdf8' : '#fef08a',
        duration: 0.32,
      });
      const dmgType: DamageType = isAghs ? 'pure' : 'magical';
      this.applyDamage(best, stats.abilityPower, dmgType, tower.id, true);
      this.spawnFloatingText(tower.x, tower.y - 24, 'LAGUNA BLADE!', isAghs ? '#38bdf8' : '#f97316');
    } else if (tower.heroId === 'earthshaker') {
      sound.playEchoSlam();
      const inRadius = this.creeps.filter(
        (c) => !c.dead && !c.reachedEnd && Math.hypot(c.x - tower.x, c.y - tower.y) <= stats.splashRadius
      );
      const echoBonus = inRadius.length * (isAghs ? 80 : 45);
      const totalDmg = stats.abilityPower + echoBonus;
      this.addEffect({
        kind: 'explosion',
        x: tower.x,
        y: tower.y,
        radius: 16,
        maxRadius: stats.splashRadius,
        color: '#f59e0b',
        duration: 0.55,
      });
      for (const c of inRadius) {
        this.applyDamage(c, totalDmg, 'magical', tower.id, true);
        this.applyStun(c, isAghs ? 1.65 : 1.15, true);
      }
      this.spawnFloatingText(
        tower.x,
        tower.y - 26,
        `ECHO SLAM! (x${inRadius.length})`,
        '#fbbf24',
        true
      );
    } else if (tower.heroId === 'zeus') {
      // Thundergod's Wrath: global sky lightning strike on EVERY creep on the map!
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
        this.applyDamage(c, stats.abilityPower, dmgType, tower.id, false);
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
      this.addEffect({
        kind: 'explosion',
        x: p.targetX,
        y: p.targetY,
        radius: 8,
        maxRadius: p.splashRadius,
        color: p.color,
        duration: 0.25,
      });
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

    this.applyDamage(
      directTarget,
      p.damage,
      p.damageType,
      p.sourceTowerId,
      Boolean(p.isUltimate)
    );

    if (p.isCrit) {
      this.spawnFloatingText(directTarget.x, directTarget.y - 22, 'CRIT!', '#ef4444');
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
      this.gold += creep.def.bounty;
      this.totalKills += 1;

      if (sourceTowerId !== null) {
        const tower = this.towers.find((t) => t.id === sourceTowerId);
        if (tower) tower.kills += 1;
      }

      sound.playGold();
      this.spawnFloatingText(
        creep.x,
        creep.y - 12,
        `+${creep.def.bounty}g`,
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
