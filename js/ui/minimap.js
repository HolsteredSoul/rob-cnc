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
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return;
      e.preventDefault();
      this.gameContext.renderer.setTouchInput(true);
      this.isDragging = true;
      this.touchId = e.pointerId;
      if (this.canvas.setPointerCapture) this.canvas.setPointerCapture(e.pointerId);
      this.panFromClient(e.clientX, e.clientY);
    });
    this.canvas.addEventListener('pointermove', (e) => {
      if (this.isDragging && e.pointerId === this.touchId) { e.preventDefault(); this.panFromClient(e.clientX, e.clientY); }
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => this.canvas.addEventListener(type, () => {
      this.isDragging = false; this.touchId = null;
    }));
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.gameContext.renderer.touchInput) return;
      this.isDragging = true;
      this.handleMinimapClick(e);
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging && !this.gameContext.renderer.touchInput) {
        this.handleMinimapClick(e);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });
  }

  handleMinimapClick(e) {
    const r = this.gameContext.renderer;
    const pt = (r && r.getPointerClient) ? r.getPointerClient(e) : { x: e.clientX, y: e.clientY };
    this.panFromClient(pt.x, pt.y);
  }

  panFromClient(clientX, clientY) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || x > rect.width || y < 0 || y > rect.height) return;

    const terrain = this.gameContext.terrain;
    if (!terrain) return;
    const worldX = (x / rect.width) * terrain.worldWidth;
    const worldZ = (y / rect.height) * terrain.worldHeight;
    if (this.gameContext.renderer && this.gameContext.renderer.panTo) {
      this.gameContext.renderer.panTo(worldX, worldZ);
    }
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

    const radarActive = typeof isPlayerRadarOperational === 'function'
      ? isPlayerRadarOperational(this.gameContext)
      : entityManager.getPlayerBuildings().some(b => b.type === 'radar_facility' && !b.isBuilding && b.isAlive) && economy.isBasePowered('player');
    const hasRadarBuilding = entityManager.getPlayerBuildings().some(b => b.type === 'radar_facility' && !b.isBuilding && b.isAlive);
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
      if (!isPlayer && !radarActive) return;
      const isPlayerBlue = (this.gameContext.playerTeam || 'blue') === 'blue';
      const isBlue = isPlayer ? isPlayerBlue : !isPlayerBlue;
      this.ctx.fillStyle = isBlue ? '#3ec6ff' : '#e0524a';
      const bw = Math.max(4, b.footprint.w * terrain.tileSize * scaleX);
      const bh = Math.max(4, b.footprint.h * terrain.tileSize * scaleZ);
      this.ctx.fillRect(
        (b.position.x - (b.footprint.w * terrain.tileSize) / 2) * scaleX,
        (b.position.z - (b.footprint.h * terrain.tileSize) / 2) * scaleZ,
        bw,
        bh
      );
    });

    entityManager.units.forEach((u) => {
      if (!u.isAlive) return;
      const isPlayer = u.faction === 'player';
      if (!isPlayer) {
        if (!radarActive) return;
        if (fogOfWar && !fogOfWar.isVisible(u.position.x, u.position.z)) return;
      }
      this.ctx.fillStyle = isPlayer ? '#9bffb5' : '#ff8a82';
      const s = u.isVehicle ? 4 : 3;
      this.ctx.fillRect(u.position.x * scaleX - s / 2, u.position.z * scaleZ - s / 2, s, s);
    });

    this.drawCameraBox(w, h, scaleX, scaleZ, renderer);
    this.drawNorth(w);
    this.drawAlertPing(w, h, scaleX, scaleZ, entityManager);

    if (!radarActive) {
      this.renderStaticNoise(w, h, 0.18);
      if (offlineMsg) {
        offlineMsg.style.display = 'flex';
        offlineMsg.innerHTML = hasRadarBuilding
          ? 'RADAR OFFLINE<br><span style="font-size:9px; color:#ff9999;">POWER DEFICIT</span>'
          : 'TACTICAL MAP<br><span style="font-size:9px; color:#8899aa;">BUILD RADAR FOR ENEMY CONTACTS</span>';
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
        if (!visible) this.ctx.globalAlpha = radarActive ? 0.45 : 0.42;
        else this.ctx.globalAlpha = radarActive ? 1 : 0.78;
        this.ctx.fillRect(gx * terrain.tileSize * scaleX, gz * terrain.tileSize * scaleZ, step + 0.5, step + 0.5);
        this.ctx.globalAlpha = 1;
      }
    }
    terrain.oreDeposits.forEach((ore) => {
      if (fogOfWar && !fogOfWar.isExplored(ore.x, ore.z)) return;
      const ratio = ore.maxOre > 0 ? ore.remaining / ore.maxOre : 0;
      this.ctx.fillStyle = colors.ore;
      this.ctx.globalAlpha = (radarActive ? 1 : 0.55) * (0.35 + Math.max(0, ratio) * 0.65);
      this.ctx.beginPath();
      this.ctx.arc(ore.x * scaleX, ore.z * scaleZ, ratio > 0 ? 3 : 2, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.globalAlpha = 1;
    });
  }

  drawNorth(w) {
    this.ctx.fillStyle = '#d7e6ee';
    this.ctx.font = 'bold 11px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('N', w / 2, 12);
    this.ctx.strokeStyle = '#d7e6ee';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(w / 2, 14);
    this.ctx.lineTo(w / 2, 22);
    this.ctx.stroke();
  }

  drawCameraBox(w, h, scaleX, scaleZ, renderer) {
    if (!renderer) return;
    const bounds = renderer.getGroundViewBounds ? renderer.getGroundViewBounds() : null;
    let x;
    let y;
    let bw;
    let bh;
    if (bounds) {
      x = bounds.minX * scaleX;
      y = bounds.minZ * scaleZ;
      bw = Math.max(10, (bounds.maxX - bounds.minX) * scaleX);
      bh = Math.max(10, (bounds.maxZ - bounds.minZ) * scaleZ);
    } else {
      const camTarget = renderer.targetPos;
      bw = 36 * (renderer.zoomLevel || 1) * scaleX;
      bh = 28 * (renderer.zoomLevel || 1) * scaleZ;
      x = camTarget.x * scaleX - bw / 2;
      y = camTarget.z * scaleZ - bh / 2;
    }
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.fillRect(x, y, bw, bh);
    this.ctx.strokeStyle = '#f4f7fa';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(x, y, bw, bh);
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
