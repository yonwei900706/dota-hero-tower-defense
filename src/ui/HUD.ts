import { HERO_LIST, HERO_MAP } from '../data/heroes';
import { SECRET_SHOP_ITEMS } from '../data/items';
import { HERO_TALENTS, RELIC_MAP, RUNE_DEFS, SYNERGY_MAP } from '../data/mechanics';
import { HERO_PORTRAITS } from '../data/portraits';
import { WAVES } from '../data/waves';
import { sound } from '../engine/Audio';
import { GameEngine } from '../engine/GameEngine';
import { Difficulty, GraphicsQuality, ItemId, Season, TargetPriority } from '../types';

export class HUDController {
  private engine: GameEngine;
  private onToggleQuality: () => GraphicsQuality;
  private getQuality: () => GraphicsQuality;

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
  private btnTimeOfDay = document.getElementById('btn-timeofday') as HTMLButtonElement;
  private timeOfDayLabel = document.getElementById('timeofday-label')!;
  private btnQuality = document.getElementById('btn-quality') as HTMLButtonElement;
  private qualityLabel = document.getElementById('quality-label')!;
  private difficultyPicker = document.getElementById('difficulty-picker')!;

  private synergyBar = document.getElementById('synergy-bar')!;
  private killstreakBannerEl = document.getElementById('killstreak-banner')!;
  private lastBannerId = -1;
  private bannerHideTimer: number | null = null;

  private relicModal = document.getElementById('relic-modal')!;
  private relicChoicesEl = document.getElementById('relic-choices')!;

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
  private inspTalentRow = document.getElementById('insp-talent-row')!;
  private inspItemCount = document.getElementById('insp-item-count')!;
  private inspItemsEl = document.getElementById('insp-items')!;
  private inspTargetBtns = document.getElementById('insp-target-btns')!;
  private btnCloseInsp = document.getElementById('btn-close-insp') as HTMLButtonElement;
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

  constructor(
    engine: GameEngine,
    getQuality: () => GraphicsQuality,
    onToggleQuality: () => GraphicsQuality
  ) {
    this.engine = engine;
    this.getQuality = getQuality;
    this.onToggleQuality = onToggleQuality;
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
      mjollnir: 'Mjol',
      divine_rapier: 'Rapier',
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
    this.btnTimeOfDay.addEventListener('click', () => this.engine.toggleTimeOfDayPreview());
    this.btnQuality.addEventListener('click', () => {
      this.onToggleQuality();
      this.sync();
    });

    this.difficultyPicker.querySelectorAll<HTMLButtonElement>('.diff-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const diff = btn.dataset.diff as Difficulty;
        this.engine.setDifficulty(diff);
      });
    });

    this.btnUpgrade.addEventListener('click', () => this.engine.upgradeSelectedTower());
    this.btnSell.addEventListener('click', () => this.engine.sellSelectedTower());
    this.btnCloseInsp.addEventListener('click', () => this.engine.selectTower(null));

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

    // Season, Time of Day & Graphics Quality pills
    const seasonNames: Record<Season, string> = {
      spring: '🌸 SPRING',
      summer: '☀️ SUMMER',
      autumn: '🍂 AUTUMN',
      winter: '❄️ WINTER',
    };
    this.seasonLabel.textContent = seasonNames[snap.season];
    this.btnSeason.dataset.season = snap.season;

    this.timeOfDayLabel.textContent = snap.timeOfDay === 'night' ? '🌙 NIGHT' : '☀️ DAY';
    this.btnTimeOfDay.dataset.time = snap.timeOfDay;

    const q = this.getQuality();
    this.qualityLabel.textContent = q === 'high' ? '✨ HI' : '⚡ MED';

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

    // Synergy, Active Rune Buffs & Owned Relics Bar
    const badges: string[] = [];
    for (const sId of snap.activeSynergies) {
      const s = SYNERGY_MAP[sId];
      badges.push(
        `<span class="hud-badge synergy-badge" style="border-color:${s.color}" title="${s.desc}">${s.icon} ${s.name}</span>`
      );
    }
    for (const buff of snap.activeRuneBuffs) {
      const r = RUNE_DEFS[buff.kind];
      badges.push(
        `<span class="hud-badge rune-badge" style="border-color:${r.color}" title="${r.shortDesc}">${r.icon} ${r.name} ${Math.ceil(buff.remaining)}s</span>`
      );
    }
    for (const relId of snap.ownedRelics) {
      const rel = RELIC_MAP[relId];
      badges.push(
        `<span class="hud-badge relic-badge" style="border-color:${rel.color}" title="${rel.name}: ${rel.desc}">${rel.icon}</span>`
      );
    }
    this.synergyBar.innerHTML = badges.join('');

    // Killstreak Announcer Banner
    if (snap.killstreakBanner && snap.killstreakBanner.id !== this.lastBannerId) {
      this.lastBannerId = snap.killstreakBanner.id;
      this.killstreakBannerEl.textContent = snap.killstreakBanner.text;
      this.killstreakBannerEl.style.color = snap.killstreakBanner.color;
      this.killstreakBannerEl.classList.remove('hidden');
      if (this.bannerHideTimer !== null) window.clearTimeout(this.bannerHideTimer);
      this.bannerHideTimer = window.setTimeout(() => {
        this.killstreakBannerEl.classList.add('hidden');
      }, 2200);
    }

    // Neutral Boss Loot Relic Modal
    if (snap.pendingRelicChoices && snap.pendingRelicChoices.length > 0) {
      if (this.relicModal.classList.contains('hidden')) {
        this.relicChoicesEl.innerHTML = '';
        for (const rId of snap.pendingRelicChoices) {
          const rel = RELIC_MAP[rId];
          const card = document.createElement('button');
          card.className = 'relic-choice-card';
          card.style.setProperty('--relic-color', rel.color);
          card.innerHTML = `
            <span class="relic-icon">${rel.icon}</span>
            <strong>${rel.name}</strong>
            <span>${rel.desc}</span>
          `;
          card.addEventListener('click', () => this.engine.chooseRelic(rId));
          this.relicChoicesEl.appendChild(card);
        }
        this.relicModal.classList.remove('hidden');
      }
    } else {
      this.relicModal.classList.add('hidden');
    }

    // Dynamic Boss HP Bar
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
        (selectedTower.precisionBoosted ? ' • +Dmg' : '') +
        (selectedTower.auraBoosted ? ' • +Mana' : '');

      let spdMult = selectedTower.items.includes('moon_shard') ? 1.45 : 1.0;
      if (selectedTower.items.includes('mjollnir')) spdMult *= 1.25;
      if (selectedTower.heroId === 'lina' && selectedTower.talent === 'left') spdMult *= 1.35;

      const dmgBonusMult =
        (selectedTower.items.includes('divine_rapier') ? 2.5 : 1.0) *
        (selectedTower.heroId === 'drow_ranger' && selectedTower.talent === 'left' ? 1.3 : 1.0);

      this.inspDmg.textContent = String(Math.round(stats.damage * dmgBonusMult));
      this.inspSpd.textContent = `${(stats.attackRate * spdMult).toFixed(2)}/s`;
      this.inspKills.textContent = String(selectedTower.kills);
      this.inspTotalDmg.textContent =
        selectedTower.totalDamage >= 1000
          ? `${(selectedTower.totalDamage / 1000).toFixed(1)}k`
          : String(Math.floor(selectedTower.totalDamage));

      // Level 3 Talent Tree Row
      if (selectedTower.level >= 3) {
        this.inspTalentRow.classList.remove('hidden');
        const talents = HERO_TALENTS[selectedTower.heroId];
        if (selectedTower.talent === null) {
          this.inspTalentRow.innerHTML = `
            <span class="talent-label">TALENT:</span>
            <button data-choice="left" class="talent-btn" title="${talents.left.desc}">✦ ${talents.left.name} (${talents.left.desc})</button>
            <button data-choice="right" class="talent-btn" title="${talents.right.desc}">✦ ${talents.right.name} (${talents.right.desc})</button>
          `;
          this.inspTalentRow.querySelectorAll<HTMLButtonElement>('.talent-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
              const c = btn.dataset.choice as 'left' | 'right';
              this.engine.chooseTowerTalent(selectedTower.id, c);
            });
          });
        } else {
          const picked = talents[selectedTower.talent];
          this.inspTalentRow.innerHTML = `
            <span class="talent-picked">✦ TALENT ACTIVE: <strong>${picked.name}</strong> (${picked.desc})</span>
          `;
        }
      } else {
        this.inspTalentRow.classList.add('hidden');
      }

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
      this.overlayDesc.innerHTML = `Your defenses fell on <strong>Wave ${snap.waveIndex} / ${snap.totalWaves}</strong> (${snap.difficulty.toUpperCase()}). Adapt your heroes, synergies &amp; Secret Shop items!`;
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
