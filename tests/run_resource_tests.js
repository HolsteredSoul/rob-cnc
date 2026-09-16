'use strict';

const { createSandbox, loadScript, loadGameScripts } = require('./browser_sandbox');

function assert(ok, message) { if (!ok) throw new Error(message); }

function events(resource) {
  let count = 0;
  resource.addEventListener('dispose', () => { count += 1; });
  return () => count;
}

function run() {
  const g = createSandbox();
  loadScript(g, 'lib/three.min.js');
  loadScript(g, 'js/engine/scene_resources.js');
  loadScript(g, 'js/entities/projectiles.js');

  // A root may reuse one asset many times; dispose it exactly once. Sprite
  // geometry is renderer-owned and must remain untouched.
  const texture = new g.THREE.CanvasTexture(g.document.createElement('canvas'));
  const geometry = new g.THREE.BoxGeometry(1, 1, 1);
  const material = new g.THREE.MeshBasicMaterial({ map: texture });
  const root = new g.THREE.Group();
  root.add(new g.THREE.Mesh(geometry, material), new g.THREE.Mesh(geometry, material));
  const sprite = new g.THREE.Sprite(new g.THREE.SpriteMaterial({ map: texture }));
  root.add(sprite);
  const disposedGeometry = events(geometry);
  const disposedMaterial = events(material);
  const disposedTexture = events(texture);
  const disposedSpriteGeometry = events(sprite.geometry);
  g.SceneResources.disposeRoots([root]);
  g.SceneResources.disposeRoots([root]);
  assert(disposedGeometry() === 1 && disposedMaterial() === 1 && disposedTexture() === 1,
    'owned shared resources should dispose exactly once');
  assert(disposedSpriteGeometry() === 0, 'shared THREE.Sprite geometry must not be disposed');

  // Projectile clear removes transients but keeps manager-owned assets usable
  // through a mission reload and a second combat burst.
  const scene = new g.THREE.Scene();
  const manager = new g.ProjectileManager(scene);
  const cachedTracer = events(manager.tracerGeo);
  const cachedTexture = events(manager.fxTexture);
  const cachedSparkMaterial = events(manager.sparkMat);
  const from = new g.THREE.Vector3(2, 2, 2);
  const to = new g.THREE.Vector3(8, 0, 8);
  manager.spawnRocket(from, to, null, 10, null);
  manager.explodeAt(to, false, 1);
  manager.spawnImpactMark(to, 0x332211, 1, 0.5);
  const fireMaterial = manager.particles.find((p) => p.type === 'fire').mesh.material;
  const smokeMaterial = manager.particles.find((p) => p.type === 'smoke').mesh.material;
  const markMaterial = manager.particles.find((p) => p.type === 'mark').mesh.material;
  const fireDisposed = events(fireMaterial);
  const smokeDisposed = events(smokeMaterial);
  const markDisposed = events(markMaterial);
  manager.spawnLaserBeam(from, to, null, 1, null);
  const beam = manager.laserBeams[0];
  const beamGeometry = beam.mesh.children[0].geometry;
  const auraMaterial = beam.mesh.children[1].material;
  const beamGeometryDisposed = events(beamGeometry);
  const auraDisposed = events(auraMaterial);
  manager.clear();
  manager.clear();
  assert(manager.projectiles.length === 0 && manager.particles.length === 0, 'clear should empty all transient effects');
  assert(cachedTracer() === 0 && cachedTexture() === 0, 'clear must retain cached projectile assets');
  assert(cachedSparkMaterial() === 0, 'cached spark material must survive transient impact cleanup');
  assert(fireDisposed() === 1 && smokeDisposed() === 1 && markDisposed() === 1,
    'fire, smoke, and impact-mark materials must dispose with their transient effects');
  assert(beamGeometryDisposed() === 1 && auraDisposed() === 1,
    'unique laser geometry and aura material must dispose on clear');
  manager.spawnBullet(from, to, null, 1, null);
  manager.update(1, null);
  assert(manager.projectiles.length === 0, 'projectiles should still expire after a clear/reload');
  manager.dispose();
  assert(cachedTracer() === 1 && cachedTexture() === 1 && cachedSparkMaterial() === 1,
    'manager disposal should release its cached GPU assets');

  // Exercise the real terrain/building lifecycle, rather than a mock root.
  const game = createSandbox();
  loadGameScripts(game, { includeMain: false });
  const gameScene = new game.THREE.Scene();
  const terrain = new game.Terrain(gameScene, 100, 100, 2, 'temperate');
  const oldGroundGeometry = terrain.groundMesh.geometry;
  const oldGroundMaterial = terrain.groundMesh.material;
  const groundGeometryDisposed = events(oldGroundGeometry);
  const groundMaterialDisposed = events(oldGroundMaterial);
  terrain.generateTerrainMesh();
  assert(groundGeometryDisposed() === 1 && groundMaterialDisposed() === 1,
    'terrain regeneration should dispose the replaced ground resources');
  terrain.setupLevelEnvironment([{ x: 30, z: 30, radius: 4, richness: 500 }], []);
  const oreRoot = terrain.oreDeposits[0].mesh;
  const oreGeometry = oreRoot.children[0].geometry;
  const oreMaterial = oreRoot.children[0].material;
  const oreGeometryDisposed = events(oreGeometry);
  const oreMaterialDisposed = events(oreMaterial);
  terrain.setupLevelEnvironment([], []);
  assert(oreGeometryDisposed() === 1 && oreMaterialDisposed() === 1,
    'terrain reload should dispose shared ore field assets exactly once');

  const building = new game.Building('power_plant', 'player', 5, 5, gameScene, terrain);
  const oldBuildingMesh = building.mesh;
  let ownedBuildingGeometry = null;
  oldBuildingMesh.traverse((object) => { if (!ownedBuildingGeometry && object.geometry) ownedBuildingGeometry = object.geometry; });
  const buildingGeometryDisposed = events(ownedBuildingGeometry);
  const scaffoldGeometry = building.scaffold.children[0].geometry;
  const scaffoldDisposed = events(scaffoldGeometry);
  building.capture('enemy');
  assert(buildingGeometryDisposed() === 1, 'capturing should dispose the replaced faction model');
  building.finishConstruction({ entityManager: { grantRefineryHarvester() {} } });
  assert(scaffoldDisposed() === 1, 'construction completion should dispose the scaffold resources');

  console.log('RESOURCE_TESTS_OK');
}

run();
