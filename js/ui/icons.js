// ==========================================================================
// Command & Conquer RTS - Procedural Cameo Icons (sidebar, portraits, lobby)
// ==========================================================================

class HudIcons {
  static paint(canvas, type, opts) {
    if (!canvas || !canvas.getContext) return;
    const size = canvas.width || 56;
    if (!canvas.height) canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const team = (opts && opts.team) || (typeof UnitModels !== 'undefined' && UnitModels.playerTeam) || 'blue';
    const isBlue = team !== 'red';
    const faction = isBlue ? '#1565c0' : '#b71c1c';
    const factionLite = isBlue ? '#42a5f5' : '#ef5350';
    const accent = isBlue ? '#90caf9' : '#ff8a80';

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0c1216';
    ctx.fillRect(0, 0, size, size);

    const inset = 3;
    ctx.fillStyle = '#1a242c';
    ctx.fillRect(inset, inset, size - inset * 2, size - inset * 2);

    ctx.save();
    ctx.beginPath();
    ctx.rect(inset, inset, size - inset * 2, size - inset * 2);
    ctx.clip();
    const stripe = faction + '55';
    ctx.fillStyle = stripe;
    for (let i = -size; i < size * 2; i += 7) {
      ctx.fillRect(i, 0, 3, size);
    }
    const wash = ctx.createLinearGradient(0, 0, 0, size);
    wash.addColorStop(0, faction + '99');
    wash.addColorStop(1, '#0a1014cc');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    ctx.strokeStyle = '#5a7384';
    ctx.lineWidth = 2;
    ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.strokeRect(inset - 0.5, inset - 0.5, size - inset * 2 + 1, size - inset * 2 + 1);

    ctx.save();
    ctx.translate(size / 2, size / 2);
    const s = size / 56;
    ctx.scale(s, s);
    this.drawGlyph(ctx, type, { faction, factionLite, accent, isBlue });
    ctx.restore();
  }

  static drawGlyph(ctx, type, pal) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    switch (type) {
      case 'power_plant': this.gPower(ctx, pal); break;
      case 'ore_refinery': this.gRefinery(ctx, pal); break;
      case 'barracks': this.gBarracks(ctx, pal); break;
      case 'war_factory': this.gFactory(ctx, pal); break;
      case 'radar_facility': this.gRadar(ctx, pal); break;
      case 'energy_storage': this.gBattery(ctx, pal); break;
      case 'command_center': this.gHQ(ctx, pal); break;
      case 'turret_gun': this.gGunTurret(ctx, pal); break;
      case 'turret_rocket': this.gRocketTurret(ctx, pal); break;
      case 'turret_laser': this.gLaser(ctx, pal); break;
      case 'wall': this.gWall(ctx, pal); break;
      case 'machine_gunner': this.gSoldier(ctx, pal, 'rifle'); break;
      case 'grenadier': this.gSoldier(ctx, pal, 'grenade'); break;
      case 'rocket_launcher': this.gSoldier(ctx, pal, 'rocket'); break;
      case 'engineer': this.gSoldier(ctx, pal, 'eng'); break;
      case 'light_tracks': this.gTank(ctx, pal, 0.72); break;
      case '4x4_gunner': this.gJeep(ctx, pal); break;
      case 'battle_tank': this.gTank(ctx, pal, 1); break;
      case 'harvester': this.gHarvester(ctx, pal); break;
      case 'laser_colossus': this.gColossus(ctx, pal); break;
      case 'helicopter': this.gHeli(ctx, pal); break;
      case 'harrier_jet': this.gJet(ctx, pal); break;
      case 'faction_blue':
      case 'faction_red': this.gFaction(ctx, pal); break;
      default: this.gHQ(ctx, pal); break;
    }
  }

  static box(ctx, x, y, w, h, fill, stroke) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
  }

  static gPower(ctx, pal) {
    this.box(ctx, -18, 8, 36, 8, '#3a4450', '#222');
    ctx.fillStyle = pal.faction;
    ctx.beginPath();
    ctx.moveTo(-14, 8); ctx.lineTo(-8, -16); ctx.lineTo(-2, 8); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2, 8); ctx.lineTo(8, -16); ctx.lineTo(14, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#33ff66';
    ctx.beginPath(); ctx.arc(-8, -10, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -10, 3, 0, Math.PI * 2); ctx.fill();
  }

  static gRefinery(ctx, pal) {
    this.box(ctx, -16, -4, 20, 18, pal.faction, '#111');
    this.box(ctx, 4, 0, 14, 14, '#2b3842', '#111');
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(6, 4, 10, 6);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(18, -10); ctx.stroke();
  }

  static gBarracks(ctx, pal) {
    this.box(ctx, -18, -2, 36, 16, pal.faction, '#111');
    this.box(ctx, -8, -14, 16, 12, '#2b3842', '#111');
    ctx.fillStyle = pal.accent;
    ctx.fillRect(-2, -18, 4, 8);
    ctx.fillStyle = pal.factionLite;
    ctx.beginPath(); ctx.moveTo(2, -18); ctx.lineTo(12, -14); ctx.lineTo(2, -10); ctx.closePath(); ctx.fill();
  }

  static gFactory(ctx, pal) {
    this.box(ctx, -20, 0, 40, 14, pal.faction, '#111');
    ctx.fillStyle = '#1a2128';
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-6, -14); ctx.lineTo(18, -14); ctx.lineTo(20, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(-4, -12, 16, 4);
  }

  static gRadar(ctx, pal) {
    this.box(ctx, -12, 4, 24, 12, pal.faction, '#111');
    ctx.strokeStyle = '#d9e5ec';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -4, 12, Math.PI * 0.15, Math.PI * 1.05); ctx.stroke();
    ctx.fillStyle = pal.factionLite;
    ctx.fillRect(-1, -8, 2, 16);
    ctx.beginPath(); ctx.arc(0, -10, 3, 0, Math.PI * 2); ctx.fill();
  }

  static gBattery(ctx, pal) {
    this.box(ctx, -16, -10, 12, 24, pal.faction, '#111');
    this.box(ctx, 4, -10, 12, 24, pal.faction, '#111');
    ctx.fillStyle = '#00e676';
    ctx.fillRect(-13, 2, 6, 10);
    ctx.fillRect(7, 2, 6, 10);
    ctx.fillStyle = '#ccc';
    ctx.fillRect(-12, -14, 4, 4);
    ctx.fillRect(8, -14, 4, 4);
  }

  static gHQ(ctx, pal) {
    this.box(ctx, -18, 4, 36, 12, '#4a5b66', '#222');
    this.box(ctx, -10, -10, 20, 16, pal.faction, '#111');
    ctx.fillStyle = '#33b5e5';
    ctx.fillRect(-12, -16, 24, 6);
    ctx.strokeStyle = '#d9e5ec';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -18, 6, 0.2, Math.PI); ctx.stroke();
  }

  static gGunTurret(ctx, pal) {
    this.box(ctx, -14, 6, 28, 10, '#4a5b66', '#222');
    ctx.fillStyle = pal.faction;
    ctx.beginPath(); ctx.arc(0, 2, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.fillRect(-6, -14, 4, 16);
    ctx.fillRect(2, -14, 4, 16);
  }

  static gRocketTurret(ctx, pal) {
    this.box(ctx, -14, 4, 28, 12, '#4a5b66', '#222');
    this.box(ctx, -10, -8, 20, 14, pal.faction, '#111');
    ctx.fillStyle = '#222';
    ctx.fillRect(-8, -16, 5, 14);
    ctx.fillRect(3, -16, 5, 14);
    ctx.fillStyle = '#dd2222';
    ctx.fillRect(-8, -18, 5, 3);
    ctx.fillRect(3, -18, 5, 3);
  }

  static gLaser(ctx, pal) {
    this.box(ctx, -12, 8, 24, 8, '#4a5b66', '#222');
    ctx.fillStyle = pal.faction;
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(8, 8); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.isBlue ? '#00e5ff' : '#ff1744';
    ctx.beginPath(); ctx.arc(0, -8, 4, 0, Math.PI * 2); ctx.fill();
  }

  static gWall(ctx) {
    ctx.fillStyle = '#6d767c';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(-18 + i * 13, i % 2 === 0 ? -6 : -2, 12, 16);
    }
    ctx.strokeStyle = '#2a3034';
    ctx.strokeRect(-18, -6, 12, 16);
    ctx.strokeRect(-5, -2, 12, 16);
    ctx.strokeRect(8, -6, 12, 16);
  }

  static gSoldier(ctx, pal, kind) {
    ctx.fillStyle = '#3d433b';
    ctx.fillRect(-7, 2, 5, 14);
    ctx.fillRect(2, 2, 5, 14);
    ctx.fillStyle = kind === 'eng' ? '#ffaa00' : pal.faction;
    ctx.fillRect(-9, -8, 18, 12);
    ctx.fillStyle = '#d2a679';
    ctx.fillRect(-5, -16, 10, 8);
    ctx.fillStyle = kind === 'eng' ? '#ffcc00' : pal.faction;
    ctx.fillRect(-6, -18, 12, 5);
    ctx.fillStyle = '#1a1a1a';
    if (kind === 'rifle') ctx.fillRect(8, -6, 16, 3);
    if (kind === 'grenade') {
      ctx.fillStyle = '#ff9900';
      ctx.beginPath(); ctx.arc(12, 0, 4, 0, Math.PI * 2); ctx.fill();
    }
    if (kind === 'rocket') {
      ctx.fillStyle = '#323a33';
      ctx.fillRect(6, -12, 16, 5);
      ctx.fillStyle = '#dd2222';
      ctx.fillRect(20, -12, 4, 5);
    }
    if (kind === 'eng') {
      ctx.fillStyle = '#00e5ff';
      ctx.fillRect(8, -2, 10, 8);
    }
  }

  static gTank(ctx, pal, scale) {
    ctx.save();
    ctx.scale(scale, scale);
    this.box(ctx, -18, 2, 36, 10, '#181818', '#000');
    this.box(ctx, -14, -4, 28, 10, pal.faction, '#111');
    this.box(ctx, -8, -12, 16, 10, pal.factionLite || pal.faction, '#111');
    ctx.fillStyle = '#222';
    ctx.fillRect(6, -10, 20, 4);
    ctx.restore();
  }

  static gJeep(ctx, pal) {
    ctx.fillStyle = '#151515';
    ctx.beginPath(); ctx.arc(-10, 8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, 8, 5, 0, Math.PI * 2); ctx.fill();
    this.box(ctx, -16, -4, 32, 10, pal.faction, '#111');
    ctx.fillStyle = '#3388aa';
    ctx.fillRect(-6, -10, 14, 6);
    ctx.fillStyle = '#111';
    ctx.fillRect(2, -14, 12, 3);
  }

  static gHarvester(ctx) {
    this.box(ctx, -18, 2, 36, 10, '#1a1a1a', '#000');
    this.box(ctx, -14, -8, 28, 14, '#e0a010', '#7a5a00');
    this.box(ctx, 2, -16, 14, 10, '#333b40', '#111');
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(-10, -6, 12, 8);
  }

  static gColossus(ctx, pal) {
    this.box(ctx, -20, 6, 12, 10, '#141414', '#000');
    this.box(ctx, 8, 6, 12, 10, '#141414', '#000');
    this.box(ctx, -12, -6, 24, 14, pal.faction, '#111');
    ctx.fillStyle = pal.isBlue ? '#00e5ff' : '#ff1744';
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(6, -6); ctx.lineTo(-6, -6); ctx.closePath(); ctx.fill();
  }

  static gHeli(ctx, pal) {
    this.box(ctx, -8, -4, 20, 10, pal.faction, '#111');
    this.box(ctx, -20, -2, 14, 5, pal.faction, '#111');
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-22, -12); ctx.lineTo(22, 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-22, 4); ctx.lineTo(22, -12); ctx.stroke();
    ctx.fillStyle = '#2288bb';
    ctx.fillRect(4, -6, 10, 6);
  }

  static gJet(ctx, pal) {
    ctx.fillStyle = pal.faction;
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-16, 8); ctx.lineTo(-12, 0); ctx.lineTo(-16, -8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.factionLite;
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-14, 14); ctx.lineTo(2, 4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-14, -14); ctx.lineTo(2, -4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#00d4ff';
    ctx.fillRect(-18, -2, 4, 4);
  }

  static gFaction(ctx, pal) {
    ctx.fillStyle = pal.factionLite;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(14, -4);
    ctx.lineTo(8, -4);
    ctx.lineTo(8, 16);
    ctx.lineTo(-8, 16);
    ctx.lineTo(-8, -4);
    ctx.lineTo(-14, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.accent;
    ctx.fillRect(-3, 4, 6, 8);
  }
}
