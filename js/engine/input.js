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

    // Command Mode: 'normal', 'repair', 'sell', 'airstrike'
    this.commandMode = 'normal';

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
          0.1,
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
  }

  onMouseUp(e) {
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
        this.handleSingleClickSelection(pt.x, pt.y, worldPos);
      }

      this.isBoxSelecting = false;

      if (this.ctx.missionActive && r && r.lockEnabled && !r.pointerLocked) {
        r.seedVirtualCursor(pt.x, pt.y);
        r.requestPlayLock();
      }
    }
  }

  handleSingleClickSelection(screenX, screenY, worldPos) {
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

    // Reset special command modes
    if (this.commandMode !== 'normal') {
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

    // Check if right-clicking friendly Refinery (Deposit order for Harvesters)
    const friendlyRefinery = this.getEntityAt(worldPos.x, worldPos.z, 'player');

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
        if (soundFX) soundFX.playOrder();
        return;
      }

      // ATTACK ORDER
      entityManager.selectedUnits.forEach(u => {
        u.attackTarget(enemyTarget, pathfinding);
      });
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
      if (soundFX) soundFX.playOrder();
    } else if (friendlyRefinery && friendlyRefinery.type === 'ore_refinery') {
      // RETURN WITH CARGO
      entityManager.selectedUnits.forEach(u => {
        if (u.type === 'harvester') {
          u.returnToRefinery(this.ctx);
        }
      });
      if (soundFX) soundFX.playOrder();
    } else {
      // MOVE ORDER
      entityManager.selectedUnits.forEach(u => {
        u.moveTo(worldPos.x, worldPos.z, pathfinding);
      });
      if (soundFX) soundFX.playOrder();

      // Notify mission manager that player moved units (advances tutorial!)
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

  // --- Building Placement Mode ---

  startBuildingPlacement(buildingType) {
    this.placementBuildingType = buildingType;
    const spec = BUILDING_SPECS[buildingType];
    if (!spec) return;

    // Create ghost mesh
    if (this.ghostMesh) {
      this.ctx.renderer.scene.remove(this.ghostMesh);
    }

    const geo = new THREE.BoxGeometry(
      spec.footprint.w * this.ctx.terrain.tileSize,
      1.5,
      spec.footprint.h * this.ctx.terrain.tileSize
    );
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      transparent: true,
      opacity: 0.55,
      wireframe: true
    });

    this.ghostMesh = new THREE.Mesh(geo, mat);
    this.ctx.renderer.scene.add(this.ghostMesh);
    if (this.ctx.soundFX) this.ctx.soundFX.playClick();
  }

  updateGhostColor(isValid) {
    if (!this.ghostMesh) return;
    this.ghostMesh.material.color.setHex(isValid ? 0x00ff66 : 0xff2222);
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
      this.ctx.renderer.scene.remove(this.ghostMesh);
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

    if (window.hud) window.hud.updateModeButtons(mode);
  }

  executeAirstrikeAtMouse(clientX, clientY) {
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
        u.waypoints = [];
        u.targetEntity = null;
      });
      if (this.ctx.soundFX) this.ctx.soundFX.playOrder();
    }

    // 'Escape' Cancel Placement / Selection (browser also releases pointer lock)
    if (key === 'escape') {
      this.cancelBuildingPlacement();
      this.setCommandMode('normal');
      this.ctx.entityManager.clearSelection();
      if (this.ctx.renderer) this.ctx.renderer.syncCursorHud();
    }
  }
}
