// ===========================================================================
// Command & Conquer RTS - Tech Tree Module
// ===========================================================================

// Simple singleton to track tech progression. Currently only tracks Command Center level.
// Future expansions can add more tech nodes and dependency checks.

const TechTree = {
  // Level 1 = basic command center, Level 2 = advanced command center unlocked
  commandCenterLevel: 1,

  // Power plant before refinery/barracks; those before war factory/radar.
  REQUIREMENTS: {
    power_plant: [],
    energy_storage: ['power_plant'],
    ore_refinery: ['power_plant'],
    barracks: ['power_plant'],
    war_factory: ['barracks', 'ore_refinery'],
    radar_facility: ['ore_refinery'],
    storage_silo: ['ore_refinery'],
    turret_gun: ['barracks'],
    turret_rocket: ['radar_facility'],
    turret_laser: ['radar_facility', 'power_plant'],
    wall: [],
    machine_gunner: ['barracks'],
    grenadier: ['barracks'],
    rocket_launcher: ['barracks'],
    engineer: ['barracks'],
    light_tracks: ['war_factory'],
    '4x4_gunner': ['war_factory'],
    battle_tank: ['war_factory'],
    harvester: ['ore_refinery'],
    laser_colossus: ['war_factory', 'radar_facility'],
    helicopter: ['war_factory', 'radar_facility'],
    harrier_jet: ['radar_facility']
  },

  upgradeCommandCenter() {
    this.commandCenterLevel = 2;
  },

  isAdvancedAvailable() {
    return this.commandCenterLevel >= 2;
  },

  isOperationalBuilding(building, type) {
    return !!(building && building.isAlive && !building.isBuilding && building.type === type);
  },

  hasBuilding(buildings, type) {
    if (!buildings) return false;
    for (let i = 0; i < buildings.length; i++) {
      if (this.isOperationalBuilding(buildings[i], type)) return true;
    }
    return false;
  },

  isUnlocked(type, buildings) {
    const reqs = this.REQUIREMENTS[type];
    if (!reqs || reqs.length === 0) return true;
    return reqs.every((reqType) => this.hasBuilding(buildings, reqType));
  }
};
