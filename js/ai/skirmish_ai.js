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
      this.attackTimer = 0;
      this.launchAssault(gameContext);
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
        const rand = Math.random();
        if (rand > 0.6) unitToTrain = 'rocket_launcher';
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

  // Launch coordinated strike against player
  launchAssault(gameContext) {
    const { entityManager, pathfinding } = gameContext;
    const combatUnits = entityManager.getEnemyUnits().filter(u => u.type !== 'harvester');

    if (combatUnits.length < this.difficultyConfig.attackSquadSize) return;

    // Pick target:
    // If Hard and player has Harvester: harass harvester!
    let target = null;
    const playerUnits = entityManager.getPlayerUnits();
    const playerBuildings = entityManager.getPlayerBuildings();

    if (this.difficultyConfig.harassHarvesters) {
      const playerHarvester = playerUnits.find(u => u.type === 'harvester');
      if (playerHarvester) target = playerHarvester;
    }

    // Target power plant or command center or closest building
    if (!target) {
      const powerPlant = playerBuildings.find(b => b.type === 'power_plant');
      const hq = playerBuildings.find(b => b.type === 'command_center');
      target = powerPlant || hq || playerBuildings[0] || playerUnits[0];
    }

    if (!target) return;

    // Send strike squad
    const squad = combatUnits.slice(0, this.difficultyConfig.attackSquadSize);
    squad.forEach(unit => {
      unit.attackTarget(target, pathfinding);
    });
  }
}
