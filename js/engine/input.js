// ==========================================================================
// Command & Conquer RTS - Input Handling (Box Select, Orders, Building Placement)
// ==========================================================================

class InputManager {
  constructor(gameContext) {
    this.ctx = gameContext;
    this.canvas = gameContext.renderer && gameContext.renderer.canvas;
    this.selectionBoxEl = document.getElementById('selection-box');

    this.isLeftMouseDown = false;
    this.dragStartScreen = { x: 0, y: 0 };
    this.dragStartWorld = null;
    this.isBoxSelecting = false;

    // Building Placement Ghost
    this.placementBuildingType = null;
    this.ghostMesh = null;
    this.ghostGridPos = { gx: 0, gz: 0 };
    this.canPlaceCurrentGhost = false;

    // Command Mode: 'normal', 'repair', 'sell', 'airstrike', 'attackmove'
    this.commandMode = 'normal';
    this.orderCursor = 'select';
    this.lastClickAt = 0;
    this.lastClickUnitType = null;

    this.movePips = [];
    this.attackBracket = null;
    this._radarDrag = false;

    this.initListeners();
  }

  initListeners() {
    window.addEventListener('mousedown', (e) => {
      if (e.button === 1) e.preventDefault();
      this.onMouseDown(e);
    });
    window.addEventListener('contextmenu', (e) => {
      if (this.ctx.missionActive) e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onMouseUp(e));
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
  }

  getPointer(e) {
    if (this.ctx.renderer && this.ctx.renderer.getPointerClient) {
      return this.ctx.renderer.getPointerClient(e);
    }
    return { x: e.clientX, y: e.clientY };
  }

  isHudTarget(el) {
    if (!el || !el.closest) return false;
    return !!el.closest('#sidebar, #top-tactical-bar, #selection-card, #mission-objective-bar, .modal-overlay, #pointer-lock-hint, button, .build-card, .build-tab, .cmd-mode-btn');
  }

  hitUiAt(x, y) {
    if (!document.elementFromPoint) return null;
    const el = document.elementFromPoint(x, y);
    if (this.isHudTarget(el)) return el;
    return null;
  }

  onMouseDown(e) {
    if (e._cncVirtual) return;
    if (e.button === 2) {
      e.preventDefault();
      this.onRightClick(e);
      return;
    }
    if (e.button === 0) { // Left Click
      const r = this.ctx.renderer;
      if (r && !r.pointerLocked && typeof e.clientX === 'number') {
        r.seedVirtualCursor(e.clientX, e.clientY);
      }
      const pt = this.getPointer(e);
      if (r && r.pointerLocked) {
        const ui = this.hitUiAt(pt.x, pt.y);
        if (ui) {
          const radar = ui.closest ? ui.closest('#radar-container, #minimap-canvas') : null;
          if (radar && this.ctx.minimap && typeof this.ctx.minimap.panFromClient === 'function') {
            this._radarDrag = true;
            this.ctx.minimap.panFromClient(pt.x, pt.y);
            return;
          }
          const clickable = ui.closest('button, .build-card, .build-tab, .cmd-mode-btn, .stance-btn, .action-btn, .team-card, .mission-card, .diff-btn, .badge-btn');
          if (clickable && clickable.click) {
            clickable.click();
            return;
          }
          const mapped = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            view: window,
            clientX: pt.x,
            clientY: pt.y,
            button: e.button
          });
          mapped._cncVirtual = true;
          ui.dispatchEvent(mapped);
          return;
        }
      } else if (this.isHudTarget(e.target)) {
        return;
      }

      if (this.placementBuildingType) {
        // Place building if valid
        this.confirmBuildingPlacement();
        return;
      }

      if (this.commandMode === 'airstrike') {
        this.executeAirstrikeAtMouse(pt.x, pt.y);
        return;
      }

      const worldPos = this.ctx.renderer.getGroundIntersection(pt.x, pt.y);
      if (!worldPos) return;

      this.isLeftMouseDown = true;
      this.dragStartScreen = { x: pt.x, y: pt.y };
      this.dragStartWorld = worldPos;
      this.isBoxSelecting = false;
    }
  }

  onMouseMove(e) {
    const pt = this.getPointer(e);
    // Native hover follows the locked element, so hit-test the virtual cursor.
    if (this.ctx.renderer.pointerLocked && this.ctx.hud) {
      const ui = this.hitUiAt(pt.x, pt.y);
      const card = ui && ui.closest ? ui.closest('.build-card') : null;
      if (card && card._buildItem && !this.placementBuildingType && !this.isLeftMouseDown) {
        this.ctx.hud.showBuildTooltip(card._buildItem, pt.x, pt.y);
      } else {
        this.ctx.hud.hideBuildTooltip();
      }
    }
    if (this._radarDrag && this.ctx.minimap && typeof this.ctx.minimap.panFromClient === 'function') {
      this.ctx.minimap.panFromClient(pt.x, pt.y);
      return;
    }
    // 1. Update Ghost Mesh during Building Placement
    if (this.placementBuildingType && this.ghostMesh) {
      const worldPos = this.ctx.renderer.getGroundIntersection(pt.x, pt.y);
      if (worldPos) {
        const spec = BUILDING_SPECS[this.placementBuildingType];
        const gridPos = this.ctx.terrain.worldToGrid(worldPos.x, worldPos.z);
        this.ghostGridPos = gridPos;

        const worldW = spec.footprint.w * this.ctx.terrain.tileSize;
        const worldH = spec.footprint.h * this.ctx.terrain.tileSize;
        this.ghostMesh.position.set(
          gridPos.gx * this.ctx.terrain.tileSize + worldW / 2,
          0,
          gridPos.gz * this.ctx.terrain.tileSize + worldH / 2
        );

        // Check if placement is valid
        this.canPlaceCurrentGhost = this.checkPlacementValidity(gridPos.gx, gridPos.gz, spec.footprint);
        this.updateGhostColor(this.canPlaceCurrentGhost);
      }
      return;
    }

    // 2. Drag Selection Box
    if (this.isLeftMouseDown) {
      const dx = Math.abs(pt.x - this.dragStartScreen.x);
      const dy = Math.abs(pt.y - this.dragStartScreen.y);

      if (dx > 5 || dy > 5) {
        this.isBoxSelecting = true;
        this.selectionBoxEl.style.display = 'block';
        const left = Math.min(pt.x, this.dragStartScreen.x);
        const top = Math.min(pt.y, this.dragStartScreen.y);
        const width = Math.abs(pt.x - this.dragStartScreen.x);
        const height = Math.abs(pt.y - this.dragStartScreen.y);

        this.selectionBoxEl.style.left = `${left}px`;
        this.selectionBoxEl.style.top = `${top}px`;
        this.selectionBoxEl.style.width = `${width}px`;
        this.selectionBoxEl.style.height = `${height}px`;
      }
    }

    if (!this.placementBuildingType && !this.isBoxSelecting) {
      this.refreshOrderCursor(pt);
    }
  }

  onMouseUp(e) {
    if (e.button === 0) this._radarDrag = false;
    if (e.button === 0 && this.isLeftMouseDown) {
      this.isLeftMouseDown = false;
      if (this.selectionBoxEl) this.selectionBoxEl.style.display = 'none';

      const r = this.ctx.renderer;
      if (r && !r.pointerLocked && typeof e.clientX === 'number') {
        r.seedVirtualCursor(e.clientX, e.clientY);
      }
      const pt = this.getPointer(e);
      const worldPos = r.getGroundIntersection(pt.x, pt.y);

      if (this.isBoxSelecting && this.dragStartWorld && worldPos) {
        // Multi-Unit Selection inside Box
        this.ctx.entityManager.selectUnitsInBox(
          this.dragStartWorld.x,
          this.dragStartWorld.z,
          worldPos.x,
          worldPos.z,
          'player'
        );
        if (this.ctx.soundFX && this.ctx.entityManager.selectedUnits.length > 0) {
          this.ctx.soundFX.playSelect();
        }
      } else if (worldPos) {
        // Single Click Selection
        this.handleSingleClickSelection(pt.x, pt.y, worldPos, e);
      }

      this.isBoxSelecting = false;

      if (this.ctx.missionActive && r && r.lockEnabled && !r.pointerLocked) {
        r.seedVirtualCursor(pt.x, pt.y);
        r.requestPlayLock();
      }
    }
  }

  handleSingleClickSelection(screenX, screenY, worldPos, ev) {
    const { entityManager, soundFX } = this.ctx;

    // Check clicked entity
    let clickedEntity = null;
    let minDist = 2.4;

    // Check units
    for (const u of entityManager.units) {
      if (!u.isAlive) continue;
      const d = Math.hypot(u.position.x - worldPos.x, u.position.z - worldPos.z);
      if (d < (u.isVehicle ? 3.0 : 1.8) && d < minDist) {
        minDist = d;
        clickedEntity = u;
      }
    }

    // Check buildings if no unit clicked
    if (!clickedEntity) {
      for (const b of entityManager.buildings) {
        if (!b.isAlive) continue;
        const halfW = (b.footprint.w * this.ctx.terrain.tileSize) / 2;
        const halfH = (b.footprint.h * this.ctx.terrain.tileSize) / 2;
        if (Math.abs(b.position.x - worldPos.x) <= halfW &&
            Math.abs(b.position.z - worldPos.z) <= halfH) {
          clickedEntity = b;
          break;
        }
      }
    }

    // Handle Repair or Sell Mode clicks
    if (this.commandMode === 'repair' && clickedEntity && clickedEntity instanceof Building && clickedEntity.faction === 'player') {
      clickedEntity.isRepairing = !clickedEntity.isRepairing;
      if (soundFX) soundFX.playOrder();
      return;
    }

    if (this.commandMode === 'sell' && clickedEntity && clickedEntity instanceof Building && clickedEntity.faction === 'player') {
      const refund = Math.floor(clickedEntity.spec.cost * 0.5);
      this.ctx.economy.addCredits('player', refund);
      clickedEntity.takeDamage(99999);
      if (soundFX) soundFX.playExplosion(false);
      this.setCommandMode('normal');
      return;
    }

    if (this.commandMode === 'attackmove' && worldPos) {
      if (typeof entityManager.issueMoveOrders === 'function') {
        entityManager.issueMoveOrders(entityManager.selectedUnits, worldPos.x, worldPos.z, this.ctx.pathfinding, { attackMove: true });
      } else {
        entityManager.selectedUnits.forEach((u) => {
          if (typeof u.attackMoveTo === 'function') u.attackMoveTo(worldPos.x, worldPos.z, this.ctx.pathfinding);
          else u.moveTo(worldPos.x, worldPos.z, this.ctx.pathfinding);
        });
      }
      this.spawnGroundPip(worldPos.x, worldPos.z, 0xff5555, 0.7);
      if (soundFX) soundFX.playOrder();
      this.setCommandMode('normal');
      return;
    }

    const now = Date.now();
    const isDouble = clickedEntity instanceof Unit && clickedEntity.type === this.lastClickUnitType && (now - this.lastClickAt) < 350;
    this.lastClickAt = now;
    this.lastClickUnitType = clickedEntity instanceof Unit ? clickedEntity.type : null;

    if (isDouble && clickedEntity.faction === 'player') {
      entityManager.selectAllOfType(clickedEntity.type, 'player');
      if (soundFX) soundFX.playSelect();
      return;
    }

    if (ev && ev.shiftKey && clickedEntity instanceof Unit && clickedEntity.faction === 'player') {
      entityManager.toggleSelectUnit(clickedEntity);
      if (soundFX) soundFX.playSelect();
      return;
    }

    entityManager.selectSingle(clickedEntity);
    if (clickedEntity && soundFX) {
      soundFX.playSelect();
    }
  }

  onRightClick(e) {
    if (e._cncVirtual) return;
    const { entityManager, pathfinding, terrain, soundFX, missionManager } = this.ctx;
    const r = this.ctx.renderer;
    if (r && !r.pointerLocked && typeof e.clientX === 'number') {
      r.seedVirtualCursor(e.clientX, e.clientY);
    }
    const pt0 = this.getPointer(e);
    if (r && r.pointerLocked) {
      if (this.hitUiAt(pt0.x, pt0.y)) return;
    } else if (this.isHudTarget(e.target)) {
      return;
    }

    // Cancel building placement if active
    if (this.placementBuildingType) {
      this.cancelBuildingPlacement();
      return;
    }

    // Reset special command modes (attack-move consumes the click as an order)
    if (this.commandMode !== 'normal' && this.commandMode !== 'attackmove') {
      this.setCommandMode('normal');
      return;
    }

    if (entityManager.selectedUnits.length === 0 && !entityManager.selectedBuilding) return;

    const pt = this.getPointer(e);
    const worldPos = this.ctx.renderer.getGroundIntersection(pt.x, pt.y);
    if (!worldPos) return;

    // Check if right-clicking an enemy entity (Attack order)
    const enemyTarget = this.getEntityAt(worldPos.x, worldPos.z, 'enemy');

    // Check if right-clicking an ore node (Harvest order for Harvesters)
    const oreDeposit = terrain.getClosestOreDeposit(worldPos.x, worldPos.z);
    const isClickingOre = oreDeposit && Math.hypot(oreDeposit.x - worldPos.x, oreDeposit.z - worldPos.z) <= oreDeposit.radius + 1.5;

    const hasHarvester = entityManager.selectedUnits.some((u) => u.type === 'harvester');
    const clickedRefinery = this.findFriendlyRefineryNear(worldPos.x, worldPos.z);

    if (enemyTarget) {
      // Check if any selected unit is an Engineer capturing an enemy building
      const hasEngineer = entityManager.selectedUnits.some(u => u.type === 'engineer');
      if (hasEngineer && enemyTarget instanceof Building) {
        entityManager.selectedUnits.forEach(u => {
          if (u.type === 'engineer') {
            u.captureBuilding(enemyTarget, pathfinding);
          } else {
            u.attackTarget(enemyTarget, pathfinding);
          }
        });
        this.spawnGroundPip(worldPos.x, worldPos.z, 0x00e5ff, 0.7);
        if (soundFX) soundFX.playOrder();
        return;
      }

      // ATTACK ORDER
      entityManager.selectedUnits.forEach(u => {
        u.attackTarget(enemyTarget, pathfinding);
      });
      this.showAttackBracket(enemyTarget);
      if (soundFX) soundFX.playOrder();
    } else if (isClickingOre) {
      // HARVEST ORDER
      entityManager.selectedUnits.forEach(u => {
        if (u.type === 'harvester') {
          u.harvestOre(oreDeposit, pathfinding);
        } else {
          u.moveTo(worldPos.x, worldPos.z, pathfinding);
        }
      });
      this.spawnGroundPip(oreDeposit.x, oreDeposit.z, 0xffaa00, 0.8);
      if (soundFX) soundFX.playOrder();
    } else if (hasHarvester && clickedRefinery) {
      entityManager.selectedUnits.forEach((u) => {
        if (u.type === 'harvester') u.returnToRefinery(this.ctx);
      });
      this.spawnGroundPip(clickedRefinery.position.x, clickedRefinery.position.z, 0xffaa00, 0.8);
      if (soundFX) soundFX.playOrder();
    } else if (entityManager.selectedUnits.length === 0 && entityManager.selectedBuilding && entityManager.selectedBuilding.isProducer && entityManager.selectedBuilding.faction === 'player') {
      entityManager.selectedBuilding.setRally(worldPos.x, worldPos.z);
      entityManager.selectedBuilding.setRallyVisible(true);
      this.spawnGroundPip(worldPos.x, worldPos.z, 0xffd700, 0.75);
      if (soundFX) soundFX.playOrder();
    } else {
      const friendly = this.getEntityAt(worldPos.x, worldPos.z, 'player');
      const wantAttackMove = this.commandMode === 'attackmove' || (e && e.shiftKey);
      if (friendly instanceof Unit && entityManager.selectedUnits.length && !entityManager.selectedUnits.includes(friendly)) {
        entityManager.selectedUnits.forEach((u) => {
          if (typeof u.followUnit === 'function') u.followUnit(friendly);
        });
        if (soundFX) soundFX.playOrder();
      } else if (wantAttackMove) {
        if (typeof entityManager.issueMoveOrders === 'function') {
          entityManager.issueMoveOrders(entityManager.selectedUnits, worldPos.x, worldPos.z, pathfinding, { attackMove: true });
        } else {
          entityManager.selectedUnits.forEach((u) => {
            if (typeof u.attackMoveTo === 'function') u.attackMoveTo(worldPos.x, worldPos.z, pathfinding);
            else u.moveTo(worldPos.x, worldPos.z, pathfinding);
          });
        }
        this.spawnGroundPip(worldPos.x, worldPos.z, 0xff5555, 0.7);
        if (soundFX) soundFX.playOrder();
        if (this.commandMode === 'attackmove') this.setCommandMode('normal');
      } else {
        if (typeof entityManager.issueMoveOrders === 'function') {
          entityManager.issueMoveOrders(entityManager.selectedUnits, worldPos.x, worldPos.z, pathfinding);
        } else {
          entityManager.selectedUnits.forEach((u) => {
            u.moveTo(worldPos.x, worldPos.z, pathfinding);
          });
        }
        this.spawnGroundPip(worldPos.x, worldPos.z, 0x33ff66, 0.65);
        if (soundFX) soundFX.playOrder();
      }

      if (missionManager) {
        missionManager.playerHasMovedUnits = true;
      }
    }
  }

  getEntityAt(wx, wz, faction = null) {
    const { entityManager } = this.ctx;

    for (const u of entityManager.units) {
      if (u.isAlive && (!faction || u.faction === faction)) {
        if (Math.hypot(u.position.x - wx, u.position.z - wz) <= (u.isVehicle ? 3.0 : 1.8)) {
          return u;
        }
      }
    }

    for (const b of entityManager.buildings) {
      if (b.isAlive && (!faction || b.faction === faction)) {
        const halfW = (b.footprint.w * this.ctx.terrain.tileSize) / 2;
        const halfH = (b.footprint.h * this.ctx.terrain.tileSize) / 2;
        if (Math.abs(b.position.x - wx) <= halfW && Math.abs(b.position.z - wz) <= halfH) {
          return b;
        }
      }
    }

    return null;
  }

  findFriendlyRefineryNear(wx, wz) {
    const { entityManager, terrain } = this.ctx;
    if (!entityManager || !terrain) return null;
    const pad = (terrain.tileSize || 2) * 1.35;
    let best = null;
    let bestDist = Infinity;
    for (const b of entityManager.buildings) {
      if (!b.isAlive || b.faction !== 'player' || b.type !== 'ore_refinery') continue;
      const halfW = (b.footprint.w * terrain.tileSize) / 2 + pad;
      const halfH = (b.footprint.h * terrain.tileSize) / 2 + pad;
      if (Math.abs(b.position.x - wx) > halfW || Math.abs(b.position.z - wz) > halfH) continue;
      const d = Math.hypot(b.position.x - wx, b.position.z - wz);
      if (d < bestDist) {
        bestDist = d;
        best = b;
      }
    }
    return best;
  }

  returnSelectedHarvesters() {
    const units = this.ctx.entityManager && this.ctx.entityManager.selectedUnits;
    if (!units || !units.length) return false;
    let sent = 0;
    units.forEach((u) => {
      if (u.type === 'harvester' && typeof u.returnToRefinery === 'function') {
        u.returnToRefinery(this.ctx);
        sent++;
      }
    });
    return sent > 0;
  }

  // --- Building Placement Mode ---

  startBuildingPlacement(buildingType) {
    this.placementBuildingType = buildingType;
    const spec = BUILDING_SPECS[buildingType];
    if (!spec) return;

    if (this.ghostMesh) {
      if (typeof SceneResources !== 'undefined' && SceneResources.removeAndDispose) {
        SceneResources.removeAndDispose(this.ctx.renderer.scene, [this.ghostMesh]);
      } else {
        this.ctx.renderer.scene.remove(this.ghostMesh);
      }
      this.ghostMesh = null;
    }

    const group = new THREE.Group();
    const model = (typeof BuildingModels !== 'undefined' && BuildingModels.create)
      ? BuildingModels.create(buildingType, 'player')
      : new THREE.Mesh(
        new THREE.BoxGeometry(spec.footprint.w * this.ctx.terrain.tileSize, 1.5, spec.footprint.h * this.ctx.terrain.tileSize),
        new THREE.MeshBasicMaterial({ color: 0x00ff66, transparent: true, opacity: 0.5, wireframe: true })
      );
    this.makeGhostHologram(model);
    group.add(model);
    group.add(this.createFootprintGrid(spec.footprint));
    group.userData.buildingRoot = model;

    this.ghostMesh = group;
    this.ctx.renderer.scene.add(this.ghostMesh);
    this.updateGhostColor(true);
    if (this.ctx.soundFX) this.ctx.soundFX.playClick();
  }

  makeGhostHologram(root) {
    root.traverse((obj) => {
      obj.castShadow = false;
      obj.receiveShadow = false;
      if (!obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      const cloned = mats.map((m) => {
        const copy = m.clone();
        copy.transparent = true;
        copy.opacity = 0.48;
        copy.depthWrite = false;
        if (copy.emissive) copy.emissive.setHex(0x145c2e);
        return copy;
      });
      obj.material = cloned.length === 1 ? cloned[0] : cloned;
    });
  }

  createFootprintGrid(footprint) {
    const tile = this.ctx.terrain.tileSize;
    const group = new THREE.Group();
    group.userData.isGrid = true;
    const worldW = footprint.w * tile;
    const worldH = footprint.h * tile;
    for (let dz = 0; dz < footprint.h; dz++) {
      for (let dx = 0; dx < footprint.w; dx++) {
        const geo = new THREE.PlaneGeometry(tile * 0.88, tile * 0.88);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshBasicMaterial({
          color: 0x33ff66,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        const cell = new THREE.Mesh(geo, mat);
        cell.position.set(
          (dx + 0.5) * tile - worldW / 2,
          0.06,
          (dz + 0.5) * tile - worldH / 2
        );
        cell.userData.isGrid = true;
        group.add(cell);
      }
    }
    return group;
  }

  updateGhostColor(isValid) {
    if (!this.ghostMesh) return;
    const hex = isValid ? 0x33ff66 : 0xff3333;
    const emissive = isValid ? 0x145c2e : 0x5c1414;
    this.ghostMesh.traverse((obj) => {
      if (!obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (obj.userData && obj.userData.isGrid) {
          m.color.setHex(hex);
          m.opacity = isValid ? 0.32 : 0.48;
        } else {
          if (m.emissive) m.emissive.setHex(emissive);
          m.opacity = 0.48;
        }
      });
    });
  }

  checkPlacementValidity(gx, gz, footprint) {
    const { terrain, entityManager } = this.ctx;

    // Check bounds and collision
    for (let dz = 0; dz < footprint.h; dz++) {
      for (let dx = 0; dx < footprint.w; dx++) {
        const nx = gx + dx;
        const nz = gz + dz;
        if (nx < 2 || nx >= terrain.width - 2 || nz < 2 || nz >= terrain.height - 2) return false;
        if (terrain.grid[nz * terrain.width + nx] !== 0) return false;
      }
    }

    // Must be within reasonable construction distance of existing player buildings
    const pBuildings = entityManager.getPlayerBuildings();
    if (pBuildings.length === 0) return true;

    const buildCenterX = (gx + footprint.w / 2) * terrain.tileSize;
    const buildCenterZ = (gz + footprint.h / 2) * terrain.tileSize;

    let nearBase = false;
    for (const b of pBuildings) {
      const dist = Math.hypot(b.position.x - buildCenterX, b.position.z - buildCenterZ);
      if (dist < 32) { // 32 world units build radius
        nearBase = true;
        break;
      }
    }

    return nearBase;
  }

  confirmBuildingPlacement() {
    if (!this.canPlaceCurrentGhost) {
      if (this.ctx.soundFX) this.ctx.soundFX.playAlert();
      return;
    }

    const spec = BUILDING_SPECS[this.placementBuildingType];
    if (this.ctx.economy.spendCredits('player', spec.cost)) {
      this.ctx.entityManager.spawnBuilding(
        this.placementBuildingType,
        'player',
        this.ghostGridPos.gx,
        this.ghostGridPos.gz
      );

      if (this.ctx.soundFX) {
        this.ctx.soundFX.playPlaceBuilding();
        this.ctx.soundFX.speak('Building');
      }

      this.cancelBuildingPlacement();
      if (window.hud) window.hud.refreshBuildCards();
    }
  }

  cancelBuildingPlacement() {
    if (this.ghostMesh) {
      if (typeof SceneResources !== 'undefined' && SceneResources.removeAndDispose) {
        SceneResources.removeAndDispose(this.ctx.renderer.scene, [this.ghostMesh]);
      } else {
        this.ctx.renderer.scene.remove(this.ghostMesh);
      }
      this.ghostMesh = null;
    }
    this.placementBuildingType = null;
  }

  // --- Command Modes ---

  setCommandMode(mode) {
    this.commandMode = mode;
    const vp = document.getElementById('viewport');
    if (!vp) return;

    vp.className = '';
    if (mode === 'repair') vp.classList.add('cursor-repair');
    else if (mode === 'sell') vp.classList.add('cursor-sell');
    else if (mode === 'airstrike') vp.classList.add('cursor-attack');
    else if (mode === 'attackmove') vp.classList.add('cursor-attackmove');

    if (window.hud) window.hud.updateModeButtons(mode);
    const r = this.ctx.renderer;
    this.refreshOrderCursor(r ? r.virtualCursor : null);
  }

  refreshOrderCursor(pt) {
    const r = this.ctx.renderer;
    if (!r) return;
    if (this.placementBuildingType) {
      this.applyOrderCursor('place');
      return;
    }
    if (this.commandMode === 'repair') { this.applyOrderCursor('repair'); return; }
    if (this.commandMode === 'sell') { this.applyOrderCursor('sell'); return; }
    if (this.commandMode === 'airstrike') { this.applyOrderCursor('attack'); return; }

    const pointer = pt || this.getPointer({ clientX: r.virtualCursor.x, clientY: r.virtualCursor.y });
    const worldPos = r.getGroundIntersection(pointer.x, pointer.y);
    const kind = this.resolveOrderCursor(worldPos);
    this.applyOrderCursor(kind);
  }

  resolveOrderCursor(worldPos) {
    const { entityManager, terrain } = this.ctx;
    if (!entityManager) return 'select';
    const units = entityManager.selectedUnits;
    if (this.commandMode === 'attackmove' && units.length) return 'attackmove';
    if (!worldPos) return units.length ? 'move' : 'select';

    const enemy = this.getEntityAt(worldPos.x, worldPos.z, 'enemy');
    const friend = this.getEntityAt(worldPos.x, worldPos.z, 'player');
    const ore = terrain && terrain.getClosestOreDeposit
      ? terrain.getClosestOreDeposit(worldPos.x, worldPos.z)
      : null;
    const onOre = ore && Math.hypot(ore.x - worldPos.x, ore.z - worldPos.z) <= (ore.radius || 4) + 1.5;

    if (units.length) {
      const hasHarvester = units.some((u) => u.type === 'harvester');
      const hasEngineer = units.some((u) => u.type === 'engineer');
      const hasCombat = units.some((u) => u.type !== 'harvester' && (u.spec && u.spec.damage > 0));
      if (enemy) {
        if (hasEngineer && enemy instanceof Building) return 'capture';
        if (hasCombat) return 'attack';
      }
      if (hasHarvester && onOre) return 'harvest';
      if (hasHarvester && this.findFriendlyRefineryNear(worldPos.x, worldPos.z)) return 'return';
      if (friend instanceof Unit && !units.includes(friend) && hasCombat) return 'follow';
      return 'move';
    }

    if (entityManager.selectedBuilding && entityManager.selectedBuilding.isProducer && entityManager.selectedBuilding.faction === 'player') {
      return 'rally';
    }
    return 'select';
  }

  applyOrderCursor(kind) {
    this.orderCursor = kind || 'select';
    const vp = document.getElementById('viewport');
    if (vp && this.commandMode === 'normal') {
      vp.classList.remove(
        'cursor-attack', 'cursor-repair', 'cursor-sell', 'cursor-attackmove',
        'cursor-harvest', 'cursor-return', 'cursor-move', 'cursor-follow', 'cursor-rally', 'cursor-capture', 'cursor-select'
      );
      vp.classList.add(`cursor-${this.orderCursor}`);
    }
    if (this.ctx.renderer && this.ctx.renderer.setOrderCursor) {
      this.ctx.renderer.setOrderCursor(this.orderCursor);
    }
  }

  executeAirstrikeAtMouse(clientX, clientY) {
    if (typeof isPlayerRadarOperational === 'function'
      ? !isPlayerRadarOperational(this.ctx)
      : !this.ctx.entityManager.getPlayerBuildings().some((b) => b.type === 'radar_facility' && b.isAlive && !b.isBuilding)) {
      this.setCommandMode('normal');
      if (this.ctx.soundFX) this.ctx.soundFX.playAlert();
      return;
    }
    const worldPos = this.ctx.renderer.getGroundIntersection(clientX, clientY);
    if (!worldPos) return;

    // Spawn a high-speed Harrier Jet from edge of map
    const spawnX = Math.max(10, worldPos.x - 60);
    const spawnZ = worldPos.z;

    const jet = this.ctx.entityManager.spawnUnit('harrier_jet', 'player', spawnX, spawnZ);
    jet.mesh.rotation.y = Math.PI / 2; // Fly east toward target

    if (this.ctx.soundFX) {
      this.ctx.soundFX.speak('Airstrike inbound');
    }

    this.setCommandMode('normal');
  }

  // Hotkeys
  onKeyDown(e) {
    const key = e.key.toLowerCase();
    // Let focused controls consume their own keyboard interaction. This keeps
    // build-card Enter/Space and text controls from also panning or issuing orders.
    if (this.isHudTarget(e.target) && key !== 'escape') return;

    // Numbers 1-9 for Control Groups
    if (key >= '1' && key <= '9') {
      const groupNum = parseInt(key);
      if (e.ctrlKey) {
        this.ctx.entityManager.assignControlGroup(groupNum);
        if (this.ctx.soundFX) this.ctx.soundFX.playClick();
      } else {
        this.ctx.entityManager.selectControlGroup(groupNum);
        if (this.ctx.soundFX) this.ctx.soundFX.playSelect();
      }
      return;
    }

    if (key === '[' || key === ']') {
      if (this.ctx.renderer && typeof this.ctx.renderer.adjustCursorSensitivity === 'function') {
        this.ctx.renderer.adjustCursorSensitivity(key === ']' ? 0.1 : -0.1);
      }
      return;
    }

    // 'R' Return selected harvesters to the nearest refinery
    if (key === 'r') {
      if (this.returnSelectedHarvesters() && this.ctx.soundFX) this.ctx.soundFX.playOrder();
      return;
    }

    // 'H' Focus Home Command Center
    if (key === 'h') {
      const hq = this.ctx.entityManager.getPlayerBuildings().find(b => b.type === 'command_center');
      if (hq) {
        this.ctx.renderer.panTo(hq.position.x, hq.position.z);
        if (this.ctx.soundFX) this.ctx.soundFX.playClick();
      }
    }

    // 'S' Stop Selected Units
    if (key === 's') {
      this.ctx.entityManager.selectedUnits.forEach(u => {
        if (typeof u.becomeIdle === 'function') u.becomeIdle();
        else {
          u.waypoints = [];
          u.targetEntity = null;
        }
      });
      if (this.ctx.soundFX) this.ctx.soundFX.playOrder();
    }

    // 'G' Guard current post
    if (key === 'g') {
      this.ctx.entityManager.selectedUnits.forEach((u) => {
        u.stance = 'guard';
        if (typeof u.becomeIdle === 'function') u.becomeIdle();
      });
      if (this.ctx.soundFX) this.ctx.soundFX.playOrder();
    }

    // 'Escape' Cancel Placement / Selection (browser also releases pointer lock)
    if (key === 'escape') {
      this.cancelBuildingPlacement();
      this.setCommandMode('normal');
      this.ctx.entityManager.clearSelection();
      if (this.attackBracket) this.attackBracket.visible = false;
      if (this.ctx.renderer) this.ctx.renderer.syncCursorHud();
    }
  }

  spawnGroundPip(x, z, color, life) {
    if (!this.ctx.renderer || !this.ctx.renderer.scene) return;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.72, 24),
      new THREE.MeshBasicMaterial({
        color: color || 0x33ff66,
        transparent: true,
        opacity: 0.95,
        side: THREE.DoubleSide,
        depthWrite: false
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.14, z);
    this.ctx.renderer.scene.add(ring);
    this.movePips.push({ mesh: ring, life: life || 0.65, maxLife: life || 0.65 });
  }

  ensureAttackBracket() {
    if (this.attackBracket) return this.attackBracket;
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xff3333, depthTest: false, depthWrite: false });
    const arm = 0.85;
    const thick = 0.09;
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    corners.forEach(([sx, sz]) => {
      const hx = new THREE.Mesh(new THREE.BoxGeometry(arm, thick, thick), mat);
      hx.position.set(sx * 1.05, 0, sz * 1.35);
      const hz = new THREE.Mesh(new THREE.BoxGeometry(thick, thick, arm), mat);
      hz.position.set(sx * 1.35, 0, sz * 1.05);
      g.add(hx, hz);
    });
    g.visible = false;
    this.ctx.renderer.scene.add(g);
    this.attackBracket = g;
    return g;
  }

  showAttackBracket(target) {
    const g = this.ensureAttackBracket();
    if (!target || !target.isAlive) {
      g.visible = false;
      g.userData.target = null;
      return;
    }
    g.userData.target = target;
    g.visible = true;
  }

  update(delta) {
    for (let i = this.movePips.length - 1; i >= 0; i--) {
      const pip = this.movePips[i];
      pip.life -= delta;
      const t = Math.max(0, pip.life / pip.maxLife);
      pip.mesh.scale.setScalar(1 + (1 - t) * 1.4);
      if (pip.mesh.material) pip.mesh.material.opacity = t * 0.95;
      if (pip.life <= 0) {
        if (typeof SceneResources !== 'undefined' && SceneResources.removeAndDispose) {
          SceneResources.removeAndDispose(this.ctx.renderer.scene, [pip.mesh]);
        } else if (pip.mesh.parent) {
          pip.mesh.parent.remove(pip.mesh);
        }
        this.movePips.splice(i, 1);
      }
    }

    const em = this.ctx.entityManager;
    let target = null;
    if (em) {
      for (let i = 0; i < em.selectedUnits.length; i++) {
        const u = em.selectedUnits[i];
        if (u && u.isAlive && u.targetEntity && u.targetEntity.isAlive) {
          target = u.targetEntity;
          break;
        }
      }
    }
    if (target) this.showAttackBracket(target);
    else if (this.attackBracket) {
      const held = this.attackBracket.userData.target;
      if (!held || !held.isAlive) this.attackBracket.visible = false;
    }

    if (this.attackBracket && this.attackBracket.visible) {
      const t = this.attackBracket.userData.target;
      if (t && t.isAlive && t.position) {
        const y = (t.healthBarHeight ? t.healthBarHeight() : 2.4) * 0.45;
        this.attackBracket.position.set(t.position.x, y, t.position.z);
        const pulse = 1 + Math.sin((typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.008) * 0.08;
        const scale = (t.isVehicle || t.footprint) ? 1.45 : 1;
        this.attackBracket.scale.set(scale * pulse, 1, scale * pulse);
      } else {
        this.attackBracket.visible = false;
      }
    }
  }
}
