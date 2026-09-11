// ==========================================================================
// Command & Conquer RTS - Procedural 3D Building Models
// ==========================================================================

class BuildingModels {
  static playerTeam = 'blue';

  static getFactionColors(faction = 'player') {
    const isPlayerBlue = (this.playerTeam || 'blue') === 'blue';
    const isBlue = faction === 'player' ? isPlayerBlue : !isPlayerBlue;

    if (isBlue) {
      return {
        primary: 0x1e88e5,
        secondary: 0x1565c0,
        concrete: 0x4a5b66,
        steel: 0x2b3842
      };
    } else {
      return {
        primary: 0xd32f2f,
        secondary: 0xb71c1c,
        concrete: 0x484242,
        steel: 0x2b2424
      };
    }
  }

  // --- 1. Command Center (HQ / Construction Yard) ---
  static createCommandCenter(faction = 'player') {
    const c = this.getFactionColors(faction);
    const group = new THREE.Group();

    const concreteMat = new THREE.MeshLambertMaterial({ color: c.concrete });
    const armorMat = new THREE.MeshLambertMaterial({ color: c.primary });
    const steelMat = new THREE.MeshLambertMaterial({ color: c.steel });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x33b5e5, transparent: true, opacity: 0.8 });

    // Main Bunker Base
    const baseGeo = new THREE.BoxGeometry(7.0, 1.4, 7.0);
    const base = new THREE.Mesh(baseGeo, concreteMat);
    base.position.set(0, 0.7, 0);
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);

    // Command Tower
    const towerGeo = new THREE.BoxGeometry(4.0, 2.5, 4.0);
    const tower = new THREE.Mesh(towerGeo, armorMat);
    tower.position.set(0, 2.65, 0);
    tower.castShadow = true;
    group.add(tower);

    // Observation Control Deck
    const deckGeo = new THREE.BoxGeometry(4.5, 0.8, 4.5);
    const deck = new THREE.Mesh(deckGeo, glassMat);
    deck.position.set(0, 4.2, 0);
    group.add(deck);

    // Satellite Dish on Roof
    const dishGroup = new THREE.Group();
    dishGroup.position.set(0, 4.8, 0);
    const dishGeo = new THREE.CylinderGeometry(1.2, 0.3, 0.4, 12, 1, true);
    dishGeo.rotateX(0.4);
    const dish = new THREE.Mesh(dishGeo, steelMat);
    const spireGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.6);
    const spire = new THREE.Mesh(spireGeo, steelMat);
    spire.position.set(0, 0.8, 0);
    dishGroup.add(dish, spire);
    group.add(dishGroup);

    // Blast Doors / Entry Ramp
    const doorGeo = new THREE.BoxGeometry(2.4, 1.2, 0.2);
    const door = new THREE.Mesh(doorGeo, steelMat);
    door.position.set(0, 0.7, 3.52);
    group.add(door);

    group.userData = { footprint: { w: 4, h: 4 }, rotatingPart: dishGroup };
    return group;
  }

  // --- 2. Power Supply (Power Plant) ---
  static createPowerPlant(faction = 'player') {
    const c = this.getFactionColors(faction);
    const group = new THREE.Group();

    const concreteMat = new THREE.MeshLambertMaterial({ color: c.concrete });
    const armorMat = new THREE.MeshLambertMaterial({ color: c.primary });
    const steelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x33ff66 });

    // Foundation
    const baseGeo = new THREE.BoxGeometry(5.2, 0.8, 5.2);
    const base = new THREE.Mesh(baseGeo, concreteMat);
    base.position.set(0, 0.4, 0);
    group.add(base);

    // Dual Hyperbolic Cooling Towers
    const towerGeo = new THREE.CylinderGeometry(1.2, 1.7, 3.8, 16);
    const leftTower = new THREE.Mesh(towerGeo, armorMat);
    leftTower.position.set(-1.4, 2.7, 0);
    leftTower.castShadow = true;
    const rightTower = new THREE.Mesh(towerGeo, armorMat);
    rightTower.position.set(1.4, 2.7, 0);
    rightTower.castShadow = true;
    group.add(leftTower, rightTower);

    // Glowing Power Coils / Reactor Core
    const coilGeo = new THREE.TorusGeometry(1.25, 0.12, 8, 16);
    coilGeo.rotateX(Math.PI / 2);
    const coil1 = new THREE.Mesh(coilGeo, glowMat);
    coil1.position.set(-1.4, 3.6, 0);
    const coil2 = new THREE.Mesh(coilGeo, glowMat);
    coil2.position.set(1.4, 3.6, 0);
    group.add(coil1, coil2);

    // Generator Turbines
    const genGeo = new THREE.BoxGeometry(1.4, 1.2, 2.4);
    const gen = new THREE.Mesh(genGeo, steelMat);
    gen.position.set(0, 1.2, 0);
    group.add(gen);

    group.userData = { footprint: { w: 3, h: 3 }, coils: [coil1, coil2] };
    return group;
  }

  // --- 3. Energy Storage (Battery Bank) ---
  static createEnergyStorage(faction = 'player') {
    const c = this.getFactionColors(faction);
    const group = new THREE.Group();

    const baseGeo = new THREE.BoxGeometry(4.0, 0.6, 4.0);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ color: c.concrete }));
    base.position.set(0, 0.3, 0);
    group.add(base);

    // 4 High-Capacity Battery Cells with Charge Level Bars
    const cellGeo = new THREE.CylinderGeometry(0.65, 0.65, 2.6, 12);
    const cellMat = new THREE.MeshLambertMaterial({ color: c.primary });
    const chargeMat = new THREE.MeshBasicMaterial({ color: 0x00e676 });

    const positions = [
      [-1.0, 1.6, -1.0],
      [1.0, 1.6, -1.0],
      [-1.0, 1.6, 1.0],
      [1.0, 1.6, 1.0]
    ];

    positions.forEach(pos => {
      const cell = new THREE.Mesh(cellGeo, cellMat);
      cell.position.set(pos[0], pos[1], pos[2]);
      cell.castShadow = true;
      group.add(cell);

      // Charge strip
      const stripGeo = new THREE.BoxGeometry(0.1, 1.8, 0.3);
      const strip = new THREE.Mesh(stripGeo, chargeMat);
      strip.position.set(pos[0], pos[1], pos[2] + 0.6);
      group.add(strip);
    });

    group.userData = { footprint: { w: 2, h: 2 } };
    return group;
  }

  // --- 4. Ore Refinery (Processing Facility) ---
  static createOreRefinery(faction = 'player') {
    const c = this.getFactionColors(faction);
    const group = new THREE.Group();

    const concreteMat = new THREE.MeshLambertMaterial({ color: c.concrete });
    const armorMat = new THREE.MeshLambertMaterial({ color: c.primary });
    const steelMat = new THREE.MeshLambertMaterial({ color: 0x272b2e });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffcc00,
      emissive: 0xaa7700,
      emissiveIntensity: 0.5
    });

    // Base Pad
    const baseGeo = new THREE.BoxGeometry(7.5, 0.6, 7.5);
    const base = new THREE.Mesh(baseGeo, concreteMat);
    base.position.set(0, 0.3, 0);
    group.add(base);

    // Main Smelter Silo
    const siloGeo = new THREE.CylinderGeometry(2.0, 2.2, 4.2, 16);
    const silo = new THREE.Mesh(siloGeo, armorMat);
    silo.position.set(-1.4, 2.7, -1.2);
    silo.castShadow = true;
    group.add(silo);

    // Smokestacks
    const stackGeo = new THREE.CylinderGeometry(0.35, 0.45, 5.4, 8);
    const stack1 = new THREE.Mesh(stackGeo, steelMat);
    stack1.position.set(-2.4, 3.3, 1.4);
    const stack2 = new THREE.Mesh(stackGeo, steelMat);
    stack2.position.set(-1.2, 3.3, 1.8);
    group.add(stack1, stack2);

    // Harvester Unloading Ramp / Dock Bay (Right side)
    const rampGeo = new THREE.BoxGeometry(3.2, 0.4, 4.5);
    rampGeo.rotateX(0.08);
    const ramp = new THREE.Mesh(rampGeo, steelMat);
    ramp.position.set(2.0, 0.35, 0.2);
    group.add(ramp);

    // Ore Hopper Intake Funnel
    const hopperGeo = new THREE.CylinderGeometry(1.6, 0.6, 1.8, 8);
    const hopper = new THREE.Mesh(hopperGeo, goldMat);
    hopper.position.set(2.0, 1.6, -1.8);
    group.add(hopper);

    group.userData = {
      footprint: { w: 4, h: 4 },
      dockPos: new THREE.Vector3(2.0, 0, 0.2), // Unload point for harvesters
      stacks: [stack1, stack2]
    };
    return group;
  }

  // --- 5. Barracks (Infantry Training) ---
  static createBarracks(faction = 'player') {
    const c = this.getFactionColors(faction);
    const group = new THREE.Group();

    const baseGeo = new THREE.BoxGeometry(5.4, 0.5, 5.4);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ color: c.concrete }));
    base.position.set(0, 0.25, 0);
    group.add(base);

    // Quonset Hut Arched Hangar
    const archGeo = new THREE.CylinderGeometry(2.2, 2.2, 4.4, 16, 1, false, 0, Math.PI);
    archGeo.rotateZ(Math.PI / 2);
    const archMat = new THREE.MeshLambertMaterial({ color: c.primary });
    const arch = new THREE.Mesh(archGeo, archMat);
    arch.position.set(0, 0.5, 0);
    arch.castShadow = true;
    group.add(arch);

    // Front Double Blast Doors
    const doorGeo = new THREE.BoxGeometry(1.8, 1.8, 0.2);
    const door = new THREE.Mesh(doorGeo, new THREE.MeshLambertMaterial({ color: 0x1f2427 }));
    door.position.set(0, 1.0, 2.22);
    group.add(door);

    // Sandbag Fortification in front
    const sandbagGeo = new THREE.BoxGeometry(3.6, 0.6, 0.5);
    const sandbags = new THREE.Mesh(sandbagGeo, new THREE.MeshLambertMaterial({ color: 0x9e875e }));
    sandbags.position.set(0, 0.5, 3.2);
    group.add(sandbags);

    // Troop Rally Flag
    const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 3.8);
    const pole = new THREE.Mesh(poleGeo, new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    pole.position.set(-2.0, 1.9, 2.0);
    
    const flagGeo = new THREE.PlaneGeometry(0.8, 0.5);
    const flagMat = new THREE.MeshBasicMaterial({ color: c.primary, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(-1.6, 3.3, 2.0);
    group.add(pole, flag);

    group.userData = {
      footprint: { w: 3, h: 3 },
      spawnOffset: new THREE.Vector3(0, 0, 3.8)
    };
    return group;
  }

  // --- 6. Heavy Vehicle Factory (War Factory) ---
  static createWarFactory(faction = 'player') {
    const c = this.getFactionColors(faction);
    const group = new THREE.Group();

    const baseGeo = new THREE.BoxGeometry(8.0, 0.6, 8.0);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ color: c.concrete }));
    base.position.set(0, 0.3, 0);
    group.add(base);

    // Massive Industrial Assembly Hall
    const hallGeo = new THREE.BoxGeometry(7.0, 3.4, 7.0);
    const hallMat = new THREE.MeshLambertMaterial({ color: c.primary });
    const hall = new THREE.Mesh(hallGeo, hallMat);
    hall.position.set(0, 2.3, 0);
    hall.castShadow = true;
    group.add(hall);

    // Large Rolling Garage Bay Doors
    const doorGeo = new THREE.BoxGeometry(3.8, 2.4, 0.2);
    const door = new THREE.Mesh(doorGeo, new THREE.MeshLambertMaterial({ color: 0x22262a }));
    door.position.set(0, 1.5, 3.52);
    group.add(door);

    // Industrial Overhead Gantry Crane / Truss
    const trussGeo = new THREE.BoxGeometry(6.6, 0.4, 0.4);
    const truss = new THREE.Mesh(trussGeo, new THREE.MeshLambertMaterial({ color: 0xffaa00 }));
    truss.position.set(0, 4.2, 0);
    group.add(truss);

    // Ventilation Exhaust Fans
    const ventGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.6, 10);
    const vent = new THREE.Mesh(ventGeo, new THREE.MeshLambertMaterial({ color: 0x333b40 }));
    vent.position.set(-2.0, 4.3, -1.8);
    group.add(vent);

    group.userData = {
      footprint: { w: 4, h: 4 },
      spawnOffset: new THREE.Vector3(0, 0, 4.5),
      door: door
    };
    return group;
  }

  // --- 7. Radar Facility ---
  static createRadarFacility(faction = 'player') {
    const c = this.getFactionColors(faction);
    const group = new THREE.Group();

    const baseGeo = new THREE.BoxGeometry(4.8, 0.6, 4.8);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ color: c.concrete }));
    base.position.set(0, 0.3, 0);
    group.add(base);

    // Geodesic Dome Bunker
    const domeGeo = new THREE.SphereGeometry(1.8, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const dome = new THREE.Mesh(domeGeo, new THREE.MeshLambertMaterial({ color: c.primary }));
    dome.position.set(0, 0.6, 0);
    dome.castShadow = true;
    group.add(dome);

    // Rotating Radar Mast & Dish
    const mastGeo = new THREE.CylinderGeometry(0.12, 0.16, 2.8);
    const mast = new THREE.Mesh(mastGeo, new THREE.MeshLambertMaterial({ color: 0x2b3842 }));
    mast.position.set(0, 2.6, 0);
    group.add(mast);

    const radarGroup = new THREE.Group();
    radarGroup.position.set(0, 4.0, 0);

    // Curved parabolic radar dish
    const dishGeo = new THREE.CylinderGeometry(1.8, 0.4, 0.5, 12, 1, true);
    dishGeo.rotateX(0.3);
    const dish = new THREE.Mesh(dishGeo, new THREE.MeshLambertMaterial({ color: 0xd9e5ec }));
    const feedHornGeo = new THREE.ConeGeometry(0.2, 0.9, 6);
    feedHornGeo.rotateX(Math.PI / 2);
    const feedHorn = new THREE.Mesh(feedHornGeo, new THREE.MeshLambertMaterial({ color: 0xd9e5ec }));
    feedHorn.position.set(0, 0, 0.8);
    radarGroup.add(dish, feedHorn);
    group.add(radarGroup);

    group.userData = {
      footprint: { w: 3, h: 3 },
      rotatingPart: radarGroup
    };
    return group;
  }

  // --- 8. Machine Gun Turret (Pillbox Defense) ---
  static createGunTurret(faction = 'player') {
    const c = this.getFactionColors(faction);
    const group = new THREE.Group();

    // Reinforced Concrete Base
    const baseGeo = new THREE.CylinderGeometry(1.4, 1.7, 1.2, 12);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ color: c.concrete }));
    base.position.set(0, 0.6, 0);
    base.castShadow = true;
    group.add(base);

    // Rotating Twin-Barrel Turret
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.3, 0);

    const capGeo = new THREE.SphereGeometry(0.9, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, new THREE.MeshLambertMaterial({ color: c.primary }));
    turretGroup.add(cap);

    const barrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.4);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel1 = new THREE.Mesh(barrelGeo, new THREE.MeshLambertMaterial({ color: 0x111111 }));
    barrel1.position.set(-0.25, 0.35, 0.8);
    const barrel2 = new THREE.Mesh(barrelGeo, new THREE.MeshLambertMaterial({ color: 0x111111 }));
    barrel2.position.set(0.25, 0.35, 0.8);

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.35, 1.5);

    turretGroup.add(barrel1, barrel2, muzzle);
    group.add(turretGroup);

    group.userData = {
      footprint: { w: 2, h: 2 },
      turret: turretGroup,
      muzzlePos: muzzle,
      type: 'turret_gun'
    };
    return group;
  }

  // --- 9. Heavy Rocket Turret (Anti-Armor / Anti-Air SAM) ---
  static createRocketTurret(faction = 'player') {
    const c = this.getFactionColors(faction);
    const group = new THREE.Group();

    // Silo Base
    const baseGeo = new THREE.CylinderGeometry(1.6, 2.0, 1.4, 12);
    const base = new THREE.Mesh(baseGeo, new THREE.MeshLambertMaterial({ color: c.concrete }));
    base.position.set(0, 0.7, 0);
    base.castShadow = true;
    group.add(base);

    // Swivel Launcher Rack
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.5, 0);

    const rackBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.8, 1.8),
      new THREE.MeshLambertMaterial({ color: c.primary })
    );
    turretGroup.add(rackBox);

    // Quad Rocket Launch Tubes
    const tubeGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.6, 8);
    tubeGeo.rotateX(Math.PI / 2);
    const tubeMat = new THREE.MeshLambertMaterial({ color: 0x22262a });

    const offsets = [
      [-0.45, 0.15],
      [0.45, 0.15],
      [-0.45, -0.15],
      [0.45, -0.15]
    ];
    offsets.forEach(off => {
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      tube.position.set(off[0], off[1], 0.6);
      turretGroup.add(tube);
    });

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, 1.5);
    turretGroup.add(muzzle);

    group.add(turretGroup);

    group.userData = {
      footprint: { w: 2, h: 2 },
      turret: turretGroup,
      muzzlePos: muzzle,
      type: 'turret_rocket'
    };
    return group;
  }

  // --- 10. Perimeter Wall / Fence Segment ---
  static createWallSegment(faction = 'player') {
    const c = this.getFactionColors(faction);
    const group = new THREE.Group();

    // Concrete Security Barrier
    const wallGeo = new THREE.BoxGeometry(2.0, 1.2, 0.8);
    const wall = new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({ color: c.concrete }));
    wall.position.set(0, 0.6, 0);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    // Steel Top Rail / Barbed Top
    const railGeo = new THREE.BoxGeometry(2.0, 0.2, 0.2);
    const rail = new THREE.Mesh(railGeo, new THREE.MeshLambertMaterial({ color: 0x1a242c }));
    rail.position.set(0, 1.3, 0);
    group.add(rail);

    group.userData = {
      footprint: { w: 1, h: 1 },
      type: 'wall'
    };
    return group;
  }

  // --- 11. Prism Laser Obelisk (Advanced Laser Defense) ---
  static createLaserTurret(faction = 'player') {
    const c = this.getFactionColors(faction);
    const group = new THREE.Group();

    const concreteMat = new THREE.MeshLambertMaterial({ color: c.concrete });
    const steelMat = new THREE.MeshLambertMaterial({ color: 0x1a2128 });
    const crystalMat = new THREE.MeshStandardMaterial({
      color: faction === 'player' ? 0x00e5ff : 0xff1744,
      emissive: faction === 'player' ? 0x00b0ff : 0xd50000,
      emissiveIntensity: 0.95,
      roughness: 0.1,
      metalness: 0.9
    });

    // Heavy Hexagonal Base
    const baseGeo = new THREE.CylinderGeometry(1.8, 2.2, 1.4, 6);
    const base = new THREE.Mesh(baseGeo, concreteMat);
    base.position.set(0, 0.7, 0);
    base.castShadow = true;
    group.add(base);

    // Rotating Obelisk Spire Turret
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.4, 0);

    const spireGeo = new THREE.CylinderGeometry(0.5, 1.4, 4.2, 4);
    const spire = new THREE.Mesh(spireGeo, steelMat);
    spire.position.set(0, 2.1, 0);
    turretGroup.add(spire);

    // Energy Conduit Rings
    for (let i = 1; i <= 3; i++) {
      const ringGeo = new THREE.TorusGeometry(1.2 - i * 0.25, 0.08, 6, 16);
      ringGeo.rotateX(Math.PI / 2);
      const ring = new THREE.Mesh(ringGeo, crystalMat);
      ring.position.set(0, i * 1.0, 0);
      turretGroup.add(ring);
    }

    // Apex Laser Prism Crystal
    const crystalGeo = new THREE.OctahedronGeometry(0.65);
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.set(0, 4.6, 0);
    turretGroup.add(crystal);

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 4.6, 0.8);
    turretGroup.add(muzzle);

    group.add(turretGroup);

    group.userData = {
      footprint: { w: 2, h: 2 },
      turret: turretGroup,
      crystal: crystal,
      muzzlePos: muzzle,
      type: 'turret_laser'
    };
    return group;
  }
}
