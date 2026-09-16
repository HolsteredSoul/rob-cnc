// ==========================================================================
// Command & Conquer RTS - Smooth Mountainous 3D Terrain & Procedural Trees
// ==========================================================================

class Terrain {
  constructor(scene, width = 100, height = 100, tileSize = 2, biome = 'temperate') {
    this.scene = scene;
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.biome = biome;
    this.worldWidth = width * tileSize;
    this.worldHeight = height * tileSize;

    // Obstacle grid (0 = walkable, 1 = rock/cliff/tree, 2 = building)
    this.grid = new Uint8Array(width * height);
    this.oreDeposits = []; // Array of OreNode objects
    this.obstacles = [];   // 3D meshes for rocks
    this.trees = [];       // 3D meshes for trees
    this.groundMesh = null;
    this.oreRegenPerSec = 36;
    this.minHarvestableOre = 80;

    this.init();
  }

  init() {
    this.generateTerrainMesh();
  }

// Flat terrain implementation
// Elevation always returns 0 (base height)
getElevation(wx, wz) {
  return 0;
}

// Generate a simple flat plane with texture
generateTerrainMesh() {
  if (this.groundMesh) {
    this.scene.remove(this.groundMesh);
  }

  const geo = new THREE.PlaneGeometry(this.worldWidth, this.worldHeight, 1, 1);
  geo.rotateX(-Math.PI / 2);
  geo.translate(this.worldWidth / 2, 0, this.worldHeight / 2);

  const texture = this.createTerrainTexture();
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.85,
    metalness: 0.12,
    flatShading: false
  });

  this.groundMesh = new THREE.Mesh(geo, material);
  this.groundMesh.receiveShadow = true;
  this.scene.add(this.groundMesh);
}

  applyBiomeAtmosphere() {
    if (!this.scene) return;
    if (this.biome === 'desert') {
      this.scene.background = new THREE.Color(0x2c2416);
      this.scene.fog = new THREE.FogExp2(0x2c2416, 0.0032);
    } else if (this.biome === 'snow') {
      this.scene.background = new THREE.Color(0x1a242c);
      this.scene.fog = new THREE.FogExp2(0x1a242c, 0.0038);
    } else {
      this.scene.background = new THREE.Color(0x0e1317);
      this.scene.fog = new THREE.FogExp2(0x0e1317, 0.0035);
    }
  }

  createTerrainTexture() {
    this.applyBiomeAtmosphere();
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const biome = this.biome;

    let colGrass = '#33482d';
    let colDirt = '#4a402d';
    let colRock = '#3e4448';
    let colAccent = '#2a3a24';

    if (biome === 'desert') {
      colGrass = '#c4a36a';
      colDirt = '#9c7a45';
      colRock = '#6b4e2c';
      colAccent = '#e0c07a';
    } else if (biome === 'snow') {
      colGrass = '#d8e2e8';
      colDirt = '#8a9aa4';
      colRock = '#4a5860';
      colAccent = '#f4f7fa';
    }

    ctx.fillStyle = colGrass;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const blobCount = biome === 'desert' ? 420 : (biome === 'snow' ? 380 : 600);
    for (let i = 0; i < blobCount; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = (biome === 'snow' ? 12 : 20) + Math.random() * (biome === 'desert' ? 80 : 55);
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, Math.random() > 0.5 ? colDirt : colRock);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (biome === 'desert') {
      ctx.strokeStyle = 'rgba(180, 140, 70, 0.35)';
      ctx.lineWidth = 18;
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo(0, 80 + i * 120);
        ctx.quadraticCurveTo(400, 40 + i * 120, 1024, 120 + i * 110);
        ctx.stroke();
      }
      ctx.fillStyle = colAccent;
      for (let i = 0; i < 40; i++) {
        ctx.globalAlpha = 0.15;
        ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 80 + Math.random() * 120, 6);
      }
      ctx.globalAlpha = 1;
    } else if (biome === 'snow') {
      ctx.fillStyle = colAccent;
      for (let i = 0; i < 900; i++) {
        ctx.globalAlpha = 0.25 + Math.random() * 0.5;
        const r = 1 + Math.random() * 2.5;
        ctx.beginPath();
        ctx.arc(Math.random() * 1024, Math.random() * 1024, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = colDirt;
      ctx.fillRect(0, 420, 1024, 28);
      ctx.fillRect(0, 710, 1024, 18);
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = 'rgba(55, 48, 36, 0.45)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(120, 480);
      ctx.quadraticCurveTo(450, 400, 890, 560);
      ctx.moveTo(500, 150);
      ctx.quadraticCurveTo(550, 520, 480, 880);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  // Setup level environment with ore fields, rock formations, and 3D tree groves
  setupLevelEnvironment(oreFields = [], rockClusters = []) {
    // 1. Clear previous
    this.oreDeposits.forEach(o => this.scene.remove(o.mesh));
    this.oreDeposits = [];
    this.obstacles.forEach(o => this.scene.remove(o));
    this.obstacles = [];
    this.trees.forEach(t => this.scene.remove(t));
    this.trees = [];
    this.grid.fill(0);

    // 2. Generate Ore / Gold Crystal Fields on terrain elevation
    oreFields.forEach(field => {
      this.createOreField(field.x, field.z, field.radius, field.richness || 4000);
    });

    // 3. Generate Natural Rock Formations on Slopes
    rockClusters.forEach(cluster => {
      this.createRockCluster(cluster.x, cluster.z, cluster.count || 5, cluster.scale || 2);
    });

    // 4. Generate 3D Procedural Tree Groves across valleys and hillsides
    this.generateForestGroves();
  }

  // Interactive 3D shimmering gold crystals matching terrain elevation
  createOreField(centerX, centerZ, radius = 6, richness = 4000) {
    const crystalsPerField = 16;
    const crystalGeo = new THREE.ConeGeometry(0.55, 2.4, 5);
    crystalGeo.translate(0, 1.2, 0);

    const goldMaterial = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xaa7700,
      emissiveIntensity: 0.65,
      roughness: 0.15,
      metalness: 0.9
    });

    const fieldGroup = new THREE.Group();
    const groundY = this.getElevation(centerX, centerZ);
    fieldGroup.position.set(centerX, groundY, centerZ);

    for (let i = 0; i < crystalsPerField; i++) {
      const angle = (i / crystalsPerField) * Math.PI * 2 + Math.random() * 0.5;
      const dist = Math.random() * radius;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const nodeElevation = this.getElevation(centerX + x, centerZ + z) - groundY;

      const crystal = new THREE.Mesh(crystalGeo, goldMaterial);
      crystal.position.set(x, nodeElevation, z);
      crystal.rotation.y = Math.random() * Math.PI;
      crystal.rotation.x = (Math.random() - 0.5) * 0.35;
      crystal.rotation.z = (Math.random() - 0.5) * 0.35;
      const scale = 0.7 + Math.random() * 0.7;
      crystal.scale.set(scale, scale * (1 + Math.random() * 0.5), scale);
      crystal.castShadow = true;
      fieldGroup.add(crystal);
    }

    // Glowing point light on ore field
    const oreLight = new THREE.PointLight(0xffaa00, 0.9, 22);
    oreLight.position.set(0, 3.5, 0);
    fieldGroup.add(oreLight);

    this.scene.add(fieldGroup);

    const oreNode = {
      x: centerX,
      z: centerZ,
      radius: radius,
      remaining: richness,
      maxOre: richness,
      mesh: fieldGroup,
      light: oreLight,
      active: true
    };

    this.oreDeposits.push(oreNode);
  }

  // Impassable mountain rock cliffs
  createRockCluster(cx, cz, count = 5, scale = 2) {
    const rockGeo = new THREE.DodecahedronGeometry(1.4, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: this.biome === 'desert' ? 0x8a6a3a : (this.biome === 'snow' ? 0x8a9aa6 : 0x3d4952),
      roughness: this.biome === 'snow' ? 0.55 : 0.92,
      metalness: 0.08
    });

    for (let i = 0; i < count; i++) {
      const rx = cx + (Math.random() - 0.5) * scale * 4;
      const rz = cz + (Math.random() - 0.5) * scale * 4;
      const ry = this.getElevation(rx, rz);

      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(rx, ry + 0.8 * scale, rz);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.scale.set(scale * (0.8 + Math.random() * 0.6), scale * (0.6 + Math.random() * 0.5), scale);
      rock.castShadow = true;
      rock.receiveShadow = true;
      this.scene.add(rock);
      this.obstacles.push(rock);

      this.setBlocked(rx, rz, scale * 1.5, true);
    }
  }

  generateForestGroves() {
    const groveCenters = [
      { x: 30, z: 80, count: 18, radius: 14 },
      { x: 85, z: 25, count: 16, radius: 12 },
      { x: 125, z: 50, count: 20, radius: 15 },
      { x: 60, z: 140, count: 22, radius: 16 },
      { x: 140, z: 110, count: 18, radius: 14 },
      { x: 170, z: 85, count: 15, radius: 12 }
    ];

    groveCenters.forEach((grove) => {
      const count = this.biome === 'desert' ? Math.floor(grove.count * 0.45) : grove.count;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * grove.radius;
        const tx = grove.x + Math.cos(angle) * dist;
        const tz = grove.z + Math.sin(angle) * dist;
        if (tx < 6 || tx > this.worldWidth - 6 || tz < 6 || tz > this.worldHeight - 6) continue;
        const ty = this.getElevation(tx, tz);
        if (ty > 14) continue;

        const prop = this.biome === 'desert'
          ? this.createDesertProp()
          : (this.biome === 'snow' ? this.createSnowPine() : this.createTemperateTree());
        const scale = 0.75 + Math.random() * 0.55;
        prop.position.set(tx, ty, tz);
        prop.scale.set(scale, scale, scale);
        prop.rotation.y = Math.random() * Math.PI * 2;
        this.scene.add(prop);
        this.trees.push(prop);
        this.setBlocked(tx, tz, this.biome === 'desert' ? 0.7 : 1.0, true);
      }
    });
  }

  createTemperateTree() {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3e2723 });
    const pineMat = new THREE.MeshLambertMaterial({ color: Math.random() > 0.5 ? 0x1b4332 : 0x2d6a4f });
    const deciduousMat = new THREE.MeshLambertMaterial({ color: 0x40916c });
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.8, 6), trunkMat);
    trunk.position.set(0, 0.9, 0);
    trunk.castShadow = true;
    group.add(trunk);
    if (Math.random() > 0.35) {
      for (let tier = 0; tier < 3; tier++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.2, 7), pineMat);
        const ts = 1 - tier * 0.22;
        cone.scale.set(ts, ts, ts);
        cone.position.set(0, 1.8 + tier * 1.1, 0);
        cone.castShadow = true;
        group.add(cone);
      }
    } else {
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.2, 6, 6), deciduousMat);
      canopy.position.set(0, 2.2, 0);
      canopy.scale.set(1.2, 1.1, 1.2);
      canopy.castShadow = true;
      group.add(canopy);
    }
    return group;
  }

  createDesertProp() {
    const cactusMat = new THREE.MeshLambertMaterial({ color: 0x4a6a3a });
    const deadMat = new THREE.MeshLambertMaterial({ color: 0x6b542e });
    const group = new THREE.Group();
    if (Math.random() > 0.4) {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 2.4, 8), cactusMat);
      stem.position.y = 1.2;
      stem.castShadow = true;
      group.add(stem);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 1.1, 6), cactusMat);
      arm.position.set(0.45, 1.5, 0);
      arm.rotation.z = -1.1;
      group.add(arm);
      const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.8, 6), cactusMat);
      arm2.position.set(-0.35, 1.7, 0);
      arm2.rotation.z = 1.05;
      group.add(arm2);
    } else {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.55, 5, 5), deadMat);
      bush.position.y = 0.4;
      bush.scale.set(1.4, 0.6, 1.1);
      bush.castShadow = true;
      group.add(bush);
      const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.2, 4), deadMat);
      twig.position.set(0.1, 0.9, 0);
      twig.rotation.z = 0.4;
      group.add(twig);
    }
    return group;
  }

  createSnowPine() {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3a332c });
    const needleMat = new THREE.MeshLambertMaterial({ color: 0x4d5c58 });
    const snowMat = new THREE.MeshLambertMaterial({ color: 0xe8eef2 });
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, 1.6, 6), trunkMat);
    trunk.position.y = 0.8;
    trunk.castShadow = true;
    group.add(trunk);
    for (let tier = 0; tier < 3; tier++) {
      const ts = 1 - tier * 0.24;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.9, 7), needleMat);
      cone.scale.set(ts, ts, ts);
      cone.position.set(0, 1.6 + tier * 0.95, 0);
      cone.castShadow = true;
      group.add(cone);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.45, 7), snowMat);
      cap.scale.set(ts, ts, ts);
      cap.position.set(0, 2.15 + tier * 0.95, 0);
      group.add(cap);
    }
    return group;
  }

  // Grid coordinates helper
  worldToGrid(wx, wz) {
    const gx = Math.floor(wx / this.tileSize);
    const gz = Math.floor(wz / this.tileSize);
    return {
      gx: Math.max(0, Math.min(this.width - 1, gx)),
      gz: Math.max(0, Math.min(this.height - 1, gz))
    };
  }

  gridToWorld(gx, gz) {
    const x = (gx + 0.5) * this.tileSize;
    const z = (gz + 0.5) * this.tileSize;
    return { x, z, wx: x, wz: z };
  }

  isBlocked(wx, wz) {
    const { gx, gz } = this.worldToGrid(wx, wz);
    return this.grid[gz * this.width + gx] !== 0;
  }

  setBlocked(wx, wz, radius = 1.5, blocked = true) {
    const radTiles = Math.ceil(radius / this.tileSize);
    const { gx, gz } = this.worldToGrid(wx, wz);

    for (let dz = -radTiles; dz <= radTiles; dz++) {
      for (let dx = -radTiles; dx <= radTiles; dx++) {
        const nx = gx + dx;
        const nz = gz + dz;
        if (nx >= 0 && nx < this.width && nz >= 0 && nz < this.height) {
          if (dx * dx + dz * dz <= radTiles * radTiles) {
            this.grid[nz * this.width + nx] = blocked ? 1 : 0;
          }
        }
      }
    }
  }

  applyOreVisual(ore) {
    if (!ore || !ore.mesh) return;
    const max = ore.maxOre || 1;
    const ratio = Math.max(0, Math.min(1, ore.remaining / max));
    const vis = Math.max(0.12, ratio);
    ore.mesh.visible = true;
    ore.mesh.scale.set(0.28 + vis * 0.72, 0.18 + vis * 0.82, 0.28 + vis * 0.72);
    if (ore.light) ore.light.intensity = 0.1 + ratio * 0.7;
  }

  // Find nearest ore node with enough remaining to be worth a trip
  getClosestOreDeposit(wx, wz) {
    let closest = null;
    let minDistSq = Infinity;
    const minAmt = this.minHarvestableOre || 80;

    for (const ore of this.oreDeposits) {
      if (ore.remaining >= minAmt) {
        const dx = ore.x - wx;
        const dz = ore.z - wz;
        const distSq = dx * dx + dz * dz;
        if (distSq < minDistSq) {
          minDistSq = distSq;
          closest = ore;
        }
      }
    }
    return closest;
  }

  // Deplete ore node when mined by Harvester
  harvestFromNode(oreNode, amount = 100) {
    if (!oreNode || oreNode.remaining <= 0) return 0;
    const harvested = Math.min(oreNode.remaining, amount);
    oreNode.remaining -= harvested;
    this.applyOreVisual(oreNode);
    return harvested;
  }

  // Ore regeneration tick — depleted fields stay visible as shrinking/growing crystals
  updateOreRegeneration(delta) {
    const rate = this.oreRegenPerSec || 36;
    this.oreDeposits.forEach((ore) => {
      if (ore.remaining < ore.maxOre) {
        ore.remaining = Math.min(ore.maxOre, ore.remaining + delta * rate);
      }
      this.applyOreVisual(ore);
    });
  }
}
