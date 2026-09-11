// ==========================================================================
// Command & Conquer RTS - Dynamic Dual-Layer Fog of War & Radar Mask
// ==========================================================================

const FOW_SHROUD = 0;   // Never explored (pitch black)
const FOW_EXPLORED = 1; // Explored, currently in fog (dimmed, terrain visible)
const FOW_VISIBLE = 2;  // Actively within sight range of friendly unit/building

class FogOfWar {
  constructor(scene, width = 100, height = 100, tileSize = 2) {
    this.scene = scene;
    this.gridWidth = width;
    this.gridHeight = height;
    this.tileSize = tileSize;
    this.worldWidth = width * tileSize;
    this.worldHeight = height * tileSize;

    // Grid states
    this.visibility = new Uint8Array(width * height); // Current tick state
    this.explored = new Uint8Array(width * height);   // Permanent exploration mask

    // Off-screen canvas used as dynamic texture
    this.canvas = document.createElement('canvas');
    this.canvas.width = 128; // Optimized resolution for smooth blur and high FPS
    this.canvas.height = 128;
    this.ctx = this.canvas.getContext('2d');

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;

    // 3D Shroud Plane just above terrain
    const geo = new THREE.PlaneGeometry(this.worldWidth, this.worldHeight);
    geo.rotateX(-Math.PI / 2);
    geo.translate(this.worldWidth / 2, 0.2, this.worldHeight / 2);

    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false
    });

    this.fogMesh = new THREE.Mesh(geo, mat);
    this.scene.add(this.fogMesh);

    this.updateCounter = 0;
    this.clearAll();
  }

  clearAll() {
    this.visibility.fill(FOW_SHROUD);
    this.explored.fill(0);
    this.drawFogTexture();
  }

  // Reveal area around starting base
  revealPermanent(cx, cz, radius = 20) {
    const rSq = radius * radius;
    const { gx, gz } = this.worldToGrid(cx, cz);
    const radTiles = Math.ceil(radius / this.tileSize);

    for (let dz = -radTiles; dz <= radTiles; dz++) {
      for (let dx = -radTiles; dx <= radTiles; dx++) {
        const distSq = (dx * this.tileSize) * (dx * this.tileSize) + (dz * this.tileSize) * (dz * this.tileSize);
        if (distSq <= rSq) {
          const nx = gx + dx;
          const nz = gz + dz;
          if (nx >= 0 && nx < this.gridWidth && nz >= 0 && nz < this.gridHeight) {
            const idx = nz * this.gridWidth + nx;
            this.explored[idx] = 1;
            this.visibility[idx] = FOW_VISIBLE;
          }
        }
      }
    }
  }

  worldToGrid(wx, wz) {
    return {
      gx: Math.floor(wx / this.tileSize),
      gz: Math.floor(wz / this.tileSize)
    };
  }

  // Fast check: is coordinate currently visible to player?
  isVisible(wx, wz) {
    const { gx, gz } = this.worldToGrid(wx, wz);
    if (gx < 0 || gx >= this.gridWidth || gz < 0 || gz >= this.gridHeight) return false;
    return this.visibility[gz * this.gridWidth + gx] === FOW_VISIBLE;
  }

  // Is coordinate explored?
  isExplored(wx, wz) {
    const { gx, gz } = this.worldToGrid(wx, wz);
    if (gx < 0 || gx >= this.gridWidth || gz < 0 || gz >= this.gridHeight) return false;
    return this.explored[gz * this.gridWidth + gx] === 1;
  }

  // Update line-of-sight for all friendly units and structures
  update(friendlyUnits, friendlyBuildings, hasRadar = false) {
    // 1. Reset currently visible back to explored fog
    for (let i = 0; i < this.visibility.length; i++) {
      this.visibility[i] = this.explored[i] ? FOW_EXPLORED : FOW_SHROUD;
    }

    // 2. Reveal circles around friendly units
    for (let i = 0; i < friendlyUnits.length; i++) {
      const u = friendlyUnits[i];
      if (u.isAlive) {
        this.revealCircle(u.position.x, u.position.z, u.sightRange || 16);
      }
    }

    // 3. Reveal circles around friendly buildings
    for (let i = 0; i < friendlyBuildings.length; i++) {
      const b = friendlyBuildings[i];
      if (b.isAlive) {
        const bonus = (b.type === 'radar_facility' && hasRadar)
          ? Math.max(b.sightRange || 20, 50)
          : (b.sightRange || 20);
        this.revealCircle(b.position.x, b.position.z, bonus);
      }
    }

    // 4. Update canvas texture (throttle to every 2 frames for top performance)
    this.updateCounter++;
    if (this.updateCounter % 2 === 0) {
      this.drawFogTexture();
    }
  }

  revealCircle(cx, cz, radius) {
    const rSq = radius * radius;
    const { gx, gz } = this.worldToGrid(cx, cz);
    const radTiles = Math.ceil(radius / this.tileSize);

    const minX = Math.max(0, gx - radTiles);
    const maxX = Math.min(this.gridWidth - 1, gx + radTiles);
    const minZ = Math.max(0, gz - radTiles);
    const maxZ = Math.min(this.gridHeight - 1, gz + radTiles);

    for (let nz = minZ; nz <= maxZ; nz++) {
      const dz = (nz - gz) * this.tileSize;
      const dzSq = dz * dz;
      const rowOffset = nz * this.gridWidth;

      for (let nx = minX; nx <= maxX; nx++) {
        const dx = (nx - gx) * this.tileSize;
        if (dx * dx + dzSq <= rSq) {
          const idx = rowOffset + nx;
          this.visibility[idx] = FOW_VISIBLE;
          this.explored[idx] = 1;
        }
      }
    }
  }

  // Render fog to canvas texture
  drawFogTexture() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const imgData = this.ctx.createImageData(w, h);
    const data = imgData.data;

    const scaleX = this.gridWidth / w;
    const scaleZ = this.gridHeight / h;

    for (let py = 0; py < h; py++) {
      const gz = Math.min(this.gridHeight - 1, Math.floor(py * scaleZ));
      const row = gz * this.gridWidth;
      const rowPixelOffset = py * w * 4;

      for (let px = 0; px < w; px++) {
        const gx = Math.min(this.gridWidth - 1, Math.floor(px * scaleX));
        const val = this.visibility[row + gx];
        const pIdx = rowPixelOffset + px * 4;

        if (val === FOW_VISIBLE) {
          // Transparent (fully visible)
          data[pIdx] = 0;
          data[pIdx + 1] = 0;
          data[pIdx + 2] = 0;
          data[pIdx + 3] = 0;
        } else if (val === FOW_EXPLORED) {
          // Dimmed Fog of War
          data[pIdx] = 10;
          data[pIdx + 1] = 15;
          data[pIdx + 2] = 20;
          data[pIdx + 3] = 160; // ~63% darkness
        } else {
          // Full Shroud
          data[pIdx] = 5;
          data[pIdx + 1] = 8;
          data[pIdx + 2] = 12;
          data[pIdx + 3] = 255; // 100% black
        }
      }
    }

    this.ctx.putImageData(imgData, 0, 0);
    this.texture.needsUpdate = true;
  }
}
