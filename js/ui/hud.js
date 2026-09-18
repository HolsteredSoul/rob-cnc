// ==========================================================================
// Command & Conquer RTS - Tactical HUD, Sidebar Build Queues & Modals
// ==========================================================================

function isPlayerRadarOperational(gameContext) {
  if (!gameContext || !gameContext.entityManager) return false;
  const buildings = gameContext.entityManager.getPlayerBuildings
    ? gameContext.entityManager.getPlayerBuildings() : [];
  const radar = buildings.some((b) => b && b.type === 'radar_facility' && b.isAlive && !b.isBuilding);
  if (!radar) return false;
  if (gameContext.economy && typeof gameContext.economy.isBasePowered === 'function') {
    return !!gameContext.economy.isBasePowered('player');
  }
  return !(gameContext.economy && gameContext.economy.getPowerStats && gameContext.economy.getPowerStats('player').isDeficit);
}
if (typeof window !== 'undefined') window.isPlayerRadarOperational = isPlayerRadarOperational;

class HUD {
  constructor(gameContext) {
    this.ctx = gameContext;
    this.activeTab = 'structures'; // 'structures', 'defenses', 'infantry', 'vehicles'
    this.selectedEntity = null;

    this.initDOMReferences();
    this.initEventListeners();
    this.initTouchControls();
    this.paintLobbyCameos();
    this.refreshBuildCards();
  }

  initTouchControls() {
    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };
    const im = this.ctx.inputManager;
    const em = this.ctx.entityManager;
    bind('btn-pause', () => {
      if (this.ctx.paused) this.ctx.resume(); else this.ctx.pause();
    });
    bind('btn-speed', () => { this.ctx.simulationSpeed = this.ctx.simulationSpeed === 1 ? 0.5 : 1; this.updateSessionControls(); });
    bind('btn-resume-menu', () => { this.hideMissionModal(); this.ctx.resume(); });
    bind('btn-build', () => this.toggleTouchPanel('build'));
    bind('btn-map', () => this.toggleTouchPanel('map'));
    bind('btn-more', () => this.toggleTouchPanel('more'));
    bind('btn-close-drawer', () => this.closeTouchPanels());
    bind('btn-home', () => {
      const hq = em.getPlayerBuildings().find(b => b.type === 'command_center');
      if (hq) this.ctx.renderer.panTo(hq.position.x, hq.position.z);
    });
    bind('btn-select-area', () => {
      const enabled = !im.selectArea;
      im.cancelTouchGesture();
      im.cancelBuildingPlacement();
      im.setCommandMode('normal');
      im.selectArea = enabled;
      this.closeTouchPanels();
      this.showCommandFeedback(enabled ? 'Drag a box around your units' : 'Selection cancelled');
    });
    bind('btn-stop', () => im.stopSelected());
    bind('btn-touch-attack', () => this.armTouchMode('attackmove'));
    bind('btn-return', () => { if (im.returnSelectedHarvesters()) this.showCommandFeedback('Return cargo'); });
    bind('btn-clear', () => { em.clearSelection(); im.setCommandMode('normal'); });
    bind('btn-place', () => im.confirmBuildingPlacement());
    bind('btn-cancel-command', () => { im.cancelBuildingPlacement(); im.setCommandMode('normal'); im.selectArea = false; });
    bind('btn-cancel-sell', () => this.cancelSell());
    bind('btn-confirm-sell', () => {
      const b = this.sellTarget;
      if (b && b.isAlive && b.faction === 'player' && !this.ctx.paused && this.ctx.missionActive) {
        this.ctx.economy.addCredits('player', Math.floor(b.spec.cost * 0.5));
        b.takeDamage(99999);
        im.setCommandMode('normal');
      }
      this.cancelSell();
    });
    document.querySelectorAll('[data-quick]').forEach(el => el.addEventListener('click', () => {
      im.quickSelect(el.dataset.quick); this.closeTouchPanels();
    }));
    document.querySelectorAll('[data-touch-mode]').forEach(el => el.addEventListener('click', () => this.armTouchMode(el.dataset.touchMode)));
    document.querySelectorAll('.touch-stance').forEach(el => el.addEventListener('click', () => {
      if (this.ctx.paused) return;
      em.selectedUnits.filter(u => u.faction === 'player').forEach(u => {
        u.stance = el.dataset.stance;
        if (u.stance === 'holdground') u.holdPosition();
        if (u.stance === 'guard') u.becomeIdle();
      });
      this.showCommandFeedback(el.textContent); this.closeTouchPanels();
    }));
    document.querySelectorAll('[data-group-assign]').forEach(el => el.addEventListener('click', () => {
      if (em.selectedUnits.some(u => u.faction !== 'player')) return;
      const ok = em.assignControlGroup(Number(el.dataset.groupAssign));
      this.showCommandFeedback(ok ? `Group ${el.dataset.groupAssign} assigned` : 'Select friendly units first');
    }));
    document.querySelectorAll('[data-group-recall]').forEach(el => el.addEventListener('click', () => {
      const ok = em.selectControlGroup(Number(el.dataset.groupRecall));
      this.showCommandFeedback(ok ? `Group ${el.dataset.groupRecall} selected` : 'Group is empty');
      this.closeTouchPanels();
    }));
  }

  armTouchMode(mode) {
    if (this.ctx.paused) { this.showCommandFeedback('Resume to give orders'); return; }
    const em = this.ctx.entityManager;
    if (mode === 'airstrike' && !isPlayerRadarOperational(this.ctx)) return;
    if (mode === 'rally' && (!em.selectedBuilding || !em.selectedBuilding.isProducer || em.selectedBuilding.faction !== 'player')) {
      this.showCommandFeedback('Select your Barracks or War Factory first'); return;
    }
    if (['attackmove', 'escort'].includes(mode) && !em.selectedUnits.some(u => u.faction === 'player')) {
      this.showCommandFeedback('Select your units first'); return;
    }
    this.ctx.inputManager.cancelBuildingPlacement();
    this.ctx.inputManager.selectArea = false;
    this.ctx.inputManager.setCommandMode(mode);
    this.closeTouchPanels();
    this.showCommandFeedback(`Tap a target: ${mode}`);
  }

  closeTouchPanels() {
    this.touchPanel = null;
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('drawer-open', 'map-only');
    const more = document.getElementById('mobile-more');
    if (more) more.hidden = true;
    ['btn-build', 'btn-map', 'btn-more'].forEach(id => {
      const el = document.getElementById(id); if (el) el.setAttribute('aria-expanded', 'false');
    });
    this.hideBuildTooltip();
  }

  toggleTouchPanel(panel) {
    const previous = this.touchPanel;
    this.closeTouchPanels();
    if (previous === panel) return;
    this.touchPanel = panel;
    const button = document.getElementById(`btn-${panel}`);
    if (button) button.setAttribute('aria-expanded', 'true');
    if (panel === 'more') document.getElementById('mobile-more').hidden = false;
    else {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.add('drawer-open');
      sidebar.classList.toggle('map-only', panel === 'map');
    }
  }

  showCommandFeedback(label) {
    const el = document.getElementById('command-feedback');
    if (!el) return;
    el.textContent = label;
    clearTimeout(this.feedbackTimeout);
    this.feedbackTimeout = setTimeout(() => { el.textContent = ''; }, 2200);
  }

  confirmSell(building) {
    if (this.ctx.paused) return;
    this.sellTarget = building;
    this.ctx.renderer.exitPlayLock();
    const modal = document.getElementById('modal-sell');
    if (!modal) return;
    document.getElementById('sell-description').textContent = `Sell ${building.spec.name} for $${Math.floor(building.spec.cost * 0.5)}?`;
    modal.classList.remove('hidden');
  }

  cancelSell() {
    this.sellTarget = null;
    const modal = document.getElementById('modal-sell');
    if (modal) modal.classList.add('hidden');
  }

  updateSessionControls() {
    const pause = document.getElementById('btn-pause');
    if (pause) pause.textContent = this.ctx.paused ? 'Resume' : 'Pause';
    const speed = document.getElementById('btn-speed');
    if (speed) speed.textContent = this.ctx.simulationSpeed === 0.5 ? '0.5×' : '1×';
    const power = document.getElementById('mobile-power');
    if (power) {
      const stats = this.ctx.economy.getPowerStats('player');
      power.textContent = `PWR ${stats.produced}/${stats.consumed}`;
      power.classList.toggle('deficit', stats.isDeficit);
    }
    const im = this.ctx.inputManager;
    const area = document.getElementById('btn-select-area');
    if (area) area.setAttribute('aria-pressed', String(im.selectArea));
    const controls = document.getElementById('placement-controls');
    if (controls) {
      const placing = !!im.placementBuildingType;
      controls.hidden = !(placing || im.commandMode !== 'normal' || im.selectArea);
      const place = document.getElementById('btn-place');
      place.hidden = !placing;
      place.disabled = this.ctx.paused || !im.canPlaceCurrentGhost;
      document.getElementById('placement-help').textContent = this.ctx.paused ? 'Paused — Resume to give orders'
        : placing ? (!im.ghostMesh.visible ? 'Tap ground to preview' : im.canPlaceCurrentGhost ? 'Ready — Place to confirm' : 'Blocked or too far from base')
        : im.selectArea ? 'Drag to select units' : `Tap target: ${im.commandMode}`;
    }
    const airstrike = document.getElementById('btn-touch-airstrike');
    if (airstrike) airstrike.disabled = this.ctx.paused || !isPlayerRadarOperational(this.ctx);
    if (this.sellTarget && (!this.sellTarget.isAlive || this.ctx.paused)) this.cancelSell();
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
        if (this.ctx.paused) return;
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
      if (this.ctx.updateOrientation) this.ctx.updateOrientation();
      if (this.ctx.renderer && this.ctx.renderer.setPlayCapture) this.ctx.renderer.setPlayCapture(true);
    });

    // Victory — Continue to next mission
    const victoryContinue = document.getElementById('btn-victory-continue');
    if (victoryContinue) victoryContinue.addEventListener('click', () => {
      this.modalVictory.classList.add('hidden');
      const nextMission = (this.ctx.missionManager.currentMissionIndex + 1) % 3;
      this.ctx.missionManager.loadMission(nextMission);
      this.refreshBuildCards();
      this.ctx.missionActive = true;
      if (this.ctx.updateOrientation) this.ctx.updateOrientation();
      if (this.ctx.renderer && this.ctx.renderer.setPlayCapture) this.ctx.renderer.setPlayCapture(true);
    });

    // Defeat — Retry same mission
    const defeatRetry = document.getElementById('btn-defeat-retry');
    if (defeatRetry) defeatRetry.addEventListener('click', () => {
      this.modalDefeat.classList.add('hidden');
      this.ctx.missionManager.loadMission(this.ctx.missionManager.currentMissionIndex);
      this.refreshBuildCards();
      this.ctx.missionActive = true;
      if (this.ctx.updateOrientation) this.ctx.updateOrientation();
      if (this.ctx.renderer && this.ctx.renderer.setPlayCapture) this.ctx.renderer.setPlayCapture(true);
    });
  }

  update(delta) {
    this.updateSessionControls();
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
    const radarReady = isPlayerRadarOperational(this.ctx);
    if (this.btnAirstrike) {
      this.btnAirstrike.disabled = !radarReady;
      this.btnAirstrike.title = radarReady ? 'Order an airstrike' : 'Requires a complete, powered Radar Facility';
      if (!radarReady && this.ctx.inputManager && this.ctx.inputManager.commandMode === 'airstrike') {
        this.ctx.inputManager.setCommandMode('normal');
      }
    }

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
    this.hideBuildTooltip();
    this.buildGridEl.innerHTML = '';
    const { entityManager } = this.ctx;

    const categoryOrder = {
      structures: ['power_plant', 'ore_refinery', 'barracks', 'war_factory', 'radar_facility', 'energy_storage'],
      defenses: ['turret_gun', 'turret_rocket', 'turret_laser', 'wall'],
      infantry: ['machine_gunner', 'grenadier', 'rocket_launcher', 'engineer'],
      vehicles: ['light_tracks', '4x4_gunner', 'battle_tank', 'harvester', 'laser_colossus', 'helicopter']
    };
    const buildingTypes = new Set(categoryOrder.structures.concat(categoryOrder.defenses));
    const items = (categoryOrder[this.activeTab] || []).map((type) => ({
      type,
      isBuilding: buildingTypes.has(type),
      spec: buildingTypes.has(type) ? BUILDING_SPECS[type] : UNIT_SPECS[type]
    })).filter((item) => item.spec);

    const playerBuildings = entityManager.getPlayerBuildings();
    const credits = this.ctx.economy ? this.ctx.economy.credits.player : 0;

    items.forEach(item => {
      const spec = item.spec;
      const cost = spec.cost;

      const card = document.createElement('div');
      card.className = 'build-card';
      card.dataset.type = item.type;
      card.dataset.isBuilding = item.isBuilding;
      card.dataset.cost = String(cost);
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `${spec.name}, $${cost}`);
      card.setAttribute('aria-describedby', 'build-tooltip');
      card._buildItem = item;

      const isUnlocked = TechTree.isUnlocked(item.type, playerBuildings);
      if (!isUnlocked) {
        card.classList.add('locked');
      } else if (credits < cost) {
        card.classList.add('unaffordable');
      }
      card.setAttribute('aria-disabled', String(!isUnlocked || credits < cost));

      card.innerHTML = `
        <div class="queue-badge" id="queue-${item.type}">0</div>
        <div class="build-card-icon"></div>
        <div class="build-card-name">${spec.name}</div>
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
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          this.onBuildCardClicked(item);
        }
      });
      card.addEventListener('mouseenter', (e) => this.showBuildTooltip(item, e.clientX, e.clientY));
      card.addEventListener('mousemove', (e) => this.showBuildTooltip(item, e.clientX, e.clientY));
      card.addEventListener('mouseleave', () => this.hideBuildTooltip());
      card.addEventListener('focus', () => {
        const rect = card.getBoundingClientRect ? card.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
        this.showBuildTooltip(item, rect.left + rect.width / 2, rect.top + rect.height);
      });
      card.addEventListener('blur', () => this.hideBuildTooltip());
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.onBuildCardCancel(item);
      });
      const actions = document.createElement('div');
      actions.className = 'touch-only build-card-actions';
      const info = document.createElement('button');
      info.textContent = 'Info';
      info.setAttribute('aria-label', `Information about ${spec.name}`);
      const details = document.createElement('div');
      details.className = 'build-details';
      details.hidden = true;
      info.addEventListener('click', (e) => {
        e.stopPropagation();
        const requirements = TechTree.REQUIREMENTS[item.type] || [];
        const missing = requirements.filter(t => !TechTree.hasBuilding(this.ctx.entityManager.getPlayerBuildings(), t));
        details.textContent = `${spec.name}: $${spec.cost}. ${spec.buildTime || 0}s. `
          + (missing.length ? `Requires completed ${missing.map(t => BUILDING_SPECS[t].name).join(' + ')}. ` : '')
          + (!this.ctx.economy.canAfford('player', spec.cost) ? 'Insufficient funds. ' : '')
          + (spec.powerProduced ? `Produces ${spec.powerProduced} MW. ` : '')
          + (spec.powerConsumed ? `Uses ${spec.powerConsumed} MW. ` : '')
          + (item.isBuilding ? 'Tap the card to preview placement.' : 'Tap the card to train one unit.');
        details.hidden = !details.hidden;
        info.setAttribute('aria-expanded', String(!details.hidden));
      });
      actions.appendChild(info);
      if (!item.isBuilding) {
        const cancel = document.createElement('button');
        cancel.textContent = 'Cancel one';
        cancel.setAttribute('aria-label', `Cancel one ${spec.name}`);
        cancel.addEventListener('click', (e) => { e.stopPropagation(); this.onBuildCardCancel(item); });
        actions.appendChild(cancel);
      }
      const itemEl = document.createElement('div');
      itemEl.className = 'build-item';
      itemEl.appendChild(card);
      itemEl.appendChild(actions);
      itemEl.appendChild(details);
      this.buildGridEl.appendChild(itemEl);
    });
  }

  showBuildTooltip(item, clientX, clientY) {
    if (!this.tooltipEl || !item || !item.spec) return;
    const spec = item.spec;
    const requirements = (TechTree.REQUIREMENTS && TechTree.REQUIREMENTS[item.type]) || [];
    const buildings = this.ctx.entityManager && this.ctx.entityManager.getPlayerBuildings
      ? this.ctx.entityManager.getPlayerBuildings() : [];
    const missing = requirements.filter((type) => !TechTree.hasBuilding(buildings, type));
    const affordable = !this.ctx.economy || !this.ctx.economy.canAfford
      || this.ctx.economy.canAfford('player', spec.cost);
    const title = document.getElementById('tooltip-title');
    const desc = document.getElementById('tooltip-desc');
    const stats = document.getElementById('tooltip-stats');
    if (title) title.textContent = spec.name;
    if (desc) {
      if (missing.length) {
        const missingNames = missing.map((type) => {
          const reqSpec = BUILDING_SPECS[type] || UNIT_SPECS[type];
          return reqSpec ? reqSpec.name : type;
        });
        desc.textContent = `Locked: requires ${missingNames.join(' + ')}.`;
      } else if (!affordable) {
        desc.textContent = `Insufficient funds: need $${spec.cost}.`;
      } else {
        desc.textContent = item.isBuilding ? 'Available from the current command network.' : 'Ready for production when its facility is operational.';
      }
    }
    const detail = [];
    detail.push(`Cost: $${spec.cost}`);
    if (spec.buildTime) detail.push(`${item.isBuilding ? 'Build' : 'Train'}: ${spec.buildTime}s`);
    if (spec.powerProduced) detail.push(`Power: +${spec.powerProduced}MW`);
    if (spec.powerConsumed) detail.push(`Power: -${spec.powerConsumed}MW`);
    if (stats) stats.textContent = detail.join(' | ');
    this.tooltipEl.style.display = 'block';
    const pad = 12;
    const rect = this.tooltipEl.getBoundingClientRect ? this.tooltipEl.getBoundingClientRect() : { width: 240, height: 70 };
    const maxX = Math.max(pad, (window.innerWidth || 1024) - rect.width - pad);
    const maxY = Math.max(pad, (window.innerHeight || 768) - rect.height - pad);
    this.tooltipEl.style.left = `${Math.min(maxX, Math.max(pad, (clientX || 0) + 14))}px`;
    this.tooltipEl.style.top = `${Math.min(maxY, Math.max(pad, (clientY || 0) + 14))}px`;
  }

  hideBuildTooltip() {
    if (this.tooltipEl) this.tooltipEl.style.display = 'none';
  }

  onBuildCardClicked(item) {
    if (this.ctx.paused) { this.showCommandFeedback("Resume to build or train"); return; }
    const playerBuildings = this.ctx.entityManager.getPlayerBuildings();
    const isUnlocked = TechTree.isUnlocked(item.type, playerBuildings);
    if (!isUnlocked) {
      if (this.ctx.soundFX) this.ctx.soundFX.playAlert();
      return;
    }

    const { economy, inputManager, entityManager, soundFX } = this.ctx;

    if (item.isBuilding) {
      // Direct placement mode for structures
      if (economy.canAfford('player', item.spec.cost)) {
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
    if (this.ctx.paused) return;
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
      card.setAttribute('aria-disabled', String(!unlocked || !economy.canAfford('player', cost)));

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
    const em = this.ctx.entityManager;
    if (this.ctx.inputManager && [...em.selectedUnits, em.selectedBuilding].some(e => e && !this.ctx.inputManager.isEntityVisible(e))) em.clearSelection();
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
      const cargoLine = primary.type === 'harvester'
        ? `<span>CARGO: ${Math.floor(primary.cargo || 0)}/${primary.maxCargo || 500}</span>`
        : `<span>ATK: ${Math.round(primary.damage)}</span><span>RNG: ${primary.attackRange}</span>`;
      statsEl.innerHTML = `
        <span>HP: ${Math.floor(totalHp)}/${totalMax}</span>
        ${cargoLine}
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
    if (this.ctx.pause) this.ctx.pause();
    this.cancelSell();
    this.modalMission.classList.remove('hidden');
    this.modalMission.style.display = 'flex';
  }

  hideMissionModal() {
    this.modalMission.classList.add('hidden');
    this.modalMission.style.display = 'none';
  }

  showVictoryModal() {
    this.cancelSell();
    this.closeTouchPanels();
    this.modalVictory.classList.remove('hidden');
    this.modalVictory.style.display = 'flex';
  }

  showDefeatModal() {
    this.cancelSell();
    this.closeTouchPanels();
    this.modalDefeat.classList.remove('hidden');
    this.modalDefeat.style.display = 'flex';
  }
}
