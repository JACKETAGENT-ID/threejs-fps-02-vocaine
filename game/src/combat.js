// Arctic Relay — combat. Hitscan shots, tracers, and the cryo grenade. The player shoots
// a ray; the first thing it meets decides the outcome. Bot shots come back through the
// same raycaster against the player's hitbox. Nothing here keeps match state.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const TRACER_POOL = 24;
const TRACER_LIFE = 0.08;
const GRENADE_FUSE = 1.6;
const GRENADE_RADIUS = 5;

export function createCombat(scene, map, bots, player, arsenal, audio, hud, state) {
  const raycaster = new THREE.Raycaster();
  raycaster.far = 90;
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const hitPoint = new THREE.Vector3();

  const tracerGeo = new THREE.BoxGeometry(0.025, 0.025, 1);
  const tracerMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.tracer), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const tracers = [];
  for (let i = 0; i < TRACER_POOL; i += 1) {
    const mesh = new THREE.Mesh(tracerGeo, tracerMat.clone());
    mesh.visible = false;
    scene.add(mesh);
    tracers.push({ mesh, life: 0 });
  }
  let tracerIndex = 0;

  const grenades = [];
  const grenadeGeo = new THREE.SphereGeometry(0.09, 10, 8);
  const grenadeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 0.8, roughness: 0.4 });
  const blastGeo = new THREE.SphereGeometry(1, 18, 12);
  const blastMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  const blasts = [];
  for (let i = 0; i < 4; i += 1) {
    const mesh = new THREE.Mesh(blastGeo, blastMat.clone());
    mesh.visible = false;
    scene.add(mesh);
    blasts.push({ mesh, life: 0 });
  }
  let blastIndex = 0;

  function fireTracer(from, to) {
    const tracer = tracers[tracerIndex];
    tracerIndex = (tracerIndex + 1) % TRACER_POOL;
    const length = from.distanceTo(to);
    tracer.mesh.position.copy(from).add(to).multiplyScalar(0.5);
    tracer.mesh.lookAt(to);
    tracer.mesh.scale.set(1, 1, Math.max(0.1, length));
    tracer.mesh.visible = true;
    tracer.life = TRACER_LIFE;
  }

  function shoot(camera, spread, random) {
    const def = arsenal.currentDef();
    if (!arsenal.takeRound()) {
      audio.dryFire();
      return false;
    }
    camera.getWorldDirection(direction);
    direction.x += (random() * 2 - 1) * spread;
    direction.y += (random() * 2 - 1) * spread;
    direction.z += (random() * 2 - 1) * spread;
    direction.normalize();
    origin.copy(camera.position);
    scene.updateMatrixWorld(true);
    raycaster.set(origin, direction);
    const targets = map.shootables.concat(bots.hitMeshes());
    const hit = raycaster.intersectObjects(targets, false)[0];
    const end = hit ? hit.point : origin.clone().add(direction.clone().multiplyScalar(80));
    const muzzle = origin.clone().add(direction.clone().multiplyScalar(0.7));
    muzzle.y -= 0.08;
    fireTracer(muzzle, end);
    arsenal.pullTrigger();
    audio.shot(def.id);
    if (hit && hit.object.userData.bot) {
      const bot = hit.object.userData.bot;
      const isHead = hit.object.userData.part === 'head';
      const killed = bots.damage(bot, isHead ? def.headDamage : def.damage);
      hud.hitMarker(killed);
      audio.hit();
      if (killed) {
        audio.kill();
        state.kills += 1;
        state.money += 100;
        hud.pushFeed(`${bot.name} eliminated  +$100`);
      }
      return true;
    }
    return false;
  }

  function botFire(bot, spread, random, playerHitMesh) {
    const eye = new THREE.Vector3(bot.position.x, bot.position.y + 1.55, bot.position.z);
    const chest = new THREE.Vector3(player.state.position.x, player.state.position.y + 1.2, player.state.position.z);
    direction.copy(chest).sub(eye).normalize();
    direction.x += (random() * 2 - 1) * spread;
    direction.y += (random() * 2 - 1) * spread;
    direction.z += (random() * 2 - 1) * spread;
    direction.normalize();
    scene.updateMatrixWorld(true);
    raycaster.set(eye, direction);
    raycaster.far = 60;
    const blockedBy = raycaster.intersectObjects(map.shootables, false)[0];
    const playerHit = raycaster.intersectObject(playerHitMesh, false)[0];
    const end = playerHit ? playerHit.point : eye.clone().add(direction.clone().multiplyScalar(50));
    fireTracer(eye, end);
    if (!playerHit) return;
    if (blockedBy && blockedBy.distance < playerHit.distance) return;
    const dmg = 9 + random() * 6;
    player.hurt(dmg);
    hud.damageFlash();
    audio.hurt();
  }

  function throwGrenade(from, dir) {
    const mesh = new THREE.Mesh(grenadeGeo, grenadeMat);
    mesh.position.copy(from);
    scene.add(mesh);
    grenades.push({
      mesh,
      velocity: dir.clone().multiplyScalar(17).add(new THREE.Vector3(0, 4.5, 0)),
      fuse: GRENADE_FUSE,
    });
    audio.grenade();
  }

  function explode(at, time) {
    const blast = blasts[blastIndex];
    blastIndex = (blastIndex + 1) % blasts.length;
    blast.mesh.position.copy(at);
    blast.mesh.scale.setScalar(0.5);
    blast.mesh.visible = true;
    blast.life = 0.5;
    audio.explosion();
    for (const bot of bots.bots) {
      if (!bot.alive) continue;
      const dist = bot.position.distanceTo(at);
      if (dist > GRENADE_RADIUS) continue;
      const dmg = Math.round(70 - (dist / GRENADE_RADIUS) * 50);
      const killed = bots.damage(bot, dmg);
      bot.slowUntil = time + 4;
      if (killed) {
        state.kills += 1;
        state.money += 100;
        hud.pushFeed(`${bot.name} frozen out  +$100`);
      }
    }
    const playerDist = player.state.position.distanceTo(at);
    if (playerDist < 3 && player.state.alive) {
      player.hurt(25);
      hud.damageFlash();
    }
  }

  function step(dt, time) {
    for (const tracer of tracers) {
      if (!tracer.mesh.visible) continue;
      tracer.life -= dt;
      tracer.mesh.material.opacity = Math.max(0, (tracer.life / TRACER_LIFE) * 0.85);
      if (tracer.life <= 0) tracer.mesh.visible = false;
    }
    for (const blast of blasts) {
      if (!blast.mesh.visible) continue;
      blast.life -= dt;
      blast.mesh.scale.setScalar(0.5 + (0.5 - blast.life) * 11);
      blast.mesh.material.opacity = Math.max(0, blast.life * 1.2);
      if (blast.life <= 0) blast.mesh.visible = false;
    }
    for (let i = grenades.length - 1; i >= 0; i -= 1) {
      const g = grenades[i];
      g.fuse -= dt;
      g.velocity.y -= 14 * dt;
      g.mesh.position.addScaledVector(g.velocity, dt);
      if (g.mesh.position.y < 0.1) {
        g.mesh.position.y = 0.1;
        g.velocity.y *= -0.4;
        g.velocity.x *= 0.6;
        g.velocity.z *= 0.6;
      }
      if (g.fuse <= 0) {
        explode(g.mesh.position.clone(), time);
        scene.remove(g.mesh);
        grenades.splice(i, 1);
      }
    }
  }

  function reset() {
    for (const g of grenades) scene.remove(g.mesh);
    grenades.length = 0;
    for (const tracer of tracers) tracer.mesh.visible = false;
    for (const blast of blasts) blast.mesh.visible = false;
  }

  return { shoot, botFire, throwGrenade, step, reset };
}
