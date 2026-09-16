// ==========================================================================
// Command & Conquer RTS - Skirmish AI Commander (Easy, Medium, Hard)
// ==========================================================================

class SkirmishAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty; // 'easy', 'medium', 'hard'
    this.faction = 'enemy';
    this.baseCenter = { x: 160, z: 160 };
    this.decisionTimer = 0;
    this.difficultyConfig = this.getConfig(difficulty);
    this.attackTimer = -(this.difficultyConfig.firstAttackDelay || 0);
  }

  setDifficulty(diff) {
    this.difficulty = diff;
    this.difficultyConfig = this.getConfig(diff);
    this.decisionTimer = 0;
    this.attackTimer = -(this.difficultyConfig.firstAttackDelay || 0);
  }

  getConfig(diff) {
    switch (diff) {
      case 'easy':
        return {
          tickInterval: 8.0,
          attackInterval: 110.0,
          firstAttackDelay: 30.0,
          maxUnits: 6,
          canBuildVehicles: false,
          canBuildAir: false,
          canBuildTurrets: false,
          attackSquadSize: 3,
          garrison: 2,
          defendRadius: 26,
          harassHarvesters: false,
          repairsBuildings: false
        };
      case 'medium':
        return {
          tickInterval: 3.5,
          attackInterval: 50.0,
          firstAttackDelay: 0,
          maxUnits: 16,
          canBuildVehicles: true,
          canBuildAir: false,
          canBuildTurrets: true,
          attackSquadSize: 6,
          garrison: 3,
          defendRadius: 34,
          harassHarvesters: false,
          repairsBuildings: true
        };
      case 'hard':
        return {
          tickInterval: 1.8,
          attackInterval: 32.0,
          firstAttackDelay: 0,
          maxUnits: 28,
          canBuildVehicles: true,
          canBuildAir: true,
          canBuildTurrets: true,
          attackSquadSize: 9,
          garrison: 4,
          defendRadius: 44,
          harassHarvesters: true,
          repairsBuildings: true
        };
      default:
        return this.getConfig('medium');
    }
  }

  update(delta, gameContext) {
    this.decisionTimer += delta;
    this.attackTimer += delta;

    if (this.decisionTimer >= this.difficultyConfig.tickInterval) {
      this.decisionTimer = 0;
      this.makeStrategicDecisions(gameContext);
    }

    if (this.attackTimer >= this.difficultyConfig.attackInterval) {
      if (this.launchAssault(gameContext)) this.attackTimer = 0;
      else this.attackTimer = this.difficultyConfig.attackInterval - 5;
    }
  }

  makeStrategicDecisions(gameContext) {
    const { entityManager, economy, terrain } = gameContext;
    const enemyBuildings = entityManager.getEnemyBuildings();
    const enemyUnits = entityManager.getEnemyUnits();
    const credits = economy.credits.enemy;

    // Find AI Command Center
    const hq = enemyBuildings.find(b => b.type === 'command_center');
    if (!hq) return; // Base destroyed

    this.baseCenter = { x: hq.position.x, z: hq.position.z };

    const defending = this.defendBase(gameContext, hq, enemyUnits);
    if (!defending) {
      this.redirectFieldUnits(gameContext, hq, enemyUnits);
      this.stageIdleUnits(gameContext, hq, enemyUnits);
    }

    // 1. Repair damaged buildings if allowed
    if (this.difficultyConfig.repairsBuildings) {
      for (const b of enemyBuildings) {
        if (b.hp < b.maxHp * 0.7 && !b.isRepairing && credits > 300) {
          b.isRepairing = true;
          break;
        }
      }
    }

    // 2. Base Construction Evaluation
    const powerProduced = economy.power.enemy.produced;
    const powerConsumed = economy.power.enemy.consumed;
    const hasPowerDeficit = powerProduced < powerConsumed + 30;

    const hasRefinery = enemyBuildings.some(b => b.type === 'ore_refinery');
    const hasBarracks = enemyBuildings.some(b => b.type === 'barracks');
    const hasFactory = enemyBuildings.some(b => b.type === 'war_factory');
    const hasRadar = enemyBuildings.some(b => b.type === 'radar_facility');
    const turretCount = enemyBuildings.filter(b => b.isTurret).length;

    // A) Build Power Plant if power is tight
    if (hasPowerDeficit && economy.canAfford('enemy', 300)) {
      this.buildStructureNearBase('power_plant', gameContext);
      return;
    }

    // B) Build Ore Refinery to sustain economy
    if (!hasRefinery && economy.canAfford('enemy', 1200)) {
      this.buildStructureNearBase('ore_refinery', gameContext);
      return;
    }

    // C) Build Barracks for troops
    if (!hasBarracks && economy.canAfford('enemy', 400)) {
      this.buildStructureNearBase('barracks', gameContext);
      return;
    }

    // D) Build War Factory if allowed
    if (this.difficultyConfig.canBuildVehicles && !hasFactory && economy.canAfford('enemy', 1000)) {
      this.buildStructureNearBase('war_factory', gameContext);
      return;
    }

    // E) Build Defensive Turrets
    if (this.difficultyConfig.canBuildTurrets && turretCount < (this.difficulty === 'hard' ? 4 : 2)) {
      let turretType = 'turret_gun';
      let cost = 350;
      if (this.difficulty === 'hard') {
        const rand = Math.random();
        if (rand > 0.6 && hasRadar) {
          turretType = 'turret_laser';
          cost = 800;
        } else if (rand > 0.3) {
          turretType = 'turret_rocket';
          cost = 550;
        }
      }
      if (economy.canAfford('enemy', cost)) {
        this.buildStructureNearBase(turretType, gameContext);
        return;
      }
    }

    // F) Build Radar Facility on Hard
    if (this.difficulty === 'hard' && !hasRadar && economy.canAfford('enemy', 600)) {
      this.buildStructureNearBase('radar_facility', gameContext);
      return;
    }

    // 3. Unit Production
    if (enemyUnits.length < this.difficultyConfig.maxUnits) {
      // Barracks production
      const barracks = enemyBuildings.find(b => b.type === 'barracks' && b.productionQueue.length === 0 && !b.currentProduction);
      if (barracks) {
        let unitToTrain = 'machine_gunner';
        const playerHasAir = entityManager.getPlayerUnits().some((u) => u.isAlive && u.isAir);
        const rand = Math.random();
        if (playerHasAir) unitToTrain = 'rocket_launcher';
        else if (rand > 0.6) unitToTrain = 'rocket_launcher';
        else if (rand > 0.35) unitToTrain = 'grenadier';

        const cost = UNIT_SPECS[unitToTrain].cost;
        if (economy.spendCredits('enemy', cost)) {
          barracks.queueUnit(unitToTrain);
        }
      }

      // War Factory production
      if (this.difficultyConfig.canBuildVehicles) {
        const factory = enemyBuildings.find(b => b.type === 'war_factory' && b.productionQueue.length === 0 && !b.currentProduction);
        if (factory) {
          let vehToBuild = 'light_tracks';
          if (this.difficulty === 'hard') {
            const r = Math.random();
            if (r > 0.75 && hasRadar && economy.canAfford('enemy', 1600)) vehToBuild = 'laser_colossus';
            else if (r > 0.5) vehToBuild = 'helicopter';
            else if (r > 0.25) vehToBuild = 'battle_tank';
            else vehToBuild = '4x4_gunner';
          } else {
            vehToBuild = Math.random() > 0.4 ? 'battle_tank' : '4x4_gunner';
          }

          const cost = UNIT_SPECS[vehToBuild].cost;
          if (economy.spendCredits('enemy', cost)) {
            factory.queueUnit(vehToBuild);
          }
        }
      }
    }
  }

  // Find valid clear location around AI base to construct
  buildStructureNearBase(type, gameContext) {
    const { entityManager, economy, terrain } = gameContext;
    const spec = BUILDING_SPECS[type];
    if (!spec || !economy.spendCredits('enemy', spec.cost)) return;

    const baseGrid = terrain.worldToGrid(this.baseCenter.x, this.baseCenter.z);
    const radius = 10;

    // Search concentric spiral
    for (let r = 3; r <= radius; r += 2) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const gx = Math.floor(baseGrid.gx + Math.cos(angle) * r);
        const gz = Math.floor(baseGrid.gz + Math.sin(angle) * r);

        if (this.canPlaceBuilding(gx, gz, spec.footprint, terrain)) {
          entityManager.spawnBuilding(type, 'enemy', gx, gz, { complete: true });
          return;
        }
      }
    }
  }

  canPlaceBuilding(gx, gz, footprint, terrain) {
    for (let dz = 0; dz < footprint.h; dz++) {
      for (let dx = 0; dx < footprint.w; dx++) {
        const nx = gx + dx;
        const nz = gz + dz;
        if (nx < 2 || nx >= terrain.width - 2 || nz < 2 || nz >= terrain.height - 2) return false;
        if (terrain.grid[nz * terrain.width + nx] !== 0) return false;
      }
    }
    return true;
  }

  combatUnits(entityManager) {
    return entityManager.getEnemyUnits().filter((u) => u.isAlive && u.type !== 'harvester' && u.type !== 'engineer');
  }

  pickAssaultTarget(gameContext) {
    const { entityManager } = gameContext;
    const playerUnits = entityManager.getPlayerUnits();
    const playerBuildings = entityManager.getPlayerBuildings();

    if (this.difficultyConfig.harassHarvesters) {
      const playerHarvester = playerUnits.find((u) => u.type === 'harvester' && u.isAlive);
      if (playerHarvester) return playerHarvester;
    }

    const refinery = playerBuildings.find((b) => b.type === 'ore_refinery' && b.isAlive);
    const powerPlant = playerBuildings.find((b) => b.type === 'power_plant' && b.isAlive);
    const hq = playerBuildings.find((b) => b.type === 'command_center' && b.isAlive);
    if (this.difficulty === 'hard') return powerPlant || refinery || hq || playerBuildings[0] || playerUnits[0];
    if (this.difficulty === 'medium') return hq || powerPlant || playerBuildings[0] || playerUnits[0];
    return hq || playerBuildings[0] || playerUnits[0];
  }

  defendBase(gameContext, hq, enemyUnits) {
    const { entityManager, pathfinding } = gameContext;
    const radius = this.difficultyConfig.defendRadius || 30;
    const threats = entityManager.getPlayerUnits().filter((u) => {
      if (!u.isAlive || u.type === 'harvester') return false;
      return Math.hypot(u.position.x - hq.position.x, u.position.z - hq.position.z) <= radius;
    });
    if (!threats.length) return false;

    const threat = threats[0];
    const defenders = (enemyUnits || this.combatUnits(entityManager)).filter((u) => {
      if (!u.isAlive || u.type === 'harvester') return false;
      const dist = Math.hypot(u.position.x - hq.position.x, u.position.z - hq.position.z);
      return dist <= radius * 1.4;
    });
    if (!defenders.length) return false;

    if (typeof entityManager.issueMoveOrders === 'function') {
      entityManager.issueMoveOrders(defenders, threat.position.x, threat.position.z, pathfinding, { attackMove: true });
    } else {
      defenders.forEach((u) => {
        if (typeof u.attackMoveTo === 'function') u.attackMoveTo(threat.position.x, threat.position.z, pathfinding);
        else u.attackTarget(threat, pathfinding);
      });
    }
    return true;
  }

  stageIdleUnits(gameContext, hq, enemyUnits) {
    const { pathfinding, entityManager } = gameContext;
    const idle = (enemyUnits || []).filter((u) => {
      if (!u.isAlive || u.type === 'harvester' || u.isAir) return false;
      if (u.order === 'attack' || u.order === 'attackMove' || u.order === 'move') return false;
      const dist = Math.hypot(u.position.x - hq.position.x, u.position.z - hq.position.z);
      return dist < 8;
    });
    if (idle.length < 2) return;
    if (typeof entityManager.issueMoveOrders === 'function') {
      entityManager.issueMoveOrders(idle, hq.position.x + 6, hq.position.z + 8, pathfinding);
    }
  }

  redirectFieldUnits(gameContext, hq, enemyUnits) {
    const { pathfinding, entityManager } = gameContext;
    const radius = this.difficultyConfig.defendRadius || 30;
    const combat = this.combatUnits(entityManager);
    const stragglers = combat.filter((u) => {
      if (!u.isAlive) return false;
      const dist = Math.hypot(u.position.x - hq.position.x, u.position.z - hq.position.z);
      if (dist <= radius) return false;
      if (u.order === 'attack' || u.order === 'attackMove') {
        if (u.waypoints && u.waypoints.length > 0) return false;
        if (u.targetEntity && u.targetEntity.isAlive) return false;
      }
      if (u.order === 'move' && u.waypoints && u.waypoints.length > 0) return false;
      return true;
    });
    if (!stragglers.length) return;
    const target = this.pickAssaultTarget(gameContext);
    if (!target || !target.position) return;
    if (typeof entityManager.issueMoveOrders === 'function') {
      entityManager.issueMoveOrders(stragglers, target.position.x, target.position.z, pathfinding, { attackMove: true });
    } else {
      stragglers.forEach((u) => {
        if (typeof u.attackMoveTo === 'function') u.attackMoveTo(target.position.x, target.position.z, pathfinding);
        else if (typeof u.attackTarget === 'function') u.attackTarget(target, pathfinding);
      });
    }
  }

  launchAssault(gameContext) {
    const { entityManager, pathfinding } = gameContext;
    const combatUnits = this.combatUnits(entityManager);
    const garrison = this.difficultyConfig.garrison || 0;
    const available = Math.max(0, combatUnits.length - garrison);
    if (available < 1) return false;

    const target = this.pickAssaultTarget(gameContext);
    if (!target || !target.position) return false;

    const hq = entityManager.getEnemyBuildings().find((b) => b.type === 'command_center' && b.isAlive);
    const hx = hq ? hq.position.x : this.baseCenter.x;
    const hz = hq ? hq.position.z : this.baseCenter.z;
    const ranked = combatUnits.slice().sort((a, b) => {
      const da = Math.hypot(a.position.x - hx, a.position.z - hz);
      const db = Math.hypot(b.position.x - hx, b.position.z - hz);
      return db - da;
    });
    const waveSize = Math.min(this.difficultyConfig.attackSquadSize, available);
    const squad = ranked.slice(0, waveSize);
    if (typeof entityManager.issueMoveOrders === 'function') {
      entityManager.issueMoveOrders(squad, target.position.x, target.position.z, pathfinding, { attackMove: true });
    } else {
      squad.forEach((unit) => {
        if (typeof unit.attackMoveTo === 'function') {
          unit.attackMoveTo(target.position.x, target.position.z, pathfinding);
        } else {
          unit.attackTarget(target, pathfinding);
        }
      });
    }
    return true;
  }
}
