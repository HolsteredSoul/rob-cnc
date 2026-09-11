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
    antiAir: true
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
    isAir: true
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
    isAir: true
  }
};

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
    this.isAlive = true;
    this.cooldownTimer = 0;
    this.kills = 0;

    // Stance: 'aggressive', 'guard', 'hold'
    this.stance = 'aggressive';

    // Harvester specific state
    this.cargo = 0;
    this.maxCargo = this.spec.cargoCapacity || 500;
    this.harvesterState = 'IDLE'; // 'SEEKING_ORE', 'MINING', 'RETURNING', 'UNLOADING'
    this.targetOreNode = null;
    this.miningTimer = 0;

    // Create procedural 3D model
    this.mesh = this.createMesh(type, faction);
    this.mesh.position.copy(this.position);
    scene.add(this.mesh);

    // Dynamic selection circle under unit
    this.selectionRing = this.createSelectionRing();
    this.mesh.add(this.selectionRing);
    this.selectionRing.visible = false;
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
    if (this.selectionRing) {
      this.selectionRing.visible = selected;
    }
  }

  // Issue move command with pathfinder waypoints
  moveTo(destX, destZ, pathfinding) {
    this.targetEntity = null;
    if (this.type === 'harvester' && this.harvesterState === 'MINING') {
      this.harvesterState = 'IDLE';
    }

    if (this.isAir) {
      // Aircraft fly in direct line
      this.waypoints = [{ x: destX, z: destZ }];
    } else if (pathfinding) {
      this.waypoints = pathfinding.findPath(this.position.x, this.position.z, destX, destZ);
      if (!this.waypoints || this.waypoints.length === 0) {
        this.waypoints = [{ x: destX, z: destZ }];
      } else {
        this.waypoints.shift(); // Remove starting tile
      }
    } else {
      this.waypoints = [{ x: destX, z: destZ }];
    }
  }

  // Issue attack order against specific entity
  attackTarget(entity, pathfinding) {
    this.targetEntity = entity;
    if (this.type === 'harvester') return; // Harvester does not attack

    const dist = this.position.distanceTo(entity.position);
    if (dist > this.attackRange && pathfinding) {
      this.moveTo(entity.position.x, entity.position.z, pathfinding);
    }
  }

  // Issue harvest order
  harvestOre(oreNode, pathfinding) {
    if (this.type !== 'harvester') return;
    this.targetOreNode = oreNode;
    this.harvesterState = 'SEEKING_ORE';
    this.moveTo(oreNode.x, oreNode.z, pathfinding);
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
      this.updateMovement(delta);
      return;
    }

    // Aircraft circling / flyby logic for Harrier
    if (this.type === 'harrier_jet') {
      this.updateHarrier(delta, gameContext);
      return;
    }

    // Combat & Movement logic
    this.updateCombat(delta, gameContext);
    this.updateMovement(delta);
  }

  updateAnimations(delta) {
    // Helicopter spinning rotors
    if (this.mesh.userData.mainRotor) {
      this.mesh.userData.mainRotor.rotation.y += 28 * delta;
    }
    if (this.mesh.userData.tailRotor) {
      this.mesh.userData.tailRotor.rotation.x += 34 * delta;
    }

    // Harvester drill spinning when mining
    if (this.mesh.userData.drill && this.harvesterState === 'MINING') {
      this.mesh.userData.drill.rotation.x += 18 * delta;
    }
  }

  updateMovement(delta) {
    if (this.waypoints.length === 0) return;

    const nextWp = this.waypoints[0];
    const wpX = nextWp.x !== undefined ? nextWp.x : nextWp.wx;
    const wpZ = nextWp.z !== undefined ? nextWp.z : nextWp.wz;
    const targetVec = new THREE.Vector3(wpX, this.position.y, wpZ);
    const dir = targetVec.clone().sub(this.position);
    dir.y = 0; // Move along horizontal plane; Y is calculated from terrain elevation
    const dist = dir.length();

    if (dist < 0.8) {
      this.waypoints.shift();
      if (this.waypoints.length === 0) return;
    }

    dir.normalize();

    // Smooth rotation towards travel direction
    const targetAngle = Math.atan2(dir.x, dir.z);
    this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, targetAngle, 12 * delta);

    // Move forward
    const moveStep = Math.min(dist, this.speed * delta);
    this.position.x += dir.x * moveStep;
    this.position.z += dir.z * moveStep;
    this.mesh.position.x = this.position.x;
    this.mesh.position.z = this.position.z;
  }

  updateCombat(delta, gameContext) {
    const { entityManager, projectileManager, soundFX } = gameContext;

    // Auto-acquire target if idle or in aggressive stance
    if (!this.targetEntity || !this.targetEntity.isAlive) {
      this.targetEntity = null;
      if (this.stance !== 'hold') {
        this.targetEntity = entityManager.findClosestEnemy(this.position, this.attackRange * 1.1, this.faction);
      }
    }

    if (!this.targetEntity) return;

    const dist = this.position.distanceTo(this.targetEntity.position);

    // If within range, engage!
    if (dist <= this.attackRange) {
      // Stop moving while actively shooting (unless helicopter)
      if (!this.isAir) {
        this.waypoints = [];
      }

      // Rotate turret or body towards target
      const lookDir = this.targetEntity.position.clone().sub(this.position);
      const angle = Math.atan2(lookDir.x, lookDir.z);

      if (this.mesh.userData.turret) {
        // Rotate turret independently
        this.mesh.userData.turret.rotation.y = angle - this.mesh.rotation.y;
      } else {
        this.mesh.rotation.y = THREE.MathUtils.lerp(this.mesh.rotation.y, angle, 14 * delta);
      }

      // Fire weapon
      if (this.cooldownTimer <= 0) {
        this.fireWeapon(this.targetEntity, gameContext);
        this.cooldownTimer = this.attackCooldown;
      }
    } else if (this.stance === 'aggressive' && this.waypoints.length === 0) {
      // Chase enemy if aggressive
      this.moveTo(this.targetEntity.position.x, this.targetEntity.position.z, gameContext.pathfinding);
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

    switch (this.harvesterState) {
      case 'IDLE':
        // Auto-find closest ore deposit
        if (this.cargo < this.maxCargo) {
          const ore = terrain.getClosestOreDeposit(this.position.x, this.position.z);
          if (ore) {
            this.targetOreNode = ore;
            this.harvesterState = 'SEEKING_ORE';
            this.moveTo(ore.x, ore.z, gameContext.pathfinding);
          }
        } else {
          this.returnToRefinery(gameContext);
        }
        break;

      case 'SEEKING_ORE':
        if (!this.targetOreNode || this.targetOreNode.remaining <= 0) {
          this.harvesterState = 'IDLE';
          return;
        }
        const distToOre = Math.hypot(this.position.x - this.targetOreNode.x, this.position.z - this.targetOreNode.z);
        if (distToOre <= this.targetOreNode.radius + 1.5) {
          this.waypoints = [];
          this.harvesterState = 'MINING';
          this.miningTimer = 0;
        }
        break;

      case 'MINING':
        if (!this.targetOreNode || this.targetOreNode.remaining <= 0) {
          this.harvesterState = 'IDLE';
          return;
        }

        this.miningTimer += delta;
        if (this.miningTimer >= 0.8) {
          this.miningTimer = 0;
          const mined = terrain.harvestFromNode(this.targetOreNode, 60);
          this.cargo = Math.min(this.maxCargo, this.cargo + mined);

          // Update glowing cargo visual in dump hopper
          if (this.mesh.userData.oreCargo) {
            const fillRatio = this.cargo / this.maxCargo;
            this.mesh.userData.oreCargo.scale.set(0.9, 0.1 + fillRatio * 0.9, 0.9);
          }

          if (soundFX && this.isAudibleToPlayer(gameContext)) {
            soundFX.playMiningSound();
          }

          if (this.cargo >= this.maxCargo) {
            this.returnToRefinery(gameContext);
          }
        }
        break;

      case 'RETURNING': {
        const refinery = entityManager.findClosestRefinery(this.position, this.faction);
        if (!refinery || !refinery.isAlive) {
          this.harvesterState = 'IDLE';
          return;
        }

        const dockPos = refinery.getDockPosition();
        const distToDock = this.position.distanceTo(dockPos);

        if (distToDock <= 3.6) {
          this.waypoints = [];
          this.harvesterState = 'UNLOADING';
          this.miningTimer = 0;
        } else if (this.waypoints.length === 0) {
          this.moveTo(dockPos.x, dockPos.z, gameContext.pathfinding);
        }
        break;
      }

      case 'UNLOADING':
        this.miningTimer += delta;
        if (this.miningTimer >= 1.2) {
          // Deliver credits
          if (economy) {
            economy.addCredits(this.faction, this.cargo);
          }
          this.cargo = 0;
          if (this.mesh.userData.oreCargo) {
            this.mesh.userData.oreCargo.scale.set(0.9, 0.05, 0.9);
          }
          this.harvesterState = 'IDLE';
        }
        break;
    }
  }

  returnToRefinery(gameContext) {
    const refinery = gameContext.entityManager.findClosestRefinery(this.position, this.faction);
    if (refinery && refinery.isAlive) {
      this.harvesterState = 'RETURNING';
      const dock = refinery.getDockPosition();
      this.moveTo(dock.x, dock.z, gameContext.pathfinding);
    } else {
      this.harvesterState = 'IDLE';
    }
  }

  takeDamage(amount, attacker) {
    if (!this.isAlive) return;
    this.hp = Math.max(0, this.hp - amount);

    if (this.hp <= 0) {
      this.die(attacker);
    } else if (!this.targetEntity && attacker && attacker.isAlive && this.stance !== 'hold') {
      // Retaliate
      this.targetEntity = attacker;
    }
  }

  die(attacker) {
    this.isAlive = false;
    if (attacker && attacker.kills !== undefined) {
      attacker.kills++;
    }
    if (this.selectionRing) {
      this.selectionRing.visible = false;
    }
  }

  isAudibleToPlayer(gameContext) {
    if (!gameContext.fogOfWar) return true;
    return gameContext.fogOfWar.isVisible(this.position.x, this.position.z);
  }
}
