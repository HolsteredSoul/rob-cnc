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

  createTerrainTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Biome base colors
    let colGrass = '#33482d'; // Dark alpine meadow green
    let colDirt = '#4a402d';  // Mountain soil
    let colRock = '#3e4448';  // Granite cliff

    if (this.biome === 'desert') {
      colGrass = '#9c8152'; // Golden canyon sand
      colDirt = '#7d6338';  // Darker sandstone
      colRock = '#5a462b';  // Canyon cliffs
    } else if (this.biome === 'snow') {
      colGrass = '#9eaeb6'; // Tundra frost
      colDirt = '#4d5b63';  // Cold gravel
      colRock = '#354148';  // Slate rock
    }

    // Fill base
    ctx.fillStyle = colGrass;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Soft organic noise patches
    for (let i = 0; i < 600; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = 20 + Math.random() * 55;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, Math.random() > 0.5 ? colDirt : colRock);
      grad.addColorStop(1, 'transparent');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Organic mountain trail contours
    ctx.strokeStyle = 'rgba(55, 48, 36, 0.45)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(120, 480);
    ctx.quadraticCurveTo(450, 400, 890, 560);
    ctx.moveTo(500, 150);
    ctx.quadraticCurveTo(550, 520, 480, 880);
    ctx.stroke();

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
      color: this.biome === 'desert' ? 0x6e5233 : 0x3d4952,
      roughness: 0.92,
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

  // Procedural 3D Forest Groves (Evergreen Pines & Deciduous Trees)
  generateForestGroves() {
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3e2723 }); // Deep brown wood
    const pineMat1 = new THREE.MeshLambertMaterial({ color: 0x1b4332 }); // Dark pine
    const pineMat2 = new THREE.MeshLambertMaterial({ color: 0x2d6a4f }); // Forest green
    const deciduousMat = new THREE.MeshLambertMaterial({ color: 0x40916c });

    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 1.8, 6);
    const coneGeo = new THREE.ConeGeometry(1.4, 2.2, 7);
    const sphereGeo = new THREE.SphereGeometry(1.2, 6, 6);

    // Distribute tree groves naturally in valleys and foothills
    const groveCenters = [
      { x: 30, z: 80, count: 18, radius: 14 },
      { x: 85, z: 25, count: 16, radius: 12 },
      { x: 125, z: 50, count: 20, radius: 15 },
      { x: 60, z: 140, count: 22, radius: 16 },
      { x: 140, z: 110, count: 18, radius: 14 },
      { x: 170, z: 85, count: 15, radius: 12 }
    ];

    groveCenters.forEach(grove => {
      for (let i = 0; i < grove.count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * grove.radius;
        const tx = grove.x + Math.cos(angle) * dist;
        const tz = grove.z + Math.sin(angle) * dist;

        if (tx < 6 || tx > this.worldWidth - 6 || tz < 6 || tz > this.worldHeight - 6) continue;

        const ty = this.getElevation(tx, tz);
        // Avoid placing on extremely steep cliff summits
        if (ty > 14) continue;

        const treeGroup = new THREE.Group();
        treeGroup.position.set(tx, ty, tz);

        const isPine = Math.random() > 0.35;
        const scale = 0.8 + Math.random() * 0.5;

        // Trunk
        const trunk = new THREE.Mesh(trunkGeo, trunkMat);
        trunk.position.set(0, 0.9, 0);
        trunk.castShadow = true;
        treeGroup.add(trunk);

        if (isPine) {
          // Tiered Pine Foliage (3 stacked cones)
          const mat = Math.random() > 0.5 ? pineMat1 : pineMat2;
          for (let tier = 0; tier < 3; tier++) {
            const tierMesh = new THREE.Mesh(coneGeo, mat);
            const tierScale = (1 - tier * 0.22);
            tierMesh.scale.set(tierScale, tierScale, tierScale);
            tierMesh.position.set(0, 1.8 + tier * 1.1, 0);
            tierMesh.castShadow = true;
            treeGroup.add(tierMesh);
          }
        } else {
          // Deciduous Canopy (organic clustered spheres)
          const canopy = new THREE.Mesh(sphereGeo, deciduousMat);
          canopy.position.set(0, 2.2, 0);
          canopy.scale.set(1.2, 1.1, 1.2);
          canopy.castShadow = true;
          treeGroup.add(canopy);
        }

        treeGroup.scale.set(scale, scale, scale);
        treeGroup.rotation.y = Math.random() * Math.PI * 2;
        this.scene.add(treeGroup);
        this.trees.push(treeGroup);

        // Mark tree obstacle in grid (blocks light movement)
        this.setBlocked(tx, tz, 1.0, true);
      }
    });
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

  // Find nearest available ore node with remaining gold
  getClosestOreDeposit(wx, wz) {
    let closest = null;
    let minDistSq = Infinity;

    for (const ore of this.oreDeposits) {
      if (ore.remaining > 0) {
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

    const ratio = oreNode.remaining / oreNode.maxOre;
    oreNode.mesh.scale.set(0.4 + ratio * 0.6, 0.3 + ratio * 0.7, 0.4 + ratio * 0.6);
    oreNode.light.intensity = 0.2 + ratio * 0.6;

    if (oreNode.remaining <= 0) {
      oreNode.mesh.visible = false;
      oreNode.light.intensity = 0;
    }
    return harvested;
  }

  // Ore regeneration tick
  updateOreRegeneration(delta) {
    this.oreDeposits.forEach(ore => {
      if (ore.remaining < ore.maxOre) {
        ore.remaining = Math.min(ore.maxOre, ore.remaining + delta * 8);
        const ratio = ore.remaining / ore.maxOre;
        ore.mesh.visible = true;
        ore.mesh.scale.set(0.4 + ratio * 0.6, 0.3 + ratio * 0.7, 0.4 + ratio * 0.6);
        ore.light.intensity = 0.2 + ratio * 0.6;
      }
    });
  }
}
