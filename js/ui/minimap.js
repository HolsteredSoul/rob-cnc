// ==========================================================================
// Command & Conquer RTS - Tactical Radar & Minimap
// ==========================================================================

class Minimap {
  constructor(canvasId, gameContext) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.gameContext = gameContext;

    this.isDragging = false;
    this.staticNoiseData = null;

    this.initEvents();
  }

  initEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.handleMinimapClick(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.handleMinimapClick(e);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
  }

  handleMinimapClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;

    const terrain = this.gameContext.terrain;
    const worldX = (x / rect.width) * terrain.worldWidth;
    const worldZ = (y / rect.height) * terrain.worldHeight;

    this.gameContext.renderer.panTo(worldX, worldZ);
  }

  biomeColors() {
    const biome = (this.gameContext.terrain && this.gameContext.terrain.biome) || 'temperate';
    if (biome === 'desert') return { ground: '#6e5a32', rock: '#4a3a22', ore: '#e0b400' };
    if (biome === 'snow') return { ground: '#6d7a82', rock: '#3a464e', ore: '#d8c45a' };
    return { ground: '#2a3a28', rock: '#3a4248', ore: '#ffcc00' };
  }

  update() {
    const { entityManager, economy, terrain, fogOfWar, renderer } = this.gameContext;
    if (!this.ctx || !this.canvas) return;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const hasRadarBuilding = entityManager.getPlayerBuildings().some(b => b.type === 'radar_facility' && !b.isBuilding && b.isAlive);
    const isPowered = economy.isBasePowered('player');
    const radarActive = hasRadarBuilding && isPowered;
    const offlineMsg = document.getElementById('radar-offline-msg');

    this.ctx.fillStyle = '#05080a';
    this.ctx.fillRect(0, 0, w, h);

    const scaleX = w / terrain.worldWidth;
    const scaleZ = h / terrain.worldHeight;
    const colors = this.biomeColors();

    this.drawTerrain(w, h, scaleX, scaleZ, terrain, fogOfWar, colors, radarActive);

    entityManager.buildings.forEach((b) => {
      if (!b.isAlive) return;
      const isPlayer = b.faction === 'player';
      if (!isPlayer && fogOfWar && !fogOfWar.isExplored(b.position.x, b.position.z)) return;
      if (!radarActive && !isPlayer) return;
      const isPlayerBlue = (this.gameContext.playerTeam || 'blue') === 'blue';
      const isBlue = isPlayer ? isPlayerBlue : !isPlayerBlue;
      this.ctx.fillStyle = isBlue ? '#3ec6ff' : '#e0524a';
      const bw = Math.max(3, b.footprint.w * terrain.tileSize * scaleX);
      const bh = Math.max(3, b.footprint.h * terrain.tileSize * scaleZ);
      this.ctx.fillRect(
        (b.position.x - (b.footprint.w * terrain.tileSize) / 2) * scaleX,
        (b.position.z - (b.footprint.h * terrain.tileSize) / 2) * scaleZ,
        bw,
        bh
      );
    });

    if (radarActive) {
      entityManager.units.forEach((u) => {
        if (!u.isAlive) return;
        const isPlayer = u.faction === 'player';
        if (!isPlayer && fogOfWar && !fogOfWar.isVisible(u.position.x, u.position.z)) return;
        this.ctx.fillStyle = isPlayer ? '#9bffb5' : '#ff8a82';
        const s = u.isVehicle ? 3 : 2;
        this.ctx.fillRect(u.position.x * scaleX - s / 2, u.position.z * scaleZ - s / 2, s, s);
      });
    } else {
      entityManager.units.forEach((u) => {
        if (!u.isAlive || u.faction !== 'player') return;
        this.ctx.fillStyle = '#7fe39a';
        this.ctx.fillRect(u.position.x * scaleX - 1, u.position.z * scaleZ - 1, 2, 2);
      });
    }

    this.drawCameraBox(w, h, scaleX, scaleZ, renderer);
    this.drawAlertPing(w, h, scaleX, scaleZ, entityManager);

    if (!radarActive) {
      this.renderStaticNoise(w, h, 0.55);
      if (offlineMsg) {
        offlineMsg.style.display = 'flex';
        offlineMsg.innerHTML = hasRadarBuilding
          ? 'RADAR OFFLINE<br><span style="font-size:10px; color:#ff9999;">POWER DEFICIT</span>'
          : 'RADAR LINK OFFLINE<br><span style="font-size:10px; color:#778899;">BUILD RADAR FACILITY</span>';
      }
    } else if (offlineMsg) {
      offlineMsg.style.display = 'none';
    }
  }

  drawTerrain(w, h, scaleX, scaleZ, terrain, fogOfWar, colors, radarActive) {
    const step = Math.max(2, terrain.tileSize * scaleX);
    for (let gz = 0; gz < terrain.height; gz += 2) {
      for (let gx = 0; gx < terrain.width; gx += 2) {
        const wx = (gx + 0.5) * terrain.tileSize;
        const wz = (gz + 0.5) * terrain.tileSize;
        const explored = !fogOfWar || fogOfWar.isExplored(wx, wz);
        const visible = !fogOfWar || fogOfWar.isVisible(wx, wz);
        if (!explored && radarActive) continue;
        if (!explored && !radarActive) {
          // own-base faint: skip unexplored
          continue;
        }
        const blocked = terrain.grid[gz * terrain.width + gx] === 1;
        this.ctx.fillStyle = blocked ? colors.rock : colors.ground;
        if (!visible) this.ctx.globalAlpha = radarActive ? 0.45 : 0.28;
        else this.ctx.globalAlpha = radarActive ? 1 : 0.4;
        this.ctx.fillRect(gx * terrain.tileSize * scaleX, gz * terrain.tileSize * scaleZ, step + 0.5, step + 0.5);
        this.ctx.globalAlpha = 1;
      }
    }
    terrain.oreDeposits.forEach((ore) => {
      if (ore.remaining <= 0) return;
      if (fogOfWar && !fogOfWar.isExplored(ore.x, ore.z)) return;
      this.ctx.fillStyle = colors.ore;
      this.ctx.globalAlpha = radarActive ? 1 : 0.35;
      this.ctx.beginPath();
      this.ctx.arc(ore.x * scaleX, ore.z * scaleZ, 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    });
  }

  drawCameraBox(w, h, scaleX, scaleZ, renderer) {
    if (!renderer) return;
    const bounds = renderer.getGroundViewBounds ? renderer.getGroundViewBounds() : null;
    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.2;
    if (bounds) {
      this.ctx.strokeRect(
        bounds.minX * scaleX,
        bounds.minZ * scaleZ,
        Math.max(8, (bounds.maxX - bounds.minX) * scaleX),
        Math.max(8, (bounds.maxZ - bounds.minZ) * scaleZ)
      );
    } else {
      const camTarget = renderer.targetPos;
      const viewW = 36 * (renderer.zoomLevel || 1) * scaleX;
      const viewH = 28 * (renderer.zoomLevel || 1) * scaleZ;
      this.ctx.strokeRect(camTarget.x * scaleX - viewW / 2, camTarget.z * scaleZ - viewH / 2, viewW, viewH);
    }
  }

  drawAlertPing(w, h, scaleX, scaleZ, entityManager) {
    if (!entityManager || entityManager.alertTime == null) return;
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() / 1000 : Date.now() / 1000;
    const since = now - entityManager.alertTime;
    if (since < 0 || since > 2.5) return;
    const pulse = 1 - ((since % 0.6) / 0.6);
    this.ctx.strokeStyle = `rgba(255,80,70,${0.85 * pulse})`;
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.arc(entityManager.alertX * scaleX, entityManager.alertZ * scaleZ, 3 + pulse * 8, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  renderStaticNoise(w, h, alpha = 1) {
    this.ctx.save();
    this.ctx.globalAlpha = 0.4 * alpha;
    this.ctx.fillStyle = '#070b0e';
    this.ctx.fillRect(0, 0, w, h);
    this.ctx.globalAlpha = 0.22 * alpha;
    for (let i = 0; i < 180; i++) {
      const v = (Math.random() * 90) | 0;
      this.ctx.fillStyle = `rgb(${v},${v + 8},${v + 16})`;
      this.ctx.fillRect((Math.random() * w) | 0, (Math.random() * h) | 0, 2, 2);
    }
    this.ctx.restore();
  }
}
