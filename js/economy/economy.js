// ==========================================================================
// Command & Conquer RTS - Economy, Mining & Power Grid Management
// ==========================================================================

class Economy {
  constructor() {
    this.credits = {
      player: 3000,
      enemy: 3000
    };

    this.power = {
      player: { produced: 0, consumed: 0, status: 'normal' },
      enemy: { produced: 0, consumed: 0, status: 'normal' }
    };

    this.batteryStorage = {
      player: 0,
      enemy: 0
    };

    this.lowPowerAlertPlayed = false;
  }

  reset(startingCredits = 3000) {
    this.credits.player = startingCredits;
    this.credits.enemy = startingCredits;
    this.power.player = { produced: 0, consumed: 0, status: 'normal' };
    this.power.enemy = { produced: 0, consumed: 0, status: 'normal' };
    this.batteryStorage.player = 0;
    this.batteryStorage.enemy = 0;
    this.lowPowerAlertPlayed = false;
  }

  addCredits(faction, amount) {
    this.credits[faction] = (this.credits[faction] || 0) + amount;
  }

  spendCredits(faction, amount) {
    if ((this.credits[faction] || 0) >= amount) {
      this.credits[faction] -= amount;
      return true;
    }
    return false;
  }

  canAfford(faction, amount) {
    return (this.credits[faction] || 0) >= amount;
  }

  isBasePowered(faction) {
    const p = this.power[faction];
    if (!p) return true;
    return p.produced >= p.consumed;
  }

  getProductionSpeed(faction) {
    return this.isBasePowered(faction) ? 1.0 : 0.35;
  }

  update(delta, entityManager, soundFX) {
    // 1. Calculate Power for Player
    let playerProduced = 0;
    let playerConsumed = 0;
    let playerBatteryCap = 0;

    entityManager.getPlayerBuildings().forEach(b => {
      if (b.isBuilding) return;
      playerProduced += b.powerProduced;
      playerConsumed += b.powerConsumed;
      if (b.spec.batteryCap) playerBatteryCap += b.spec.batteryCap;
    });

    this.power.player.produced = playerProduced;
    this.power.player.consumed = playerConsumed;

    const isPlayerDeficit = playerProduced < playerConsumed;
    this.power.player.status = isPlayerDeficit ? 'deficit' : (playerProduced - playerConsumed < 40 ? 'warning' : 'normal');

    if (isPlayerDeficit && !this.lowPowerAlertPlayed) {
      this.lowPowerAlertPlayed = true;
      if (soundFX) {
        soundFX.playPowerAlert();
        soundFX.speak('Low power');
      }
    } else if (!isPlayerDeficit) {
      this.lowPowerAlertPlayed = false;
    }

    // 2. Calculate Power for Enemy AI
    let enemyProduced = 0;
    let enemyConsumed = 0;

    entityManager.getEnemyBuildings().forEach(b => {
      if (b.isBuilding) return;
      enemyProduced += b.powerProduced;
      enemyConsumed += b.powerConsumed;
    });

    this.power.enemy.produced = enemyProduced;
    this.power.enemy.consumed = enemyConsumed;
    this.power.enemy.status = enemyProduced < enemyConsumed ? 'deficit' : 'normal';
  }

  getPowerStats(faction = 'player') {
    const p = this.power[faction];
    const surplus = p.produced - p.consumed;
    return {
      produced: p.produced,
      consumed: p.consumed,
      surplus: surplus,
      isDeficit: surplus < 0,
      ratio: p.produced === 0 && p.consumed === 0 ? 1 : (p.consumed === 0 ? 1 : Math.min(1.5, p.produced / p.consumed))
    };
  }
}
