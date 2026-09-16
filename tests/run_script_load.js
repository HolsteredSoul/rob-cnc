'use strict';

const { createSandbox, loadGameScripts, fireDOMContentLoaded } = require('./browser_sandbox');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

try {
  const sandbox = createSandbox();
  assert(sandbox.module === undefined, 'sandbox leaked Node module');
  assert(sandbox.require === undefined, 'sandbox leaked Node require');
  assert(sandbox.exports === undefined, 'sandbox leaked Node exports');

  const scripts = loadGameScripts(sandbox, { includeMain: true });
  console.log('loaded scripts:', scripts.join(', '));
  assert(scripts.every((s) => !s.startsWith('http')), 'scripts must be local <script src> files');
  assert(scripts.indexOf('js/engine/scene_resources.js') !== -1, 'scene resource helper must load before model scripts');

  fireDOMContentLoaded(sandbox);

  assert(typeof sandbox.THREE === 'object', 'THREE was not installed on window (possible module leak)');
  assert(sandbox.hud, 'window.hud missing after DOMContentLoaded');
  assert(sandbox.hud.ctx, 'window.hud.ctx missing');
  assert(sandbox.gameContext, 'window.gameContext missing');

  const ctx = sandbox.hud.ctx;
  ctx.missionManager.loadMission(0, 'easy');
  sandbox.hud.refreshBuildCards();

  const playerBuildings = ctx.entityManager.getPlayerBuildings();
  const playerUnits = ctx.entityManager.getPlayerUnits();
  const hq = playerBuildings.find((b) => b.type === 'command_center');
  assert(!!hq, 'Mission 1 missing player command center');
  assert(playerUnits.length >= 4, 'Mission 1 missing starter units (got ' + playerUnits.length + ')');

  const creditsEl = sandbox.document.getElementById('credits-val');
  sandbox.hud.update(0.016);
  const creditsText = creditsEl.textContent;
  console.log('credits display:', creditsText);
  const creditsNum = Number(String(creditsText).replace(/[^0-9]/g, ''));
  assert(creditsNum > 0, 'credits display is not a positive number: ' + creditsText);

  const mover = playerUnits[0];
  const x0 = mover.position.x;
  const z0 = mover.position.z;
  mover.moveTo(x0 + 12, z0 + 8, ctx.pathfinding);
  assert(mover.waypoints.length > 0, 'move order did not assign waypoints');
  const wp = mover.waypoints[mover.waypoints.length - 1];
  const destChanged = (wp.x !== x0) || (wp.z !== z0);
  assert(destChanged, 'move order did not change unit waypoint/position');

  const grid = sandbox.document.getElementById('build-grid');
  const cards = (grid && grid.children ? grid.children : []).filter((c) => c.classList && c.classList.contains('build-card'));
  assert(cards.length > 0, 'sidebar has no structure/infantry cards');
  const types = cards.map((c) => c.dataset.type);
  assert(types.indexOf('power_plant') !== -1, 'structures tab missing power plant card');
  console.log('sidebar cards:', types.join(', '));

  const locked = cards.filter((c) => c.classList.contains('locked')).map((c) => c.dataset.type);
  const unlocked = cards.filter((c) => !c.classList.contains('locked')).map((c) => c.dataset.type);
  console.log('locked cards:', locked.join(', ') || '(none)');
  console.log('unlocked cards:', unlocked.join(', ') || '(none)');
  assert(unlocked.indexOf('power_plant') !== -1, 'power plant should be unlocked at mission start');
  assert(locked.indexOf('ore_refinery') !== -1 || locked.indexOf('war_factory') !== -1, 'tech-gated cards should be locked');
  assert(typeof sandbox.isPlayerRadarOperational === 'function' && !sandbox.isPlayerRadarOperational(ctx), 'missing radar must not be operational');
  const powerCard = cards.find((c) => c.dataset.type === 'power_plant');
  assert(powerCard && powerCard._listeners && powerCard._listeners.keydown, 'power plant card is not keyboard wired');
  powerCard._listeners.keydown[0]({ type: 'keydown', key: 'Enter', preventDefault() {}, stopPropagation() {} });
  assert(ctx.inputManager.placementBuildingType === 'power_plant', 'Enter should activate a focused build card');
  ctx.inputManager.cancelBuildingPlacement();

  const renderer = ctx.renderer;
  // Locked hover must run on movement, use virtual coordinates, and clear off-card.
  const originalElementFromPoint = sandbox.document.elementFromPoint;
  renderer.pointerLocked = true;
  renderer.virtualCursor = { x: 123, y: 234 };
  sandbox.document.elementFromPoint = (x, y) => {
    assert(x === 123 && y === 234, 'tooltip hit-test used lock-element coordinates');
    return powerCard;
  };
  ctx.inputManager.onMouseMove({ clientX: 500, clientY: 400 });
  assert(sandbox.hud.tooltipEl.style.display === 'block', 'locked movement did not show build tooltip');
  assert(sandbox.document.getElementById('tooltip-title').textContent === 'Power Plant', 'wrong virtual hover tooltip');
  sandbox.document.elementFromPoint = () => null;
  ctx.inputManager.onMouseMove({ clientX: 500, clientY: 400 });
  assert(sandbox.hud.tooltipEl.style.display === 'none', 'locked tooltip remained after leaving card');
  sandbox.document.elementFromPoint = originalElementFromPoint;
  renderer.pointerLocked = false;
  sandbox.dispatchEvent({ type: 'keydown', key: 'w', target: powerCard, preventDefault() {} });
  assert(!renderer.keysDown.w, 'focused build card also activated camera panning');
  sandbox.dispatchEvent({ type: 'keyup', key: 'w', target: powerCard });
  console.log('keyboard camera guard / virtual build tooltip: ok');

  // Readiness and command execution both reject unfinished or unpowered radar.
  const radar = ctx.entityManager.spawnBuilding('radar_facility', 'player', 55, 55);
  ctx.economy.update(0, ctx.entityManager, null);
  sandbox.hud.update(0);
  assert(sandbox.hud.btnAirstrike.disabled, 'unfinished radar enabled Airstrike');
  const jetsBefore = ctx.entityManager.units.filter(u => u.type === 'harrier_jet').length;
  ctx.inputManager.executeAirstrikeAtMouse(100, 100);
  assert(ctx.entityManager.units.filter(u => u.type === 'harrier_jet').length === jetsBefore, 'unfinished radar allowed airstrike execution');
  radar.finishConstruction(ctx);
  ctx.economy.update(0, ctx.entityManager, null);
  assert(!sandbox.isPlayerRadarOperational(ctx), 'unpowered radar was operational');
  const power = ctx.entityManager.spawnBuilding('power_plant', 'player', 50, 55, { complete: true });
  ctx.economy.update(0, ctx.entityManager, null);
  sandbox.hud.update(0);
  assert(!sandbox.hud.btnAirstrike.disabled, 'completed powered radar did not enable Airstrike');
  power.takeDamage(power.maxHp + 1);
  ctx.economy.update(0, ctx.entityManager, null);
  ctx.inputManager.executeAirstrikeAtMouse(100, 100);
  assert(ctx.entityManager.units.filter(u => u.type === 'harrier_jet').length === jetsBefore, 'power loss after arming allowed airstrike execution');
  console.log('radar construction / power-loss command guard: ok');

  renderer.pointerInside = false;
  renderer.pointerLocked = false;
  renderer.virtualCursor = { x: 0, y: 0 };
  const idlePan = renderer.getEdgePan();
  assert(idlePan.x === 0 && idlePan.z === 0, 'edge pan must be zero when the pointer left the window');
  renderer.pointerInside = true;
  renderer.virtualCursor = { x: 0, y: 200 };
  renderer.lockRoot = { getBoundingClientRect() { return { left: 0, top: 0, right: 1000, bottom: 720 }; } };
  const edgePan = renderer.getEdgePan();
  assert(edgePan.x < 0, 'left-edge pan should move camera left/west');
  renderer.setPlayCapture(true);
  assert(renderer.lockEnabled === true, 'play capture should enable pointer lock');
  assert(renderer.pointerLocked === false, 'deploy must not steal the cursor before a battlefield click');
  renderer.seedVirtualCursor(120, 80);
  renderer.pointerLocked = true;
  const lockedPt = renderer.getPointerClient({ clientX: 500, clientY: 400 });
  assert(lockedPt.x === 120 && lockedPt.y === 80, 'locked picks must use the seeded cursor, not the lock-element center');
  renderer._lockWarmup = 3;
  const before = { x: renderer.virtualCursor.x, y: renderer.virtualCursor.y };
  renderer.applyMouseMove({ movementX: 400, movementY: -300, clientX: 0, clientY: 0 });
  assert(renderer.virtualCursor.x === before.x && renderer.virtualCursor.y === before.y, 'lock recenter jump must not move the virtual cursor');
  renderer._lockWarmup = 0;
  renderer.cursorSensitivity = 1;
  renderer.lockRoot = { getBoundingClientRect() { return { left: 0, top: 0, right: 1920, bottom: 1080 }; } };
  renderer.virtualCursor = { x: 200, y: 200 };
  renderer.applyMouseMove({ movementX: 10, movementY: 0, clientX: 0, clientY: 0 });
  assert(renderer.virtualCursor.x > 210, 'locked cursor should scale with window size (x=' + renderer.virtualCursor.x + ')');
  renderer.setPlayCapture(false);
  assert(renderer.lockEnabled === false, 'lobby should release pointer lock');
  console.log('pointer lock / edge-pan idle: ok');

  const mini = ctx.minimap;
  assert(mini && typeof mini.panFromClient === 'function', 'minimap missing panFromClient');
  const camBefore = { x: ctx.renderer.targetPos.x, z: ctx.renderer.targetPos.z };
  mini.canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 220, height: 200, right: 220, bottom: 200 });
  mini.panFromClient(200, 180);
  assert(
    ctx.renderer.targetPos.x !== camBefore.x || ctx.renderer.targetPos.z !== camBefore.z,
    'radar click did not pan camera'
  );
  console.log('radar panFromClient: ok');

  console.log('SCRIPT_LOAD_OK');
  process.exit(0);
} catch (err) {
  console.error('FAIL ' + err.message);
  console.error(err.stack);
  process.exit(1);
}
