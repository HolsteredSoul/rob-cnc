// ==========================================================================
// Command & Conquer RTS - Procedural 3D Unit Models
// ==========================================================================

class UnitModels {
  static playerTeam = 'blue';

  static getFactionColors(faction = 'player') {
    const isPlayerBlue = (this.playerTeam || 'blue') === 'blue';
    const isBlue = faction === 'player' ? isPlayerBlue : !isPlayerBlue;

    if (isBlue) {
      return {
        primary: 0x1e88e5,    // Military Blue
        secondary: 0x1565c0,  // Dark Blue
        trim: 0x90caf9,       // Light Blue
        accent: 0xffb300      // Gold trim
      };
    } else {
      return {
        primary: 0xd32f2f,    // Combat Red
        secondary: 0xb71c1c,  // Dark Crimson
        trim: 0xef5350,       // Light Red
        accent: 0x424242      // Charcoal Dark
      };
    }
  }

  static addRoadWheels(group, xs, y, zs, radius, width, mat) {
    const wheels = group.userData.wheels || [];
    const geo = new THREE.CylinderGeometry(radius, radius, width, 8);
    geo.rotateZ(Math.PI / 2);
    xs.forEach((x) => {
      zs.forEach((z) => {
        const wheel = new THREE.Mesh(geo, mat);
        wheel.position.set(x, y, z);
        group.add(wheel);
        wheels.push(wheel);
      });
    });
    group.userData.wheels = wheels;
    return wheels;
  }

  static addDeckVents(group, width, y, z, material) {
    const vents = [];
    for (let i = 0; i < 4; i++) vents.push([width, .035, .055, 0, y, z + i * .12]);
    group.add(new THREE.Mesh(ModelGeometry.boxes(vents), material));
  }

  static addTrackCleats(group, x, width, height, length, material) {
    const cleats = [];
    for (let i = 0; i < 7; i++) {
      const z = (i / 6 - .5) * (length - .6);
      cleats.push([width, .025, .07, -x, height + .012, z], [width, .025, .07, x, height + .012, z]);
    }
    group.add(new THREE.Mesh(ModelGeometry.boxes(cleats), material));
  }

  // --- 1. Machine Gunner (Infantry) ---
  static createMachineGunner(faction = 'player') {
    const colors = this.getFactionColors(faction);
    const group = new THREE.Group();

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd2a679 });
    const uniformMat = new THREE.MeshLambertMaterial({ color: 0x475545 }); // Olive camo
    const armorMat = new THREE.MeshLambertMaterial({ color: 0x303a38 });
    const trimMat = new THREE.MeshLambertMaterial({ color: colors.primary });
    const gunMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a }); // Dark steel
    const bootMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

    // Legs & Boots
    const legGeo = new THREE.BoxGeometry(0.24, 0.6, 0.24);
    const leftLeg = new THREE.Mesh(legGeo, uniformMat);
    leftLeg.position.set(-0.16, 0.3, 0);
    const rightLeg = new THREE.Mesh(legGeo, uniformMat);
    rightLeg.position.set(0.16, 0.3, 0);
    group.add(leftLeg, rightLeg);

    const bootGeo = new THREE.BoxGeometry(0.26, 0.2, 0.34);
    const leftBoot = new THREE.Mesh(bootGeo, bootMat);
    leftBoot.position.set(-0.16, 0.1, 0.05);
    const rightBoot = new THREE.Mesh(bootGeo, bootMat);
    rightBoot.position.set(0.16, 0.1, 0.05);
    group.add(leftBoot, rightBoot);

    // Torso with tactical vest
    const torsoGeo = new THREE.BoxGeometry(0.55, 0.65, 0.35);
    const torso = new THREE.Mesh(torsoGeo, armorMat);
    torso.position.set(0, 0.85, 0);
    group.add(torso);

    // A high-contrast chest stripe and shoulder tabs survive the top-down
    // camera much better than colouring the whole soldier like a toy piece.
    const chestStrip = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.035), trimMat);
    chestStrip.position.set(0, 0.94, 0.193);
    const shoulderGeo = new THREE.BoxGeometry(0.14, 0.18, 0.38);
    const leftShoulder = new THREE.Mesh(shoulderGeo, trimMat);
    const rightShoulder = new THREE.Mesh(shoulderGeo, trimMat);
    leftShoulder.position.set(-0.33, 1.05, 0);
    rightShoulder.position.set(0.33, 1.05, 0);
    group.add(chestStrip, leftShoulder, rightShoulder);

    // Head with combat helmet
    const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 1.3, 0);
    group.add(head);

    const helmetGeo = new THREE.BoxGeometry(0.38, 0.2, 0.38);
    const helmet = new THREE.Mesh(helmetGeo, armorMat);
    helmet.position.set(0, 1.45, 0);
    group.add(helmet);
    const helmetBand = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.405), trimMat);
    helmetBand.position.set(0, 1.43, 0);
    group.add(helmetBand);

    // Assault Rifle
    const gunGroup = new THREE.Group();
    const receiverGeo = new THREE.BoxGeometry(0.12, 0.14, 0.45);
    const receiver = new THREE.Mesh(receiverGeo, gunMat);
    const barrelGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, gunMat);
    barrel.position.set(0, 0.02, 0.35);
    
    // Muzzle Flash anchor
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.02, 0.6);
    gunGroup.add(receiver, barrel, muzzle);
    gunGroup.position.set(0.24, 0.85, 0.2);
    group.add(gunGroup);

    group.scale.set(1.3, 1.3, 1.3);
    group.userData = { muzzlePos: muzzle, gunGroup: gunGroup, type: 'machine_gunner', leftLeg, rightLeg };
    return group;
  }

  // --- 2. Grenadier (Infantry) ---
  static createGrenadier(faction = 'player') {
    const colors = this.getFactionColors(faction);
    const group = new THREE.Group();

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd2a679 });
    const uniformMat = new THREE.MeshLambertMaterial({ color: 0x3d433b });
    const armorMat = new THREE.MeshLambertMaterial({ color: 0x343b38 });
    const trimMat = new THREE.MeshLambertMaterial({ color: colors.primary });
    const darkSteel = new THREE.MeshLambertMaterial({ color: 0x242424 });
    const ammoMat = new THREE.MeshLambertMaterial({ color: 0xff9900 }); // Orange grenade caps

    // Legs
    const legGeo = new THREE.BoxGeometry(0.26, 0.6, 0.26);
    const leftLeg = new THREE.Mesh(legGeo, uniformMat);
    leftLeg.position.set(-0.18, 0.3, 0);
    const rightLeg = new THREE.Mesh(legGeo, uniformMat);
    rightLeg.position.set(0.18, 0.3, 0);
    group.add(leftLeg, rightLeg);

    // Heavy Torso + Backpack Satchel
    const torsoGeo = new THREE.BoxGeometry(0.65, 0.7, 0.42);
    const torso = new THREE.Mesh(torsoGeo, armorMat);
    torso.position.set(0, 0.88, 0);
    group.add(torso);

    const chestStrip = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.13, 0.04), trimMat);
    chestStrip.position.set(0, 0.98, 0.235);
    const shoulderGeo = new THREE.BoxGeometry(0.15, 0.19, 0.45);
    const leftShoulder = new THREE.Mesh(shoulderGeo, trimMat);
    const rightShoulder = new THREE.Mesh(shoulderGeo, trimMat);
    leftShoulder.position.set(-0.38, 1.1, 0);
    rightShoulder.position.set(0.38, 1.1, 0);
    group.add(chestStrip, leftShoulder, rightShoulder);

    const packGeo = new THREE.BoxGeometry(0.5, 0.5, 0.3);
    const pack = new THREE.Mesh(packGeo, darkSteel);
    pack.position.set(0, 0.9, -0.32);
    group.add(pack);

    // Grenade Bandolier across chest
    const bandoGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.18);
    for (let i = -1; i <= 1; i++) {
      const g = new THREE.Mesh(bandoGeo, ammoMat);
      g.position.set(i * 0.16, 0.88, 0.23);
      group.add(g);
    }

    // Head + Visor
    const headGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    const head = new THREE.Mesh(headGeo, skinMat);
    head.position.set(0, 1.34, 0);
    const helmetGeo = new THREE.BoxGeometry(0.42, 0.22, 0.42);
    const helmet = new THREE.Mesh(helmetGeo, armorMat);
    helmet.position.set(0, 1.48, 0);
    group.add(head, helmet);
    const helmetBand = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.06, 0.445), trimMat);
    helmetBand.position.set(0, 1.46, 0);
    group.add(helmetBand);

    // Grenade Launcher Drum Gun
    const gunGroup = new THREE.Group();
    const drumGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.22, 8);
    drumGeo.rotateZ(Math.PI / 2);
    const drum = new THREE.Mesh(drumGeo, darkSteel);
    const barrelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.45);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, darkSteel);
    barrel.position.set(0, 0.04, 0.25);
    
    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.04, 0.5);
    gunGroup.add(drum, barrel, muzzle);
    gunGroup.position.set(0.22, 0.85, 0.25);
    group.add(gunGroup);

    group.scale.set(1.3, 1.3, 1.3);
    group.userData = { muzzlePos: muzzle, gunGroup: gunGroup, type: 'grenadier', leftLeg, rightLeg };
    return group;
  }

  // --- 3. Rocket Launcher (Infantry) ---
  static createRocketLauncher(faction = 'player') {
    const colors = this.getFactionColors(faction);
    const group = new THREE.Group();

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd2a679 });
    const uniformMat = new THREE.MeshLambertMaterial({ color: 0x384037 });
    const armorMat = new THREE.MeshLambertMaterial({ color: 0x303936 });
    const trimMat = new THREE.MeshLambertMaterial({ color: colors.primary });
    const launcherMat = new THREE.MeshLambertMaterial({ color: 0x323a33 });
    const tipMat = new THREE.MeshLambertMaterial({ color: 0xdd2222 });

    // Legs
    const legGeo = new THREE.BoxGeometry(0.26, 0.6, 0.26);
    const leftLeg = new THREE.Mesh(legGeo, uniformMat);
    leftLeg.position.set(-0.18, 0.3, 0);
    const rightLeg = new THREE.Mesh(legGeo, uniformMat);
    rightLeg.position.set(0.18, 0.3, 0);
    group.add(leftLeg, rightLeg);

    // Torso & Head
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.68, 0.38), armorMat);
    torso.position.set(0, 0.88, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skinMat);
    head.position.set(0, 1.32, 0);
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.4), armorMat);
    helmet.position.set(0, 1.45, 0);
    group.add(torso, head, helmet);

    const chestStrip = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.13, 0.04), trimMat);
    chestStrip.position.set(0, 0.98, 0.215);
    const shoulderGeo = new THREE.BoxGeometry(0.15, 0.18, 0.42);
    const leftShoulder = new THREE.Mesh(shoulderGeo, trimMat);
    const rightShoulder = new THREE.Mesh(shoulderGeo, trimMat);
    leftShoulder.position.set(-0.35, 1.08, 0);
    rightShoulder.position.set(0.35, 1.08, 0);
    const helmetBand = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.425), trimMat);
    helmetBand.position.set(0, 1.43, 0);
    group.add(chestStrip, leftShoulder, rightShoulder, helmetBand);

    // Shoulder-mounted Bazooka/Rocket Tube
    const launcherGroup = new THREE.Group();
    const tubeGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2, 10);
    tubeGeo.rotateX(Math.PI / 2);
    const tube = new THREE.Mesh(tubeGeo, launcherMat);
    
    // Rocket tip ready in tube
    const rocketCone = new THREE.ConeGeometry(0.11, 0.3, 8);
    rocketCone.rotateX(Math.PI / 2);
    const tip = new THREE.Mesh(rocketCone, tipMat);
    tip.position.set(0, 0, 0.7);

    // Aiming Sight
    const sightGeo = new THREE.BoxGeometry(0.08, 0.12, 0.15);
    const sight = new THREE.Mesh(sightGeo, new THREE.MeshLambertMaterial({ color: 0x111111 }));
    sight.position.set(-0.12, 0.1, 0.1);

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0, 0.85);

    launcherGroup.add(tube, tip, sight, muzzle);
    launcherGroup.position.set(0.32, 1.25, 0.1);
    group.add(launcherGroup);

    group.scale.set(1.3, 1.3, 1.3);
    group.userData = { muzzlePos: muzzle, gunGroup: launcherGroup, type: 'rocket_launcher', leftLeg, rightLeg };
    return group;
  }

  // --- 4. Light Tracks (Ground Vehicle) ---
  static createLightTracks(faction = 'player') {
    const colors = this.getFactionColors(faction);
    const group = new THREE.Group();

    const hullMat = new THREE.MeshLambertMaterial({ color: 0x596361 });
    const teamMat = new THREE.MeshLambertMaterial({ color: colors.primary });
    const darkSteel = new THREE.MeshLambertMaterial({ color: 0x282f34 });
    const treadMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });

    // Dual Tracks
    const treadGeo = ModelGeometry.track(0.4, 0.5, 2.4);
    const leftTread = new THREE.Mesh(treadGeo, treadMat);
    leftTread.position.set(-0.75, 0, 0);
    const rightTread = new THREE.Mesh(treadGeo, treadMat);
    rightTread.position.set(0.75, 0, 0);
    group.add(leftTread, rightTread);
    this.addRoadWheels(group, [-0.75, 0.75], 0.25, [-0.7, 0, 0.7], 0.18, 0.4, hullMat);
    this.addTrackCleats(group, .75, .4, .5, 2.4, darkSteel);

    // Chassis Hull
    const hullGeo = ModelGeometry.taperedBox(1.2, 0.5, 2.2, .12);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.set(0, 0.45, 0);
    hull.castShadow = true;
    group.add(hull);
    group.add(new THREE.Mesh(ModelGeometry.boxes([
      [.22, .06, 1.75, -.39, .71, 0], [.22, .06, 1.75, .39, .71, 0]
    ]), teamMat));
    this.addDeckVents(group, .48, .72, -.82, darkSteel);

    // Rotating Turret with Twin Autocannons
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 0.7, 0.1);

    const cupolaGeo = new THREE.CylinderGeometry(0.45, 0.5, 0.35, 8);
    const cupola = new THREE.Mesh(cupolaGeo, darkSteel);
    turretGroup.add(cupola);

    const barrelGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.2);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel1 = new THREE.Mesh(barrelGeo, darkSteel);
    barrel1.position.set(-0.16, 0.08, 0.6);
    const barrel2 = new THREE.Mesh(barrelGeo, darkSteel);
    barrel2.position.set(0.16, 0.08, 0.6);

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.08, 1.2);
    turretGroup.add(barrel1, barrel2, muzzle);

    group.add(turretGroup);
    group.scale.set(1.4, 1.4, 1.4);
    group.userData = { turret: turretGroup, muzzlePos: muzzle, type: 'light_tracks', wheels: group.userData.wheels };
    return group;
  }

  // --- 5. 4x4 Gunner (Jeep / Buggy) ---
  static create4x4Gunner(faction = 'player') {
    const colors = this.getFactionColors(faction);
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: colors.primary });
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x30363b });
    const tireMat = new THREE.MeshLambertMaterial({ color: 0x151515 });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x3388aa, transparent: true, opacity: 0.7 });

    // 4 Rugged Tires
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.28, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelPositions = [
      [-0.8, 0.35, 0.85],
      [0.8, 0.35, 0.85],
      [-0.8, 0.35, -0.85],
      [0.8, 0.35, -0.85]
    ];
    const wheels = [];
    wheelPositions.forEach(pos => {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(pos[0], pos[1], pos[2]);
      group.add(wheel);
      wheels.push(wheel);
    });

    // Buggy Body
    const bodyGeo = new THREE.BoxGeometry(1.2, 0.45, 2.1);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.55, 0);
    group.add(body);

    // Sloped Windshield
    const shieldGeo = new THREE.BoxGeometry(1.1, 0.4, 0.08);
    shieldGeo.rotateX(-0.35);
    const shield = new THREE.Mesh(shieldGeo, glassMat);
    shield.position.set(0, 0.9, 0.45);
    group.add(shield);

    // Roll Cage
    const cageGeo = new THREE.BoxGeometry(1.15, 0.55, 1.1);
    const cage = new THREE.Mesh(cageGeo, frameMat);
    cage.position.set(0, 0.98, -0.2);
    group.add(cage);

    // Roof-Mounted Heavy Gunner
    const gunGroup = new THREE.Group();
    gunGroup.position.set(0, 1.3, -0.2);

    const standGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.3);
    const stand = new THREE.Mesh(standGeo, frameMat);
    
    const gunBarrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.9);
    gunBarrelGeo.rotateX(Math.PI / 2);
    const gunBarrel = new THREE.Mesh(gunBarrelGeo, frameMat);
    gunBarrel.position.set(0, 0.2, 0.4);

    const gunShieldGeo = new THREE.BoxGeometry(0.45, 0.3, 0.05);
    const gunShield = new THREE.Mesh(gunShieldGeo, bodyMat);
    gunShield.position.set(0, 0.2, 0.15);

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.2, 0.9);

    gunGroup.add(stand, gunBarrel, gunShield, muzzle);
    group.add(gunGroup);

    group.scale.set(1.35, 1.35, 1.35);
    group.userData = { turret: gunGroup, muzzlePos: muzzle, type: '4x4_gunner', wheels };
    return group;
  }

  // --- 6. Battle Tank (Heavy Armor) ---
  static createBattleTank(faction = 'player') {
    const colors = this.getFactionColors(faction);
    const group = new THREE.Group();

    const hullMat = new THREE.MeshLambertMaterial({ color: 0x596361 });
    const treadMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
    const turretMat = new THREE.MeshLambertMaterial({ color: 0x46504e });
    const teamMat = new THREE.MeshLambertMaterial({ color: colors.primary });
    const steelMat = new THREE.MeshLambertMaterial({ color: 0x22262a });

    // Heavy Tread Skirts
    const treadGeo = ModelGeometry.track(0.65, 0.7, 3.2);
    const leftTread = new THREE.Mesh(treadGeo, treadMat);
    leftTread.position.set(-1.05, 0, 0);
    const rightTread = new THREE.Mesh(treadGeo, treadMat);
    rightTread.position.set(1.05, 0, 0);
    group.add(leftTread, rightTread);
    this.addRoadWheels(group, [-1.05, 1.05], 0.35, [-1.08, 0, 1.08], 0.26, 0.65, hullMat);
    this.addTrackCleats(group, 1.05, .65, .7, 3.2, steelMat);

    // Main Heavy Hull
    const hullGeo = ModelGeometry.taperedBox(1.6, 0.65, 3.0, .18);
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.position.set(0, 0.6, 0);
    hull.castShadow = true;
    group.add(hull);
    group.add(new THREE.Mesh(ModelGeometry.boxes([
      [.27, .08, 2.3, -.88, .78, -.15], [.27, .08, 2.3, .88, .78, -.15],
      [1.0, .05, .28, 0, .94, 1.08]
    ]), teamMat));
    this.addDeckVents(group, 1.05, .94, -1.18, steelMat);

    // Rotating 360-degree Turret
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.0, -0.2);

    const turretBodyGeo = ModelGeometry.taperedBox(1.3, 0.55, 1.7, .18);
    const turretBody = new THREE.Mesh(turretBodyGeo, turretMat);
    turretBody.castShadow = true;
    turretGroup.add(turretBody);
    turretGroup.add(new THREE.Mesh(ModelGeometry.boxes([
      [.21, .04, 1.1, -.32, .295, .02], [.6, .19, .28, 0, .02, .9]
    ]), teamMat));

    // Heavy High-Caliber Cannon
    const cannonGeo = new THREE.CylinderGeometry(0.12, 0.14, 2.4, 8);
    cannonGeo.rotateX(Math.PI / 2);
    const cannon = new THREE.Mesh(cannonGeo, steelMat);
    cannon.position.set(0, 0.08, 1.6);

    // Muzzle Brake
    const brakeGeo = new THREE.BoxGeometry(0.35, 0.25, 0.35);
    const brake = new THREE.Mesh(brakeGeo, steelMat);
    brake.position.set(0, 0.08, 2.7);

    // Commander Hatch & Antenna
    const hatchGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.1, 8);
    const hatch = new THREE.Mesh(hatchGeo, steelMat);
    hatch.position.set(0.35, 0.32, -0.3);

    const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.1);
    const antenna = new THREE.Mesh(antennaGeo, steelMat);
    antenna.position.set(0.45, 0.85, -0.4);

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.08, 2.9);

    turretGroup.add(cannon, brake, hatch, antenna, muzzle);
    group.add(turretGroup);

    group.scale.set(1.3, 1.3, 1.3);
    group.userData = { turret: turretGroup, muzzlePos: muzzle, type: 'battle_tank', wheels: group.userData.wheels };
    return group;
  }

  // --- 7. Ore Harvester (Resource Hauler) ---
  static createOreHarvester(faction = 'player') {
    const colors = this.getFactionColors(faction);
    const group = new THREE.Group();

    const indYellow = new THREE.MeshLambertMaterial({ color: 0xe0a010 }); // Industrial yellow
    const treadMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const steelMat = new THREE.MeshLambertMaterial({ color: 0x333b40 });
    const teamMat = new THREE.MeshLambertMaterial({ color: colors.primary });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x85bac6 });
    const goldOreMat = new THREE.MeshStandardMaterial({
      color: 0xc69a32,
      emissive: 0x5b3807,
      emissiveIntensity: 0.18, roughness: .7, metalness: .15
    });

    // Heavy Treads
    const treadGeo = ModelGeometry.track(0.7, 0.8, 3.4);
    const leftTread = new THREE.Mesh(treadGeo, treadMat);
    leftTread.position.set(-1.15, 0, 0);
    const rightTread = new THREE.Mesh(treadGeo, treadMat);
    rightTread.position.set(1.15, 0, 0);
    group.add(leftTread, rightTread);
    this.addRoadWheels(group, [-1.15, 1.15], 0.4, [-1.15, 0, 1.15], 0.3, 0.7, steelMat);
    this.addTrackCleats(group, 1.15, .7, .8, 3.4, steelMat);

    // Main Industrial Cab & Chassis
    const chassisGeo = new THREE.BoxGeometry(1.8, 0.75, 3.2);
    const chassis = new THREE.Mesh(chassisGeo, indYellow);
    chassis.position.set(0, 0.75, 0);
    chassis.castShadow = true;
    group.add(chassis);

    // Front Armored Cab
    const cabGeo = ModelGeometry.taperedBox(1.5, 0.7, 1.0, .14);
    const cab = new THREE.Mesh(cabGeo, steelMat);
    cab.position.set(0, 1.3, 1.0);
    cab.castShadow = true;
    group.add(cab);
    group.add(new THREE.Mesh(ModelGeometry.boxes([
      [1.08, .3, .05, 0, 1.43, 1.44, -.38], [.8, .035, .42, 0, 1.66, 1.0]
    ]), glassMat));
    group.add(new THREE.Mesh(ModelGeometry.boxes([
      [.19, .05, .72, -.53, 1.67, 1.0], [.19, .05, .72, .53, 1.67, 1.0]
    ]), teamMat));

    // Front Mining Auger / Drill Cylinder
    const drillGeo = new THREE.CylinderGeometry(0.35, 0.35, 2.2, 12);
    drillGeo.rotateZ(Math.PI / 2);
    const drill = new THREE.Mesh(drillGeo, steelMat);
    drill.position.set(0, 0.4, 1.95);
    group.add(drill);

    // Rear Ore Hopper (Dump Bed)
    const hopperGeo = ModelGeometry.boxes([
      [.13, .6, 1.8, -.79, 1.42, -.6], [.13, .6, 1.8, .79, 1.42, -.6],
      [1.45, .6, .13, 0, 1.42, -1.44], [1.45, .6, .13, 0, 1.42, .24]
    ]);
    const hopper = new THREE.Mesh(hopperGeo, indYellow);
    hopper.castShadow = true;
    group.add(hopper);
    group.add(new THREE.Mesh(ModelGeometry.boxes([[1.45, .1, 1.55, 0, 1.135, -.6]]), steelMat));

    // Glowing Gold Ore inside Hopper (scales with cargo!)
    // Bottom-anchored cargo rises inside the open bed; empty cargo is hidden.
    const oreCargoGeo = ModelGeometry.merge([
      new THREE.BoxGeometry(1.45, .52, 1.55).translate(0, .26, 0),
      new THREE.DodecahedronGeometry(.35, 0).scale(1, .65, 1).translate(-.3, .52, -.3),
      new THREE.DodecahedronGeometry(.3, 0).scale(1, .7, 1).translate(.3, .52, .25)
    ]);
    const oreCargo = new THREE.Mesh(oreCargoGeo, goldOreMat);
    oreCargo.position.set(0, 1.19, -0.6);
    oreCargo.scale.set(0.9, 0.1, 0.9);
    oreCargo.visible = false;
    group.add(oreCargo);

    group.scale.set(1.2, 1.2, 1.2);
    group.userData = { drill: drill, oreCargo: oreCargo, type: 'harvester', wheels: group.userData.wheels };
    return group;
  }

  // --- 8. Machine Gun Helicopter (Aerial Unit) ---
  static createHelicopter(faction = 'player') {
    const colors = this.getFactionColors(faction);
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: colors.primary });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x1a2126 });
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x2288bb, transparent: true, opacity: 0.75 });
    const bladeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

    // Fuselage
    const fuseGeo = new THREE.BoxGeometry(1.1, 0.95, 2.6);
    const fuse = new THREE.Mesh(fuseGeo, bodyMat);
    fuse.position.set(0, 0, 0);
    group.add(fuse);

    // Canopy Glass
    const canopyGeo = new THREE.BoxGeometry(0.9, 0.6, 1.0);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(0, 0.2, 0.9);
    group.add(canopy);

    // Tail Boom & Stabilizer
    const boomGeo = new THREE.BoxGeometry(0.3, 0.35, 2.2);
    const boom = new THREE.Mesh(boomGeo, bodyMat);
    boom.position.set(0, 0.1, -2.0);
    group.add(boom);

    const finGeo = new THREE.BoxGeometry(0.08, 0.8, 0.5);
    const fin = new THREE.Mesh(finGeo, bodyMat);
    fin.position.set(0, 0.4, -3.0);
    group.add(fin);

    // Tail Rotor (rotates around X axis)
    const tailRotorGeo = new THREE.BoxGeometry(0.04, 0.8, 0.12);
    const tailRotor = new THREE.Mesh(tailRotorGeo, bladeMat);
    tailRotor.position.set(0.1, 0.4, -3.0);
    group.add(tailRotor);

    // Main Rotor Mast & Spinning Rotor (rotates around Y axis)
    const mastGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.4);
    const mast = new THREE.Mesh(mastGeo, darkMat);
    mast.position.set(0, 0.6, 0.1);
    group.add(mast);

    const rotorGroup = new THREE.Group();
    rotorGroup.position.set(0, 0.8, 0.1);
    const blade1Geo = new THREE.BoxGeometry(4.2, 0.04, 0.22);
    const blade1 = new THREE.Mesh(blade1Geo, bladeMat);
    const blade2Geo = new THREE.BoxGeometry(0.22, 0.04, 4.2);
    const blade2 = new THREE.Mesh(blade2Geo, bladeMat);
    rotorGroup.add(blade1, blade2);
    group.add(rotorGroup);

    // Dual Chin Machine Guns & Rocket Pods
    const stubWings = new THREE.BoxGeometry(2.4, 0.15, 0.4);
    const wings = new THREE.Mesh(stubWings, darkMat);
    wings.position.set(0, -0.2, 0.3);
    group.add(wings);

    const chinGunGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.7);
    chinGunGeo.rotateX(Math.PI / 2);
    const leftGun = new THREE.Mesh(chinGunGeo, darkMat);
    leftGun.position.set(-0.8, -0.35, 0.7);
    const rightGun = new THREE.Mesh(chinGunGeo, darkMat);
    rightGun.position.set(0.8, -0.35, 0.7);
    group.add(leftGun, rightGun);

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, -0.35, 1.1);
    group.add(muzzle);

    group.scale.set(1.2, 1.2, 1.2);
    group.userData = {
      mainRotor: rotorGroup,
      tailRotor: tailRotor,
      muzzlePos: muzzle,
      isAerial: true,
      flightHeight: 12,
      type: 'helicopter'
    };
    return group;
  }

  // --- 9. Harrier Jet (Aerial Strike Fighter) ---
  static createHarrierJet(faction = 'player') {
    const colors = this.getFactionColors(faction);
    const group = new THREE.Group();

    const bodyMat = new THREE.MeshLambertMaterial({ color: colors.primary });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x1f272e });
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x1177aa, transparent: true, opacity: 0.8 });

    // Sleek Jet Fuselage
    const fuseGeo = new THREE.ConeGeometry(0.7, 4.4, 6);
    fuseGeo.rotateX(Math.PI / 2);
    const fuse = new THREE.Mesh(fuseGeo, bodyMat);
    fuse.position.set(0, 0, 0.4);
    group.add(fuse);

    // Cockpit
    const cockpitGeo = new THREE.BoxGeometry(0.5, 0.4, 1.2);
    const cockpit = new THREE.Mesh(cockpitGeo, canopyMat);
    cockpit.position.set(0, 0.35, 0.6);
    group.add(cockpit);

    // Delta Swept Wings
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2.4, -1.6);
    wingShape.lineTo(2.2, -2.4);
    wingShape.lineTo(0, -1.8);
    wingShape.lineTo(-2.2, -2.4);
    wingShape.lineTo(-2.4, -1.6);
    wingShape.closePath();

    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.08, bevelEnabled: false });
    wingGeo.rotateX(Math.PI / 2);
    wingGeo.translate(0, 0, 0.5);
    const wings = new THREE.Mesh(wingGeo, bodyMat);
    group.add(wings);

    // Vertical Tail Fin
    const finGeo = new THREE.BoxGeometry(0.08, 0.9, 0.8);
    const fin = new THREE.Mesh(finGeo, bodyMat);
    fin.position.set(0, 0.5, -1.5);
    group.add(fin);

    // Jet Engine Exhaust Glow
    const exhaustGeo = new THREE.CylinderGeometry(0.2, 0.25, 0.4, 8);
    exhaustGeo.rotateX(Math.PI / 2);
    const exhaustMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff });
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.position.set(0, 0, -1.8);
    group.add(exhaust);

    group.scale.set(1.3, 1.3, 1.3);
    group.userData = { isAerial: true, flightHeight: 22, type: 'harrier_jet' };
    return group;
  }

  // --- 10. Combat Engineer (Building Capture Specialist) ---
  static createEngineer(faction = 'player') {
    const colors = this.getFactionColors(faction);
    const group = new THREE.Group();

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xd2a679 });
    const uniformMat = new THREE.MeshLambertMaterial({ color: 0x3e4a44 });
    const hazardMat = new THREE.MeshLambertMaterial({ color: 0xffaa00 }); // High-visibility hazard vest
    const hardHatMat = new THREE.MeshLambertMaterial({ color: 0xffcc00 }); // Yellow hard hat
    const toolMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });

    // Legs
    const legGeo = new THREE.BoxGeometry(0.24, 0.6, 0.24);
    const leftLeg = new THREE.Mesh(legGeo, uniformMat);
    leftLeg.position.set(-0.16, 0.3, 0);
    const rightLeg = new THREE.Mesh(legGeo, uniformMat);
    rightLeg.position.set(0.16, 0.3, 0);
    group.add(leftLeg, rightLeg);

    // Hazard Torso & Toolbelt
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.35), hazardMat);
    torso.position.set(0, 0.85, 0);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.12, 0.38), toolMat);
    belt.position.set(0, 0.58, 0);
    group.add(torso, belt);

    // Engineer Tech Backpack with Antenna
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.26), toolMat);
    pack.position.set(0, 0.9, -0.28);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.9), toolMat);
    antenna.position.set(0.15, 1.4, -0.28);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff0044 }));
    beacon.position.set(0.15, 1.85, -0.28);
    group.add(pack, antenna, beacon);

    // Head with Safety Helmet
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), skinMat);
    head.position.set(0, 1.3, 0);
    const hat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.42), hardHatMat);
    hat.position.set(0, 1.45, 0);
    group.add(head, hat);

    // Diagnostic Data Tablet in Hands
    const tabletGroup = new THREE.Group();
    const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.04, 0.24), toolMat);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.18), screenMat);
    tabletGroup.add(tablet, screen);
    tabletGroup.position.set(0.15, 0.9, 0.3);
    tabletGroup.rotation.x = -0.4;
    group.add(tabletGroup);

    group.scale.set(1.25, 1.25, 1.25);
    group.userData = { isEngineer: true, type: 'engineer', leftLeg, rightLeg };
    return group;
  }

  // --- 11. Laser Colossus (High-Tech Super Unit) ---
  static createLaserColossus(faction = 'player') {
    const colors = this.getFactionColors(faction);
    const group = new THREE.Group();

    const hullMat = new THREE.MeshLambertMaterial({ color: colors.primary });
    const darkSteel = new THREE.MeshLambertMaterial({ color: 0x1c2227 });
    const treadMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
    const crystalMat = new THREE.MeshStandardMaterial({
      color: faction === 'player' ? 0x00e5ff : 0xff1744,
      emissive: faction === 'player' ? 0x00b0ff : 0xd50000,
      emissiveIntensity: 0.9,
      roughness: 0.1,
      metalness: 0.9
    });

    // Quad Heavy Track Sponsons (4 heavy treads at corners)
    const podGeo = new THREE.BoxGeometry(0.8, 0.85, 2.2);
    const podPositions = [
      [-1.5, 0.42, 1.3],
      [1.5, 0.42, 1.3],
      [-1.5, 0.42, -1.3],
      [1.5, 0.42, -1.3]
    ];
    podPositions.forEach(pos => {
      const pod = new THREE.Mesh(podGeo, treadMat);
      pod.position.set(pos[0], pos[1], pos[2]);
      group.add(pod);

      // Hydraulic suspension strut to center
      const strutGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.2);
      strutGeo.rotateZ(pos[0] > 0 ? -0.5 : 0.5);
      const strut = new THREE.Mesh(strutGeo, darkSteel);
      strut.position.set(pos[0] * 0.6, 0.7, pos[2]);
      group.add(strut);
    });
    this.addRoadWheels(group, [-1.5, 1.5], 0.28, [-1.3, 1.3], 0.32, 0.45, treadMat);

    // Massive Main Chassis
    const chassisGeo = new THREE.BoxGeometry(2.4, 0.9, 3.4);
    const chassis = new THREE.Mesh(chassisGeo, hullMat);
    chassis.position.set(0, 0.9, 0);
    group.add(chassis);

    // Rotating 360-degree Laser Spire Turret
    const turretGroup = new THREE.Group();
    turretGroup.position.set(0, 1.45, 0);

    const turretBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.8, 12), darkSteel);
    turretGroup.add(turretBase);

    // Twin High-Energy Laser Emitter Barrels
    const barrelGeo = new THREE.CylinderGeometry(0.16, 0.22, 3.2, 8);
    barrelGeo.rotateX(Math.PI / 2);
    const leftBarrel = new THREE.Mesh(barrelGeo, darkSteel);
    leftBarrel.position.set(-0.65, 0.35, 1.8);
    const rightBarrel = new THREE.Mesh(barrelGeo, darkSteel);
    rightBarrel.position.set(0.65, 0.35, 1.8);
    turretGroup.add(leftBarrel, rightBarrel);

    // Glowing Laser Focus Crystals inside Emitters
    const crystalGeo = new THREE.OctahedronGeometry(0.35);
    const leftCrystal = new THREE.Mesh(crystalGeo, crystalMat);
    leftCrystal.position.set(-0.65, 0.35, 3.2);
    const rightCrystal = new THREE.Mesh(crystalGeo, crystalMat);
    rightCrystal.position.set(0.65, 0.35, 3.2);
    turretGroup.add(leftCrystal, rightCrystal);

    // Central Prism Core on top
    const corePrism = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 6), crystalMat);
    corePrism.position.set(0, 1.1, -0.4);
    turretGroup.add(corePrism);

    const muzzle = new THREE.Object3D();
    muzzle.position.set(0, 0.35, 3.5);
    turretGroup.add(muzzle);

    group.add(turretGroup);

    group.scale.set(1.5, 1.5, 1.5);
    group.userData = {
      turret: turretGroup,
      muzzlePos: muzzle,
      crystals: [leftCrystal, rightCrystal, corePrism],
      isSuperUnit: true,
      type: 'laser_colossus',
      wheels: group.userData.wheels
    };
    return group;
  }
}
