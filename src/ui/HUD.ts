import { HERO_LIST, HERO_MAP } from '../data/heroes';
import { SECRET_SHOP_ITEMS } from '../data/items';
import { HERO_PORTRAITS } from '../data/portraits';
import { WAVES } from '../data/waves';
import { sound } from '../engine/Audio';
import { GameEngine } from '../engine/GameEngine';
import { Difficulty, ItemId, Season, TargetPriority } from '../types';

export class HUDController {
  private engine: GameEngine;

  private statLives = document.getElementById('stat-lives')!;
  private statGold = document.getElementById('stat-gold')!;
  private statWave = document.getElementById('stat-wave')!;
  private waveTitle = document.getElementById('wave-title')!;
  private waveSubtitle = document.getElementById('wave-subtitle')!;

  private btnNextWave = document.getElementById('btn-next-wave') as HTMLButtonElement;
  private btnAutoWave = document.getElementById('btn-auto-wave') as HTMLButtonElement;
  private btnSpeed = document.getElementById('btn-speed') as HTMLButtonElement;
  private btnPause = document.getElementById('btn-pause') as HTMLButtonElement;
  private btnMute = document.getElementById('btn-mute') as HTMLButtonElement;

  private btnGlyph = document.getElementById('btn-glyph') as HTMLButtonElement;
  private glyphLabel = document.getElementById('glyph-label')!;
  private btnSunstrike = document.getElementById('btn-sunstrike') as HTMLButtonElement;
  private sunstrikeLabel = document.getElementById('sunstrike-label')!;
  private btnSeason = document.getElementById('btn-season') as HTMLButtonElement;
  private seasonLabel = document.getElementById('season-label')!;
  private difficultyPicker = document.getElementById('difficulty-picker')!;

  private bossBarContainer = document.getElementById('boss-bar-container')!;
  private bossName = document.getElementById('boss-name')!;
  private bossStatus = document.getElementById('boss-status')!;
  private bossHpText = document.getElementById('boss-hp-text')!;
  private bossHpFill = document.getElementById('boss-hp-fill') as HTMLElement;
  private bossEnrageMarker = document.getElementById('boss-enrage-marker') as HTMLElement;

  private heroShopEl = document.getElementById('hero-shop')!;
  private inspectorEmpty = document.getElementById('inspector-empty')!;
  private inspectorActive = document.getElementById('inspector-active')!;
  private nextWaveIntel = document.getElementById('next-wave-intel')!;

  private inspAvatar = document.getElementById('insp-avatar')!;
  private inspName = document.getElementById('insp-name')!;
  private inspLevel = document.getElementById('insp-level')!;
  private inspRole = document.getElementById('insp-role')!;
  private inspDmg = document.getElementById('insp-dmg')!;
  private inspSpd = document.getElementById('insp-spd')!;
  private inspKills = document.getElementById('insp-kills')!;
  private inspTotalDmg = document.getElementById('insp-total-dmg')!;
  private inspItemCount = document.getElementById('insp-item-count')!;
  private inspItemsEl = document.getElementById('insp-items')!;
  private inspTargetBtns = document.getElementById('insp-target-btns')!;
  private btnUpgrade = document.getElementById('btn-upgrade') as HTMLButtonElement;
  private btnSell = document.getElementById('btn-sell') as HTMLButtonElement;
  private inspSellValue = document.getElementById('insp-sell-value')!;

  private overlay = document.getElementById('overlay')!;
  private overlayTitle = document.getElementById('overlay-title')!;
  private overlayDesc = document.getElementById('overlay-desc')!;
  private overlayStats = document.getElementById('overlay-stats')!;
  private btnOverlayAction = document.getElementById('btn-overlay-action') as HTMLButtonElement;

  private shopButtons = new Map<string, HTMLButtonElement>();
  private itemButtons = new Map<ItemId, HTMLButtonElement>();

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.buildShop();
    this.buildSecretShop();
    this.bindEvents();
    this.sync();
  }

  private buildShop(): void {
    this.heroShopEl.innerHTML = '';
    for (const hero of HERO_LIST) {
      const btn = document.createElement('button');
      btn.className = 'hero-card';
      btn.style.setProperty('--hero-color', hero.primaryColor);
      btn.innerHTML = `
        <span class="hero-hotkey">${hero.hotkey}</span>
        <span class="hero-portrait">${HERO_PORTRAITS[hero.id]}</span>
        <span class="hero-name">${hero.name}</span>
        <span class="hero-cost">🪙 ${hero.cost}g</span>
      `;
      btn.title = `${hero.name} (${hero.role}) — ${hero.abilityDesc}`;
      btn.addEventListener('click', () => {
        this.engine.selectHeroToBuy(hero.id);
      });
      this.heroShopEl.appendChild(btn);
      this.shopButtons.set(hero.id, btn);
    }
  }

  private buildSecretShop(): void {
    this.inspItemsEl.innerHTML = '';
    const shortNames: Record<ItemId, string> = {
      desolator: 'Deso',
      daedalus: 'Daed',
      moon_shard: 'Moon',
      octarine_core: 'Octa',
    };
    for (const item of SECRET_SHOP_ITEMS) {
      const btn = document.createElement('button');
      btn.className = 'item-btn';
      btn.title = `${item.name} (${item.cost}g) — ${item.fullDesc}`;
      btn.innerHTML = `${item.icon} <span>${shortNames[item.id]}</span> <strong>${item.cost}g</strong>`;
      btn.addEventListener('click', () => {
        this.engine.buyItemForSelectedTower(item.id);
      });
      this.inspItemsEl.appendChild(btn);
      this.itemButtons.set(item.id, btn);
    }
  }

  private bindEvents(): void {
    this.btnNextWave.addEventListener('click', () => this.engine.startNextWave());
    this.btnAutoWave.addEventListener('click', () => this.engine.toggleAutoWave());
    this.btnSpeed.addEventListener('click', () => this.engine.toggleSpeed());
    this.btnPause.addEventListener('click', () => this.engine.togglePause());
    this.btnMute.addEventListener('click', () => {
      sound.muted = !sound.muted;
      this.btnMute.textContent = sound.muted ? '🔇' : '🔊';
    });

    this.btnGlyph.addEventListener('click', () => this.engine.activateGlyph());
    this.btnSunstrike.addEventListener('click', () => this.engine.toggleSunstrikeTargeting());
    this.btnSeason.addEventListener('click', () => this.engine.cycleSeasonPreview());

    this.difficultyPicker.querySelectorAll<HTMLButtonElement>('.diff-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const diff = btn.dataset.diff as Difficulty;
        this.engine.setDifficulty(diff);
      });
    });

    this.btnUpgrade.addEventListener('click', () => this.engine.upgradeSelectedTower());
    this.btnSell.addEventListener('click', () => this.engine.sellSelectedTower());

    this.inspTargetBtns.querySelectorAll<HTMLButtonElement>('.target-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const priority = btn.dataset.target as TargetPriority;
        if (this.engine.selectedTowerId !== null) {
          this.engine.setTowerTargetPriority(this.engine.selectedTowerId, priority);
        }
      });
    });

    this.btnOverlayAction.addEventListener('click', () => {
      this.engine.reset(true);
    });

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (this.engine.phase !== 'playing') return;
      if (e.key >= '1' && e.key <= '8') {
        const idx = Number(e.key) - 1;
        if (HERO_LIST[idx]) {
          this.engine.selectHeroToBuy(HERO_LIST[idx].id);
        }
      } else if (e.key === 'u' || e.key === 'U') {
        this.engine.upgradeSelectedTower();
      } else if (e.key === 's' || e.key === 'S') {
        this.engine.sellSelectedTower();
      } else if (e.key === 'g' || e.key === 'G') {
        this.engine.activateGlyph();
      } else if (e.key === 'f' || e.key === 'F') {
        this.engine.toggleSunstrikeTargeting();
      } else if (e.key === 'Escape') {
        this.engine.selectHeroToBuy(null);
        this.engine.selectTower(null);
      } else if (e.key === ' ') {
        e.preventDefault();
        this.engine.togglePause();
      } else if (e.key === 'Enter') {
        this.engine.startNextWave();
      }
    });
  }

  public sync(): void {
    const snap = this.engine.getSnapshot();

    // Top stats
    this.statLives.textContent = String(snap.lives);
    this.statGold.textContent = String(snap.gold);
    this.statWave.textContent = `${snap.waveIndex} / ${snap.totalWaves}`;

    // Wave banner
    if (snap.waveIndex === 0) {
      this.waveTitle.textContent = 'PREPARE YOUR DEFENSES';
      this.waveSubtitle.textContent = 'Select a Hero (1–8) & click a stone pedestal';
    } else {
      const curWave = WAVES[snap.waveIndex - 1];
      this.waveTitle.textContent = curWave.title;
      this.waveSubtitle.textContent = snap.waveActive
        ? curWave.subtitle
        : 'Wave Cleared! Upgrade heroes or call next wave.';
    }

    // Top controls
    if (snap.waveActive) {
      this.btnNextWave.disabled = true;
      this.btnNextWave.textContent = `⚔ WAVE ${snap.waveIndex}`;
    } else if (snap.waveIndex >= snap.totalWaves) {
      this.btnNextWave.disabled = true;
      this.btnNextWave.textContent = 'CLEARED';
    } else {
      this.btnNextWave.disabled = false;
      const nextNum = snap.waveIndex + 1;
      if (nextNum === 40) {
        this.btnNextWave.textContent = '🔥 ROSHAN (W40)';
      } else if (nextNum % 5 === 0) {
        this.btnNextWave.textContent = `💀 BOSS (W${nextNum})`;
      } else {
        this.btnNextWave.textContent = `▶ WAVE ${nextNum}`;
      }
    }

    // Season badge
    const seasonNames: Record<Season, string> = {
      spring: '🌸 SPRING',
      summer: '☀️ SUMMER',
      autumn: '🍂 AUTUMN',
      winter: '❄️ WINTER',
    };
    this.seasonLabel.textContent = seasonNames[snap.season];
    this.btnSeason.dataset.season = snap.season;

    // Difficulty buttons
    this.difficultyPicker.querySelectorAll<HTMLButtonElement>('.diff-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.diff === snap.difficulty);
    });

    this.btnAutoWave.classList.toggle('active-toggle', snap.autoWave);
    this.btnSpeed.textContent = `${snap.speed}x`;
    this.btnSpeed.classList.toggle('active-toggle', snap.speed > 1);
    this.btnPause.textContent = snap.paused ? '▶' : '⏸';
    this.btnPause.classList.toggle('active-toggle', snap.paused);

    // Tactical Commander Spells
    if (snap.glyphActiveTimer > 0) {
      this.btnGlyph.disabled = true;
      this.btnGlyph.classList.add('active-spell');
      this.glyphLabel.textContent = `ACTIVE ${Math.ceil(snap.glyphActiveTimer)}s`;
    } else if (snap.glyphCooldown > 0) {
      this.btnGlyph.disabled = true;
      this.btnGlyph.classList.remove('active-spell');
      this.glyphLabel.textContent = `${snap.glyphCooldown}s`;
    } else {
      this.btnGlyph.disabled = false;
      this.btnGlyph.classList.remove('active-spell');
      this.glyphLabel.textContent = 'GLYPH';
    }

    if (snap.sunstrikeCooldown > 0) {
      this.btnSunstrike.disabled = true;
      this.btnSunstrike.classList.remove('active-spell');
      this.sunstrikeLabel.textContent = `${snap.sunstrikeCooldown}s`;
    } else {
      this.btnSunstrike.disabled = false;
      this.btnSunstrike.classList.toggle('active-spell', snap.sunstrikeTargeting);
      this.sunstrikeLabel.textContent = snap.sunstrikeTargeting ? 'CLICK LANE!' : 'SUNSTRIKE';
    }

    // Dynamic Boss HP Bar (Waves 5, 10, 15, 20)
    if (snap.boss && snap.boss.active) {
      this.bossBarContainer.classList.remove('hidden');
      const pct = Math.max(0, (snap.boss.hp / snap.boss.maxHp) * 100);
      this.bossName.textContent = snap.boss.name;
      this.bossHpFill.style.width = `${pct}%`;
      this.bossHpText.textContent = `${snap.boss.hp.toLocaleString()} / ${snap.boss.maxHp.toLocaleString()}`;
      this.bossStatus.textContent = snap.boss.statusText;
      this.bossStatus.classList.toggle('enraged', snap.boss.enraged);
      this.bossEnrageMarker.style.display = snap.boss.isFinalBoss ? 'block' : 'none';
    } else {
      this.bossBarContainer.classList.add('hidden');
    }

    // Shop buttons
    for (const hero of HERO_LIST) {
      const btn = this.shopButtons.get(hero.id);
      if (!btn) continue;
      btn.classList.toggle('selected', snap.selectedHeroToBuy === hero.id);
      btn.classList.toggle('unaffordable', snap.gold < hero.cost);
    }

    // Inspector panel
    const selectedTower =
      snap.selectedTowerId !== null
        ? this.engine.towers.find((t) => t.id === snap.selectedTowerId) ?? null
        : null;

    if (!selectedTower) {
      this.inspectorEmpty.classList.remove('hidden');
      this.inspectorActive.classList.add('hidden');

      const nextWave = WAVES[Math.min(snap.waveIndex, WAVES.length - 1)];
      this.nextWaveIntel.innerHTML = `
        <div class="intel-title">${nextWave.title}</div>
        <div class="intel-desc">${nextWave.intel}</div>
      `;
    } else {
      this.inspectorEmpty.classList.add('hidden');
      this.inspectorActive.classList.remove('hidden');

      const def = HERO_MAP[selectedTower.heroId];
      const stats = def.levels[selectedTower.level - 1];
      const isMax = selectedTower.level >= def.levels.length;
      const nextStats = !isMax ? def.levels[selectedTower.level] : null;

      this.inspAvatar.innerHTML = HERO_PORTRAITS[selectedTower.heroId];
      this.inspAvatar.style.borderColor = selectedTower.level === 4 ? '#38bdf8' : def.primaryColor;
      this.inspName.textContent = def.name;
      this.inspLevel.textContent =
        selectedTower.level === 4 ? "LVL 4 • AGHANIM'S" : `LVL ${selectedTower.level}`;
      this.inspLevel.classList.toggle('aghs-badge', selectedTower.level === 4);
      this.inspRole.textContent =
        def.role +
        (selectedTower.precisionBoosted ? ' • +Dmg Aura' : '') +
        (selectedTower.auraBoosted ? ' • +Mana Aura' : '');

      const effectiveSpd =
        stats.attackRate * (selectedTower.items.includes('moon_shard') ? 1.45 : 1);
      this.inspDmg.textContent = String(stats.damage);
      this.inspSpd.textContent = `${effectiveSpd.toFixed(2)}/s`;
      this.inspKills.textContent = String(selectedTower.kills);
      this.inspTotalDmg.textContent =
        selectedTower.totalDamage >= 1000
          ? `${(selectedTower.totalDamage / 1000).toFixed(1)}k`
          : String(Math.floor(selectedTower.totalDamage));

      // Secret Shop item states
      this.inspItemCount.textContent = String(selectedTower.items.length);
      for (const item of SECRET_SHOP_ITEMS) {
        const btn = this.itemButtons.get(item.id);
        if (!btn) continue;
        const owned = selectedTower.items.includes(item.id);
        const full = selectedTower.items.length >= 3;
        btn.classList.toggle('owned', owned);
        btn.disabled = owned || full || snap.gold < item.cost;
      }

      // Target buttons
      this.inspTargetBtns.querySelectorAll<HTMLButtonElement>('.target-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.target === selectedTower.targetPriority);
      });

      // Upgrade button
      if (isMax || !nextStats) {
        this.btnUpgrade.disabled = true;
        this.btnUpgrade.innerHTML = "★ MAXED (AGHANIM'S)";
      } else {
        const isNextAghs = nextStats.level === 4;
        this.btnUpgrade.disabled = snap.gold < nextStats.upgradeCost;
        this.btnUpgrade.innerHTML = isNextAghs
          ? `💎 AGHANIM'S (${nextStats.upgradeCost}g)`
          : `⬆ LVL ${nextStats.level} (${nextStats.upgradeCost}g)`;
      }

      const refund = Math.floor(selectedTower.totalInvested * 0.75);
      this.inspSellValue.textContent = `${refund}g`;
    }

    // Overlays
    if (snap.phase === 'title') {
      this.overlay.classList.remove('hidden');
      this.difficultyPicker.classList.remove('hidden');
      this.overlayStats.classList.add('hidden');
      this.overlayTitle.textContent = 'DOTA HERO TOWER DEFENSE';
      this.btnOverlayAction.textContent = 'ENTER BATTLE';
    } else if (snap.phase === 'victory') {
      this.overlay.classList.remove('hidden');
      this.difficultyPicker.classList.remove('hidden');
      this.overlayTitle.textContent = 'RADIANT VICTORY!';
      this.overlayDesc.innerHTML =
        `You conquered all <strong>40 Waves</strong> across all 4 Seasons on <strong>${snap.difficulty.toUpperCase()}</strong> difficulty and slew <strong>Roshan</strong>!`;
      this.overlayStats.classList.remove('hidden');
      this.overlayStats.innerHTML = `
        <span>🏛️ Ancient HP: <strong>${snap.lives} / ${snap.maxLives}</strong></span>
        <span>💀 Creeps Slain: <strong>${snap.totalKills}</strong></span>
        <span>🪙 Gold Remaining: <strong>${snap.gold}g</strong></span>
      `;
      this.btnOverlayAction.textContent = 'PLAY AGAIN';
    } else if (snap.phase === 'defeat') {
      this.overlay.classList.remove('hidden');
      this.difficultyPicker.classList.remove('hidden');
      this.overlayTitle.textContent = 'THE ANCIENT HAS FALLEN';
      this.overlayDesc.innerHTML = `Your defenses fell on <strong>Wave ${snap.waveIndex} / ${snap.totalWaves}</strong> (${snap.difficulty.toUpperCase()}). Adapt your heroes &amp; Secret Shop items!`;
      this.overlayStats.classList.remove('hidden');
      this.overlayStats.innerHTML = `
        <span>⚔️ Reached Wave: <strong>${snap.waveIndex} / ${snap.totalWaves}</strong></span>
        <span>💀 Creeps Slain: <strong>${snap.totalKills}</strong></span>
      `;
      this.btnOverlayAction.textContent = 'TRY AGAIN';
    } else {
      this.overlay.classList.add('hidden');
    }
  }
}
