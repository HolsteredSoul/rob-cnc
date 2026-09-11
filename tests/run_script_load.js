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

  const renderer = ctx.renderer;
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
  renderer.setPlayCapture(false);
  assert(renderer.lockEnabled === false, 'lobby should release pointer lock');
  console.log('pointer lock / edge-pan idle: ok');

  console.log('SCRIPT_LOAD_OK');
  process.exit(0);
} catch (err) {
  console.error('FAIL ' + err.message);
  console.error(err.stack);
  process.exit(1);
}
