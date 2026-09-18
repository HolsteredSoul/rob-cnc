'use strict';
const assert = require('assert');
const { createSandbox, loadGameScripts, fireDOMContentLoaded } = require('./browser_sandbox');
const s = createSandbox();
let now = 0;
let nextFrame;
s.performance.now = () => now;
s.requestAnimationFrame = fn => { nextFrame = fn; return 1; };
// Register new UI controls in the existing lightweight DOM fixture.
for (const id of ['btn-pause', 'btn-speed', 'btn-resume-menu', 'rotate-prompt', 'mobile-power',
  'btn-place', 'btn-cancel-command', 'placement-controls', 'placement-help', 'btn-select-area',
  'modal-sell', 'sell-description', 'btn-confirm-sell', 'btn-cancel-sell', 'mobile-more',
  'btn-build', 'btn-map', 'btn-more', 'btn-stop', 'btn-touch-attack', 'command-feedback']) {
  const el = s.document.createElement(id.startsWith('btn') ? 'button' : 'div');
  el.id = id;
  s.document._byId.set(id, el);
  s.document.body.appendChild(el);
}
loadGameScripts(s, { includeMain: true });
fireDOMContentLoaded(s);
const ctx = s.gameContext;
const im = ctx.inputManager;
const em = ctx.entityManager;
const r = ctx.renderer;
function frame(dt = 0.05) { now += dt * 1000; nextFrame(now); }
function frames(n) { for (let i = 0; i < n; i++) frame(); }
function click(id) { s.document.getElementById(id)._listeners.click[0]({}); }
function pointer(type, x, y, id = 1) {
  const e = { type, pointerType: 'touch', pointerId: id, clientX: x, clientY: y, preventDefault() {} };
  im.canvas._listeners[type].forEach(fn => fn(e));
}
function tap(x, y) { pointer('pointerdown', x, y); pointer('pointerup', x, y); }
function reset() { ctx.missionManager.loadMission(0, 'easy'); ctx.missionActive = true; frame(); }
try {
  reset();
  r.setTouchInput(true);
  im.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 960, height: 720, right: 960, bottom: 720 });
  // Only the screen projection is substituted; orders and all managers are real.
  r.getGroundIntersection = (x, y) => new s.THREE.Vector3(x / 4, 0, y / 4);
  r.worldToScreen = p => ({ x: p.x * 4, y: p.z * 4, visible: true });
  const troop = em.getPlayerUnits()[0];
  tap(troop.position.x * 4, troop.position.z * 4);
  assert.strictEqual(em.selectedUnits[0], troop, 'tap selects a friendly unit');
  tap(280, 340);
  assert(troop.waypoints.length > 0, 'ground tap gives a real path');
  assert(ctx.missionManager.playerHasMovedUnits, 'touch movement progresses tutorial');
  const path = JSON.stringify(troop.waypoints);
  const camera = r.targetPos.clone();
  pointer('pointerdown', 300, 300); pointer('pointermove', 350, 340); pointer('pointerup', 350, 340);
  assert(!camera.equals(r.targetPos), 'drag pans camera');
  assert.strictEqual(JSON.stringify(troop.waypoints), path, 'drag cannot also order');
  const zoom = r.zoomLevel;
  pointer('pointerdown', 200, 200, 1); pointer('pointerdown', 300, 200, 2);
  pointer('pointermove', 350, 200, 2); pointer('pointerup', 350, 200, 2); pointer('pointerup', 200, 200, 1);
  assert(r.zoomLevel < zoom, 'pinch zooms in');
  assert.strictEqual(JSON.stringify(troop.waypoints), path, 'pinch cannot order on either release');
  pointer('pointerdown', 400, 300); pointer('pointercancel', 400, 300); pointer('pointerup', 400, 300);
  assert.strictEqual(JSON.stringify(troop.waypoints), path, 'cancelled tap cannot order');
  assert(im.ignoreMouse({}), 'compatibility mouse input suppressed');
  let requested = false;
  r.lockRoot.requestPointerLock = () => { requested = true; };
  r.setPlayCapture(true); r.requestPlayLock();
  assert(!requested, 'touch never requests pointer lock');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(r.getEdgePan())), { x: 0, z: 0 });
  console.log('PASS touch select, move, pan, pinch, cancel and mouse suppression');

  im.selectArea = true;
  pointer('pointerdown', 130, 200); pointer('pointermove', 210, 240); pointer('pointerup', 210, 240);
  assert.strictEqual(em.selectedUnits.length, 4, 'area selection uses projected units');
  assert(!im.selectArea, 'area mode ends after one rectangle');
  const harv = em.spawnUnit('harvester', 'player', 80, 60);
  em.spawnUnit('engineer', 'player', 85, 60);
  im.quickSelect('all'); assert.strictEqual(em.selectedUnits.length, 4, 'army excludes utility units');
  em.assignControlGroup(1); em.clearSelection(); em.selectControlGroup(1);
  assert.strictEqual(em.selectedUnits.length, 4, 'group recalls the squad');
  im.quickSelect('harvesters'); assert.strictEqual(em.selectedUnits[0], harv, 'idle harvester shortcut');
  console.log('PASS area selection, army filters, control groups and idle harvesters');

  const enemy = em.spawnUnit('machine_gunner', 'enemy', 100, 80);
  const visible = ctx.fogOfWar.isVisible.bind(ctx.fogOfWar);
  ctx.fogOfWar.isVisible = () => false;
  assert.strictEqual(im.pickTouchEntity({ x: 400, y: 320 }), null, 'hidden enemy not targetable');
  ctx.fogOfWar.isVisible = () => true;
  assert.strictEqual(im.pickTouchEntity({ x: 420, y: 320 }), enemy, 'screen tolerance finds nearby visible enemy');
  em.selectSingle(troop); tap(400, 320);
  assert.strictEqual(troop.targetEntity, enemy, 'visible enemy tap attacks');
  ctx.fogOfWar.isVisible = visible;
  const overlapping = em.spawnUnit('machine_gunner', 'player', troop.position.x + 1, troop.position.z);
  assert.strictEqual(im.getEntityAt(overlapping.position.x, overlapping.position.z), overlapping, 'overlapping direct hits pick nearest unit');
  em.selectSingle(troop);
  im.setCommandMode('attackmove');
  const ore = ctx.terrain.oreDeposits[0];
  im.selectOrActOnEntity(null, new s.THREE.Vector3(ore.x, 0, ore.z), null);
  assert.strictEqual(troop.order, 'attackMove', 'explicit attack-move over ore stays attack-move');
  console.log('PASS forgiving targeting respects fog and explicit attack-move retains its semantics');

  reset();
  im.startBuildingPlacement('power_plant');
  assert(!im.ghostMesh.visible, 'touch ghost starts unpositioned');
  let site;
  for (let z = 15; z < 35 && !site; z++) for (let x = 15; x < 35; x++) {
    if (im.checkPlacementValidity(x, z, s.BUILDING_SPECS.power_plant.footprint)) { site = { x: x * 8, y: z * 8 }; break; }
  }
  assert(site, 'valid construction site exists');
  const credits = ctx.economy.credits.player;
  tap(site.x, site.y);
  assert(im.canPlaceCurrentGhost, 'tap positions a valid preview');
  assert.strictEqual(ctx.economy.credits.player, credits, 'preview does not spend');
  pointer('pointerdown', site.x, site.y); pointer('pointercancel', site.x, site.y);
  assert.strictEqual(ctx.economy.credits.player, credits, 'interruption does not build');
  click('btn-place');
  assert.strictEqual(ctx.economy.credits.player, credits - s.BUILDING_SPECS.power_plant.cost, 'Place spends once');
  assert(em.getPlayerBuildings().some(b => b.type === 'power_plant'), 'Place creates construction');
  const hq = em.getPlayerBuildings().find(b => b.type === 'command_center');
  ctx.hud.confirmSell(hq);
  assert(hq.isAlive, 'sell waits for confirmation');
  click('btn-cancel-sell'); assert(hq.isAlive, 'sell cancellation retains building');
  console.log('PASS placement preview, explicit confirmation and sell cancellation');

  ctx.pause();
  const before = JSON.stringify({ credits: ctx.economy.credits.player, units: em.units.map(u => [u.position.x, u.position.z, u.hp]),
    construction: em.buildings.map(b => b.constructionProgress) });
  em.selectSingle(em.getPlayerUnits()[0]);
  const order = JSON.stringify(em.selectedUnits[0].waypoints);
  tap(300, 400); // inspection is allowed but must not move anything
  em.selectSingle(em.getPlayerUnits()[0]);
  im.issueOrderAt(new s.THREE.Vector3(90, 0, 90));
  im.startBuildingPlacement('power_plant');
  ctx.hud.onBuildCardClicked({ type: 'power_plant', isBuilding: true, spec: s.BUILDING_SPECS.power_plant });
  frames(40);
  assert.strictEqual(JSON.stringify(em.selectedUnits[0].waypoints), order, 'orders blocked while paused');
  assert.strictEqual(JSON.stringify({ credits: ctx.economy.credits.player, units: em.units.map(u => [u.position.x, u.position.z, u.hp]),
    construction: em.buildings.map(b => b.constructionProgress) }), before, 'paused simulation stays frozen');
  assert(!im.placementBuildingType, 'pause cannot start construction');
  const totals = {};
  for (const [name, obj, method] of [['units/buildings', em, 'update'], ['ore', ctx.terrain, 'updateOreRegeneration'],
    ['projectiles', ctx.projectileManager, 'update'], ['economy', ctx.economy, 'update'], ['ai', ctx.skirmishAI, 'update'], ['mission', ctx.missionManager, 'update']]) {
    const original = obj[method].bind(obj);
    totals[name] = 0;
    obj[method] = (dt, ...args) => { totals[name] += dt; return original(dt, ...args); };
  }
  ctx.resume(); frame(); ctx.simulationSpeed = 0.5; frames(20);
  for (const [name, dt] of Object.entries(totals)) assert(Math.abs(dt - 0.5) < 1e-8, `${name} shares half-speed simulation time: ${dt}`);
  const halfProgress = em.getPlayerBuildings().find(b => b.type === 'power_plant').constructionProgress;
  assert(halfProgress > 0, 'real construction advances at half speed');
  console.log('PASS pause blocks spending/orders and half-speed scales every simulation subsystem');

  s.document.hidden = true; s.document.dispatchEvent({ type: 'visibilitychange' });
  assert(ctx.paused, 'backgrounding pauses');
  frame(100); s.document.hidden = false; s.document.dispatchEvent({ type: 'visibilitychange' });
  assert(ctx.paused, 'foreground requires explicit Resume');
  ctx.resume(); frame(100);
  assert.strictEqual(em.getPlayerBuildings().find(b => b.type === 'power_plant').constructionProgress, halfProgress, 'resume discards elapsed time');
  s.innerWidth = 390; s.innerHeight = 844; ctx.updateOrientation();
  assert(ctx.portraitBlocked && ctx.paused, 'portrait pauses');
  ctx.resume(); assert(ctx.paused, 'cannot resume in portrait');
  s.innerWidth = 844; s.innerHeight = 390; ctx.updateOrientation();
  assert(ctx.paused && !ctx.portraitBlocked, 'rotation back still requires Resume');
  ctx.resume(); assert(!ctx.paused, 'landscape resumes explicitly');
  ctx.hud.showMissionModal(); assert(ctx.paused, 'menu pauses');
  click('btn-resume-menu'); assert(!ctx.paused, 'menu Resume works');
  console.log('PASS background, rotation, menu and resume without catch-up');
  console.log('MOBILE_TESTS_OK');
  process.exit(0);
} catch (err) { console.error(err.stack); process.exit(1); }
