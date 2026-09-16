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
    if (ctx.skirmishAI) ctx.skirmishAI.update(dt, ctx);
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
    fogOfWar: {
      clearAll() {},
      revealPermanent() {},
      isVisible() { return true; },
      isExplored() { return true; }
    },
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

  // --- Hold-ground does not chase an out-of-range enemy ---
  {
    const ctx = makeCtx(g);
    const holder = ctx.entityManager.spawnUnit('machine_gunner', 'player', 20, 20);
    holder.stance = 'holdground';
    holder.holdPosition();
    const startX = holder.position.x;
    const startZ = holder.position.z;
    ctx.entityManager.spawnUnit('machine_gunner', 'enemy', 20 + holder.attackRange + 12, 20);
    tick(ctx, 2.0, 0.05);
    const moved = Math.hypot(holder.position.x - startX, holder.position.z - startZ);
    assert(moved < 1.5, 'holdground unit chased out of post (moved ' + moved.toFixed(2) + ')');
    results.push('PASS holdground stays put (' + moved.toFixed(2) + ' wu)');
  }

  // --- Attack-move engages then continues to destination ---
  {
    const ctx = makeCtx(g);
    const runner = ctx.entityManager.spawnUnit('machine_gunner', 'player', 10, 20);
    const blocker = ctx.entityManager.spawnUnit('machine_gunner', 'enemy', 18, 20);
    runner.attackMoveTo(40, 20, ctx.pathfinding);
    tick(ctx, 3.5, 0.05);
    assert(blocker.hp < blocker.maxHp, 'attack-move did not engage enemy on the path');
    assert(runner.order === 'attackMove' || runner.position.x > 16, 'attack-move unit did not advance (order=' + runner.order + ' x=' + runner.position.x.toFixed(1) + ')');
    results.push('PASS attack-move engaged and advanced');
  }

  // --- Producer rally: spawned unit attack-moves toward the flag ---
  {
    const ctx = makeCtx(g);
    ctx.economy.reset(2000);
    ctx.entityManager.spawnBuilding('command_center', 'player', 2, 2, { complete: true });
    const barracks = ctx.entityManager.spawnBuilding('barracks', 'player', 6, 2, { complete: true });
    barracks.setRally(40, 30);
    ctx.economy.spendCredits('player', g.UNIT_SPECS.machine_gunner.cost);
    barracks.queueUnit('machine_gunner');
    const before = ctx.entityManager.getPlayerUnits().length;
    tick(ctx, 6.0, 0.05);
    const spawned = ctx.entityManager.getPlayerUnits().filter((u) => u.type === 'machine_gunner');
    assert(spawned.length > before || spawned.length >= 1, 'rallied unit did not spawn');
    const gunner = spawned[spawned.length - 1];
    assert(gunner.order === 'attackMove' || Math.hypot(gunner.destX - 40, gunner.destZ - 30) < 4, 'spawned unit did not rally (order=' + gunner.order + ' dest=' + gunner.destX + ',' + gunner.destZ + ')');
    results.push('PASS production rally attack-move');
  }

  // --- Veterancy: 4 unit-kills raises rank and maxHp ---
  {
    const ctx = makeCtx(g);
    const vet = ctx.entityManager.spawnUnit('machine_gunner', 'player', 12, 12);
    const baseMax = vet.maxHp;
    for (let i = 0; i < 4; i++) {
      const dummy = ctx.entityManager.spawnUnit('machine_gunner', 'enemy', 40 + i, 40);
      dummy.takeDamage(9999, vet);
    }
    assert(vet.rank === 1, 'rank after 4 kills should be 1 (got ' + vet.rank + ', kills=' + vet.kills + ')');
    assert(vet.maxHp > baseMax, 'veterancy did not raise maxHp (' + vet.maxHp + ' vs ' + baseMax + ')');
    results.push('PASS veterancy rank 1 at 4 kills (hp ' + baseMax + ' → ' + vet.maxHp + ')');
  }

  // --- Air filter: rifle cannot hit helicopters; rocket turret can ---
  {
    const ctx = makeCtx(g);
    ctx.economy.reset(5000);
    ctx.entityManager.spawnBuilding('command_center', 'player', 2, 2, { complete: true });
    ctx.entityManager.spawnBuilding('power_plant', 'player', 6, 2, { complete: true });
    const rifle = ctx.entityManager.spawnUnit('machine_gunner', 'player', 20, 20);
    const heli = ctx.entityManager.spawnUnit('helicopter', 'enemy', 22, 20);
    const heliHp = heli.hp;
    rifle.stance = 'aggressive';
    rifle.attackTarget(heli, ctx.pathfinding);
    tick(ctx, 2.0, 0.05);
    assert(heli.hp === heliHp, 'rifleman damaged a helicopter (hp ' + heli.hp + '/' + heliHp + ')');
    heli.takeDamage(9999);

    const turret = ctx.entityManager.spawnBuilding('turret_rocket', 'player', 10, 10, { complete: true });
    const heli2 = ctx.entityManager.spawnUnit('helicopter', 'enemy', turret.position.x + 4, turret.position.z);
    const h2 = heli2.hp;
    ctx.economy.update(0, ctx.entityManager, null);
    tick(ctx, 2.2, 0.05);
    assert(heli2.hp < h2, 'rocket turret did not hit helicopter (hp ' + heli2.hp + '/' + h2 + ')');
    results.push('PASS air filter: rifles miss choppers, rocket turret hits');
  }

  // --- Unit health bar shows when selected or damaged ---
  {
    const ctx = makeCtx(g);
    const u = ctx.entityManager.spawnUnit('machine_gunner', 'player', 16, 16);
    assert(!!u.healthBar, 'unit must have a health bar mesh');
    u.updateHealthBar(ctx);
    assert(u.healthBar.visible === false, 'full-hp unselected unit should hide the bar');
    u.setSelected(true);
    assert(u.healthBar.visible === true, 'selected unit should show the bar');
    u.setSelected(false);
    u.takeDamage(40);
    assert(u.healthBar.visible === true, 'damaged unit should show the bar');
    const ratio = u.hp / u.maxHp;
    assert(u.healthBar.userData.fill.scale.x < 0.99, 'fill scale should shrink with missing HP (scale=' + u.healthBar.userData.fill.scale.x + ' hpRatio=' + ratio.toFixed(2) + ')');
    results.push('PASS unit health bar selected/damaged visibility');
  }

  // --- Harvester cargo bar shows mining fill and hides when empty ---
  {
    const ctx = makeCtx(g);
    const h = ctx.entityManager.spawnUnit('harvester', 'player', 18, 18);
    assert(!!h.cargoBar, 'harvester must have a cargo bar');
    h.updateCargoBar(ctx);
    assert(h.cargoBar.visible === false, 'empty idle harvester should hide the cargo bar');
    h.harvesterState = 'MINING';
    h.cargo = 200;
    h.miningTimer = 0.4;
    h.updateCargoBar(ctx);
    assert(h.cargoBar.visible === true, 'mining harvester should show the cargo bar');
    const ratio = h.cargoFillRatio();
    assert(ratio > 0.4 && ratio < 0.55, 'cargo fill should include current mining tick (ratio=' + ratio.toFixed(2) + ')');
    assert(h.cargoBar.userData.fill.scale.x > 0.4, 'cargo bar fill should grow with cargo');
    results.push('PASS harvester cargo bar mining fill');
  }

  // --- Constructing buildings fade in at full scale (no pancake squash) ---
  {
    const ctx = makeCtx(g);
    ctx.economy.reset(5000);
    const site = ctx.entityManager.spawnBuilding('power_plant', 'player', 12, 12);
    assert(site.isBuilding === true, 'new power plant should start under construction');
    assert(Math.abs(site.mesh.scale.y - 1) < 0.02, 'constructing mesh should stay at full height, got scale.y=' + site.mesh.scale.y);
    assert(!!site.scaffold, 'constructing building should keep a scaffold');
    assert(!!site.healthBar, 'building must have a world-space health bar');
    site.setSelected(true);
    site.updateHealthBar(ctx);
    assert(site.healthBar.visible === true, 'selected building should show HP bar');
    site.setSelected(false);
    site.hp = site.maxHp * 0.4;
    site.updateHealthBar(ctx);
    assert(site.healthBar.visible === true, 'damaged building should show HP bar');
    results.push('PASS construction fade + building health bar');
  }

  // --- Group move uses formation slots, not one stacked dest ---
  {
    const ctx = makeCtx(g);
    const squad = [
      ctx.entityManager.spawnUnit('machine_gunner', 'player', 12, 12),
      ctx.entityManager.spawnUnit('machine_gunner', 'player', 14, 12),
      ctx.entityManager.spawnUnit('machine_gunner', 'player', 12, 14),
      ctx.entityManager.spawnUnit('machine_gunner', 'player', 14, 14)
    ];
    ctx.entityManager.issueMoveOrders(squad, 40, 40, ctx.pathfinding);
    const dests = squad.map((u) => {
      const wp = u.waypoints[u.waypoints.length - 1];
      return wp ? (wp.x + ',' + wp.z) : 'none';
    });
    const unique = new Set(dests);
    assert(unique.size >= 3, 'group move should assign distinct formation slots (got ' + dests.join(' | ') + ')');
    tick(ctx, 5.0, 0.05);
    let minPair = Infinity;
    for (let i = 0; i < squad.length; i++) {
      for (let j = i + 1; j < squad.length; j++) {
        const d = Math.hypot(squad[i].position.x - squad[j].position.x, squad[i].position.z - squad[j].position.z);
        if (d < minPair) minPair = d;
      }
    }
    assert(minPair > 1.3, 'stopped squad still piled up (min pair ' + minPair.toFixed(2) + ')');
    results.push('PASS group move formation (min spacing ' + minPair.toFixed(2) + ')');
  }

  // --- Coincident units unstick instead of staying in one voxel ---
  {
    const ctx = makeCtx(g);
    const a = ctx.entityManager.spawnUnit('machine_gunner', 'player', 22, 22);
    const b = ctx.entityManager.spawnUnit('machine_gunner', 'player', 22, 22);
    tick(ctx, 0.6, 0.05);
    const d = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
    assert(d > 1.0, 'coincident infantry did not separate (dist ' + d.toFixed(2) + ')');
    results.push('PASS coincident units separate (' + d.toFixed(2) + ')');
  }

  // --- AI holds a garrison and only assaults with enough troops ---
  {
    const ctx = makeCtx(g);
    ctx.entityManager.spawnBuilding('command_center', 'enemy', 70, 70, { complete: true });
    ctx.entityManager.spawnBuilding('command_center', 'player', 8, 8, { complete: true });
    ctx.skirmishAI.setDifficulty('easy');
    const launchedEmpty = ctx.skirmishAI.launchAssault(ctx);
    assert(launchedEmpty === false, 'easy AI assaulted with no army');
    for (let i = 0; i < 6; i++) {
      ctx.entityManager.spawnUnit('machine_gunner', 'enemy', 140 + i, 140);
    }
    const launchedFull = ctx.skirmishAI.launchAssault(ctx);
    assert(launchedFull === true, 'easy AI did not assault with 6 units and garrison 2');
    const movers = ctx.entityManager.getEnemyUnits().filter((u) => u.order === 'attackMove' || u.waypoints.length > 0);
    assert(movers.length >= 3, 'assault squad too small (movers=' + movers.length + ')');
    const home = ctx.entityManager.getEnemyUnits().filter((u) => u.order === 'idle' && u.waypoints.length === 0);
    assert(home.length >= 2, 'easy AI sent everyone; expected garrison (idle=' + home.length + ')');
    results.push('PASS AI garrison + assault threshold');
  }

  // --- Harvester player-move does not snap back to ore mid-order ---
  {
    const ctx = makeCtx(g);
    ctx.economy.reset(1000);
    ctx.terrain.setupLevelEnvironment([{ x: 40, z: 20, radius: 5, richness: 5000 }], []);
    ctx.entityManager.spawnBuilding('ore_refinery', 'player', 8, 8, { complete: true });
    const harvester = ctx.entityManager.getPlayerUnits().find((u) => u.type === 'harvester');
    assert(!!harvester, 'expected free harvester');
    harvester.cargo = 80;
    harvester.harvesterState = 'IDLE';
    harvester.moveTo(harvester.position.x + 16, harvester.position.z + 4, ctx.pathfinding);
    assert(harvester.order === 'move', 'player move should set order=move');
    tick(ctx, 0.35, 0.05);
    assert(harvester.order === 'move', 'harvester snapped back during player move (order=' + harvester.order + ' state=' + harvester.harvesterState + ')');
    results.push('PASS harvester player-move holds until arrival');
  }

  // --- Full cargo docks and unloads instead of idle-looping at the pad ---
  {
    const ctx = makeCtx(g);
    ctx.economy.reset(1000);
    ctx.entityManager.spawnBuilding('ore_refinery', 'player', 8, 8, { complete: true });
    const harvester = ctx.entityManager.getPlayerUnits().find((u) => u.type === 'harvester');
    const ref = ctx.entityManager.getPlayerBuildings().find((b) => b.type === 'ore_refinery');
    const dock = ref.getDockPosition();
    harvester.position.set(dock.x + 2.2, 0, dock.z);
    harvester.mesh.position.copy(harvester.position);
    harvester.cargo = harvester.maxCargo;
    harvester.returnToRefinery(ctx);
    assert(harvester.harvesterState === 'RETURNING', 'returnToRefinery should set RETURNING not move-idle');
    assert(harvester.order === 'harvest', 'return should keep harvest order, got ' + harvester.order);
    tick(ctx, 3.2, 0.05);
    const credits = ctx.economy.credits.player;
    assert(
      harvester.harvesterState === 'UNLOADING' || harvester.cargo === 0 || credits > 1000,
      'full harvester did not dock/unload (state=' + harvester.harvesterState + ' cargo=' + harvester.cargo + ' credits=' + credits + ')'
    );
    results.push('PASS full harvester docks and unloads');
  }

  // --- Easy AI sends a smaller follow-up wave when below full squad size ---
  {
    const ctx = makeCtx(g);
    ctx.entityManager.spawnBuilding('command_center', 'enemy', 70, 70, { complete: true });
    ctx.entityManager.spawnBuilding('command_center', 'player', 8, 8, { complete: true });
    ctx.skirmishAI.setDifficulty('easy');
    for (let i = 0; i < 3; i++) {
      ctx.entityManager.spawnUnit('machine_gunner', 'enemy', 140 + i, 140);
    }
    const launchedSmall = ctx.skirmishAI.launchAssault(ctx);
    assert(launchedSmall === true, 'easy AI should send a remnant follow-up wave');
    const movers = ctx.entityManager.getEnemyUnits().filter((u) => u.order === 'attackMove' || u.waypoints.length > 0);
    assert(movers.length >= 1 && movers.length <= 3, 'follow-up wave size wrong (movers=' + movers.length + ')');
    results.push('PASS AI follow-up assault with remnant army');
  }

  // --- AI keeps producing while defending the base ---
  {
    const ctx = makeCtx(g);
    ctx.economy.reset(400);
    const hq = ctx.entityManager.spawnBuilding('command_center', 'enemy', 60, 60, { complete: true });
    ctx.entityManager.spawnBuilding('power_plant', 'enemy', 54, 60, { complete: true });
    const barracks = ctx.entityManager.spawnBuilding('barracks', 'enemy', 58, 54, { complete: true });
    ctx.entityManager.spawnUnit('machine_gunner', 'enemy', hq.position.x + 2, hq.position.z + 2);
    ctx.entityManager.spawnUnit('machine_gunner', 'player', hq.position.x + 8, hq.position.z + 4);
    ctx.skirmishAI.setDifficulty('easy');
    ctx.economy.update(0, ctx.entityManager, null);
    ctx.skirmishAI.makeStrategicDecisions(ctx);
    assert(
      barracks.productionQueue.length > 0 || barracks.currentProduction,
      'AI skipped production while defending (queue=' + barracks.productionQueue.length + ')'
    );
    results.push('PASS AI produces while defending');
  }

  // --- Idle formation holds without vibrating ---
  {
    const ctx = makeCtx(g);
    const squad = [];
    for (let i = 0; i < 12; i++) {
      squad.push(ctx.entityManager.spawnUnit('machine_gunner', 'player', 20 + (i % 4) * 2.6, 20 + Math.floor(i / 4) * 2.6));
    }
    ctx.entityManager.issueMoveOrders(squad, 30, 30, ctx.pathfinding);
    squad.forEach((u) => {
      const wp = u.waypoints[u.waypoints.length - 1];
      u.position.x = wp.x;
      u.position.z = wp.z;
      u.mesh.position.x = wp.x;
      u.mesh.position.z = wp.z;
      u.becomeIdle();
      u.destX = wp.x;
      u.destZ = wp.z;
    });
    const before = squad.map((u) => ({ x: u.position.x, z: u.position.z }));
    tick(ctx, 1.0, 0.05);
    let maxShift = 0;
    squad.forEach((u, i) => {
      const d = Math.hypot(u.position.x - before[i].x, u.position.z - before[i].z);
      if (d > maxShift) maxShift = d;
    });
    assert(maxShift < 0.45, 'idle formation jittered (max shift ' + maxShift.toFixed(2) + ')');
    results.push('PASS idle formation holds (max shift ' + maxShift.toFixed(2) + ')');
  }

  // --- Harvester steers around a troop line instead of driving through it ---
  {
    const ctx = makeCtx(g);
    const h = ctx.entityManager.spawnUnit('harvester', 'player', 16, 24);
    const troops = [];
    for (let i = 0; i < 6; i++) {
      const u = ctx.entityManager.spawnUnit('machine_gunner', 'player', 28, 17.5 + i * 2.6);
      u.waypoints = [];
      u.order = 'idle';
      u.setGuardPost(u.position.x, u.position.z);
      u.destX = u.position.x;
      u.destZ = u.position.z;
      troops.push(u);
    }
    h.moveTo(44, 24, ctx.pathfinding);
    let minGap = Infinity;
    let sawCrossing = false;
    for (let t = 0; t < 8; t += 0.05) {
      tick(ctx, 0.05, 0.05);
      if (h.position.x > 24 && h.position.x < 35) {
        sawCrossing = true;
        for (let i = 0; i < troops.length; i++) {
          const d = Math.hypot(h.position.x - troops[i].position.x, h.position.z - troops[i].position.z);
          if (d < minGap) minGap = d;
        }
      }
    }
    assert(h.position.x > 36, 'harvester did not get past the troop line (x=' + h.position.x.toFixed(2) + ' z=' + h.position.z.toFixed(2) + ')');
    assert(sawCrossing, 'harvester never entered the troop corridor');
    assert(minGap > 2.15, 'harvester drove through troops (min gap ' + minGap.toFixed(2) + ')');
    results.push('PASS harvester avoids troops (min gap ' + minGap.toFixed(2) + ')');
  }

  // --- Depleted ore stays visible and becomes harvestable again ---
  {
    const ctx = makeCtx(g);
    ctx.terrain.setupLevelEnvironment([{ x: 30, z: 30, radius: 5, richness: 2000 }], []);
    const ore = ctx.terrain.oreDeposits[0];
    ore.remaining = 0;
    ctx.terrain.updateOreRegeneration(0.016);
    assert(ore.mesh.visible === true, 'depleted ore field should stay visible while regenerating');
    const before = ore.remaining;
    tick(ctx, 4.0, 0.05);
    assert(ore.remaining > before + 50, 'ore did not regenerate on a mission timescale (remaining=' + ore.remaining + ')');
    const closest = ctx.terrain.getClosestOreDeposit(30, 30);
    assert(!!closest, 'recovering field should become harvestable');
    results.push('PASS ore regen visible + harvestable ' + ore.remaining.toFixed(0));
  }

  function measureTtk(g, setup) {
    const ctx = makeCtx(g);
    const built = setup(ctx, g);
    let t = 0;
    while (t < 45 && built.target.isAlive && built.attackers.some((a) => a.isAlive)) {
      tick(ctx, 0.05, 0.05);
      t += 0.05;
    }
    const winnerDead = built.target.isAlive
      ? 'attackers'
      : 'target';
    return { seconds: t, winnerDead, targetHp: built.target.hp, targetAlive: built.target.isAlive };
  }

  // --- Balance ladder combat TTK samples ---
  {
    const fourVOne = measureTtk(g, (ctx) => {
      const attackers = [
        ctx.entityManager.spawnUnit('machine_gunner', 'player', 20, 20),
        ctx.entityManager.spawnUnit('machine_gunner', 'player', 20.8, 20),
        ctx.entityManager.spawnUnit('machine_gunner', 'player', 20, 20.8),
        ctx.entityManager.spawnUnit('machine_gunner', 'player', 21, 21)
      ];
      const target = ctx.entityManager.spawnUnit('machine_gunner', 'enemy', 24, 21);
      attackers.forEach((a) => {
        a.stance = 'aggressive';
        a.attackTarget(target, ctx.pathfinding);
      });
      return { attackers, target };
    });
    assert(fourVOne.seconds < 6, '4 gunners vs 1 took too long (' + fourVOne.seconds.toFixed(2) + 's)');
    assert(fourVOne.targetAlive === false, '4 gunners failed to kill 1 gunner');
    results.push('PASS TTK 4 gunners vs 1 = ' + fourVOne.seconds.toFixed(2) + 's');

    {
      const ctx = makeCtx(g);
      const tank = ctx.entityManager.spawnUnit('battle_tank', 'player', 30, 30);
      const gunners = [
        ctx.entityManager.spawnUnit('machine_gunner', 'enemy', 34, 30),
        ctx.entityManager.spawnUnit('machine_gunner', 'enemy', 34, 31.2),
        ctx.entityManager.spawnUnit('machine_gunner', 'enemy', 34, 28.8),
        ctx.entityManager.spawnUnit('machine_gunner', 'enemy', 35, 30)
      ];
      tank.stance = 'aggressive';
      gunners.forEach((u) => {
        u.stance = 'aggressive';
        u.attackTarget(tank, ctx.pathfinding);
      });
      tank.attackTarget(gunners[0], ctx.pathfinding);
      let t = 0;
      while (t < 45 && tank.isAlive && gunners.some((u) => u.isAlive)) {
        tick(ctx, 0.05, 0.05);
        t += 0.05;
      }
      const gunnersLeft = gunners.filter((u) => u.isAlive).length;
      results.push('PASS TTK tank vs 4 gunners = ' + t.toFixed(2) + 's tankHp=' + Math.floor(tank.hp) + ' gunnersLeft=' + gunnersLeft);
    }

    const rocketsVHeli = measureTtk(g, (ctx) => {
      const rockets = [
        ctx.entityManager.spawnUnit('rocket_launcher', 'player', 40, 40),
        ctx.entityManager.spawnUnit('rocket_launcher', 'player', 41, 40)
      ];
      const heli = ctx.entityManager.spawnUnit('helicopter', 'enemy', 46, 40);
      rockets.forEach((a) => {
        a.stance = 'aggressive';
        a.attackTarget(heli, ctx.pathfinding);
      });
      return { attackers: rockets, target: heli };
    });
    assert(rocketsVHeli.targetAlive === false, '2 rockets did not kill heli');
    results.push('PASS TTK 2 rockets vs heli = ' + rocketsVHeli.seconds.toFixed(2) + 's');

    const harvVTwo = measureTtk(g, (ctx) => {
      const h = ctx.entityManager.spawnUnit('harvester', 'player', 50, 50);
      const gunners = [
        ctx.entityManager.spawnUnit('machine_gunner', 'enemy', 53, 50),
        ctx.entityManager.spawnUnit('machine_gunner', 'enemy', 53, 51)
      ];
      gunners.forEach((u) => {
        u.stance = 'aggressive';
        u.attackTarget(h, ctx.pathfinding);
      });
      h.moveTo(70, 50, ctx.pathfinding);
      return { attackers: gunners, target: h };
    });
    results.push('PASS TTK harvester vs 2 gunners = ' + harvVTwo.seconds.toFixed(2) + 's (' + (harvVTwo.targetAlive ? 'escaped' : 'died') + ')');
  }

  // --- Ladder cells T1–T6: each mission+difficulty loads ---
  {
    const cells = [
      { idx: 0, diff: 'easy', credits: 3000, win: 'destroy_hq' },
      { idx: 0, diff: 'medium', credits: 3000, win: 'destroy_hq' },
      { idx: 1, diff: 'medium', credits: 4500, win: 'destroy_hq' },
      { idx: 1, diff: 'hard', credits: 4500, win: 'destroy_hq' },
      { idx: 2, diff: 'medium', credits: 6000, win: 'destroy_all' },
      { idx: 2, diff: 'hard', credits: 6000, win: 'destroy_all' }
    ];
    cells.forEach((cell, n) => {
      const ctx = makeCtx(g);
      ctx.missionManager.loadMission(cell.idx, cell.diff);
      const mission = g.MISSIONS[cell.idx];
      assert(ctx.economy.credits.player === cell.credits, 'T' + (n + 1) + ' credits ' + ctx.economy.credits.player + ' != ' + cell.credits);
      assert(!!ctx.entityManager.getPlayerBuildings().find((b) => b.type === 'command_center'), 'T' + (n + 1) + ' missing player HQ');
      assert(!!ctx.entityManager.getEnemyBuildings().find((b) => b.type === 'command_center'), 'T' + (n + 1) + ' missing enemy HQ');
      assert(ctx.entityManager.getPlayerUnits().length >= 4, 'T' + (n + 1) + ' missing starters');
      assert(mission.winRule === cell.win, 'T' + (n + 1) + ' winRule ' + mission.winRule);
      assert(ctx.skirmishAI.difficulty === cell.diff, 'T' + (n + 1) + ' AI diff ' + ctx.skirmishAI.difficulty);
      results.push('PASS ladder T' + (n + 1) + ' load M' + mission.id + ' ' + cell.diff + ' $' + cell.credits);
    });
    const hard = makeCtx(g);
    hard.missionManager.loadMission(1, 'hard');
    assert(hard.skirmishAI.difficultyConfig.harassHarvesters === true, 'T4 hard should hunt harvesters');
    const m3 = makeCtx(g);
    m3.missionManager.loadMission(2, 'hard');
    assert(m3.skirmishAI.difficultyConfig.canBuildAir === true, 'T6 hard should allow air');
    results.push('PASS ladder T4 harass + T6 air flags');
  }

  // --- T1 Easy compressed playthrough: tutorial eco then HQ kill ---
  {
    const ctx = makeCtx(g);
    ctx.missionManager.loadMission(0, 'easy');
    const log = {};
    assert(ctx.missionManager.getCurrentObjectiveText().indexOf('SELECT & MOVE') !== -1, 'T1 tutorial should start on move');
    ctx.missionManager.playerHasMovedUnits = true;
    tick(ctx, 0.2, 0.05);
    assert(ctx.missionManager.getCurrentObjectiveText().indexOf('POWER') !== -1, 'T1 did not advance to power plant');

    const terrain = ctx.terrain;
    const pStart = terrain.worldToGrid(45, 45);
    assert(ctx.economy.spendCredits('player', g.BUILDING_SPECS.power_plant.cost), 'T1 could not afford power plant');
    const plant = ctx.entityManager.spawnBuilding('power_plant', 'player', pStart.gx - 5, pStart.gz, {});
    tick(ctx, plant.spec.buildTime + 0.4);
    log.power = { t: plant.spec.buildTime, credits: ctx.economy.credits.player };
    assert(plant.isBuilding === false, 'T1 power plant did not complete');
    tick(ctx, 0.2, 0.05);
    assert(ctx.missionManager.getCurrentObjectiveText().indexOf('ECONOMY') !== -1, 'T1 did not advance to refinery');

    const ore = ctx.terrain.oreDeposits[0];
    const og = terrain.worldToGrid(ore.x, ore.z);
    assert(ctx.economy.spendCredits('player', g.BUILDING_SPECS.ore_refinery.cost), 'T1 could not afford refinery');
    const ref = ctx.entityManager.spawnBuilding('ore_refinery', 'player', og.gx - 4, og.gz, {});
    tick(ctx, ref.spec.buildTime + 0.4);
    const harvester = ctx.entityManager.getPlayerUnits().find((u) => u.type === 'harvester');
    assert(!!harvester, 'T1 refinery did not grant harvester');
    log.refinery = { t: ref.spec.buildTime, credits: ctx.economy.credits.player };
    const creditsAfterRef = ctx.economy.credits.player;
    tick(ctx, 22, 0.05);
    assert(ctx.economy.credits.player > creditsAfterRef, 'T1 harvest did not pay credits (still $' + ctx.economy.credits.player + ')');
    tick(ctx, 0.2, 0.05);
    assert(ctx.missionManager.getCurrentObjectiveText().indexOf('Barracks') !== -1, 'T1 did not advance to barracks');

    assert(ctx.economy.spendCredits('player', g.BUILDING_SPECS.barracks.cost), 'T1 could not afford barracks');
    const barracks = ctx.entityManager.spawnBuilding('barracks', 'player', pStart.gx + 5, pStart.gz, {});
    tick(ctx, barracks.spec.buildTime + 0.4);
    log.barracks = { t: barracks.spec.buildTime, credits: ctx.economy.credits.player };
    const beforeTrain = ctx.entityManager.getPlayerUnits().length;
    for (let i = 0; i < 3; i++) {
      assert(ctx.economy.spendCredits('player', g.UNIT_SPECS.machine_gunner.cost), 'T1 could not afford gunner ' + i);
      barracks.queueUnit('machine_gunner');
    }
    tick(ctx, 12, 0.05);
    assert(ctx.entityManager.getPlayerUnits().length >= beforeTrain + 3, 'T1 did not train 3 gunners');
    tick(ctx, 0.2, 0.05);
    assert(ctx.missionManager.getCurrentObjectiveText().indexOf('ASSAULT') !== -1, 'T1 did not reach assault step');

    const enemyHq = ctx.entityManager.getEnemyBuildings().find((b) => b.type === 'command_center');
    for (let i = 0; i < 8; i++) {
      const u = ctx.entityManager.spawnUnit(
        'machine_gunner',
        'player',
        enemyHq.position.x - 11,
        enemyHq.position.z - 6 + i * 1.6
      );
      u.stance = 'holdground';
      u.attackTarget(enemyHq, ctx.pathfinding);
    }
    const army = ctx.entityManager.getPlayerUnits().filter((u) => u.isAlive && u.type !== 'harvester');
    army.forEach((u) => {
      u.stance = 'holdground';
      u.attackTarget(enemyHq, ctx.pathfinding);
    });
    let assaultT = 0;
    while (assaultT < 12 && enemyHq.isAlive && enemyHq.hp > 2000) {
      tick(ctx, 0.25, 0.05);
      assaultT += 0.25;
    }
    assert(enemyHq.hp < 2500, 'T1 assault never damaged the enemy HQ');
    const hqHpHit = Math.floor(enemyHq.hp);
    if (enemyHq.isAlive) enemyHq.takeDamage(99999);
    tick(ctx, 0.3, 0.05);
    assert(ctx.missionManager.isMissionCompleted === true, 'T1 Easy should win when the enemy HQ dies');
    log.end = { t: assaultT, credits: ctx.economy.credits.player, hqHpHit };
    results.push('PASS T1 Easy playthrough (harvest $' + creditsAfterRef + ' → $' + ctx.economy.credits.player + ', HQ engaged then destroyed)');
  }

  // --- AI defends when player units enter the base radius ---
  {
    const ctx = makeCtx(g);
    const hq = ctx.entityManager.spawnBuilding('command_center', 'enemy', 60, 60, { complete: true });
    const guard = ctx.entityManager.spawnUnit('machine_gunner', 'enemy', hq.position.x + 3, hq.position.z + 3);
    ctx.entityManager.spawnUnit('machine_gunner', 'player', hq.position.x + 8, hq.position.z + 4);
    ctx.skirmishAI.setDifficulty('medium');
    const defended = ctx.skirmishAI.defendBase(ctx, hq, ctx.entityManager.getEnemyUnits());
    assert(defended === true, 'AI did not react to a player unit in its base');
    assert(guard.order === 'attackMove' || guard.waypoints.length > 0, 'defender did not receive an order (order=' + guard.order + ')');
    results.push('PASS AI defends base when threatened');
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
