// ==========================================================================
// Command & Conquer RTS - Entity Manager (Units, Buildings & Spatial Index)
// ==========================================================================

class EntityManager {
  constructor(scene, terrain) {
    this.scene = scene;
    this.terrain = terrain;

    this.units = [];
    this.buildings = [];

    this.selectedUnits = [];
    this.selectedBuilding = null;
    this.controlGroups = {}; // Hotkey groups 1-9
    this.alertX = 0;
    this.alertZ = 0;
    this.alertTime = -999;
  }

  clearAll() {
    this.units.forEach(u => {
      this.scene.remove(u.mesh);
      if (u.healthBar) this.scene.remove(u.healthBar);
      if (u.cargoBar) this.scene.remove(u.cargoBar);
    });
    this.units = [];

    this.buildings.forEach(b => {
      this.scene.remove(b.mesh);
      if (b.scaffold) this.scene.remove(b.scaffold);
      if (b.rallyMarker) this.scene.remove(b.rallyMarker);
      if (b.healthBar) this.scene.remove(b.healthBar);
      b.setTerrainGrid(this.terrain, false);
    });
    this.buildings = [];

    this.selectedUnits = [];
    this.selectedBuilding = null;
    this.controlGroups = {};
  }

  spawnUnit(type, faction, x, z) {
    const unit = new Unit(type, faction, x, z, this.scene);
    this.units.push(unit);
    return unit;
  }

  spawnBuilding(type, faction, gridX, gridZ, options = {}) {
    const building = new Building(type, faction, gridX, gridZ, this.scene, this.terrain, options);
    this.buildings.push(building);

    if (!building.isBuilding) {
      this.grantRefineryHarvester(building);
    }

    return building;
  }

  grantRefineryHarvester(building) {
    if (!building || !building.spec || !building.spec.grantsHarvester) return null;
    if (building.harvesterGranted || building.isBuilding || !building.isAlive) return null;
    building.harvesterGranted = true;
    const spawnPos = building.getDockPosition();
    return this.spawnUnit('harvester', building.faction, spawnPos.x, spawnPos.z + 3);
  }

  update(delta, gameContext) {
    // 1. Update Units
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (!u.isAlive) {
        // Explode on death
        if (gameContext.projectileManager) {
          gameContext.projectileManager.explodeAt(u.position, u.isVehicle, u.isVehicle ? 1.5 : 0.8);
        }
        if (gameContext.soundFX && u.isAudibleToPlayer(gameContext)) {
          gameContext.soundFX.playExplosion(u.isVehicle);
        }
        this.scene.remove(u.mesh);
        if (u.healthBar) this.scene.remove(u.healthBar);
        if (u.cargoBar) this.scene.remove(u.cargoBar);
        this.deselectUnit(u);
        this.units.splice(i, 1);
      } else {
        u.update(delta, gameContext);

        // Hide enemy units under Fog of War
        if (u.faction === 'enemy' && gameContext.fogOfWar) {
          const isSeen = gameContext.fogOfWar.isVisible(u.position.x, u.position.z);
          u.mesh.visible = isSeen;
        } else {
          u.mesh.visible = true;
        }
        if (u.healthBar && !u.mesh.visible) u.healthBar.visible = false;
        if (u.cargoBar && !u.mesh.visible) u.cargoBar.visible = false;
      }
    }

    // 2. Update Buildings
    for (let i = this.buildings.length - 1; i >= 0; i--) {
      const b = this.buildings[i];
      if (!b.isAlive) {
        if (gameContext.projectileManager) {
          gameContext.projectileManager.explodeAt(b.position, true, 2.2);
        }
        if (gameContext.soundFX && b.isAudibleToPlayer(gameContext)) {
          gameContext.soundFX.playExplosion(true);
        }
        b.setTerrainGrid(this.terrain, false);
        this.scene.remove(b.mesh);
        if (b.scaffold) this.scene.remove(b.scaffold);
        if (b.rallyMarker) this.scene.remove(b.rallyMarker);
        if (b.healthBar) this.scene.remove(b.healthBar);
        if (this.selectedBuilding === b) {
          this.selectedBuilding = null;
        }
        this.buildings.splice(i, 1);
      } else {
        b.update(delta, gameContext);

        // Explored vs Visible for buildings
        if (b.faction === 'enemy' && gameContext.fogOfWar) {
          const isExplored = gameContext.fogOfWar.isExplored(b.position.x, b.position.z);
          b.mesh.visible = isExplored;
        } else {
          b.mesh.visible = true;
        }
        if (b.healthBar && !b.mesh.visible) b.healthBar.visible = false;
      }
    }

    // Flocking / Soft collision between units so they don't overlap awkwardly
    this.applyUnitSeparation(delta);
  }

  formationSlots(count, cx, cz, spacing) {
    const slots = [];
    if (count <= 0) return slots;
    if (count === 1) return [{ x: cx, z: cz }];
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const originX = -((cols - 1) * spacing) / 2;
    const originZ = -((rows - 1) * spacing) / 2;
    let n = 0;
    for (let r = 0; r < rows && n < count; r++) {
      for (let c = 0; c < cols && n < count; c++) {
        slots.push({ x: cx + originX + c * spacing, z: cz + originZ + r * spacing });
        n++;
      }
    }
    return slots;
  }

  resolveWalkableSlot(x, z, pathfinding, fallbackX, fallbackZ) {
    if (!this.terrain) return { x, z };
    if (!this.terrain.isBlocked(x, z)) return { x, z };
    if (pathfinding && pathfinding.findNearestWalkableTile) {
      const g = this.terrain.worldToGrid(x, z);
      const alt = pathfinding.findNearestWalkableTile(g.gx, g.gz);
      if (alt) {
        const w = this.terrain.gridToWorld(alt.gx, alt.gz);
        return { x: w.x, z: w.z };
      }
    }
    return { x: fallbackX, z: fallbackZ };
  }

  issueMoveOrders(units, destX, destZ, pathfinding, options) {
    const attackMove = !!(options && options.attackMove);
    const live = (units || []).filter((u) => u && u.isAlive);
    if (!live.length) return;
    const spacing = live.some((u) => u.isVehicle) ? 3.2 : 2.5;
    const slots = this.formationSlots(live.length, destX, destZ, spacing);
    live.forEach((u, i) => {
      const raw = slots[i] || { x: destX, z: destZ };
      const slot = u.isAir ? raw : this.resolveWalkableSlot(raw.x, raw.z, pathfinding, destX, destZ);
      if (attackMove && typeof u.attackMoveTo === 'function') u.attackMoveTo(slot.x, slot.z, pathfinding);
      else u.moveTo(slot.x, slot.z, pathfinding);
    });
  }

  isDockLocked(unit) {
    if (!unit || unit.type !== 'harvester') return false;
    return unit.harvesterState === 'UNLOADING' || unit.harvesterState === 'MINING';
  }

  isUnitMoving(unit) {
    return !!(unit && unit.waypoints && unit.waypoints.length > 0);
  }

  isHoldingSlot(unit) {
    if (!unit || this.isUnitMoving(unit)) return false;
    if (unit.destX == null || unit.destZ == null) return false;
    const d = Math.hypot(unit.position.x - unit.destX, unit.position.z - unit.destZ);
    return d < (unit.isVehicle ? 1.25 : 0.8);
  }

  applySeparationOffset(unit, ox, oz) {
    if (!unit || !unit.isAlive) return;
    unit.position.x += ox;
    unit.position.z += oz;
    if (unit.mesh) {
      unit.mesh.position.x = unit.position.x;
      unit.mesh.position.z = unit.position.z;
      if (typeof unit.applyWalkBob === 'function') unit.applyWalkBob();
    }
  }

  applyUnitSeparation(delta) {
    const count = this.units.length;
    const stepCap = Math.min(0.38, 12 * delta);
    for (let i = 0; i < count; i++) {
      const u1 = this.units[i];
      if (!u1.isAlive || u1.isAir) continue;
      const moving1 = this.isUnitMoving(u1);
      const hold1 = this.isHoldingSlot(u1);
      const lock1 = this.isDockLocked(u1);

      for (let j = i + 1; j < count; j++) {
        const u2 = this.units[j];
        if (!u2.isAlive || u2.isAir) continue;

        const dx = u1.position.x - u2.position.x;
        const dz = u1.position.z - u2.position.z;
        let distSq = dx * dx + dz * dz;
        const rad1 = u1.type === 'harvester' ? 2.55 : (u1.isVehicle ? 2.05 : 1.3);
        const rad2 = u2.type === 'harvester' ? 2.55 : (u2.isVehicle ? 2.05 : 1.3);
        const minDist = rad1 + rad2;
        const minDistSq = minDist * minDist;
        if (distSq >= minDistSq) continue;

        const moving2 = this.isUnitMoving(u2);
        const hold2 = this.isHoldingSlot(u2);
        const lock2 = this.isDockLocked(u2);

        let nx;
        let nz;
        let dist;
        if (distSq < 1e-6) {
          const ang = (i * 12.9898 + j * 78.233) % (Math.PI * 2);
          nx = Math.cos(ang);
          nz = Math.sin(ang);
          dist = 0.01;
        } else {
          dist = Math.sqrt(distSq);
          nx = dx / dist;
          nz = dz / dist;
        }

        if (hold1 && hold2 && !moving1 && !moving2) {
          const slotGap = Math.hypot((u1.destX || 0) - (u2.destX || 0), (u1.destZ || 0) - (u2.destZ || 0));
          if (slotGap > 0.6 && dist > minDist * 0.72) continue;
        }

        let w1 = 0.5;
        let w2 = 0.5;
        const harv1 = u1.type === 'harvester';
        const harv2 = u2.type === 'harvester';
        if (lock1 && lock2) continue;
        if (lock1 && !lock2) { w1 = 0; w2 = 1; }
        else if (lock2 && !lock1) { w1 = 1; w2 = 0; }
        else if (harv1 !== harv2) {
          if (harv1) { w1 = 0.18; w2 = 0.82; }
          else { w1 = 0.82; w2 = 0.18; }
        }
        else if (moving1 && !moving2) { w1 = 1; w2 = 0; }
        else if (moving2 && !moving1) { w1 = 0; w2 = 1; }
        else if (hold1 && !hold2) { w1 = 0; w2 = 1; }
        else if (hold2 && !hold1) { w1 = 1; w2 = 0; }

        const share = w1 + w2;
        if (share <= 0) continue;
        const overlap = minDist - dist;
        const cap = (harv1 || harv2) ? Math.min(0.72, 22 * delta) : stepCap;
        const mag = Math.min(overlap * 0.55, cap);
        this.applySeparationOffset(u1, nx * mag * (w1 / share), nz * mag * (w1 / share));
        this.applySeparationOffset(u2, -nx * mag * (w2 / share), -nz * mag * (w2 / share));

        if ((moving1 && !moving2) || (moving2 && !moving1)) {
          const side = ((i + j) % 2 === 0) ? 1 : -1;
          const slide = mag * 0.35;
          const sx = -nz * side * slide;
          const sz = nx * side * slide;
          if (moving1 && !lock1) this.applySeparationOffset(u1, sx, sz);
          else if (moving2 && !lock2) this.applySeparationOffset(u2, sx, sz);
        }
      }
    }
  }

  notePlayerAlert(x, z) {
    this.alertX = x;
    this.alertZ = z;
    this.alertTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() / 1000 : Date.now() / 1000;
  }

  // Find nearest enemy unit or building
  findClosestEnemy(pos, maxRadius = Infinity, myFaction = 'player', options = {}) {
    const canTargetAir = options.canTargetAir === true;
    const preferAir = !!options.preferAir;
    let closest = null;
    let closestAir = null;
    let minDistSq = maxRadius * maxRadius;
    let minAirSq = maxRadius * maxRadius;

    for (const u of this.units) {
      if (!u.isAlive || u.faction === myFaction) continue;
      if (u.isAir && !canTargetAir) continue;
      const distSq = pos.distanceToSquared(u.position);
      if (u.isAir && distSq < minAirSq) {
        minAirSq = distSq;
        closestAir = u;
      }
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closest = u;
      }
    }

    for (const b of this.buildings) {
      if (!b.isAlive || b.faction === myFaction) continue;
      const distSq = pos.distanceToSquared(b.position);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        closest = b;
      }
    }

    if (preferAir && closestAir) return closestAir;
    return closest;
  }

  // Find closest refinery of own faction
  findClosestRefinery(pos, faction = 'player') {
    let closest = null;
    let minDistSq = Infinity;

    for (const b of this.buildings) {
      if (b.isAlive && b.faction === faction && b.type === 'ore_refinery') {
        const distSq = pos.distanceToSquared(b.position);
        if (distSq < minDistSq) {
          minDistSq = distSq;
          closest = b;
        }
      }
    }
    return closest;
  }

  // Apply splash/area of effect damage
  applyAreaDamage(centerPos, maxDamage, radius, attacker) {
    const radSq = radius * radius;

    // Damage units
    for (const u of this.units) {
      if (u.isAlive && (!attacker || u.faction !== attacker.faction)) {
        const distSq = centerPos.distanceToSquared(u.position);
        if (distSq <= radSq) {
          const falloff = 1 - (Math.sqrt(distSq) / radius);
          u.takeDamage(maxDamage * Math.max(0.25, falloff), attacker);
        }
      }
    }

    // Damage buildings
    for (const b of this.buildings) {
      if (b.isAlive && (!attacker || b.faction !== attacker.faction)) {
        const distSq = centerPos.distanceToSquared(b.position);
        if (distSq <= radSq) {
          const falloff = 1 - (Math.sqrt(distSq) / radius);
          b.takeDamage(maxDamage * Math.max(0.3, falloff), attacker);
        }
      }
    }
  }

  // --- Selection Methods ---

  selectSingle(entity) {
    this.clearSelection();
    if (!entity) return;

    if (entity instanceof Unit) {
      this.selectedUnits = [entity];
      entity.setSelected(true);
    } else if (entity instanceof Building) {
      this.selectedBuilding = entity;
      entity.setSelected(true);
    }
  }

  toggleSelectUnit(unit) {
    if (!unit || !(unit instanceof Unit)) return;
    if (this.selectedBuilding) {
      this.selectedBuilding.setSelected(false);
      this.selectedBuilding = null;
    }
    const idx = this.selectedUnits.indexOf(unit);
    if (idx !== -1) {
      this.selectedUnits.splice(idx, 1);
      unit.setSelected(false);
    } else {
      this.selectedUnits.push(unit);
      unit.setSelected(true);
    }
  }

  selectUnitsInBox(x1, z1, x2, z2, faction = 'player') {
    this.clearSelection();
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minZ = Math.min(z1, z2);
    const maxZ = Math.max(z1, z2);

    for (const u of this.units) {
      if (u.isAlive && u.faction === faction) {
        if (u.position.x >= minX && u.position.x <= maxX &&
            u.position.z >= minZ && u.position.z <= maxZ) {
          this.selectedUnits.push(u);
          u.setSelected(true);
        }
      }
    }
  }

  selectAllOfType(type, faction = 'player') {
    this.clearSelection();
    for (const u of this.units) {
      if (u.isAlive && u.faction === faction && u.type === type) {
        this.selectedUnits.push(u);
        u.setSelected(true);
      }
    }
  }

  deselectUnit(unit) {
    const idx = this.selectedUnits.indexOf(unit);
    if (idx !== -1) {
      this.selectedUnits.splice(idx, 1);
      unit.setSelected(false);
    }
  }

  clearSelection() {
    this.selectedUnits.forEach(u => u.setSelected(false));
    this.selectedUnits = [];
    if (this.selectedBuilding) {
      this.selectedBuilding.setSelected(false);
      this.selectedBuilding = null;
    }
  }

  // Hotkey Control Groups (1-9)
  assignControlGroup(groupNumber) {
    if (this.selectedUnits.length > 0) {
      this.controlGroups[groupNumber] = [...this.selectedUnits];
      return true;
    }
    return false;
  }

  selectControlGroup(groupNumber) {
    const group = this.controlGroups[groupNumber];
    if (group && group.length > 0) {
      this.clearSelection();
      this.selectedUnits = group.filter(u => u.isAlive);
      this.selectedUnits.forEach(u => u.setSelected(true));
      return true;
    }
    return false;
  }

  getPlayerUnits() {
    return this.units.filter(u => u.isAlive && u.faction === 'player');
  }

  getPlayerBuildings() {
    return this.buildings.filter(b => b.isAlive && b.faction === 'player');
  }

  getEnemyUnits() {
    return this.units.filter(u => u.isAlive && u.faction === 'enemy');
  }

  getEnemyBuildings() {
    return this.buildings.filter(b => b.isAlive && b.faction === 'enemy');
  }
}
