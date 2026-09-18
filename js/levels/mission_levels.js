// ==========================================================================
// Command & Conquer RTS - Mission Levels & Interactive Tutorial System
// ==========================================================================

const MISSIONS = [
  {
    id: 1,
    title: 'Mission 1: Operation Foothold (Tutorial)',
    biome: 'temperate',
    difficulty: 'easy',
    briefing: 'Welcome Commander! Establish a forward operations base in Sector 4. Scout the surrounding terrain, construct a Power Plant and Ore Refinery, train reinforcements, and eliminate the insurgent outpost to the north.',
    startingCredits: 3000,
    playerStart: { x: 45, z: 45 },
    enemyStart: { x: 155, z: 155 },
    oreFields: [
      { x: 55, z: 65, radius: 5.5, richness: 5000 },
      { x: 145, z: 140, radius: 5.0, richness: 4000 }
    ],
    rockClusters: [
      { x: 95, z: 40, count: 6, scale: 2 },
      { x: 40, z: 100, count: 5, scale: 2 },
      { x: 110, z: 110, count: 8, scale: 2.5 }
    ],
    starterUnits: [
      { type: 'machine_gunner', offset: [-4, 5] },
      { type: 'machine_gunner', offset: [-2, 5] },
      { type: 'machine_gunner', offset: [0, 5] },
      { type: 'grenadier', offset: [2, 5] }
    ],
    enemyStarters: [
      { type: 'machine_gunner', x: 150, z: 150 },
      { type: 'machine_gunner', x: 156, z: 148 },
      { type: 'grenadier', x: 154, z: 160 }
    ],
    enemyBaseBuildings: [
      { type: 'command_center', gx: 75, gz: 75 },
      { type: 'power_plant', gx: 71, gz: 75 },
      { type: 'barracks', gx: 79, gz: 75 }
    ],
    winRule: 'destroy_hq',
    isTutorial: true,
    tutorialSteps: [
      {
        id: 'move_units',
        instruction: 'SELECT & MOVE: Left-click drag to select your infantry, then right-click on the ground to move them forward.',
        check: (ctx) => ctx.playerHasMovedUnits
      },
      {
        id: 'build_power',
        instruction: 'POWER GRID: Click [STRUCTURES] tab on the right sidebar, click "Power Plant", and place it near your base.',
        check: (ctx) => ctx.entityManager.getPlayerBuildings().some(b => b.type === 'power_plant')
      },
      {
        id: 'build_refinery',
        instruction: 'ECONOMY: Build an "Ore Refinery" next to the golden ore crystal field. Your Harvester will automatically start mining gold credits!',
        check: (ctx) => ctx.entityManager.getPlayerBuildings().some(b => b.type === 'ore_refinery')
      },
      {
        id: 'build_barracks',
        instruction: 'INFANTRY: Construct a "Barracks" to train additional infantry forces.',
        check: (ctx) => ctx.entityManager.getPlayerBuildings().some(b => b.type === 'barracks')
      },
      {
        id: 'train_troops',
        instruction: 'REINFORCEMENTS: Select the [INFANTRY] tab and train at least 3 new soldiers (Machine Gunners or Rocket Soldiers).',
        check: (ctx) => ctx.entityManager.getPlayerUnits().length >= 7
      },
      {
        id: 'destroy_enemy',
        instruction: 'ASSAULT: Move your squad north-east through the Fog of War, uncover the enemy base, and destroy their Command Center!',
        check: (ctx) => !ctx.entityManager.getEnemyBuildings().some(b => b.type === 'command_center')
      }
    ]
  },
  {
    id: 2,
    title: 'Mission 2: Canyon Clash (Armored Warfare)',
    biome: 'desert',
    difficulty: 'medium',
    briefing: 'Satellite reconnaissance detected a fortified enemy armor division occupying the central desert canyon. War Factories and heavy vehicle production are now authorized. Secure the rich gold basins, build a tank strike force, and wipe out the enemy installation.',
    startingCredits: 4500,
    playerStart: { x: 40, z: 40 },
    enemyStart: { x: 160, z: 160 },
    oreFields: [
      { x: 50, z: 65, radius: 5.0, richness: 6000 },
      { x: 100, z: 100, radius: 8.0, richness: 12000 }, // Central rich basin
      { x: 150, z: 135, radius: 5.0, richness: 6000 }
    ],
    rockClusters: [
      { x: 80, z: 60, count: 8, scale: 2.8 },
      { x: 60, z: 120, count: 7, scale: 2.5 },
      { x: 120, z: 80, count: 9, scale: 3.0 },
      { x: 140, z: 130, count: 6, scale: 2.2 }
    ],
    starterUnits: [
      { type: 'light_tracks', offset: [-4, 6] },
      { type: '4x4_gunner', offset: [0, 6] },
      { type: 'machine_gunner', offset: [-2, 4] },
      { type: 'rocket_launcher', offset: [2, 4] }
    ],
    enemyStarters: [
      { type: 'light_tracks', x: 145, z: 145 },
      { type: '4x4_gunner', x: 155, z: 140 },
      { type: 'rocket_launcher', x: 158, z: 152 },
      { type: 'machine_gunner', x: 150, z: 158 }
    ],
    enemyBaseBuildings: [
      { type: 'command_center', gx: 77, gz: 77 },
      { type: 'power_plant', gx: 72, gz: 77 },
      { type: 'ore_refinery', gx: 72, gz: 71 },
      { type: 'barracks', gx: 82, gz: 77 },
      { type: 'war_factory', gx: 77, gz: 71 },
      { type: 'turret_gun', gx: 70, gz: 68 },
      { type: 'turret_gun', gx: 84, gz: 70 }
    ],
    winRule: 'destroy_hq',
    isTutorial: false
  },
  {
    id: 3,
    title: 'Mission 3: Air Superiority (Total Warfare)',
    biome: 'snow',
    difficulty: 'hard',
    briefing: 'General, all tactical restrictions have been lifted. Attack Helicopters, Harrier Jet Airstrikes, and Heavy Rocket Turrets are online. The enemy has deployed a fully fortified base with automated air defense networks. Total victory requires complete annihilation of all enemy structures.',
    startingCredits: 6000,
    playerStart: { x: 45, z: 45 },
    enemyStart: { x: 155, z: 155 },
    oreFields: [
      { x: 50, z: 70, radius: 6.0, richness: 8000 },
      { x: 100, z: 60, radius: 6.5, richness: 9000 },
      { x: 100, z: 140, radius: 6.5, richness: 9000 },
      { x: 150, z: 130, radius: 6.0, richness: 8000 }
    ],
    rockClusters: [
      { x: 90, z: 70, count: 10, scale: 3.0 },
      { x: 110, z: 130, count: 10, scale: 3.0 },
      { x: 70, z: 110, count: 8, scale: 2.8 },
      { x: 130, z: 90, count: 8, scale: 2.8 }
    ],
    starterUnits: [
      { type: 'battle_tank', offset: [-5, 6] },
      { type: 'battle_tank', offset: [0, 6] },
      { type: 'helicopter', offset: [5, 6] },
      { type: 'rocket_launcher', offset: [-2, 3] },
      { type: 'rocket_launcher', offset: [2, 3] }
    ],
    enemyStarters: [
      { type: 'battle_tank', x: 145, z: 145 },
      { type: 'helicopter', x: 155, z: 145 },
      { type: '4x4_gunner', x: 140, z: 155 },
      { type: 'rocket_launcher', x: 150, z: 158 },
      { type: 'grenadier', x: 158, z: 150 }
    ],
    enemyBaseBuildings: [
      { type: 'command_center', gx: 75, gz: 75 },
      { type: 'power_plant', gx: 70, gz: 75 },
      { type: 'power_plant', gx: 70, gz: 79 },
      { type: 'ore_refinery', gx: 75, gz: 70 },
      { type: 'war_factory', gx: 81, gz: 75 },
      { type: 'barracks', gx: 81, gz: 70 },
      { type: 'radar_facility', gx: 75, gz: 81 },
      { type: 'turret_rocket', gx: 68, gz: 68 },
      { type: 'turret_rocket', gx: 86, gz: 68 },
      { type: 'turret_gun', gx: 68, gz: 84 }
    ],
    winRule: 'destroy_all',
    isTutorial: false
  }
];

class MissionManager {
  constructor(gameContext) {
    this.gameContext = gameContext;
    this.currentMissionIndex = 0;
    this.currentStepIndex = 0;
    this.playerHasMovedUnits = false;
    this.isMissionCompleted = false;
    this.isMissionFailed = false;
  }

  loadMission(index, customDifficulty = null) {
    if (this.gameContext.resetSession) this.gameContext.resetSession();
    this.currentMissionIndex = index;
    this.currentStepIndex = 0;
    this.playerHasMovedUnits = false;
    this.isMissionCompleted = false;
    this.isMissionFailed = false;

    const mission = MISSIONS[index] || MISSIONS[0];
    const diff = customDifficulty || mission.difficulty;

    const {
      terrain,
      entityManager,
      economy,
      skirmishAI,
      fogOfWar,
      renderer,
      soundFX
    } = this.gameContext;

    // Clear entities while the old terrain grid is still installed so their
    // occupied cells are released before the new mission is generated.
    entityManager.clearAll();
    if (this.gameContext.projectileManager) {
      const pm = this.gameContext.projectileManager;
      if (typeof pm.clear === 'function') pm.clear();
      else if (typeof pm.reset === 'function') pm.reset();
    }

    // 1. Reset terrain biome & features
    terrain.biome = mission.biome;
    terrain.generateTerrainMesh();
    terrain.setupLevelEnvironment(mission.oreFields, mission.rockClusters);

    if (this.gameContext.inputManager && this.gameContext.inputManager.cancelBuildingPlacement) {
      this.gameContext.inputManager.cancelBuildingPlacement();
    }
    if (this.gameContext.inputManager) {
      const im = this.gameContext.inputManager;
      if (im.movePips) {
        SceneResources.removeAndDispose(renderer.scene, im.movePips.map((p) => p.mesh));
        im.movePips = [];
      }
      if (im.attackBracket) im.attackBracket.visible = false;
    }

    // 2. Reset Economy
    economy.reset(mission.startingCredits);

    // 4. Setup AI
    skirmishAI.setDifficulty(diff);

    // 5. Setup Player Starting Base & Units
    const pStart = mission.playerStart;
    const playerGrid = terrain.worldToGrid(pStart.x, pStart.z);
    entityManager.spawnBuilding('command_center', 'player', playerGrid.gx, playerGrid.gz, { complete: true });

    mission.starterUnits.forEach(u => {
      entityManager.spawnUnit(
        u.type,
        'player',
        pStart.x + u.offset[0] * 2,
        pStart.z + u.offset[1] * 2
      );
    });

    // 6. Setup Enemy Base & Units
    mission.enemyBaseBuildings.forEach(b => {
      entityManager.spawnBuilding(b.type, 'enemy', b.gx, b.gz, { complete: true });
    });

    mission.enemyStarters.forEach(u => {
      entityManager.spawnUnit(u.type, 'enemy', u.x, u.z);
    });

    // 7. Reset Fog of War and reveal around player base
    fogOfWar.clearAll();
    fogOfWar.revealPermanent(pStart.x, pStart.z, 28);

    // 8. Pan Camera to player Command Center
    renderer.panTo(pStart.x, pStart.z);

    // 9. Sound FX & Speech announcement
    if (soundFX) {
      soundFX.speak('Battlefield control established');
    }
  }

  update(delta) {
    if (this.isMissionCompleted || this.isMissionFailed) return;

    const mission = MISSIONS[this.currentMissionIndex];

    if (this.checkVictory()) {
      this.triggerVictory();
      return;
    }

    if (this.checkDefeat()) {
      this.triggerDefeat();
      return;
    }

    // Interactive Tutorial step progression
    if (mission.isTutorial && mission.tutorialSteps) {
      const step = mission.tutorialSteps[this.currentStepIndex];
      if (step) {
        const passed = step.check({
          playerHasMovedUnits: this.playerHasMovedUnits,
          entityManager: this.gameContext.entityManager,
          economy: this.gameContext.economy
        });

        if (passed) {
          this.currentStepIndex++;
          if (this.gameContext.soundFX) {
            this.gameContext.soundFX.playOrder();
          }
        }
      }
    }
  }

  checkVictory() {
    const mission = MISSIONS[this.currentMissionIndex] || MISSIONS[0];
    const enemyBuildings = this.gameContext.entityManager.getEnemyBuildings();
    if (mission.winRule === 'destroy_all') {
      return enemyBuildings.length === 0;
    }
    return !enemyBuildings.some(b => b.type === 'command_center');
  }

  checkDefeat() {
    const playerHQ = this.gameContext.entityManager.getPlayerBuildings().find(b => b.type === 'command_center');
    const remainingArmy = this.gameContext.entityManager.getPlayerUnits().length;
    return !playerHQ && remainingArmy === 0;
  }

  getCurrentObjectiveText() {
    const mission = MISSIONS[this.currentMissionIndex];
    if (mission.isTutorial && mission.tutorialSteps) {
      const step = mission.tutorialSteps[this.currentStepIndex];
      if (step) {
        if (this.gameContext.renderer.touchInput) {
          const touchInstructions = {
            move_units: 'SELECT & MOVE: Tap infantry, then tap ground to move. Drag to pan; pinch to zoom. Use Select Area for squads.',
            build_power: 'POWER: Open Build > STRUCT. Tap Power Plant, tap ground near your base, then Place. Two fingers move the camera.',
            build_refinery: 'ECONOMY: Build an Ore Refinery near golden ore. Its Harvester starts mining automatically when construction finishes.',
            build_barracks: 'INFANTRY: Open Build > STRUCT and place a Barracks near your base.',
            train_troops: 'REINFORCEMENTS: Open Build > INFANTRY. Tap troop cards to train at least 3 soldiers. Cancel one removes a queued unit.',
            destroy_enemy: 'ASSAULT: Select your squad, use Attack-Move, then tap north-east. Reveal and destroy the enemy Command Center!'
          };
          return touchInstructions[step.id] || step.instruction;
        }
        return step.instruction;
      }
      return 'OBJECTIVE: Eliminate remaining enemy forces!';
    }
    if (mission.winRule === 'destroy_all') {
      return 'MISSION OBJECTIVE: Destroy every remaining enemy structure.';
    }
    return 'MISSION OBJECTIVE: Destroy the enemy Command Center and secure the sector.';
  }

  triggerVictory() {
    this.isMissionCompleted = true;
    this.gameContext.missionActive = false;
    if (this.gameContext.renderer && this.gameContext.renderer.setPlayCapture) {
      this.gameContext.renderer.setPlayCapture(false);
    }
    if (this.gameContext.soundFX) {
      this.gameContext.soundFX.speak('Mission accomplished');
    }
    if (window.hud) {
      window.hud.showVictoryModal();
    }
  }

  triggerDefeat() {
    this.isMissionFailed = true;
    this.gameContext.missionActive = false;
    if (this.gameContext.renderer && this.gameContext.renderer.setPlayCapture) {
      this.gameContext.renderer.setPlayCapture(false);
    }
    if (this.gameContext.soundFX) {
      this.gameContext.soundFX.speak('Mission failed');
    }
    if (window.hud) {
      window.hud.showDefeatModal();
    }
  }
}
