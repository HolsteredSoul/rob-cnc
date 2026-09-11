// ==========================================================================
// Command & Conquer RTS - Building Logic, Tech Tree & Defensive Turrets
// ==========================================================================

const BUILDING_SPECS = {
  // Base structures
  command_center: {
    name: 'Command Center',
    hp: 2500,
    cost: 0,
    powerProduced: 40,
    powerConsumed: 0,
    buildTime: 12,
    footprint: { w: 4, h: 4 },
    category: 'structure'
  },
  command_center_advanced: {
    name: 'Advanced Command Center',
    hp: 3000,
    cost: 2500,
    powerProduced: 80,
    powerConsumed: 0,
    buildTime: 15,
    footprint: { w: 4, h: 4 },
    category: 'structure',
    visualCue: 'glow' // will add glowing beacon in mesh creation
  },
  power_plant: {
    name: 'Power Plant',
    hp: 850,
    cost: 300,
    powerProduced: 120,
    powerConsumed: 0,
    buildTime: 6,
    footprint: { w: 3, h: 3 },
    category: 'structure'
  },
  energy_storage: {
    name: 'Energy Storage',
    hp: 650,
    cost: 250,
    powerProduced: 0,
    powerConsumed: 0,
    batteryCap: 250,
    buildTime: 5,
    footprint: { w: 2, h: 2 },
    category: 'structure'
  },
  ore_refinery: {
    name: 'Ore Refinery',
    hp: 1300,
    cost: 1200,
    powerProduced: 0,
    powerConsumed: 30,
    buildTime: 10,
    footprint: { w: 4, h: 4 },
    category: 'structure',
    grantsHarvester: true
  },
  barracks: {
    name: 'Barracks',
    hp: 950,
    cost: 400,
    powerProduced: 0,
    powerConsumed: 20,
    buildTime: 7,
    footprint: { w: 3, h: 3 },
    category: 'structure',
    produces: ['machine_gunner', 'grenadier', 'rocket_launcher']
  },
  barracks_advanced: {
    name: 'Advanced Barracks',
    hp: 1200,
    cost: 1000,
    powerProduced: 0,
    powerConsumed: 25,
    buildTime: 9,
    footprint: { w: 3, h: 3 },
    category: 'structure',
    produces: ['light_tracks', '4x4_gunner', 'battle_tank', 'harvester', 'helicopter', 'laser_colossus', 'turret_laser']
  },
  war_factory: {
    name: 'War Factory',
    hp: 1600,
    cost: 1000,
    powerProduced: 0,
    powerConsumed: 40,
    buildTime: 12,
    footprint: { w: 4, h: 4 },
    category: 'structure',
    produces: ['light_tracks', '4x4_gunner', 'battle_tank', 'harvester', 'helicopter']
  },
  radar_facility: {
    name: 'Radar Facility',
    hp: 1000,
    cost: 600,
    powerProduced: 0,
    powerConsumed: 50,
    buildTime: 8,
    footprint: { w: 3, h: 3 },
    category: 'structure'
  },
  storage_silo: {
    name: 'Storage Silo',
    hp: 800,
    cost: 150,
    powerProduced: 0,
    powerConsumed: 0,
    buildTime: 6,
    footprint: { w: 3, h: 3 },
    category: 'structure',
    capacity: 10000
  },
  turret_gun: {
    name: 'MG Turret',
    hp: 700,
    cost: 350,
    powerProduced: 0,
    powerConsumed: 20,
    buildTime: 6,
    footprint: { w: 2, h: 2 },
    category: 'defense',
    attackRange: 18,
    damage: 18,
    attackCooldown: 0.35
  },
  turret_rocket: {
    name: 'Rocket Turret',
    hp: 800,
    cost: 550,
    powerProduced: 0,
    powerConsumed: 30,
    buildTime: 8,
    footprint: { w: 2, h: 2 },
    category: 'defense',
    attackRange: 22,
    damage: 70,
    attackCooldown: 1.8
  },
  turret_laser: {
    name: 'Laser Obelisk',
    hp: 950,
    cost: 800,
    powerProduced: 0,
    powerConsumed: 60,
    buildTime: 9,
    footprint: { w: 2, h: 2 },
    category: 'defense',
    attackRange: 24,
    damage: 140,
    attackCooldown: 1.0,
    isLaser: true
  },
  wall: {
    name: 'Perimeter Wall',
    hp: 500,
    cost: 50,
    powerProduced: 0,
    powerConsumed: 0,
    buildTime: 2,
    footprint: { w: 1, h: 1 },
    category: 'defense'
  }
};

let nextBuildingId = 1;

class Building {
  constructor(type, faction, gridX, gridZ, scene, terrain, options = {}) {
    this.id = nextBuildingId++;
    this.type = type;
    this.faction = faction;
    this.spec = BUILDING_SPECS[type] || BUILDING_SPECS.command_center;
    this.name = this.spec.name;

    this.gridX = gridX;
    this.gridZ = gridZ;
    this.footprint = this.spec.footprint;
    this.tileSize = terrain.tileSize;
    this.scene = scene;
    this.terrain = terrain;

    // Calculate world center
    const worldW = this.footprint.w * this.tileSize;
    const worldH = this.footprint.h * this.tileSize;
    const centerX = gridX * this.tileSize + worldW / 2;
    const centerZ = gridZ * this.tileSize + worldH / 2;
    const elevationY = terrain.getElevation ? terrain.getElevation(centerX, centerZ) : 0;

    this.position = new THREE.Vector3(
      centerX,
      elevationY,
      centerZ
    );

    this.hp = this.spec.hp;
    this.maxHp = this.spec.hp;
    this.sightRange = 22;
    this.isAlive = true;
    this.currentOre = 0; // Track stored ore for storage silos
    this.isRepairing = false;
    this.isBuilding = options.complete !== true;
    this.constructionProgress = this.isBuilding ? 0 : 1;
    this.harvesterGranted = false;
    this.powerProduced = this.isBuilding ? 0 : this.spec.powerProduced;
    this.powerConsumed = this.isBuilding ? 0 : this.spec.powerConsumed;

    // Turret combat attributes
    this.isTurret = type.startsWith('turret_');
    this.attackRange = this.spec.attackRange || 0;
    this.damage = this.spec.damage || 0;
    this.attackCooldown = this.spec.attackCooldown || 1.0;
    this.cooldownTimer = 0;
    this.targetEntity = null;

    // Unit Production Queue
    this.productionQueue = [];
    this.currentProduction = null;
    this.productionProgress = 0;
    this.rallyPoint = this.position.clone().add(new THREE.Vector3(0, 0, (this.footprint.h * this.tileSize) / 2 + 5));

    // Create 3D Mesh
    this.mesh = this.createMesh(type, faction);
    this.mesh.position.copy(this.position);
    if (this.isBuilding) {
      this.mesh.scale.set(1, 0.3, 1);
    }
    scene.add(this.mesh);

    // Mark terrain grid as blocked
    this.setTerrainGrid(terrain, true);

    // Selection ring / box
    this.selectionRing = this.createSelectionRing();
    this.mesh.add(this.selectionRing);
    this.selectionRing.visible = false;
  }

  createMesh(type, faction) {
    switch (type) {
      case 'command_center': return BuildingModels.createCommandCenter(faction);
      case 'power_plant': return BuildingModels.createPowerPlant(faction);
      case 'energy_storage': return BuildingModels.createEnergyStorage(faction);
      case 'ore_refinery': return BuildingModels.createOreRefinery(faction);
      case 'barracks': return BuildingModels.createBarracks(faction);
      case 'war_factory': return BuildingModels.createWarFactory(faction);
      case 'radar_facility': return BuildingModels.createRadarFacility(faction);
      case 'turret_gun': return BuildingModels.createGunTurret(faction);
      case 'turret_rocket': return BuildingModels.createRocketTurret(faction);
      case 'turret_laser': return BuildingModels.createLaserTurret(faction);
      case 'wall': return BuildingModels.createWallSegment(faction);
      default: return BuildingModels.createCommandCenter(faction);
    }
  }

  // Combat Engineer Capture Method: flips ownership to capturing faction
  capture(newFaction) {
    this.faction = newFaction;
    this.hp = this.maxHp; // Refurbish structure to full health
    this.isRepairing = false;
    this.targetEntity = null;
    this.productionQueue = [];
    this.currentProduction = null;
    this.productionProgress = 0;

    // Replace 3D mesh with new faction team colors
    if (this.mesh && this.mesh.parent) {
      this.mesh.parent.remove(this.mesh);
    }
    this.mesh = this.createMesh(this.type, newFaction);
    this.mesh.position.copy(this.position);
    if (this.scene) {
      this.scene.add(this.mesh);
    }

    this.selectionRing = this.createSelectionRing();
    this.mesh.add(this.selectionRing);
    this.selectionRing.visible = false;
  }

  createSelectionRing() {
    const sizeX = this.footprint.w * this.tileSize + 0.6;
    const sizeZ = this.footprint.h * this.tileSize + 0.6;
    const geo = new THREE.PlaneGeometry(sizeX, sizeZ);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.08, 0);

    const mat = new THREE.MeshBasicMaterial({
      color: this.faction === 'player' ? 0x00ff66 : 0xff3333,
      wireframe: true
    });
    return new THREE.Mesh(geo, mat);
  }

  setSelected(selected) {
    if (this.selectionRing) {
      this.selectionRing.visible = selected;
    }
  }

  setTerrainGrid(terrain, blocked) {
    for (let dz = 0; dz < this.footprint.h; dz++) {
      for (let dx = 0; dx < this.footprint.w; dx++) {
        const gx = this.gridX + dx;
        const gz = this.gridZ + dz;
        if (gx >= 0 && gx < terrain.width && gz >= 0 && gz < terrain.height) {
          terrain.grid[gz * terrain.width + gx] = blocked ? 2 : 0;
        }
      }
    }
  }

  getDockPosition() {
    if (this.mesh.userData.dockPos) {
      return this.position.clone().add(this.mesh.userData.dockPos);
    }
    return this.position.clone().add(new THREE.Vector3(2.5, 0, 0));
  }

  getSpawnPosition() {
    if (this.mesh.userData.spawnOffset) {
      return this.position.clone().add(this.mesh.userData.spawnOffset);
    }
    return this.position.clone().add(new THREE.Vector3(0, 0, 4));
  }

  // Enqueue unit training
  queueUnit(unitType) {
    this.productionQueue.push(unitType);
  }

  cancelQueueIndex(index) {
    if (index >= 0 && index < this.productionQueue.length) {
      const removed = this.productionQueue.splice(index, 1)[0];
      return removed;
    }
    return null;
  }

  finishConstruction(gameContext) {
    this.isBuilding = false;
    this.constructionProgress = 1;
    this.powerProduced = this.spec.powerProduced;
    this.powerConsumed = this.spec.powerConsumed;
    if (this.mesh) {
      this.mesh.scale.set(1, 1, 1);
    }
    if (this.type === 'command_center_advanced') {
      TechTree.upgradeCommandCenter();
    }
    if (gameContext && gameContext.entityManager) {
      gameContext.entityManager.grantRefineryHarvester(this);
    }
    if (this.faction === 'player' && gameContext && gameContext.soundFX) {
      gameContext.soundFX.speak('Construction complete');
    }
    if (this.faction === 'player' && typeof window !== 'undefined' && window.hud) {
      window.hud.refreshBuildCards();
    }
  }

  update(delta, gameContext) {
    if (!this.isAlive) return;

    if (this.isBuilding) {
      const buildTime = Math.max(0.25, this.spec.buildTime || 1);
      this.constructionProgress = Math.min(1, this.constructionProgress + delta / buildTime);
      if (this.mesh) {
        this.mesh.scale.set(1, 0.3 + 0.7 * this.constructionProgress, 1);
      }
      if (this.constructionProgress >= 1) {
        this.finishConstruction(gameContext);
      }
      return;
    }

    // Check power availability
    const isPowered = gameContext.economy ? gameContext.economy.isBasePowered(this.faction) : true;

    // Continuous animations (Radar dish spinning, power coils)
    if (this.mesh.userData.rotatingPart && (isPowered || this.type === 'command_center')) {
      this.mesh.userData.rotatingPart.rotation.y += 2.5 * delta;
    }

    // Repairing
    if (this.isRepairing && this.hp < this.maxHp) {
      const repairCost = 15 * delta;
      if (gameContext.economy && gameContext.economy.spendCredits(this.faction, repairCost)) {
        this.hp = Math.min(this.maxHp, this.hp + 40 * delta);
        if (this.hp >= this.maxHp) {
          this.isRepairing = false;
        }
      } else {
        this.isRepairing = false;
      }
    }

    // Defensive Turret Combat (Disabled when low power!)
    if (this.isTurret) {
      if (isPowered) {
        this.updateTurretCombat(delta, gameContext);
      }
    }

    // Unit Production Queue
    this.updateProduction(delta, gameContext, isPowered);
  }

  updateTurretCombat(delta, gameContext) {
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= delta;
    }

    const { entityManager, projectileManager, soundFX } = gameContext;

    if (!this.targetEntity || !this.targetEntity.isAlive) {
      this.targetEntity = entityManager.findClosestEnemy(this.position, this.attackRange, this.faction);
    }

    if (!this.targetEntity) return;

    const dist = this.position.distanceTo(this.targetEntity.position);
    if (dist > this.attackRange) {
      this.targetEntity = null;
      return;
    }

    // Rotate turret towards target
    const dir = this.targetEntity.position.clone().sub(this.position);
    const angle = Math.atan2(dir.x, dir.z);
    if (this.mesh.userData.turret) {
      this.mesh.userData.turret.rotation.y = angle;
    }

    // Fire!
    if (this.cooldownTimer <= 0) {
      const muzzleWorld = new THREE.Vector3();
      if (this.mesh.userData.muzzlePos) {
        this.mesh.userData.muzzlePos.getWorldPosition(muzzleWorld);
      } else {
        muzzleWorld.copy(this.position).add(new THREE.Vector3(0, 1.8, 0));
      }

      const targetPos = this.targetEntity.position.clone().add(new THREE.Vector3(0, 1.0, 0));

      if (this.type === 'turret_gun') {
        projectileManager.spawnBullet(muzzleWorld, targetPos, this.targetEntity, this.damage, this);
        if (soundFX && this.isAudibleToPlayer(gameContext)) soundFX.playMachineGun();
      } else if (this.type === 'turret_rocket') {
        projectileManager.spawnRocket(muzzleWorld, targetPos, this.targetEntity, this.damage, this);
        if (soundFX && this.isAudibleToPlayer(gameContext)) soundFX.playRocketLaunch();
      } else if (this.type === 'turret_laser') {
        projectileManager.spawnLaserBeam(
          muzzleWorld,
          targetPos,
          this.targetEntity,
          this.damage,
          this,
          this.faction === 'player' ? 0x00e5ff : 0xff1744
        );
        if (soundFX && this.isAudibleToPlayer(gameContext)) soundFX.playLaserSound();
      }

      this.cooldownTimer = this.attackCooldown;
    }
  }

  updateProduction(delta, gameContext, isPowered) {
    if (this.productionQueue.length === 0 && !this.currentProduction) return;

    if (!this.currentProduction && this.productionQueue.length > 0) {
      this.currentProduction = this.productionQueue.shift();
      this.productionProgress = 0;
    }

    if (this.currentProduction) {
      const spec = UNIT_SPECS[this.currentProduction];
      if (!spec) {
        this.currentProduction = null;
        return;
      }

      // Low power slows (does not instantly cancel) construction
      const prodSpeed = gameContext.economy
        ? gameContext.economy.getProductionSpeed(this.faction)
        : (isPowered ? 1.0 : 0.35);
      const baseBuildTime = Math.max(3, spec.cost / 90); // ~1s per 90 credits
      this.productionProgress += (delta * prodSpeed) / baseBuildTime;

      if (this.productionProgress >= 1.0) {
        // Spawn finished unit
        const spawnPos = this.getSpawnPosition();
        const newUnit = gameContext.entityManager.spawnUnit(
          this.currentProduction,
          this.faction,
          spawnPos.x,
          spawnPos.z
        );

        // Move to rally point
        if (newUnit && this.rallyPoint) {
          newUnit.moveTo(this.rallyPoint.x, this.rallyPoint.z, gameContext.pathfinding);
        }

        if (this.faction === 'player' && gameContext.soundFX) {
          gameContext.soundFX.speak('Unit ready');
        }

        this.currentProduction = null;
        this.productionProgress = 0;
      }
    }
  }

  takeDamage(amount, attacker) {
    if (!this.isAlive) return;
    this.hp = Math.max(0, this.hp - amount);

    if (this.hp <= 0) {
      this.die(attacker);
    }
  }

  die(attacker) {
    this.isAlive = false;
    if (this.selectionRing) {
      this.selectionRing.visible = false;
    }
  }

  storeOre(amount) {
    if (this.spec && typeof this.spec.capacity === 'number') {
      const newAmount = Math.min(this.spec.capacity, (this.currentOre || 0) + amount);
      this.currentOre = newAmount;
    }
  }

  isAudibleToPlayer(gameContext) {
    if (!gameContext.fogOfWar) return true;
    return gameContext.fogOfWar.isVisible(this.position.x, this.position.z);
  }
}
