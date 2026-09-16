// ==========================================================================
// Command & Conquer RTS - Tactical HUD, Sidebar Build Queues & Modals
// ==========================================================================

class HUD {
  constructor(gameContext) {
    this.ctx = gameContext;
    this.activeTab = 'structures'; // 'structures', 'defenses', 'infantry', 'vehicles'
    this.selectedEntity = null;

    this.initDOMReferences();
    this.initEventListeners();
    this.paintLobbyCameos();
    this.refreshBuildCards();
  }

  paintLobbyCameos() {
    document.querySelectorAll('.team-cameo').forEach((canvas) => {
      const team = canvas.dataset.faction || canvas.dataset.team || 'blue';
      if (typeof HudIcons !== 'undefined') {
        HudIcons.paint(canvas, team === 'red' ? 'faction_red' : 'faction_blue', { team });
      }
    });
  }

  initDOMReferences() {
    this.creditsValEl = document.getElementById('credits-val');
    this.powerFillEl = document.getElementById('power-bar-fill');
    this.powerValEl = document.getElementById('power-val');
    this.objectiveTextEl = document.getElementById('objective-text');
    this.objectiveStatusEl = document.getElementById('objective-status');
    this.buildGridEl = document.getElementById('build-grid');
    this.selectionCardEl = document.getElementById('selection-card');
    this.tooltipEl = document.getElementById('build-tooltip');
    this.radioFeedEl = document.getElementById('radio-feed');

    this.btnRepair = document.getElementById('btn-mode-repair');
    this.btnSell = document.getElementById('btn-mode-sell');
    this.btnAttackMove = document.getElementById('btn-mode-attackmove');
    this.btnAirstrike = document.getElementById('btn-mode-airstrike');

    this.modalMission = document.getElementById('modal-mission-select');
    this.modalVictory = document.getElementById('modal-victory');
    this.modalDefeat = document.getElementById('modal-defeat');
  }

  initEventListeners() {
    // Build category tabs
    document.querySelectorAll('.build-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.build-tab').forEach(t => t.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.activeTab = e.currentTarget.dataset.tab;
        if (this.ctx.soundFX) this.ctx.soundFX.playClick();
        this.refreshBuildCards();
      });
    });

    if (this.btnRepair) this.btnRepair.addEventListener('click', () => {
      const isCurrentlyRepair = this.ctx.inputManager.commandMode === 'repair';
      this.ctx.inputManager.setCommandMode(isCurrentlyRepair ? 'normal' : 'repair');
      if (this.ctx.soundFX) this.ctx.soundFX.playClick();
    });

    // Sell Mode
    if (this.btnSell) this.btnSell.addEventListener('click', () => {
      const isCurrentlySell = this.ctx.inputManager.commandMode === 'sell';
      this.ctx.inputManager.setCommandMode(isCurrentlySell ? 'normal' : 'sell');
      if (this.ctx.soundFX) this.ctx.soundFX.playClick();
    });

    if (this.btnAttackMove) this.btnAttackMove.addEventListener('click', () => {
      const isOn = this.ctx.inputManager.commandMode === 'attackmove';
      this.ctx.inputManager.setCommandMode(isOn ? 'normal' : 'attackmove');
      if (this.ctx.soundFX) this.ctx.soundFX.playClick();
    });

    // Airstrike Mode
    if (this.btnAirstrike) this.btnAirstrike.addEventListener('click', () => {
      if (this.btnAirstrike.disabled) return;
      const isCurrentlyAirstrike = this.ctx.inputManager.commandMode === 'airstrike';
      this.ctx.inputManager.setCommandMode(isCurrentlyAirstrike ? 'normal' : 'airstrike');
      if (this.ctx.soundFX) this.ctx.soundFX.playClick();
    });

    // Top Tactical Bar Menu Button — shows in-game mission select modal
    const menuBtn = document.getElementById('btn-menu');
    if (menuBtn) menuBtn.addEventListener('click', () => {
      this.showMissionModal();
      if (this.ctx.soundFX) this.ctx.soundFX.playClick();
    });

    // Unit Stance Buttons
    document.querySelectorAll('.stance-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        let stance = e.currentTarget.dataset.stance;
        if (stance === 'hold') stance = 'holdground';
        this.ctx.entityManager.selectedUnits.forEach((u) => {
          u.stance = stance;
          if (stance === 'holdground' && typeof u.holdPosition === 'function') u.holdPosition();
          if (stance === 'guard' && typeof u.becomeIdle === 'function') u.becomeIdle();
        });
        document.querySelectorAll('.stance-btn').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        if (this.ctx.soundFX) this.ctx.soundFX.playClick();
      });
    });

    // In-game Mission Select Cards (inside #modal-mission-select only)
    document.querySelectorAll('#modal-mission-select .mission-card').forEach(card => {
      card.addEventListener('click', (e) => {
        document.querySelectorAll('#modal-mission-select .mission-card').forEach(c => c.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        if (this.ctx.soundFX) this.ctx.soundFX.playClick();
      });
    });

    // In-game Difficulty Select Buttons (inside #modal-mission-select only)
    document.querySelectorAll('#modal-mission-select .diff-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#modal-mission-select .diff-btn').forEach(b => b.classList.remove('selected'));
        e.currentTarget.classList.add('selected');
        if (this.ctx.soundFX) this.ctx.soundFX.playClick();
      });
    });

    // In-game Launch Mission Button
    const launchBtn = document.getElementById('btn-launch-mission');
    if (launchBtn) launchBtn.addEventListener('click', () => {
      const selectedCard = document.querySelector('#modal-mission-select .mission-card.selected');
      const selectedDiff = document.querySelector('#modal-mission-select .diff-btn.selected');
      const missionIdx = selectedCard ? parseInt(selectedCard.dataset.mission) : 0;
      const difficulty = selectedDiff ? selectedDiff.dataset.diff : 'medium';

      UnitModels.playerTeam = this.ctx.playerTeam || 'blue';
      BuildingModels.playerTeam = this.ctx.playerTeam || 'blue';
      this.ctx.missionManager.loadMission(missionIdx, difficulty);
      this.hideMissionModal();
      this.refreshBuildCards();
      this.ctx.missionActive = true;
      if (this.ctx.renderer && this.ctx.renderer.setPlayCapture) this.ctx.renderer.setPlayCapture(true);
    });

    // Victory — Continue to next mission
    const victoryContinue = document.getElementById('btn-victory-continue');
    if (victoryContinue) victoryContinue.addEventListener('click', () => {
      this.modalVictory.classList.add('hidden');
      const nextMission = (this.ctx.missionManager.currentMissionIndex + 1) % 3;
      this.ctx.missionManager.loadMission(nextMission);
      this.ctx.missionActive = true;
      if (this.ctx.renderer && this.ctx.renderer.setPlayCapture) this.ctx.renderer.setPlayCapture(true);
    });

    // Defeat — Retry same mission
    const defeatRetry = document.getElementById('btn-defeat-retry');
    if (defeatRetry) defeatRetry.addEventListener('click', () => {
      this.modalDefeat.classList.add('hidden');
      this.ctx.missionManager.loadMission(this.ctx.missionManager.currentMissionIndex);
      this.ctx.missionActive = true;
      if (this.ctx.renderer && this.ctx.renderer.setPlayCapture) this.ctx.renderer.setPlayCapture(true);
    });
  }

  update(delta) {
    const { economy, entityManager, missionManager } = this.ctx;
    if (!this.creditsValEl) return;

    // 1. Update Credits display
    this.creditsValEl.textContent = `$ ${Math.floor(economy.credits.player).toLocaleString()}`;

    // 2. Update Power Meter
    const power = economy.getPowerStats('player');
    this.powerValEl.textContent = `${power.produced} / ${power.consumed} MW`;

    if (power.isDeficit) {
      this.powerFillEl.className = 'power-bar-fill deficit';
      this.powerValEl.className = 'power-val deficit';
    } else if (power.surplus < 30) {
      this.powerFillEl.className = 'power-bar-fill warning';
      this.powerValEl.className = 'power-val';
    } else {
      this.powerFillEl.className = 'power-bar-fill';
      this.powerValEl.className = 'power-val';
    }

    const fillPercent = power.consumed === 0 ? 100 : Math.min(100, (power.produced / (power.consumed + 40)) * 100);
    this.powerFillEl.style.width = `${fillPercent}%`;

    // 3. Update Airstrike Button state
    const hasRadar = entityManager.getPlayerBuildings().some(b => b.type === 'radar_facility' && b.isAlive);
    if (this.btnAirstrike) this.btnAirstrike.disabled = !hasRadar || power.isDeficit;

    // 4. Update Objective Text
    if (this.objectiveTextEl) {
      this.objectiveTextEl.textContent = missionManager.getCurrentObjectiveText();
    }
    if (this.objectiveStatusEl) {
      if (missionManager.isMissionCompleted) this.objectiveStatusEl.textContent = 'COMPLETE';
      else if (missionManager.isMissionFailed) this.objectiveStatusEl.textContent = 'FAILED';
      else this.objectiveStatusEl.textContent = 'ACTIVE';
    }

    // 5. Update Selection Card
    this.updateSelectionCard();

    // 6. Update Build Queues & Progress on cards
    this.updateBuildCardsProgress();
  }

  updateModeButtons(mode) {
    if (this.btnRepair) this.btnRepair.className = `cmd-mode-btn ${mode === 'repair' ? 'active-repair' : ''}`;
    if (this.btnSell) this.btnSell.className = `cmd-mode-btn ${mode === 'sell' ? 'active-sell' : ''}`;
    if (this.btnAttackMove) this.btnAttackMove.className = `cmd-mode-btn ${mode === 'attackmove' ? 'active-airstrike' : ''}`;
    if (this.btnAirstrike) this.btnAirstrike.className = `cmd-mode-btn ${mode === 'airstrike' ? 'active-airstrike' : ''}`;
  }

  // Generate build cards for current tab
  refreshBuildCards() {
    if (!this.buildGridEl) return;
    this.buildGridEl.innerHTML = '';
    const { entityManager } = this.ctx;

    let items = [];
    if (this.activeTab === 'structures') {
      items = [
        { type: 'power_plant', isBuilding: true, name: 'Power Plant', cost: 300, req: [] },
        { type: 'ore_refinery', isBuilding: true, name: 'Ore Refinery', cost: 1200, req: ['power_plant'] },
        { type: 'barracks', isBuilding: true, name: 'Barracks', cost: 400, req: ['power_plant'] },
        { type: 'war_factory', isBuilding: true, name: 'War Factory', cost: 1000, req: ['barracks', 'ore_refinery'] },
        { type: 'radar_facility', isBuilding: true, name: 'Radar Facility', cost: 600, req: ['ore_refinery'] },
        { type: 'energy_storage', isBuilding: true, name: 'Energy Storage', cost: 250, req: ['power_plant'] }
      ];
    } else if (this.activeTab === 'defenses') {
      items = [
        { type: 'turret_gun', isBuilding: true, name: 'MG Turret', cost: 350, req: ['barracks'] },
        { type: 'turret_rocket', isBuilding: true, name: 'Rocket Turret', cost: 550, req: ['radar_facility'] },
        { type: 'turret_laser', isBuilding: true, name: 'Laser Obelisk', cost: 800, req: ['radar_facility', 'power_plant'] },
        { type: 'wall', isBuilding: true, name: 'Wall Segment', cost: 50, req: [] }
      ];
    } else if (this.activeTab === 'infantry') {
      items = [
        { type: 'machine_gunner', isBuilding: false, name: 'Machine Gunner', cost: 100, req: ['barracks'] },
        { type: 'grenadier', isBuilding: false, name: 'Grenadier', cost: 160, req: ['barracks'] },
        { type: 'rocket_launcher', isBuilding: false, name: 'Rocket Soldier', cost: 220, req: ['barracks'] },
        { type: 'engineer', isBuilding: false, name: 'Combat Engineer', cost: 250, req: ['barracks'] }
      ];
    } else if (this.activeTab === 'vehicles') {
      items = [
        { type: 'light_tracks', isBuilding: false, name: 'Light Tracks', cost: 400, req: ['war_factory'] },
        { type: '4x4_gunner', isBuilding: false, name: '4x4 Gunner', cost: 350, req: ['war_factory'] },
        { type: 'battle_tank', isBuilding: false, name: 'Battle Tank', cost: 800, req: ['war_factory'] },
        { type: 'harvester', isBuilding: false, name: 'Ore Harvester', cost: 500, req: ['ore_refinery'] },
        { type: 'laser_colossus', isBuilding: false, name: 'Laser Colossus', cost: 1600, req: ['war_factory', 'radar_facility'] },
        { type: 'helicopter', isBuilding: false, name: 'Attack Chopper', cost: 750, req: ['war_factory', 'radar_facility'] }
      ];
    }

    const playerBuildings = entityManager.getPlayerBuildings();
    const credits = this.ctx.economy ? this.ctx.economy.credits.player : 0;

    items.forEach(item => {
      const specCost = item.isBuilding
        ? (BUILDING_SPECS[item.type] && BUILDING_SPECS[item.type].cost)
        : (UNIT_SPECS[item.type] && UNIT_SPECS[item.type].cost);
      const cost = specCost !== undefined ? specCost : item.cost;

      const card = document.createElement('div');
      card.className = 'build-card';
      card.dataset.type = item.type;
      card.dataset.isBuilding = item.isBuilding;
      card.dataset.cost = String(cost);

      const isUnlocked = TechTree.isUnlocked(item.type, playerBuildings);
      if (!isUnlocked) {
        card.classList.add('locked');
      } else if (credits < cost) {
        card.classList.add('unaffordable');
      }

      card.innerHTML = `
        <div class="queue-badge" id="queue-${item.type}">0</div>
        <div class="build-card-icon"></div>
        <div class="build-card-name">${item.name}</div>
        <div class="build-card-cost">$ ${cost}</div>
        <div class="build-progress-overlay">
          <span class="progress-text">0%</span>
        </div>
      `;

      const iconWrap = card.querySelector('.build-card-icon');
      if (iconWrap && typeof document !== 'undefined' && document.createElement) {
        const cameo = document.createElement('canvas');
        cameo.className = 'cameo-icon';
        cameo.width = 56;
        cameo.height = 56;
        iconWrap.appendChild(cameo);
        if (typeof HudIcons !== 'undefined') {
          HudIcons.paint(cameo, item.type, { team: this.ctx.playerTeam || 'blue' });
        }
      }

      card.addEventListener('click', () => this.onBuildCardClicked(item));
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.onBuildCardCancel(item);
      });
      this.buildGridEl.appendChild(card);
    });
  }

  onBuildCardClicked(item) {
    const playerBuildings = this.ctx.entityManager.getPlayerBuildings();
    const isUnlocked = TechTree.isUnlocked(item.type, playerBuildings);
    if (!isUnlocked) {
      if (this.ctx.soundFX) this.ctx.soundFX.playAlert();
      return;
    }

    const { economy, inputManager, entityManager, soundFX } = this.ctx;

    if (item.isBuilding) {
      // Direct placement mode for structures
      if (economy.canAfford('player', item.cost)) {
        inputManager.startBuildingPlacement(item.type);
      } else {
        if (soundFX) soundFX.playAlert();
      }
    } else {
      // Queue training at Barracks or Factory
      const spec = UNIT_SPECS[item.type];
      if (!economy.canAfford('player', spec.cost)) {
        if (soundFX) soundFX.playAlert();
        return;
      }

      const targetFacilityType = spec.category === 'infantry' ? 'barracks' : 'war_factory';
      const facility = entityManager.getPlayerBuildings().find(b => b.type === targetFacilityType && b.isAlive);

      if (facility) {
        if (economy.spendCredits('player', spec.cost)) {
          facility.queueUnit(item.type);
          if (soundFX) {
            soundFX.playClick();
            soundFX.speak('Training');
          }
        }
      } else {
        if (soundFX) soundFX.playAlert();
      }
    }
  }

  onBuildCardCancel(item) {
    if (item.isBuilding) return;
    const { entityManager, economy, soundFX } = this.ctx;
    const spec = UNIT_SPECS[item.type];
    if (!spec) return;
    const targetFacilityType = spec.category === 'infantry' ? 'barracks' : 'war_factory';
    const facility = entityManager.getPlayerBuildings().find(b => b.type === targetFacilityType && b.isAlive);
    if (!facility) return;

    let refunded = false;
    if (facility.currentProduction === item.type) {
      facility.currentProduction = null;
      facility.productionProgress = 0;
      refunded = true;
    } else {
      const idx = facility.productionQueue.lastIndexOf(item.type);
      if (idx >= 0) {
        facility.cancelQueueIndex(idx);
        refunded = true;
      }
    }
    if (refunded) {
      economy.addCredits('player', spec.cost);
      if (soundFX) soundFX.playClick();
    }
  }

  updateBuildCardsProgress() {
    const { entityManager, economy } = this.ctx;
    const playerBuildings = entityManager.getPlayerBuildings();

    document.querySelectorAll('.build-card').forEach(card => {
      const type = card.dataset.type;
      const isBuilding = card.dataset.isBuilding === 'true';
      const cost = Number(card.dataset.cost || 0);
      const unlocked = TechTree.isUnlocked(type, playerBuildings);
      card.classList.toggle('locked', !unlocked);
      card.classList.toggle('unaffordable', unlocked && !economy.canAfford('player', cost));

      if (isBuilding) {
        const site = playerBuildings.find((b) => b.type === type && b.isBuilding);
        const overlay = card.querySelector('.build-progress-overlay');
        const progressText = card.querySelector('.progress-text');
        if (site && overlay && progressText) {
          card.classList.add('building');
          progressText.textContent = `${Math.floor(site.constructionProgress * 100)}%`;
        } else if (overlay) {
          card.classList.remove('building');
        }
        return;
      }

      if (!isBuilding) {
        const spec = UNIT_SPECS[type];
        if (!spec) return;

        const targetFacilityType = spec.category === 'infantry' ? 'barracks' : 'war_factory';
        const facility = playerBuildings.find(b => b.type === targetFacilityType && b.isAlive);

        const overlay = card.querySelector('.build-progress-overlay');
        const progressText = card.querySelector('.progress-text');
        const queueBadge = card.querySelector('.queue-badge');
        if (!overlay || !progressText || !queueBadge) return;

        if (facility && (facility.currentProduction === type || facility.productionQueue.includes(type))) {
          card.classList.add('building');
          if (facility.currentProduction === type) {
            const pct = Math.floor(facility.productionProgress * 100);
            progressText.textContent = `${pct}%`;
          } else {
            progressText.textContent = 'QUEUED';
          }

          const inQueue = facility.productionQueue.filter(t => t === type).length + (facility.currentProduction === type ? 1 : 0);
          queueBadge.textContent = inQueue;
          queueBadge.style.display = inQueue > 0 ? 'block' : 'none';
        } else {
          card.classList.remove('building');
          queueBadge.style.display = 'none';
        }
      }
    });
  }

  // Bottom selection HUD card
  updateSelectionCard() {
    const { selectedUnits, selectedBuilding } = this.ctx.entityManager;
    if (!this.selectionCardEl) return;

    if (selectedUnits.length === 0 && !selectedBuilding) {
      this.selectionCardEl.classList.add('hidden');
      return;
    }

    this.selectionCardEl.classList.remove('hidden');

    const nameEl = document.getElementById('selected-name');
    const hpFillEl = document.getElementById('selected-hp-fill');
    const statsEl = document.getElementById('selected-stats');
    const countEl = document.getElementById('selected-count');
    const portraitEl = document.getElementById('selected-portrait-icon');
    const stanceRowEl = document.getElementById('stance-actions-row');

    if (selectedUnits.length > 0) {
      const primary = selectedUnits[0];
      nameEl.textContent = primary.name;
      countEl.textContent = selectedUnits.length > 1 ? `x${selectedUnits.length} SQUAD` : '';

      // Total HP percentage
      let totalHp = 0;
      let totalMax = 0;
      selectedUnits.forEach(u => {
        totalHp += u.hp;
        totalMax += u.maxHp;
      });

      const hpPercent = (totalHp / totalMax) * 100;
      hpFillEl.style.width = `${hpPercent}%`;
      hpFillEl.className = hpPercent < 30 ? 'hp-bar-fill low' : (hpPercent < 60 ? 'hp-bar-fill medium' : 'hp-bar-fill');

      if (portraitEl && typeof HudIcons !== 'undefined') {
        HudIcons.paint(portraitEl, primary.type, { team: this.ctx.playerTeam || 'blue' });
      }

      const rank = primary.rank || 0;
      const rankLabel = rank >= 2 ? 'ELT' : (rank === 1 ? 'VET' : '');
      statsEl.innerHTML = `
        <span>HP: ${Math.floor(totalHp)}/${totalMax}</span>
        <span>ATK: ${Math.round(primary.damage)}</span>
        <span>RNG: ${primary.attackRange}</span>
        <span>KILLS: ${primary.kills}${rankLabel ? ' · ' + rankLabel : ''}</span>
      `;

      stanceRowEl.style.display = 'flex';
      const shownStance = primary.stance === 'hold' ? 'holdground' : primary.stance;
      document.querySelectorAll('.stance-btn').forEach(b => {
        const ds = b.dataset.stance === 'hold' ? 'holdground' : b.dataset.stance;
        b.classList.toggle('active', ds === shownStance);
      });
    } else if (selectedBuilding) {
      const b = selectedBuilding;
      nameEl.textContent = b.name;
      countEl.textContent = b.faction.toUpperCase();

      const hpPercent = (b.hp / b.maxHp) * 100;
      hpFillEl.style.width = `${hpPercent}%`;
      hpFillEl.className = hpPercent < 30 ? 'hp-bar-fill low' : (hpPercent < 60 ? 'hp-bar-fill medium' : 'hp-bar-fill');

      if (portraitEl && typeof HudIcons !== 'undefined') {
        HudIcons.paint(portraitEl, b.type, { team: this.ctx.playerTeam || 'blue' });
      }
      const powerLabel = b.isBuilding
        ? 'OFFLINE'
        : (b.powerProduced > 0 ? `+${b.powerProduced}` : `-${b.powerConsumed}`);
      statsEl.innerHTML = `
        <span>HP: ${Math.floor(b.hp)}/${b.maxHp}</span>
        <span>POWER: ${powerLabel} MW</span>
        ${b.isBuilding ? `<span style="color:#ffaa00;">CONSTRUCTING ${Math.floor(b.constructionProgress * 100)}%</span>` : ''}
        ${b.isRepairing ? '<span style="color:#00ff66;">REPAIRING</span>' : ''}
        ${b.isProducer && !b.isBuilding ? '<span>RMB: SET RALLY</span>' : ''}
      `;

      stanceRowEl.style.display = 'none';
    }
  }

  // Radio notification banner
  postRadioMessage(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `radio-message ${type}`;
    el.textContent = `[RADIO] ${msg}`;
    this.radioFeedEl.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 5000);
  }

  showMissionModal() {
    this.modalMission.classList.remove('hidden');
    this.modalMission.style.display = 'flex';
  }

  hideMissionModal() {
    this.modalMission.classList.add('hidden');
    this.modalMission.style.display = 'none';
  }

  showVictoryModal() {
    this.modalVictory.classList.remove('hidden');
    this.modalVictory.style.display = 'flex';
  }

  showDefeatModal() {
    this.modalDefeat.classList.remove('hidden');
    this.modalDefeat.style.display = 'flex';
  }
}
