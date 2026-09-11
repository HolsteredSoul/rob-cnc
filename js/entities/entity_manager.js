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
  }

  clearAll() {
    this.units.forEach(u => {
      this.scene.remove(u.mesh);
    });
    this.units = [];

    this.buildings.forEach(b => {
      this.scene.remove(b.mesh);
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
      }
    }

    // Flocking / Soft collision between units so they don't overlap awkwardly
    this.applyUnitSeparation(delta);
  }

  // Soft push apart between moving units
  applyUnitSeparation(delta) {
    const count = this.units.length;
    for (let i = 0; i < count; i++) {
      const u1 = this.units[i];
      if (!u1.isAlive || u1.isAir) continue;

      for (let j = i + 1; j < count; j++) {
        const u2 = this.units[j];
        if (!u2.isAlive || u2.isAir) continue;

        const dx = u1.position.x - u2.position.x;
        const dz = u1.position.z - u2.position.z;
        const distSq = dx * dx + dz * dz;
        const minDist = (u1.isVehicle ? 2.0 : 1.2) + (u2.isVehicle ? 2.0 : 1.2);
        const minDistSq = minDist * minDist;

        if (distSq > 0 && distSq < minDistSq) {
          const dist = Math.sqrt(distSq);
          const overlap = (minDist - dist) * 0.5;
          const nx = (dx / dist) * overlap * 12 * delta;
          const nz = (dz / dist) * overlap * 12 * delta;

          u1.position.x += nx;
          u1.position.z += nz;
          u2.position.x -= nx;
          u2.position.z -= nz;
          u1.mesh.position.copy(u1.position);
          u2.mesh.position.copy(u2.position);
        }
      }
    }
  }

  // Find nearest enemy unit or building
  findClosestEnemy(pos, maxRadius = Infinity, myFaction = 'player') {
    let closest = null;
    let minDistSq = maxRadius * maxRadius;

    // Check enemy units first
    for (const u of this.units) {
      if (u.isAlive && u.faction !== myFaction) {
        const distSq = pos.distanceToSquared(u.position);
        if (distSq < minDistSq) {
          minDistSq = distSq;
          closest = u;
        }
      }
    }

    // Check enemy buildings
    for (const b of this.buildings) {
      if (b.isAlive && b.faction !== myFaction) {
        const distSq = pos.distanceToSquared(b.position);
        if (distSq < minDistSq) {
          minDistSq = distSq;
          closest = b;
        }
      }
    }

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
