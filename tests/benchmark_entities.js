'use strict';

// CPU-only proximity benchmark; run with: node tests/benchmark_entities.js
// Uses shipped entities. Rendering, pathfinding, and AI are not timed.
const { performance } = require('perf_hooks');
const { createSandbox, loadGameScripts } = require('./browser_sandbox');
const game = createSandbox();
loadGameScripts(game);

function measure(work) {
  for (let i = 0; i < 20; i++) work();
  const samples = [];
  for (let sample = 0; sample < 5; sample++) {
    const start = performance.now();
    for (let frame = 0; frame < 100; frame++) work();
    samples.push((performance.now() - start) / 100);
  }
  samples.sort((a, b) => a - b);
  return Number(samples[2].toFixed(3));
}

for (const count of [32, 96, 192]) {
  const scene = new game.THREE.Scene();
  const terrain = new game.Terrain(scene);
  const entities = new game.EntityManager(scene, terrain);
  for (let i = 0; i < count; i++) {
    entities.spawnUnit('machine_gunner', i % 2 ? 'enemy' : 'player', 10 + (i % 16) * 11, 10 + Math.floor(i / 16) * 11);
  }
  const separation = measure(() => entities.applyUnitSeparation(1 / 60));
  const targeting = measure(() => entities.units.forEach(unit => {
    entities.findClosestEnemy(unit.position, 24, unit.faction);
  }));
  // Reset a congested moving formation each frame so warmup cannot disperse it.
  const congested = measure(() => {
    entities.units.forEach((unit, i) => {
      unit.position.set(50 + (i % 16) * 1.4, 0, 50 + Math.floor(i / 16) * 1.4);
      unit.waypoints = [{ x: 100, z: 100 }];
    });
    entities.applyUnitSeparation(1 / 60);
  });
  console.log(JSON.stringify({ units: count, separationMs: separation, allUnitTargetingMs: targeting, congestedSeparationIncludingResetMs: congested }));
  entities.clearAll();
}
