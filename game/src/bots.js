// Arctic Relay — the Drifter raiders. Four bots with a real state machine: they patrol
// the station lanes, hold angles, engage on sight, and when the charge is planted they
// converge on the pad to defuse it. They shoot with bursts whose accuracy falls off with
// range and with the player's movement, and a cryo grenade slows them down.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const NAMES = ['Sable', 'Rime', 'Gale', 'Frost'];
const ROUTE_KEYS = ['west', 'east', 'mid', 'west'];
const HEALTH = 100;
const WALK = 3.1;
const ENGAGE_RANGE = 42;
const BURST_MIN = 3;
const BURST_MAX = 5;

function buildBotMesh(scene, index) {
  const steel = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.steelDark), roughness: 0.7, metalness: 0.35 });
  const cloth = new THREE.MeshStandardMaterial({ color: new THREE.Color('#4a3f35'), roughness: 0.95, metalness: 0 });
  const visor = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.danger), emissive: new THREE.Color(PALETTE.danger), emissiveIntensity: 1.5, roughness: 0.3 });
  const group = new THREE.Group();

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.78, 0.18), cloth);
  legL.position.set(-0.11, 0.39, 0);
  const legR = legL.clone();
  legR.position.x = 0.11;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.32), steel);
  torso.position.y = 1.14;
  torso.userData.part = 'torso';
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.34), visor);
  chest.position.y = 1.32;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 12), cloth);
  head.position.y = 1.66;
  head.userData.part = 'head';
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), visor);
  eye.position.set(0, 1.68, 0.15);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.62), steel);
  gun.position.set(0.3, 1.18, -0.18);
  group.add(legL, legR, torso, chest, head, eye, gun);
  group.traverse((mesh) => {
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  scene.add(group);
  return { group, torso, head };
}

export function createBots(scene, map, random) {
  const bots = [];
  const raycaster = new THREE.Raycaster();
  raycaster.far = 60;
  const probe = new THREE.Box3();
  const tmp = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  for (let i = 0; i < 4; i += 1) {
    const meshes = buildBotMesh(scene, i);
    const bot = {
      id: i, name: NAMES[i], meshes, routeKey: ROUTE_KEYS[i], routeIndex: i % 2,
      position: map.botSpawns[i].clone(), yaw: 0, health: HEALTH, alive: true,
      mode: 'patrol', target: new THREE.Vector3(), fireTimer: 1 + random() * 1.5,
      burstLeft: 0, burstTimer: 0, slowUntil: -1, fall: 0, defusing: false,
      strafeDir: random() > 0.5 ? 1 : -1, strafeTimer: 0,
    };
    meshes.torso.userData.bot = bot;
    meshes.head.userData.bot = bot;
    bots.push(bot);
  }

  function blocked(x, z) {
    probe.min.set(x - 0.34, 0.05, z - 0.34);
    probe.max.set(x + 0.34, 1.7, z + 0.34);
    for (const box of map.colliders) if (probe.intersectsBox(box)) return true;
    return false;
  }

  function moveToward(bot, dest, dt, speed) {
    tmp.copy(dest).sub(bot.position);
    tmp.y = 0;
    const dist = tmp.length();
    if (dist < 0.15) return true;
    tmp.normalize();
    const step = speed * dt;
    const nx = bot.position.x + tmp.x * step;
    if (!blocked(nx, bot.position.z)) bot.position.x = nx;
    const nz = bot.position.z + tmp.z * step;
    if (!blocked(bot.position.x, nz)) bot.position.z = nz;
    bot.yaw = Math.atan2(tmp.x, tmp.z);
    return dist < 0.4;
  }

  function canSee(bot, playerPos, shootables) {
    tmp.copy(playerPos);
    tmp.y += 1.2;
    tmpDir.copy(tmp).sub(bot.position).setY(tmpDir.y + 0);
    const eye = new THREE.Vector3(bot.position.x, bot.position.y + 1.55, bot.position.z);
    const dist = tmp.distanceTo(eye);
    if (dist > ENGAGE_RANGE) return false;
    tmpDir.copy(tmp).sub(eye).normalize();
    raycaster.set(eye, tmpDir);
    raycaster.far = dist;
    const hit = raycaster.intersectObjects(shootables, false)[0];
    return !hit;
  }

  function reset() {
    for (let i = 0; i < bots.length; i += 1) {
      const bot = bots[i];
      bot.position.copy(map.botSpawns[i]);
      bot.health = HEALTH;
      bot.alive = true;
      bot.mode = 'patrol';
      bot.routeIndex = i % 2;
      bot.fireTimer = 1 + random() * 1.5;
      bot.burstLeft = 0;
      bot.burstTimer = 0;
      bot.slowUntil = -1;
      bot.fall = 0;
      bot.defusing = false;
      bot.meshes.group.rotation.set(0, 0, 0);
      bot.meshes.group.position.copy(bot.position);
      bot.meshes.group.visible = true;
    }
  }

  function damage(bot, amount) {
    if (!bot.alive) return false;
    bot.health -= amount;
    if (bot.health > 0) return false;
    bot.health = 0;
    bot.alive = false;
    bot.fall = 0;
    bot.defusing = false;
    return true;
  }

  function aliveCount() {
    return bots.filter((bot) => bot.alive).length;
  }

  function step(dt, time, ctx) {
    for (const bot of bots) {
      const mesh = bot.meshes.group;
      if (!bot.alive) {
        bot.fall = Math.min(1, bot.fall + dt / 0.45);
        mesh.rotation.x = -bot.fall * 1.5;
        mesh.position.y = -bot.fall * 0.1;
        continue;
      }
      mesh.rotation.x = 0;
      mesh.position.y = 0;
      const slowed = time < bot.slowUntil;
      const speed = WALK * (slowed ? 0.45 : 1);
      const player = ctx.player;
      const playerAlive = player.alive;
      const chargePlanted = ctx.state.charge === 'planted';

      // Decide the mode: planted charge pulls every bot to the pad.
      if (chargePlanted) {
        bot.mode = bot.position.distanceTo(map.plantSite) < 3.2 ? 'defuse' : 'converge';
      } else if (playerAlive && ctx.state.phase === 'live' && canSee(bot, player.position, map.shootables)) {
        bot.mode = 'engage';
      } else if (bot.mode === 'engage') {
        bot.mode = 'patrol';
      }
      bot.defusing = false;

      if (bot.mode === 'patrol') {
        const route = map.routes[bot.routeKey];
        const dest = route[bot.routeIndex % route.length];
        if (moveToward(bot, dest, dt, speed)) bot.routeIndex += 1;
      } else if (bot.mode === 'converge') {
        moveToward(bot, map.plantSite, dt, speed * 1.25);
      } else if (bot.mode === 'defuse') {
        bot.defusing = true;
        bot.yaw = Math.atan2(map.plantSite.x - bot.position.x, map.plantSite.z - bot.position.z);
      } else if (bot.mode === 'engage' && playerAlive) {
        // Face the player, strafe sideways, keep a fighting distance.
        const dx = player.position.x - bot.position.x;
        const dz = player.position.z - bot.position.z;
        const dist = Math.hypot(dx, dz) || 1;
        bot.yaw = Math.atan2(dx, dz);
        bot.strafeTimer -= dt;
        if (bot.strafeTimer <= 0) {
          bot.strafeDir *= -1;
          bot.strafeTimer = 0.7 + random() * 0.9;
        }
        const px = -dz / dist * bot.strafeDir;
        const pz = dx / dist * bot.strafeDir;
        const want = dist > 20 ? 1 : dist < 7 ? -1 : 0;
        const mx = px * 0.8 + (dx / dist) * want;
        const mz = pz * 0.8 + (dz / dist) * want;
        const nx = bot.position.x + mx * speed * dt;
        if (!blocked(nx, bot.position.z)) bot.position.x = nx;
        const nz = bot.position.z + mz * speed * dt;
        if (!blocked(bot.position.x, nz)) bot.position.z = nz;

        // Burst fire with range- and movement-based inaccuracy.
        bot.fireTimer -= dt;
        if (bot.burstLeft > 0) {
          bot.burstTimer -= dt;
          if (bot.burstTimer <= 0) {
            bot.burstTimer = 0.13;
            bot.burstLeft -= 1;
            const spread = 0.02 + dist * 0.0011 + (slowed ? 0.02 : 0) + ctx.playerSpeed * 0.002;
            ctx.onBotFire(bot, spread);
          }
        } else if (bot.fireTimer <= 0 && dist < ENGAGE_RANGE) {
          bot.burstLeft = BURST_MIN + Math.floor(random() * (BURST_MAX - BURST_MIN + 1));
          bot.burstTimer = 0;
          bot.fireTimer = 0.9 + random() * 0.7;
        }
      }

      mesh.position.set(bot.position.x, bot.position.y, bot.position.z);
      mesh.rotation.y = bot.yaw;
    }
  }

  function hitMeshes() {
    const list = [];
    for (const bot of bots) list.push(bot.meshes.torso, bot.meshes.head);
    return list;
  }

  function aimPoint(index) {
    const bot = bots[index % bots.length];
    return new THREE.Vector3(bot.position.x, bot.position.y + 1.2, bot.position.z);
  }

  return {
    bots, step, damage, reset, aliveCount, hitMeshes, aimPoint,
    anyDefusing() {
      return bots.some((bot) => bot.alive && bot.defusing);
    },
  };
}
