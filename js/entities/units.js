// ==========================================================================
// Command & Conquer RTS - Unit Logic, Combat State Machine & Harvesters
// ==========================================================================

const UNIT_SPECS = {
  machine_gunner: {
    name: 'Machine Gunner',
    category: 'infantry',
    hp: 110,
    speed: 7.5,
    attackRange: 13,
    damage: 14,
    attackCooldown: 0.45,
    cost: 100,
    sightRange: 18,
    isVehicle: false,
    isAir: false
  },
  grenadier: {
    name: 'Grenadier',
    category: 'infantry',
    hp: 130,
    speed: 6.8,
    attackRange: 15,
    damage: 38,
    attackCooldown: 1.2,
    cost: 160,
    sightRange: 18,
    isVehicle: false,
    isAir: false,
    splashRadius: 3.5
  },
  rocket_launcher: {
    name: 'Rocket Soldier',
    category: 'infantry',
    hp: 115,
    speed: 6.2,
    attackRange: 19,
    damage: 65,
    attackCooldown: 1.7,
    cost: 220,
    sightRange: 20,
    isVehicle: false,
    isAir: false,
    antiAir: true,
    canTargetAir: true
  },
  light_tracks: {
    name: 'Light Tracks',
    category: 'vehicle',
    hp: 290,
    speed: 10.5,
    attackRange: 14,
    damage: 22,
    attackCooldown: 0.4,
    cost: 400,
    sightRange: 22,
    isVehicle: true,
    isAir: false
  },
  '4x4_gunner': {
    name: '4x4 Gunner',
    category: 'vehicle',
    hp: 230,
    speed: 13.0,
    attackRange: 15,
    damage: 26,
    attackCooldown: 0.45,
    cost: 350,
    sightRange: 24,
    isVehicle: true,
    isAir: false
  },
  battle_tank: {
    name: 'Battle Tank',
    category: 'vehicle',
    hp: 580,
    speed: 6.8,
    attackRange: 18,
    damage: 95,
    attackCooldown: 1.6,
    cost: 800,
    sightRange: 22,
    isVehicle: true,
    isAir: false
  },
  harvester: {
    name: 'Ore Harvester',
    category: 'vehicle',
    hp: 650,
    speed: 7.2,
    attackRange: 0,
    damage: 0,
    attackCooldown: 1.0,
    cost: 500, // Reduced from 1000!
    sightRange: 18,
    isVehicle: true,
    isAir: false,
    cargoCapacity: 500
  },
  engineer: {
    name: 'Combat Engineer',
    category: 'infantry',
    hp: 90,
    speed: 6.8,
    attackRange: 3,
    damage: 0,
    attackCooldown: 1.0,
    cost: 250,
    sightRange: 16,
    isVehicle: false,
    isAir: false,
    isEngineer: true
  },
  laser_colossus: {
    name: 'Laser Colossus',
    category: 'vehicle',
    hp: 1350,
    speed: 5.4,
    attackRange: 22,
    damage: 130,
    attackCooldown: 0.75,
    cost: 1600,
    sightRange: 25,
    isVehicle: true,
    isAir: false,
    isLaser: true
  },
  helicopter: {
    name: 'Attack Chopper',
    category: 'air',
    hp: 280,
    speed: 11.5,
    attackRange: 15,
    damage: 20,
    attackCooldown: 0.35,
    cost: 750,
    sightRange: 24,
    isVehicle: true,
    isAir: true,
    canTargetAir: true
  },
  harrier_jet: {
    name: 'Harrier Jet',
    category: 'air',
    hp: 340,
    speed: 22.0,
    attackRange: 22,
    damage: 130,
    attackCooldown: 3.5,
    cost: 1200,
    sightRange: 28,
    isVehicle: true,
    isAir: true,
    canTargetAir: true
  }
};

const GUARD_LEASH = 14;
const AGGRO_LEASH = 32;
const VET_THRESHOLDS = [4, 10];
const VET_DMG_MULT = [1, 1.1, 1.2];
const VET_HP_MULT = [1, 1.1, 1.2];

let nextUnitId = 1;

class Unit {
  constructor(type, faction, x, z, scene) {
    this.id = nextUnitId++;
    this.type = type;
    this.faction = faction; // 'player' or 'enemy'
    this.spec = UNIT_SPECS[type] || UNIT_SPECS.machine_gunner;
    this.name = this.spec.name;

    this.hp = this.spec.hp;
    this.maxHp = this.spec.hp;
    this.speed = this.spec.speed;
    this.attackRange = this.spec.attackRange;
    this.damage = this.spec.damage;
    this.attackCooldown = this.spec.attackCooldown;
    this.sightRange = this.spec.sightRange;
    this.isAir = this.spec.isAir;
    this.isVehicle = this.spec.isVehicle;

    this.position = new THREE.Vector3(x, this.isAir ? (this.type === 'harrier_jet' ? 22 : 12) : 0, z);
    this.targetPos = this.position.clone();
    this.waypoints = [];
    this.targetEntity = null;
    this.followTarget = null;
    this.isAlive = true;
    this.cooldownTimer = 0;
    this.kills = 0;
    this.baseHp = this.spec.hp;
    this.baseDamage = this.spec.damage;
    this.canTargetAir = !!(this.spec.canTargetAir || this.spec.antiAir);

    // idle | move | attackMove | attack | hold | follow | harvest
    this.order = this.type === 'harvester' ? 'harvest' : 'idle';
    // aggressive | guard | holdground | holdfire
    this.stance = 'guard';
    this.guardX = x;
    this.guardZ = z;
    this.destX = x;
    this.destZ = z;

    // Harvester specific state
    this.cargo = 0;
    this.maxCargo = this.spec.cargoCapacity || 500;
    this.harvesterState = 'IDLE'; // 'SEEKING_ORE', 'MINING', 'RETURNING', 'UNLOADING'
    this.targetOreNode = null;
    this.targetRefinery = null;
    this.miningTimer = 0;

    // Create procedural 3D model
    this.mesh = this.createMesh(type, faction);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);

    // Dynamic selection circle under unit
    this.selectionRing = this.createSelectionRing();
    this.mesh.add(this.selectionRing);
    this.selectionRing.visible = false;

    this.vetChevrons = this.createVetChevrons();
    this.mesh.add(this.vetChevrons);

    this.selected = false;
    this.healthBar = this.createHealthBar();
    scene.add(this.healthBar);

    this.cargoBar = null;
    if (this.type === 'harvester') {
      this.cargoBar = this.createCargoBar();
      scene.add(this.cargoBar);
    }
  }

  get rank() {
    let r = 0;
    for (let i = 0; i < VET_THRESHOLDS.length; i++) {
      if (this.kills >= VET_THRESHOLDS[i]) r++;
    }
    return r;
  }

  applyVeterancy() {
    const r = this.rank;
    const hpMult = VET_HP_MULT[r] || 1;
    const dmgMult = VET_DMG_MULT[r] || 1;
    const newMax = Math.round(this.baseHp * hpMult);
    if (newMax > this.maxHp) {
      this.hp += (newMax - this.maxHp);
    }
    this.maxHp = newMax;
    this.damage = this.baseDamage * dmgMult;
    this.updateVetChevrons();
    this.updateHealthBar();
  }

  createVetChevrons() {
    const group = new THREE.Group();
    group.visible = false;
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide, depthTest: false });
    for (let i = 0; i < 2; i++) {
      const geo = new THREE.RingGeometry(0.22, 0.38, 3);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, 0.12 + i * 0.08, -(this.isVehicle ? 1.6 : 0.85) - i * 0.12);
      mesh.visible = false;
      group.add(mesh);
    }
    return group;
  }

  updateVetChevrons() {
    if (!this.vetChevrons) return;
    const r = this.rank;
    this.vetChevrons.visible = r > 0;
    this.vetChevrons.children.forEach((c, i) => {
      c.visible = i < r;
    });
  }

  canEngage(entity) {
    if (!entity || !entity.isAlive) return false;
    if (entity.isAir && !this.canTargetAir) return false;
    return true;
  }

  setGuardPost(x, z) {
    this.guardX = x;
    this.guardZ = z;
  }

  becomeIdle() {
    this.waypoints = [];
    this.targetEntity = null;
    this.followTarget = null;
    this.setGuardPost(this.position.x, this.position.z);
    if (this.type === 'harvester') {
      this.order = 'harvest';
      if (this.harvesterState === 'UNLOADING' || this.harvesterState === 'MINING') return;
      if ((this.cargo || 0) >= this.maxCargo) {
        this.harvesterState = 'RETURNING';
        return;
      }
      this.harvesterState = 'IDLE';
    } else {
      this.order = 'idle';
    }
  }

  createMesh(type, faction) {
    switch (type) {
      case 'machine_gunner': return UnitModels.createMachineGunner(faction);
      case 'grenadier': return UnitModels.createGrenadier(faction);
      case 'rocket_launcher': return UnitModels.createRocketLauncher(faction);
      case 'light_tracks': return UnitModels.createLightTracks(faction);
      case '4x4_gunner': return UnitModels.create4x4Gunner(faction);
      case 'battle_tank': return UnitModels.createBattleTank(faction);
      case 'harvester': return UnitModels.createOreHarvester(faction);
      case 'engineer': return UnitModels.createEngineer(faction);
      case 'laser_colossus': return UnitModels.createLaserColossus(faction);
      case 'helicopter': return UnitModels.createHelicopter(faction);
      case 'harrier_jet': return UnitModels.createHarrierJet(faction);
      default: return UnitModels.createMachineGunner(faction);
    }
  }

  createSelectionRing() {
    const radius = this.isVehicle ? (this.type === 'battle_tank' ? 2.2 : 1.8) : 1.0;
    const ringGeo = new THREE.RingGeometry(radius * 0.85, radius, 24);
    ringGeo.rotateX(-Math.PI / 2);
    ringGeo.translate(0, 0.05, 0);

    const ringMat = new THREE.MeshBasicMaterial({
      color: this.faction === 'player' ? 0x00ff66 : 0xff3333,
      side: THREE.DoubleSide
    });
    return new THREE.Mesh(ringGeo, ringMat);
  }

  setSelected(selected) {
    this.selected = !!selected;
    if (this.selectionRing) {
      this.selectionRing.visible = this.selected;
    }
    this.updateHealthBar();
  }

  createHealthBar() {
    const width = this.isVehicle ? 2.4 : 1.5;
    const height = 0.18;
    const group = new THREE.Group();
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: 0x111111, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    );
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: 0x33ff33, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    );
    fill.position.z = 0.02;
    bg.renderOrder = 20;
    fill.renderOrder = 21;
    group.add(bg, fill);
    group.userData.fill = fill;
    group.userData.width = width;
    group.visible = false;
    return group;
  }

  healthBarHeight() {
    if (this.type === 'harrier_jet') return 3.2;
    if (this.isAir) return 2.4;
    if (this.type === 'laser_colossus' || this.type === 'battle_tank') return 4.0;
    if (this.isVehicle) return 3.2;
    return 2.35;
  }

  updateHealthBar(gameContext) {
    const bar = this.healthBar;
    if (!bar) return;
    const ratio = this.maxHp > 0 ? Math.max(0, Math.min(1, this.hp / this.maxHp)) : 0;
    const show = this.isAlive && (this.selected || ratio < 0.999);
    bar.visible = show && (this.mesh ? this.mesh.visible !== false : true);
    if (!bar.visible) return;

    const yOff = (this.cargoBar && this.cargoBar.visible) ? 0.32 : 0;
    bar.position.set(this.position.x, this.position.y + this.healthBarHeight() + yOff, this.position.z);
    const cam = gameContext && gameContext.renderer && gameContext.renderer.camera;
    if (cam) {
      bar.lookAt(cam.position);
    }

    const fill = bar.userData.fill;
    const width = bar.userData.width;
    fill.scale.x = Math.max(0.02, ratio);
    fill.position.x = -((1 - fill.scale.x) * width) / 2;
    if (ratio < 0.3) fill.material.color.setHex(0xff3333);
    else if (ratio < 0.6) fill.material.color.setHex(0xffaa00);
    else fill.material.color.setHex(0x33ff33);
  }

  createCargoBar() {
    const width = 2.5;
    const height = 0.16;
    const group = new THREE.Group();
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: 0x1a1408, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    );
    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: 0xffcc00, depthTest: false, depthWrite: false, side: THREE.DoubleSide })
    );
    fill.position.z = 0.02;
    bg.renderOrder = 22;
    fill.renderOrder = 23;
    group.add(bg, fill);
    group.userData.fill = fill;
    group.userData.width = width;
    group.visible = false;
    return group;
  }

  cargoFillRatio() {
    const max = this.maxCargo || 500;
    let amount = this.cargo || 0;
    if (this.harvesterState === 'MINING' && this.miningTimer > 0) {
      amount += (this.miningTimer / 0.8) * 60;
    }
    return Math.max(0, Math.min(1, amount / max));
  }

  updateCargoBar(gameContext) {
    const bar = this.cargoBar;
    if (!bar) return;
    if (this.type !== 'harvester' || !this.isAlive) {
      bar.visible = false;
      return;
    }
    const mining = this.harvesterState === 'MINING';
    const hauling = (this.cargo || 0) > 0 || this.harvesterState === 'RETURNING' || this.harvesterState === 'UNLOADING';
    const show = mining || hauling;
    bar.visible = show && (this.mesh ? this.mesh.visible !== false : true);
    if (!bar.visible) return;

    bar.position.set(this.position.x, this.position.y + this.healthBarHeight(), this.position.z);
    const cam = gameContext && gameContext.renderer && gameContext.renderer.camera;
    if (cam) bar.lookAt(cam.position);

    const ratio = this.cargoFillRatio();
    const fill = bar.userData.fill;
    const width = bar.userData.width;
    fill.scale.x = Math.max(0.02, ratio);
    fill.position.x = -((1 - fill.scale.x) * width) / 2;
    if (this.harvesterState === 'RETURNING' || ratio >= 0.999) fill.material.color.setHex(0xffaa00);
    else fill.material.color.setHex(0xffcc00);
  }

  arrivalRadius() {
    if (this.isAir) return 1.6;
    if (this.isVehicle) return 1.15;
    return 0.7;
  }

  setPathTo(destX, destZ, pathfinding) {
    this.destX = destX;
    this.destZ = destZ;
    if (this.isAir) {
      this.waypoints = [{ x: destX, z: destZ }];
    } else if (pathfinding) {
      this.waypoints = pathfinding.findPath(this.position.x, this.position.z, destX, destZ);
      if (!this.waypoints || this.waypoints.length === 0) {
        this.waypoints = [{ x: destX, z: destZ }];
      } else {
        this.waypoints.shift();
      }
    } else {
      this.waypoints = [{ x: destX, z: destZ }];
    }
  }

  // Issue move command with pathfinder waypoints
  moveTo(destX, destZ, pathfinding) {
    this.targetEntity = null;
    this.followTarget = null;
    if (this.type === 'harvester') this.targetRefinery = null;
    this.order = 'move';
    if (this.type === 'harvester' && this.harvesterState !== 'UNLOADING') {
      this.harvesterState = 'IDLE';
    }
    this.setPathTo(destX, destZ, pathfinding);
  }

  attackMoveTo(destX, destZ, pathfinding) {
    if (this.type === 'harvester' || this.spec.damage <= 0) {
      this.moveTo(destX, destZ, pathfinding);
      return;
    }
    this.targetEntity = null;
    this.followTarget = null;
    this.order = 'attackMove';
    this.setPathTo(destX, destZ, pathfinding);
  }

  // Issue attack order against specific entity
  attackTarget(entity, pathfinding) {
    if (this.type === 'harvester') return;
    if (!this.canEngage(entity)) return;
    this.followTarget = null;
    this.targetEntity = entity;
    this.order = 'attack';
    const dist = this.position.distanceTo(entity.position);
    if (dist > this.attackRange && pathfinding) {
      this.setPathTo(entity.position.x, entity.position.z, pathfinding);
    }
  }

  followUnit(leader) {
    if (!leader || leader === this || this.type === 'harvester') return;
    this.followTarget = leader;
    this.targetEntity = null;
    this.order = 'follow';
    this.waypoints = [];
  }

  holdPosition() {
    if (this.type === 'harvester') {
      this.order = 'hold';
      this.waypoints = [];
      this.followTarget = null;
      this.targetEntity = null;
      if (this.harvesterState !== 'UNLOADING') this.harvesterState = 'IDLE';
      this.setGuardPost(this.position.x, this.position.z);
      return;
    }
    this.order = 'hold';
    this.stance = 'holdground';
    this.waypoints = [];
    this.followTarget = null;
    this.targetEntity = null;
    this.setGuardPost(this.position.x, this.position.z);
  }

  // Issue harvest order
  harvestOre(oreNode, pathfinding) {
    if (this.type !== 'harvester') return;
    this.targetOreNode = oreNode;
    this.targetRefinery = null;
    this.harvesterState = 'SEEKING_ORE';
    this.order = 'harvest';
    this.targetEntity = null;
    this.followTarget = null;
    this.setPathTo(oreNode.x, oreNode.z, pathfinding);
  }

  // Issue capture order for Combat Engineer
  captureBuilding(building, pathfinding) {
    if (this.type !== 'engineer') return;
    this.targetBuildingToCapture = building;
    this.targetEntity = null;
    this.moveTo(building.position.x, building.position.z, pathfinding);
  }

  update(delta, gameContext) {
    if (!this.isAlive) return;

    // Continuous smooth terrain height following
    if (gameContext.terrain) {
      const groundY = gameContext.terrain.getElevation(this.position.x, this.position.z);
      if (this.isAir) {
        const targetAirY = groundY + (this.type === 'harrier_jet' ? 22 : 12);
        this.position.y = THREE.MathUtils.lerp(this.position.y, targetAirY, 8 * delta);
      } else {
        this.position.y = THREE.MathUtils.lerp(this.position.y, groundY, 18 * delta);
      }
      this.mesh.position.y = this.position.y;
    }

    // Cooldown timer
    if (this.cooldownTimer > 0) {
      this.cooldownTimer -= delta;
    }

    // Rotor & Animation update
    this.updateAnimations(delta);

    // Engineer Building Capture check
    if (this.type === 'engineer' && this.targetBuildingToCapture) {
      if (!this.targetBuildingToCapture.isAlive || this.targetBuildingToCapture.faction === this.faction) {
        this.targetBuildingToCapture = null;
      } else {
        const dist = this.position.distanceTo(this.targetBuildingToCapture.position);
        if (dist <= 3.6) {
          // Successfully infiltrated!
          this.targetBuildingToCapture.capture(this.faction);
          if (gameContext.soundFX) gameContext.soundFX.playCaptureSound();
          if (gameContext.hud) gameContext.hud.postRadioMessage('Enemy structure captured!', 'success');
          this.die();
          return;
        }
      }
    }

    // Harvester State Machine
    if (this.type === 'harvester') {
      this.updateHarvester(delta, gameContext);
      this.updateMovement(delta, gameContext);
      this.updateHealthBar(gameContext);
      this.updateCargoBar(gameContext);
      return;
    }

    // Aircraft circling / flyby logic for Harrier
    if (this.type === 'harrier_jet') {
      this.updateHarrier(delta, gameContext);
      this.updateHealthBar(gameContext);
      return;
    }

    // Combat & Movement logic
    this.updateOrders(delta, gameContext);
    this.updateMovement(delta, gameContext);
    this.updateHealthBar(gameContext);
  }

  updateAnimations(delta) {
    const ud = this.mesh.userData;
    // Helicopter spinning rotors
    if (ud.mainRotor) {
      ud.mainRotor.rotation.y += 28 * delta;
    }
    if (ud.tailRotor) {
      ud.tailRotor.rotation.x += 34 * delta;
    }

    // Harvester drill spinning when mining
    if (ud.drill && this.harvesterState === 'MINING') {
      ud.drill.rotation.x += 18 * delta;
    }

    const moving = this.waypoints && this.waypoints.length > 0 && this.isAlive;
    if (ud.animPhase === undefined) ud.animPhase = 0;
    if (moving) ud.animPhase += delta * Math.max(4, this.speed * 2.4);
    else ud.animPhase += (0 - ud.animPhase) * Math.min(1, delta * 8);

    const swing = moving ? Math.sin(ud.animPhase) * 0.55 : 0;
    if (ud.leftLeg) ud.leftLeg.rotation.x = swing;
    if (ud.rightLeg) ud.rightLeg.rotation.x = -swing;

    if (ud.wheels && ud.wheels.length) {
      const spin = moving ? this.speed * delta * 3.2 : 0;
      for (let i = 0; i < ud.wheels.length; i++) {
        ud.wheels[i].rotation.x += spin;
      }
    }

    this.applyWalkBob();
  }

  applyWalkBob() {
    const ud = this.mesh && this.mesh.userData;
    if (!ud || !ud.leftLeg || this.isAir) return;
    const moving = this.waypoints && this.waypoints.length > 0;
    const bob = moving ? Math.abs(Math.sin((ud.animPhase || 0) * 2)) * 0.07 : 0;
    this.mesh.position.y = this.position.y + bob;
  }

  steerAroundUnits(dirX, dirZ, entityManager) {
    if (!entityManager || this.isAir) return null;
    const units = entityManager.units;
    const look = this.type === 'harvester' ? 5.6 : 4.2;
    const lookSq = look * look;
    let ax = 0;
    let az = 0;
    let hits = 0;
    let closestAhead = look;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (u === this || !u.isAlive || u.isAir) continue;
      const dx = u.position.x - this.position.x;
      const dz = u.position.z - this.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq > lookSq || distSq < 1e-5) continue;
      const dist = Math.sqrt(distSq);
      const fwd = (dx * dirX + dz * dirZ) / dist;
      if (fwd < 0.12) continue;
      let side = dirX * dz - dirZ * dx;
      if (Math.abs(side) < 0.15 * dist) {
        if (this._avoidBias == null) this._avoidBias = (i + (this.mesh && this.mesh.id ? this.mesh.id : 0)) % 2 ? 1 : -1;
        side = this._avoidBias;
      }
      const steerRight = side > 0 ? 1 : -1;
      const weight = (1 - dist / look) * (0.65 + fwd * 0.85) * (u.isVehicle ? 1.2 : 1);
      ax += dirZ * steerRight * weight;
      az += -dirX * steerRight * weight;
      hits++;
      if (fwd > 0.5 && dist < closestAhead) closestAhead = dist;
    }
    if (!hits) return null;
    const mag = Math.hypot(ax, az);
    if (mag > 0.95) {
      ax = (ax / mag) * 0.95;
      az = (az / mag) * 0.95;
    }
    return { x: ax, z: az, slow: closestAhead < 2.5 ? 0.48 : (closestAhead < 3.6 ? 0.72 : 1) };
  }

  updateMovement(delta, gameContext) {
    if (this.waypoints.length === 0) {
      this.applyWalkBob();
      return;
    }

    const nextWp = this.waypoints[0];
    const wpX = nextWp.x !== undefined ? nextWp.x : nextWp.wx;
    const wpZ = nextWp.z !== undefined ? nextWp.z : nextWp.wz;
    const targetVec = new THREE.Vector3(wpX, this.position.y, wpZ);
    const dir = targetVec.clone().sub(this.position);
    dir.y = 0; // Move along horizontal plane; Y is calculated from terrain elevation
    const dist = dir.length();

    const arriveAt = this.waypoints.length === 1 ? this.arrivalRadius() : 0.8;
    if (dist < arriveAt) {
      this.waypoints.shift();
      if (this.waypoints.length === 0) {
        if (this.order === 'move' || this.order === 'attackMove') {
          this.becomeIdle();
        }
        return;
      }
    }

    dir.normalize();
    let stepScale = 1;
    if (this.type === 'harvester' && gameContext && gameContext.entityManager) {
      const avoid = this.steerAroundUnits(dir.x, dir.z, gameContext.entityManager);
      if (avoid) {
        dir.x += avoid.x;
        dir.z += avoid.z;
        const len = Math.hypot(dir.x, dir.z) || 1;
        dir.x /= len;
        dir.z /= len;
        stepScale = avoid.slow;
      }
    }

    // Smooth rotation towards travel direction
    const targetAngle = Math.atan2(dir.x, dir.z);
    this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetAngle, 12 * delta);

    // Move forward
    const moveStep = Math.min(dist, this.speed * delta * stepScale);
    this.position.x += dir.x * moveStep;
    this.position.z += dir.z * moveStep;
    this.mesh.position.x = this.position.x;
    this.mesh.position.z = this.position.z;
  }

  acquireEnemy(gameContext, radius) {
    const { entityManager } = gameContext;
    if (!entityManager || this.spec.damage <= 0) return null;
    return entityManager.findClosestEnemy(this.position, radius, this.faction, {
      canTargetAir: this.canTargetAir,
      preferAir: !!this.spec.antiAir
    });
  }

  fireIfInRange(gameContext) {
    if (this.stance === 'holdfire' || this.spec.damage <= 0) return;
    if (!this.targetEntity || !this.targetEntity.isAlive || !this.canEngage(this.targetEntity)) {
      this.targetEntity = this.acquireEnemy(gameContext, this.attackRange);
    }
    if (!this.targetEntity) return;
    const dist = this.position.distanceTo(this.targetEntity.position);
    if (dist <= this.attackRange) {
      this.aimAt(this.targetEntity, gameContext, 0);
      if (this.cooldownTimer <= 0) {
        this.fireWeapon(this.targetEntity, gameContext);
        this.cooldownTimer = this.attackCooldown;
      }
    }
  }

  aimAt(entity, gameContext, delta) {
    const lookDir = entity.position.clone().sub(this.position);
    const angle = Math.atan2(lookDir.x, lookDir.z);
    if (this.mesh.userData.turret) {
      this.mesh.userData.turret.rotation.y = angle - this.mesh.rotation.y;
    } else if (delta > 0) {
      this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, angle, 14 * delta);
    } else {
      this.mesh.rotation.y = angle;
    }
  }

  engageTarget(entity, gameContext, delta, stopToShoot) {
    if (!this.canEngage(entity)) {
      this.targetEntity = null;
      return false;
    }
    const dist = this.position.distanceTo(entity.position);
    if (dist <= this.attackRange) {
      if (stopToShoot && !this.isAir) this.waypoints = [];
      this.aimAt(entity, gameContext, delta);
      if (this.cooldownTimer <= 0) {
        this.fireWeapon(entity, gameContext);
        this.cooldownTimer = this.attackCooldown;
      }
      return true;
    }
    if (gameContext.pathfinding && (this.waypoints.length === 0 || dist > this.attackRange * 1.4)) {
      this.setPathTo(entity.position.x, entity.position.z, gameContext.pathfinding);
    }
    return true;
  }

  updateOrders(delta, gameContext) {
    if (this.spec.damage <= 0 && this.order !== 'follow') {
      this.fireIfInRange(gameContext);
      return;
    }

    switch (this.order) {
      case 'move':
        this.fireIfInRange(gameContext);
        break;
      case 'attack': {
        if (!this.targetEntity || !this.targetEntity.isAlive) {
          this.targetEntity = this.stance === 'holdfire' ? null : this.acquireEnemy(gameContext, this.sightRange);
          if (this.targetEntity) {
            this.engageTarget(this.targetEntity, gameContext, delta, true);
          } else {
            this.becomeIdle();
          }
        } else {
          this.engageTarget(this.targetEntity, gameContext, delta, true);
        }
        break;
      }
      case 'attackMove': {
        if (this.stance !== 'holdfire') {
          const t = this.acquireEnemy(gameContext, this.sightRange);
          if (t) {
            this.targetEntity = t;
            this.engageTarget(t, gameContext, delta, true);
            break;
          }
        }
        this.targetEntity = null;
        if (this.waypoints.length === 0 && gameContext.pathfinding) {
          this.setPathTo(this.destX, this.destZ, gameContext.pathfinding);
        }
        break;
      }
      case 'hold':
        this.fireIfInRange(gameContext);
        this.waypoints = [];
        break;
      case 'follow':
        this.updateFollow(delta, gameContext);
        break;
      default:
        this.updateAutonomous(delta, gameContext);
        break;
    }
  }

  updateFollow(delta, gameContext) {
    const leader = this.followTarget;
    if (!leader || !leader.isAlive) {
      this.becomeIdle();
      return;
    }
    if (this.stance !== 'holdfire' && this.spec.damage > 0) {
      const t = this.acquireEnemy(gameContext, this.attackRange * 1.2);
      if (t) {
        const distToLeader = this.position.distanceTo(leader.position);
        if (this.position.distanceTo(t.position) <= this.attackRange) {
          this.engageTarget(t, gameContext, delta, false);
        } else if (distToLeader <= GUARD_LEASH) {
          this.engageTarget(t, gameContext, delta, false);
          return;
        }
      }
    }
    const gap = (this.isVehicle ? 3.2 : 2.2) + (leader.isVehicle ? 3.2 : 2.2);
    const dist = this.position.distanceTo(leader.position);
    if (dist <= gap) {
      this.waypoints = [];
      return;
    }
    this.setPathTo(leader.position.x, leader.position.z, gameContext.pathfinding);
  }

  updateAutonomous(delta, gameContext) {
    if (this.spec.damage <= 0 || this.stance === 'holdfire') return;
    if (this.stance === 'holdground') {
      this.fireIfInRange(gameContext);
      return;
    }

    const sight = this.stance === 'aggressive' ? this.sightRange * 1.6 : this.sightRange;
    const leash = this.stance === 'aggressive' ? AGGRO_LEASH : GUARD_LEASH;
    const t = this.acquireEnemy(gameContext, sight);
    if (t) {
      const dist = this.position.distanceTo(t.position);
      if (dist <= this.attackRange) {
        this.engageTarget(t, gameContext, delta, true);
        return;
      }
      const fromPost = Math.hypot(this.position.x - this.guardX, this.position.z - this.guardZ);
      if (fromPost <= leash) {
        this.targetEntity = t;
        this.engageTarget(t, gameContext, delta, true);
        return;
      }
    }
    this.returnToGuard(gameContext);
  }

  returnToGuard(gameContext) {
    const dist = Math.hypot(this.position.x - this.guardX, this.position.z - this.guardZ);
    if (dist <= 1.2) {
      this.waypoints = [];
      return;
    }
    if (this.waypoints.length === 0) {
      this.setPathTo(this.guardX, this.guardZ, gameContext.pathfinding);
    }
  }

  fireWeapon(target, gameContext) {
    const { projectileManager, soundFX } = gameContext;
    const muzzleWorld = new THREE.Vector3();

    if (this.mesh.userData.muzzlePos) {
      this.mesh.userData.muzzlePos.getWorldPosition(muzzleWorld);
    } else {
      muzzleWorld.copy(this.position).add(new THREE.Vector3(0, 1.2, 0));
    }

    const targetCenter = target.position.clone().add(new THREE.Vector3(0, 1.0, 0));

    // Audio and Projectile based on unit type
    switch (this.type) {
      case 'machine_gunner':
        projectileManager.spawnBullet(muzzleWorld, targetCenter, target, this.damage, this);
        if (soundFX && this.isAudibleToPlayer(gameContext)) soundFX.playMachineGun();
        break;

      case 'grenadier':
        projectileManager.spawnGrenade(muzzleWorld, targetCenter, target, this.damage, this, this.spec.splashRadius);
        if (soundFX && this.isAudibleToPlayer(gameContext)) soundFX.playGrenadeLaunch();
        break;

      case 'rocket_launcher':
        projectileManager.spawnRocket(muzzleWorld, targetCenter, target, this.damage, this);
        if (soundFX && this.isAudibleToPlayer(gameContext)) soundFX.playRocketLaunch();
        break;

      case 'light_tracks':
      case '4x4_gunner':
        projectileManager.spawnBullet(muzzleWorld, targetCenter, target, this.damage, this);
        if (soundFX && this.isAudibleToPlayer(gameContext)) soundFX.playMachineGun();
        break;

      case 'battle_tank':
        projectileManager.spawnTankShell(muzzleWorld, targetCenter, target, this.damage, this);
        if (soundFX && this.isAudibleToPlayer(gameContext)) soundFX.playTankCannon();
        break;

      case 'laser_colossus':
        projectileManager.spawnLaserBeam(
          muzzleWorld,
          targetCenter,
          target,
          this.damage,
          this,
          this.faction === 'player' ? 0x00e5ff : 0xff1744
        );
        if (soundFX && this.isAudibleToPlayer(gameContext)) soundFX.playLaserSound();
        break;

      case 'helicopter':
        projectileManager.spawnBullet(muzzleWorld, targetCenter, target, this.damage, this);
        if (soundFX && this.isAudibleToPlayer(gameContext)) soundFX.playMachineGun();
        break;
    }
  }

  // Harrier Jet special strafing flight run
  updateHarrier(delta, gameContext) {
    const { entityManager, projectileManager, soundFX } = gameContext;

    // Continuous flight forward
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mesh.rotation.y);
    this.position.addScaledVector(forward, this.speed * delta);
    this.mesh.position.copy(this.position);

    // Acquire or re-target
    if (!this.targetEntity || !this.targetEntity.isAlive) {
      this.targetEntity = entityManager.findClosestEnemy(this.position, 60, this.faction);
    }

    if (this.targetEntity) {
      const dirToTarget = this.targetEntity.position.clone().sub(this.position);
      const angle = Math.atan2(dirToTarget.x, dirToTarget.z);
      this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, angle, 4.0 * delta);

      const horizontalDist = Math.hypot(dirToTarget.x, dirToTarget.z);

      // Drop bombs when flying overhead
      if (horizontalDist < 12 && this.cooldownTimer <= 0) {
        projectileManager.spawnAerialBomb(this.position.clone(), this.damage, this);
        this.cooldownTimer = this.attackCooldown;
        if (soundFX && this.isAudibleToPlayer(gameContext)) soundFX.playJetAirstrike();
      }
    } else {
      // Orbit around battlefield
      this.mesh.rotation.y += 0.8 * delta;
    }

    // Keep within map boundaries
    if (this.position.x < 10 || this.position.x > 190 || this.position.z < 10 || this.position.z > 190) {
      this.mesh.rotation.y += Math.PI * 0.5 * delta;
    }
  }

  // Automated Harvester resource gathering loop
  updateHarvester(delta, gameContext) {
    const { terrain, entityManager, economy, soundFX } = gameContext;
    const playerHold = this.order === 'move' || this.order === 'hold';

    switch (this.harvesterState) {
      case 'IDLE':
        if (playerHold) break;
        if (this.cargo >= this.maxCargo) {
          this.returnToRefinery(gameContext);
        } else {
          const ore = terrain.getClosestOreDeposit(this.position.x, this.position.z);
          if (ore) {
            this.targetOreNode = ore;
            this.harvesterState = 'SEEKING_ORE';
            this.order = 'harvest';
            this.setPathTo(ore.x, ore.z, gameContext.pathfinding);
          }
        }
        break;

      case 'SEEKING_ORE':
        if (playerHold) break;
        if (!this.targetOreNode || this.targetOreNode.remaining <= 0) {
          this.harvesterState = 'IDLE';
          break;
        }
        const distToOre = Math.hypot(this.position.x - this.targetOreNode.x, this.position.z - this.targetOreNode.z);
        if (distToOre <= this.targetOreNode.radius + 1.5) {
          this.waypoints = [];
          this.harvesterState = 'MINING';
          this.miningTimer = 0;
        } else if (this.waypoints.length === 0 && gameContext.pathfinding) {
          this.order = 'harvest';
          this.setPathTo(this.targetOreNode.x, this.targetOreNode.z, gameContext.pathfinding);
        }
        break;

      case 'MINING':
        if (!this.targetOreNode || this.targetOreNode.remaining <= 0) {
          this.harvesterState = 'IDLE';
          break;
        }

        this.miningTimer += delta;
        if (this.miningTimer >= 0.8) {
          this.miningTimer = 0;
          const mined = terrain.harvestFromNode(this.targetOreNode, 60);
          this.cargo = Math.min(this.maxCargo, this.cargo + mined);

          if (this.mesh.userData.oreCargo) {
            const fillRatio = this.cargo / this.maxCargo;
            this.mesh.userData.oreCargo.scale.set(0.9, 0.1 + fillRatio * 0.9, 0.9);
          }

          if (this.cargo >= this.maxCargo) {
            this.returnToRefinery(gameContext);
          }
        }
        break;

      case 'RETURNING': {
        if (this.order === 'move') break;
        let refinery = this.targetRefinery;
        if (!refinery || !refinery.isAlive || refinery.isBuilding || refinery.faction !== this.faction) {
          refinery = entityManager.findClosestRefinery(this.position, this.faction);
          this.targetRefinery = refinery;
        }
        if (!refinery) {
          this.harvesterState = 'IDLE';
          break;
        }

        const dockPos = refinery.getDockPosition();
        const distToDock = this.position.distanceTo(dockPos);
        const distToBldg = this.position.distanceTo(refinery.position);
        if (distToDock <= 5.4 || distToBldg <= 6.8) {
          this.waypoints = [];
          this.targetRefinery = refinery;
          this.harvesterState = 'UNLOADING';
          this.miningTimer = 0;
        } else if (this.waypoints.length === 0) {
          this.order = 'harvest';
          this.setPathTo(dockPos.x, dockPos.z, gameContext.pathfinding);
        }
        break;
      }

      case 'UNLOADING':
        if (!this.targetRefinery || !this.targetRefinery.isAlive || this.targetRefinery.isBuilding || this.targetRefinery.faction !== this.faction) {
          this.returnToRefinery(gameContext);
          break;
        }
        this.miningTimer += delta;
        if (this.miningTimer >= 1.2) {
          if (economy) {
            economy.addCredits(this.faction, this.cargo);
          }
          this.cargo = 0;
          if (this.mesh.userData.oreCargo) {
            this.mesh.userData.oreCargo.scale.set(0.9, 0.05, 0.9);
          }
          this.harvesterState = 'IDLE';
          this.order = 'harvest';
          this.targetRefinery = null;
        }
        break;
    }

    const mining = this.harvesterState === 'MINING';
    if (mining !== !!this._miningAudio) {
      this._miningAudio = mining;
      if (soundFX) {
        if (mining && typeof soundFX.startMiningLoop === 'function') soundFX.startMiningLoop();
        else if (!mining && typeof soundFX.stopMiningLoop === 'function') soundFX.stopMiningLoop();
      }
    }
  }

  returnToRefinery(gameContext) {
    if (this.type !== 'harvester') return;
    const refinery = gameContext.entityManager.findClosestRefinery(this.position, this.faction);
    if (refinery && refinery.isAlive && !refinery.isBuilding) {
      this.targetRefinery = refinery;
      this.harvesterState = 'RETURNING';
      this.order = 'harvest';
      this.targetEntity = null;
      this.followTarget = null;
      const dock = refinery.getDockPosition();
      this.setPathTo(dock.x, dock.z, gameContext.pathfinding);
    } else {
      this.harvesterState = 'IDLE';
    }
  }

  takeDamage(amount, attacker) {
    if (!this.isAlive) return;
    this.hp = Math.max(0, this.hp - amount);

    if (this.hp <= 0) {
      this.die(attacker);
    } else {
      this.updateHealthBar();
      if (attacker && attacker.isAlive && this.stance !== 'holdfire' && this.stance !== 'holdground') {
        if (!this.targetEntity && this.canEngage(attacker) && this.order === 'idle') {
          this.targetEntity = attacker;
        }
      }
    }
    if (this.faction === 'player' && typeof window !== 'undefined' && window.gameContext && window.gameContext.entityManager) {
      window.gameContext.entityManager.notePlayerAlert(this.position.x, this.position.z);
    }
  }

  die(attacker) {
    this.isAlive = false;
    if (this._miningAudio) {
      this._miningAudio = false;
      const sfx = typeof window !== 'undefined' && window.gameContext && window.gameContext.soundFX;
      if (sfx && typeof sfx.stopMiningLoop === 'function') sfx.stopMiningLoop();
    }
    if (attacker && attacker.kills !== undefined) {
      attacker.kills++;
      if (typeof attacker.applyVeterancy === 'function') attacker.applyVeterancy();
    }
    if (this.selectionRing) {
      this.selectionRing.visible = false;
    }
    if (this.healthBar) {
      this.healthBar.visible = false;
    }
    if (this.cargoBar) {
      this.cargoBar.visible = false;
    }
  }

  isAudibleToPlayer(gameContext) {
    if (!gameContext.fogOfWar) return true;
    return gameContext.fogOfWar.isVisible(this.position.x, this.position.z);
  }
}
