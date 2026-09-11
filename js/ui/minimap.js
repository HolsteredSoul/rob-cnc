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

  update() {
    const { entityManager, economy, terrain, fogOfWar, renderer } = this.gameContext;
    const w = this.canvas.width;
    const h = this.canvas.height;

    // Check if player has an active, powered Radar Facility
    const hasRadarBuilding = entityManager.getPlayerBuildings().some(b => b.type === 'radar_facility' && b.isAlive);
    const isPowered = economy.isBasePowered('player');
    const radarActive = hasRadarBuilding && isPowered;

    const offlineMsg = document.getElementById('radar-offline-msg');

    if (!radarActive) {
      // Render CRT Static Noise
      this.renderStaticNoise(w, h);
      if (offlineMsg) {
        offlineMsg.style.display = 'flex';
        offlineMsg.innerHTML = hasRadarBuilding ? 'RADAR OFFLINE<br><span style="font-size:10px; color:#ff9999;">POWER DEFICIT</span>' : 'RADAR LINK OFFLINE<br><span style="font-size:10px; color:#778899;">BUILD RADAR FACILITY</span>';
      }
      return;
    }

    if (offlineMsg) {
      offlineMsg.style.display = 'none';
    }

    // 1. Clear background
    this.ctx.fillStyle = '#081014';
    this.ctx.fillRect(0, 0, w, h);

    const scaleX = w / terrain.worldWidth;
    const scaleZ = h / terrain.worldHeight;

    // 2. Draw explored terrain & ore deposits
    terrain.oreDeposits.forEach(ore => {
      if (ore.remaining > 0 && fogOfWar.isExplored(ore.x, ore.z)) {
        this.ctx.fillStyle = '#ffcc00';
        this.ctx.beginPath();
        this.ctx.arc(ore.x * scaleX, ore.z * scaleZ, 3, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });

    // 3. Draw Buildings
    entityManager.buildings.forEach(b => {
      if (!b.isAlive) return;
      const isPlayer = b.faction === 'player';
      const isVisibleOrExplored = isPlayer || fogOfWar.isExplored(b.position.x, b.position.z);

      if (isVisibleOrExplored) {
        const isPlayerBlue = (this.gameContext.playerTeam || 'blue') === 'blue';
        const isBlue = isPlayer ? isPlayerBlue : !isPlayerBlue;
        this.ctx.fillStyle = isBlue ? '#00b0ff' : '#ff3333';
        const bw = Math.max(3, b.footprint.w * terrain.tileSize * scaleX);
        const bh = Math.max(3, b.footprint.h * terrain.tileSize * scaleZ);
        this.ctx.fillRect(
          (b.position.x - (b.footprint.w * terrain.tileSize) / 2) * scaleX,
          (b.position.z - (b.footprint.h * terrain.tileSize) / 2) * scaleZ,
          bw,
          bh
        );
      }
    });

    // 4. Draw Units
    entityManager.units.forEach(u => {
      if (!u.isAlive) return;
      const isPlayer = u.faction === 'player';
      const isVisible = isPlayer || fogOfWar.isVisible(u.position.x, u.position.z);

      if (isVisible) {
        this.ctx.fillStyle = isPlayer ? '#33ff33' : '#ff2222';
        const uRadius = u.isVehicle ? 2.5 : 1.8;
        this.ctx.beginPath();
        this.ctx.arc(u.position.x * scaleX, u.position.z * scaleZ, uRadius, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });

    // 5. Draw Shroud Mask from Fog of War
    this.drawShroudOverlay(w, h, fogOfWar);

    // 6. Draw Camera Viewport Frustum Box
    this.drawCameraBox(w, h, scaleX, scaleZ, renderer);
  }

  drawShroudOverlay(w, h, fogOfWar) {
    // Sample fogOfWar canvas texture onto minimap
    if (fogOfWar && fogOfWar.canvas) {
      this.ctx.save();
      this.ctx.globalAlpha = 0.85;
      this.ctx.drawImage(fogOfWar.canvas, 0, 0, w, h);
      this.ctx.restore();
    }
  }

  drawCameraBox(w, h, scaleX, scaleZ, renderer) {
    const camTarget = renderer.targetPos;
    const viewW = 44 * renderer.zoomLevel * scaleX;
    const viewH = 34 * renderer.zoomLevel * scaleZ;

    this.ctx.strokeStyle = '#ffffff';
    this.ctx.lineWidth = 1.2;
    this.ctx.strokeRect(
      camTarget.x * scaleX - viewW / 2,
      camTarget.z * scaleZ - viewH / 2,
      viewW,
      viewH
    );
  }

  renderStaticNoise(w, h) {
    if (!this.staticNoiseData) {
      this.staticNoiseData = this.ctx.createImageData(w, h);
    }
    const data = this.staticNoiseData.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = (Math.random() * 80) | 0;
      data[i] = v;
      data[i + 1] = v + 10;
      data[i + 2] = v + 20;
      data[i + 3] = 255;
    }
    this.ctx.putImageData(this.staticNoiseData, 0, 0);
  }
}
