'use strict';

const { createSandbox, loadGameScripts } = require('./browser_sandbox');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function tick(ctx, seconds, step) {
  step = step || 0.05;
  let t = 0;
  while (t < seconds) {
    const dt = Math.min(step, seconds - t);
    if (ctx.entityManager) ctx.entityManager.update(dt, ctx);
    if (ctx.projectileManager) ctx.projectileManager.update(dt, ctx.entityManager);
    if (ctx.economy) ctx.economy.update(dt, ctx.entityManager, null);
    if (ctx.terrain && ctx.terrain.updateOreRegeneration) ctx.terrain.updateOreRegeneration(dt);
    if (ctx.missionManager) ctx.missionManager.update(dt);
    t += dt;
  }
}

function makeCtx(g) {
  const scene = new g.THREE.Scene();
  const terrain = new g.Terrain(scene, 100, 100, 2, 'temperate');
  terrain.setupLevelEnvironment([], []);
  const entityManager = new g.EntityManager(scene, terrain);
  const projectileManager = new g.ProjectileManager(scene);
  const economy = new g.Economy();
  const pathfinding = new g.Pathfinding(terrain);
  const skirmishAI = new g.SkirmishAI('easy');
  const ctx = {
    scene,
    terrain,
    entityManager,
    projectileManager,
    economy,
    pathfinding,
    skirmishAI,
    soundFX: null,
    fogOfWar: null,
    renderer: { panTo() {}, scene }
  };
  ctx.missionManager = new g.MissionManager(ctx);
  return ctx;
}

function run() {
  const g = createSandbox();
  loadGameScripts(g, { includeMain: false });

  assert(typeof g.THREE === 'object', 'THREE global missing (module leak or load failure)');
  assert(typeof g.Economy === 'function', 'Economy not installed');
  assert(typeof g.Unit === 'function', 'Unit not installed');
  assert(typeof g.Building === 'function', 'Building not installed');
  assert(typeof g.EntityManager === 'function', 'EntityManager not installed');
  assert(typeof g.TechTree === 'object', 'TechTree not installed');
  assert(typeof g.MissionManager === 'function', 'MissionManager not installed');

  const results = [];

  // --- Construction timer actually marks buildings as under construction ---
  {
    const ctx = makeCtx(g);
    const plant = ctx.entityManager.spawnBuilding('power_plant', 'player', 4, 4);
    assert(plant.isBuilding === true, 'placed building should start under construction');
    assert(plant.powerProduced === 0, 'incomplete power plant must not produce power');
    tick(ctx, plant.spec.buildTime + 0.5);
    assert(plant.isBuilding === false, 'construction timer never completed');
    assert(plant.powerProduced === plant.spec.powerProduced, 'completed plant should produce power');
    results.push('PASS construction timer marks isBuilding then completes');
  }

  // --- Harvest → return → unload credits (real harvester state machine) ---
  {
    const ctx = makeCtx(g);
    ctx.economy.reset(1000);
    ctx.terrain.setupLevelEnvironment([{ x: 40, z: 20, radius: 5, richness: 5000 }], []);
    ctx.entityManager.spawnBuilding('ore_refinery', 'player', 8, 8, { complete: true });
    const harvester = ctx.entityManager.getPlayerUnits().find((u) => u.type === 'harvester');
    assert(!!harvester, 'refinery must grant a free harvester');
    const creditsBefore = ctx.economy.credits.player;
    tick(ctx, 22, 0.05);
    const creditsAfter = ctx.economy.credits.player;
    assert(creditsAfter > creditsBefore, 'credits did not rise after mine→return→unload (before=' + creditsBefore + ' after=' + creditsAfter + ' cargo=' + harvester.cargo + ' state=' + harvester.harvesterState + ')');
    results.push('PASS harvest→return→unload credits ' + creditsBefore + ' → ' + creditsAfter);
  }

  // --- Combat HP falls after an attack tick ---
  {
    const ctx = makeCtx(g);
    const shooter = ctx.entityManager.spawnUnit('machine_gunner', 'player', 12, 12);
    const target = ctx.entityManager.spawnUnit('machine_gunner', 'enemy', 14, 12);
    const hpBefore = target.hp;
    shooter.stance = 'aggressive';
    shooter.attackTarget(target, ctx.pathfinding);
    tick(ctx, 2.0, 0.05);
    assert(target.hp < hpBefore, 'target HP did not fall after attack ticks (hp ' + target.hp + '/' + hpBefore + ')');
    results.push('PASS combat HP ' + hpBefore + ' → ' + target.hp);
  }

  // --- Production spawn ---
  {
    const ctx = makeCtx(g);
    ctx.economy.reset(2000);
    ctx.entityManager.spawnBuilding('command_center', 'player', 2, 2, { complete: true });
    const barracks = ctx.entityManager.spawnBuilding('barracks', 'player', 6, 2, { complete: true });
    const before = ctx.entityManager.getPlayerUnits().length;
    assert(ctx.economy.spendCredits('player', g.UNIT_SPECS.machine_gunner.cost), 'could not afford gunner');
    barracks.queueUnit('machine_gunner');
    tick(ctx, 5.0, 0.05);
    const after = ctx.entityManager.getPlayerUnits().length;
    assert(after > before, 'trained unit did not spawn (units ' + before + ' → ' + after + ', prod=' + barracks.currentProduction + ' p=' + barracks.productionProgress + ')');
    results.push('PASS production spawn ' + before + ' → ' + after);
  }

  // --- Low power slows production AND offlines turrets ---
  {
    const ctx = makeCtx(g);
    ctx.economy.reset(5000);
    ctx.entityManager.spawnBuilding('command_center', 'player', 2, 2, { complete: true });
    const barracks = ctx.entityManager.spawnBuilding('barracks', 'player', 6, 2, { complete: true });
    ctx.economy.update(0, ctx.entityManager, null);
    assert(ctx.economy.isBasePowered('player') === true, 'HQ+barracks should be powered');
    barracks.queueUnit('machine_gunner');
    tick(ctx, 1.0, 0.05);
    const poweredProgress = barracks.productionProgress;
    barracks.currentProduction = 'machine_gunner';
    barracks.productionProgress = 0;
    ctx.entityManager.spawnBuilding('radar_facility', 'player', 10, 2, { complete: true });
    ctx.entityManager.spawnBuilding('turret_laser', 'player', 12, 2, { complete: true });
    ctx.economy.update(0, ctx.entityManager, null);
    assert(ctx.economy.isBasePowered('player') === false, 'radar+laser should create a power deficit');
    assert(ctx.economy.getProductionSpeed('player') < 1, 'low power must reduce production speed');
    tick(ctx, 1.0, 0.05);
    const lowPowerProgress = barracks.productionProgress;
    assert(lowPowerProgress < poweredProgress, 'low power did not slow production (' + lowPowerProgress + ' vs ' + poweredProgress + ')');

    const turret = ctx.entityManager.getPlayerBuildings().find((b) => b.type === 'turret_laser');
    const dummy = ctx.entityManager.spawnUnit('machine_gunner', 'enemy', turret.position.x + 2, turret.position.z);
    const dummyHp = dummy.hp;
    tick(ctx, 1.5, 0.05);
    assert(dummy.hp === dummyHp, 'laser turret fired while base was unpowered');
    ctx.entityManager.spawnBuilding('power_plant', 'player', 16, 2, { complete: true });
    ctx.entityManager.spawnBuilding('power_plant', 'player', 20, 2, { complete: true });
    ctx.economy.update(0, ctx.entityManager, null);
    assert(ctx.economy.isBasePowered('player') === true, 'plants should restore power');
    tick(ctx, 1.5, 0.05);
    assert(dummy.hp < dummyHp, 'turret stayed offline after power was restored');
    results.push('PASS power deficit slows production (' + poweredProgress.toFixed(3) + ' vs ' + lowPowerProgress.toFixed(3) + ') and offlines turrets');
  }

  // --- Tech gates ---
  {
    const ctx = makeCtx(g);
    const none = [];
    assert(g.TechTree.isUnlocked('power_plant', none), 'power plant should be unlocked at start');
    assert(!g.TechTree.isUnlocked('ore_refinery', none), 'refinery must wait for a power plant');
    assert(!g.TechTree.isUnlocked('barracks', none), 'barracks must wait for a power plant');
    assert(!g.TechTree.isUnlocked('war_factory', none), 'war factory gated');
    assert(!g.TechTree.isUnlocked('radar_facility', none), 'radar gated');
    const plant = ctx.entityManager.spawnBuilding('power_plant', 'player', 4, 4, { complete: true });
    const withPlant = ctx.entityManager.getPlayerBuildings();
    assert(g.TechTree.isUnlocked('ore_refinery', withPlant), 'refinery unlocks after power plant');
    assert(g.TechTree.isUnlocked('barracks', withPlant), 'barracks unlocks after power plant');
    const incompleteFactoryGate = g.TechTree.isUnlocked('war_factory', withPlant);
    assert(!incompleteFactoryGate, 'war factory still needs barracks + refinery');
    ctx.entityManager.spawnBuilding('ore_refinery', 'player', 8, 4, { complete: true });
    ctx.entityManager.spawnBuilding('barracks', 'player', 12, 4, { complete: true });
    const ready = ctx.entityManager.getPlayerBuildings();
    assert(g.TechTree.isUnlocked('war_factory', ready), 'war factory unlocks after barracks + refinery');
    assert(g.TechTree.isUnlocked('radar_facility', ready), 'radar unlocks after refinery');
    const stillBuilding = ctx.entityManager.spawnBuilding('power_plant', 'enemy', 30, 30);
    assert(stillBuilding.isBuilding, 'unfinished plant should not count');
    assert(!g.TechTree.hasBuilding([stillBuilding], 'power_plant'), 'tech gate ignores buildings still under construction');
    void plant;
    results.push('PASS tech gates: power plant → refinery/barracks → war factory/radar');
  }

  // --- Win when enemy HQ is gone even if leftover buildings remain ---
  {
    const ctx = makeCtx(g);
    ctx.missionManager.currentMissionIndex = 0;
    ctx.entityManager.spawnBuilding('command_center', 'player', 2, 2, { complete: true });
    ctx.entityManager.spawnUnit('machine_gunner', 'player', 8, 8);
    const enemyHQ = ctx.entityManager.spawnBuilding('command_center', 'enemy', 70, 70, { complete: true });
    ctx.entityManager.spawnBuilding('power_plant', 'enemy', 74, 70, { complete: true });
    ctx.entityManager.spawnBuilding('barracks', 'enemy', 78, 70, { complete: true });
    ctx.missionManager.update(0.05);
    assert(!ctx.missionManager.isMissionCompleted, 'victory fired before HQ death');
    enemyHQ.takeDamage(99999);
    tick(ctx, 0.2, 0.05);
    assert(ctx.missionManager.isMissionCompleted === true, 'victory did not fire after enemy HQ death with leftover buildings');
    results.push('PASS victory on enemy HQ death despite leftover buildings');
  }

  // --- Defeat when player HQ is gone and no army remains ---
  {
    const ctx = makeCtx(g);
    ctx.missionManager.currentMissionIndex = 0;
    const playerHQ = ctx.entityManager.spawnBuilding('command_center', 'player', 2, 2, { complete: true });
    const soldier = ctx.entityManager.spawnUnit('machine_gunner', 'player', 8, 8);
    ctx.entityManager.spawnBuilding('command_center', 'enemy', 70, 70, { complete: true });
    playerHQ.takeDamage(99999);
    tick(ctx, 0.2, 0.05);
    assert(!ctx.missionManager.isMissionFailed, 'defeat fired while army still remained');
    soldier.takeDamage(99999);
    tick(ctx, 0.2, 0.05);
    assert(ctx.missionManager.isMissionFailed === true, 'defeat did not fire after HQ + army lost');
    results.push('PASS defeat when HQ gone and no army remains');
  }

  // --- Easy / medium / hard AI cadence actually differs ---
  {
    const easy = new g.SkirmishAI('easy').difficultyConfig;
    const medium = new g.SkirmishAI('medium').difficultyConfig;
    const hard = new g.SkirmishAI('hard').difficultyConfig;
    assert(easy.tickInterval > medium.tickInterval, 'easy should decide slower than medium');
    assert(medium.tickInterval > hard.tickInterval, 'medium should decide slower than hard');
    assert(easy.attackInterval > medium.attackInterval, 'easy should attack less often than medium');
    assert(medium.attackInterval > hard.attackInterval, 'medium should attack less often than hard');
    assert(easy.maxUnits < medium.maxUnits && medium.maxUnits < hard.maxUnits, 'unit caps must increase with difficulty');
    assert(easy.canBuildVehicles === false && medium.canBuildVehicles === true, 'medium unlocks vehicles');
    assert(hard.harassHarvesters === true && easy.harassHarvesters === false, 'hard uniquely harasses harvesters');
    results.push('PASS easy/medium/hard AI cadence and caps differ');
  }

  results.forEach((line) => console.log(line));
  console.log('ALL_SIM_TESTS_PASSED ' + results.length);
  process.exit(0);
}

try {
  run();
} catch (err) {
  console.error('FAIL ' + err.message);
  console.error(err.stack);
  process.exit(1);
}
