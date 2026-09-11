// ==========================================================================
// Command & Conquer RTS - Projectiles, Ballistics & Particle Explosions
// ==========================================================================

class ProjectileManager {
  constructor(scene) {
    this.scene = scene;
    this.projectiles = [];
    this.particles = [];

    // Shared geometries and materials for max performance
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
    this.tracerGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9);
    this.tracerGeo.rotateX(Math.PI / 2);

    this.rocketGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.7, 6);
    this.rocketGeo.rotateX(Math.PI / 2);
    this.rocketMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });

    this.grenadeGeo = new THREE.SphereGeometry(0.16, 6, 6);
    this.grenadeMat = new THREE.MeshLambertMaterial({ color: 0x222222 });

    this.bombGeo = new THREE.CylinderGeometry(0.18, 0.25, 0.9, 8);
    this.bombGeo.rotateX(Math.PI / 2);
    this.bombMat = new THREE.MeshLambertMaterial({ color: 0x334433 });

    this.sparkGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    this.laserBeams = [];
    this.laserCoreMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.laserAuraMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.65 });
  }

  // Fire bullet / machine gun tracer
  spawnBullet(fromPos, toPos, targetEntity, damage, shooter) {
    const mesh = new THREE.Mesh(this.tracerGeo, this.tracerMat);
    mesh.position.copy(fromPos);
    mesh.lookAt(toPos);
    this.scene.add(mesh);

    this.projectiles.push({
      type: 'bullet',
      mesh: mesh,
      pos: fromPos.clone(),
      startPos: fromPos.clone(),
      targetPos: toPos.clone(),
      targetEntity: targetEntity,
      damage: damage,
      shooter: shooter,
      speed: 65,
      progress: 0,
      totalDist: fromPos.distanceTo(toPos)
    });
  }

  // Fire arcing grenade
  spawnGrenade(fromPos, toPos, targetEntity, damage, shooter, splashRadius = 3.5) {
    const mesh = new THREE.Mesh(this.grenadeGeo, this.grenadeMat);
    mesh.position.copy(fromPos);
    this.scene.add(mesh);

    this.projectiles.push({
      type: 'grenade',
      mesh: mesh,
      startPos: fromPos.clone(),
      targetPos: toPos.clone(),
      targetEntity: targetEntity,
      damage: damage,
      shooter: shooter,
      splashRadius: splashRadius,
      speed: 22,
      progress: 0,
      arcHeight: 5.5,
      totalDist: fromPos.distanceTo(toPos)
    });
  }

  // Fire homing or straight rocket
  spawnRocket(fromPos, toPos, targetEntity, damage, shooter, splashRadius = 2.0) {
    const mesh = new THREE.Mesh(this.rocketGeo, this.rocketMat);
    mesh.position.copy(fromPos);
    mesh.lookAt(toPos);
    this.scene.add(mesh);

    this.projectiles.push({
      type: 'rocket',
      mesh: mesh,
      pos: fromPos.clone(),
      startPos: fromPos.clone(),
      targetPos: toPos.clone(),
      targetEntity: targetEntity,
      damage: damage,
      shooter: shooter,
      splashRadius: splashRadius,
      speed: 38,
      progress: 0,
      totalDist: fromPos.distanceTo(toPos)
    });
  }

  // Tank heavy shell
  spawnTankShell(fromPos, toPos, targetEntity, damage, shooter) {
    const mesh = new THREE.Mesh(this.tracerGeo, new THREE.MeshBasicMaterial({ color: 0xffaa22 }));
    mesh.scale.set(2, 2, 2.5);
    mesh.position.copy(fromPos);
    mesh.lookAt(toPos);
    this.scene.add(mesh);

    this.projectiles.push({
      type: 'shell',
      mesh: mesh,
      pos: fromPos.clone(),
      startPos: fromPos.clone(),
      targetPos: toPos.clone(),
      targetEntity: targetEntity,
      damage: damage,
      shooter: shooter,
      splashRadius: 2.5,
      speed: 75,
      progress: 0,
      totalDist: fromPos.distanceTo(toPos)
    });
  }

  // Aerial bomb dropped by Harrier
  spawnAerialBomb(dropPos, damage, shooter) {
    const mesh = new THREE.Mesh(this.bombGeo, this.bombMat);
    mesh.position.copy(dropPos);
    mesh.rotation.x = Math.PI / 2; // Point down
    this.scene.add(mesh);

    this.projectiles.push({
      type: 'bomb',
      mesh: mesh,
      pos: dropPos.clone(),
      targetPos: new THREE.Vector3(dropPos.x, 0, dropPos.z),
      damage: damage,
      shooter: shooter,
      splashRadius: 5.0,
      fallSpeed: 28
    });
  }

  // High-Energy Continuous Laser Beam
  spawnLaserBeam(fromPos, toPos, targetEntity, damage, shooter, colorHex = 0x00e5ff) {
    const dist = fromPos.distanceTo(toPos);
    const midPoint = fromPos.clone().add(toPos).multiplyScalar(0.5);

    // Laser Core (Intense white hot)
    const coreGeo = new THREE.CylinderGeometry(0.08, 0.08, dist, 6);
    coreGeo.rotateX(Math.PI / 2);
    const coreMesh = new THREE.Mesh(coreGeo, this.laserCoreMat);

    // Laser Aura (Faction/Energy color)
    const auraGeo = new THREE.CylinderGeometry(0.24, 0.24, dist, 6);
    auraGeo.rotateX(Math.PI / 2);
    const auraMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.65 });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);

    const laserGroup = new THREE.Group();
    laserGroup.add(coreMesh, auraMesh);
    laserGroup.position.copy(midPoint);
    laserGroup.lookAt(toPos);
    this.scene.add(laserGroup);

    // Deal immediate damage
    if (targetEntity && targetEntity.isAlive) {
      targetEntity.takeDamage(damage, shooter);
    }
    this.spawnSparks(toPos, 4);

    this.laserBeams.push({
      mesh: laserGroup,
      duration: 0.35,
      maxDuration: 0.35,
      targetEntity: targetEntity
    });
  }

  // Update physics and collision
  update(delta, entityManager) {
    // 0. Update Laser Beams
    for (let i = this.laserBeams.length - 1; i >= 0; i--) {
      const lb = this.laserBeams[i];
      lb.duration -= delta;
      const progress = lb.duration / lb.maxDuration;
      lb.mesh.scale.set(progress, progress, 1);

      if (lb.duration <= 0) {
        this.scene.remove(lb.mesh);
        this.laserBeams.splice(i, 1);
      }
    }
    // 1. Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];

      if (p.type === 'bomb') {
        p.pos.y -= p.fallSpeed * delta;
        p.mesh.position.copy(p.pos);

        if (p.pos.y <= 0.2) {
          // Detonate bomb
          this.explodeAt(p.pos, true, 2.5);
          if (entityManager) {
            entityManager.applyAreaDamage(p.pos, p.damage, p.splashRadius, p.shooter);
          }
          if (window.soundFX) window.soundFX.playExplosion(true);
          this.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
        continue;
      }

      // If guided rocket has target entity, update target coordinate
      if (p.type === 'rocket' && p.targetEntity && p.targetEntity.isAlive) {
        p.targetPos.copy(p.targetEntity.position);
        p.totalDist = p.startPos.distanceTo(p.targetPos);
      }

      const step = (p.speed * delta) / Math.max(1, p.totalDist);
      p.progress += step;

      if (p.progress >= 1.0) {
        // Impact
        this.onImpact(p, entityManager);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      } else {
        // Interpolate position
        if (p.type === 'grenade') {
          const currentX = THREE.MathUtils.lerp(p.startPos.x, p.targetPos.x, p.progress);
          const currentZ = THREE.MathUtils.lerp(p.startPos.z, p.targetPos.z, p.progress);
          const heightArc = Math.sin(p.progress * Math.PI) * p.arcHeight;
          const currentY = THREE.MathUtils.lerp(p.startPos.y, p.targetPos.y, p.progress) + heightArc;

          p.mesh.position.set(currentX, currentY, currentZ);
          p.mesh.rotation.x += 10 * delta;
          p.mesh.rotation.y += 10 * delta;
        } else {
          p.pos.lerpVectors(p.startPos, p.targetPos, p.progress);
          p.mesh.position.copy(p.pos);

          // Rocket smoke trail
          if (p.type === 'rocket' && Math.random() > 0.4) {
            this.spawnSmokeParticle(p.pos.clone());
          }
        }
      }
    }

    // 2. Update Explosion Particles & Debris
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= delta;

      if (pt.life <= 0) {
        this.scene.remove(pt.mesh);
        this.particles.splice(i, 1);
      } else {
        pt.pos.addScaledVector(pt.velocity, delta);
        if (pt.gravity) pt.velocity.y -= 18 * delta;
        pt.mesh.position.copy(pt.pos);

        const progress = 1 - (pt.life / pt.maxLife);
        if (pt.type === 'fire') {
          const scale = pt.baseScale * (1 + progress * 2.0);
          pt.mesh.scale.set(scale, scale, scale);
          pt.mesh.material.opacity = Math.max(0, 1 - progress);
        } else if (pt.type === 'smoke') {
          const scale = pt.baseScale * (1 + progress * 3.5);
          pt.mesh.scale.set(scale, scale, scale);
          pt.mesh.material.opacity = Math.max(0, 0.6 * (1 - progress));
        } else if (pt.type === 'debris') {
          pt.mesh.rotation.x += 5 * delta;
          pt.mesh.rotation.y += 5 * delta;
        }
      }
    }
  }

  onImpact(p, entityManager) {
    const impactPos = p.targetPos.clone();

    if (p.type === 'bullet') {
      // Direct damage
      if (p.targetEntity && p.targetEntity.isAlive) {
        p.targetEntity.takeDamage(p.damage, p.shooter);
      }
      this.spawnSparks(impactPos, 3);
    } else if (p.type === 'grenade') {
      // AoE damage
      if (entityManager) {
        entityManager.applyAreaDamage(impactPos, p.damage, p.splashRadius, p.shooter);
      }
      this.explodeAt(impactPos, false, 1.2);
      if (window.soundFX) window.soundFX.playExplosion(false);
    } else if (p.type === 'rocket') {
      if (p.targetEntity && p.targetEntity.isAlive) {
        p.targetEntity.takeDamage(p.damage, p.shooter);
      }
      if (entityManager && p.splashRadius) {
        entityManager.applyAreaDamage(impactPos, p.damage * 0.45, p.splashRadius, p.shooter);
      }
      this.explodeAt(impactPos, false, 1.5);
      if (window.soundFX) window.soundFX.playExplosion(false);
    } else if (p.type === 'shell') {
      if (p.targetEntity && p.targetEntity.isAlive) {
        p.targetEntity.takeDamage(p.damage, p.shooter);
      }
      if (entityManager) {
        entityManager.applyAreaDamage(impactPos, p.damage * 0.5, p.splashRadius, p.shooter);
      }
      this.explodeAt(impactPos, true, 1.8);
      if (window.soundFX) window.soundFX.playExplosion(true);
    }
  }

  // Create explosion effect with dynamic fire sphere, sparks, and smoke
  explodeAt(pos, isLarge = false, scaleMul = 1.0) {
    const count = isLarge ? 12 : 6;

    // Expanding Fireball Sphere
    const fireGeo = new THREE.SphereGeometry(1.0 * scaleMul, 8, 8);
    const fireMat = new THREE.MeshBasicMaterial({
      color: 0xff6600,
      transparent: true,
      opacity: 0.95
    });
    const fireMesh = new THREE.Mesh(fireGeo, fireMat);
    fireMesh.position.copy(pos);
    this.scene.add(fireMesh);

    this.particles.push({
      type: 'fire',
      mesh: fireMesh,
      pos: pos.clone(),
      velocity: new THREE.Vector3(0, 1.5, 0),
      life: 0.35,
      maxLife: 0.35,
      baseScale: 1.0 * scaleMul
    });

    // Flying debris sparks
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: Math.random() > 0.4 ? 0xffcc00 : 0xff3300 });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 16 * scaleMul,
        (4 + Math.random() * 12) * scaleMul,
        (Math.random() - 0.5) * 16 * scaleMul
      );

      this.particles.push({
        type: 'debris',
        mesh: mesh,
        pos: pos.clone(),
        velocity: vel,
        gravity: true,
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9
      });
    }

    // Rising Smoke Puffs
    for (let i = 0; i < (isLarge ? 5 : 2); i++) {
      this.spawnSmokeParticle(
        pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2)),
        scaleMul
      );
    }
  }

  spawnSmokeParticle(pos, scaleMul = 1.0) {
    const geo = new THREE.SphereGeometry(0.8 * scaleMul, 6, 6);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x44484d,
      transparent: true,
      opacity: 0.6
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    this.scene.add(mesh);

    this.particles.push({
      type: 'smoke',
      mesh: mesh,
      pos: pos.clone(),
      velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 2.5 + Math.random() * 2, (Math.random() - 0.5) * 2),
      gravity: false,
      life: 0.7 + Math.random() * 0.5,
      maxLife: 1.2,
      baseScale: 0.8 * scaleMul
    });
  }

  spawnSparks(pos, count = 3) {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffff66 });
      const mesh = new THREE.Mesh(this.sparkGeo, mat);
      mesh.scale.set(0.6, 0.6, 0.6);
      mesh.position.copy(pos);
      this.scene.add(mesh);

      this.particles.push({
        type: 'debris',
        mesh: mesh,
        pos: pos.clone(),
        velocity: new THREE.Vector3((Math.random() - 0.5) * 8, 3 + Math.random() * 6, (Math.random() - 0.5) * 8),
        gravity: true,
        life: 0.25,
        maxLife: 0.25
      });
    }
  }
}
