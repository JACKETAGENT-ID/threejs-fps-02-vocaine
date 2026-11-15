// Arctic Relay — the Drifter raiders, v2. Four bots, four archetypes with genuinely
// different behaviour, so the round reads as a team to outplay rather than four
// copies of one enemy:
//   Sable the Holder — slow, patient, long accurate bursts from a held angle.
//   Rime the Sniper — one precise heavy shot, then a long repositioning pause.
//   Gale the Rusher — fast, close-range, and he hunts the sound of your shots.
//   Frost the Flanker — works the lane opposite to yours and cuts across mid when
// the charge is planted, so holding one lane never holds the whole map.
// They patrol, hold angles, engage on sight, and when the charge is planted they
// converge on the pad to defuse it. A smoke cloud blocks their sight, and a cryo
// grenade still slows them down.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const NAMES = ['Sable', 'Rime', 'Gale', 'Frost'];
const ARCHETYPES = {
  holder: { role: 'holder', speed: 2.4, range: 48, burstMin: 4, burstMax: 6, fireGap: 1.3, spreadMul: 0.7, damage: 11, hold: 2.4 },
  sniper: { role: 'sniper', speed: 2.0, range: 55, burstMin: 1, burstMax: 1, fireGap: 2.4, spreadMul: 0.45, damage: 26, hold: 3.2 },
  rusher: { role: 'rusher', speed: 4.3, range: 26, burstMin: 5, burstMax: 7, fireGap: 0.8, spreadMul: 1.5, damage: 7, hold: 0.3 },
  flanker: { role: 'flanker', speed: 3.4, range: 38, burstMin: 3, burstMax: 5, fireGap: 1.0, spreadMul: 1.0, damage: 9, hold: 0.8 },
};
const ROLES = ['holder', 'sniper', 'rusher', 'flanker'];
const ROUTE_KEYS = ['west', 'east', 'mid', 'west'];
const HEALTH = 100;

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
  // Thermal signature: a heat bloom the Long Night's scope picks up. It is
  // invisible in normal light and flares orange through fog and smoke when
  // the player aims the thermal scope — the counterplay to whiteouts.
  const heatCanvas = document.createElement('canvas');
  heatCanvas.width = 32;
  heatCanvas.height = 32;
  const heatCtx = heatCanvas.getContext('2d');
  const heatGrad = heatCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  heatGrad.addColorStop(0, 'rgba(255, 140, 40, 0.95)');
  heatGrad.addColorStop(0.45, 'rgba(255, 80, 20, 0.55)');
  heatGrad.addColorStop(1, 'rgba(255, 60, 10, 0)');
  heatCtx.fillStyle = heatGrad;
  heatCtx.fillRect(0, 0, 32, 32);
  const heatTex = new THREE.CanvasTexture(heatCanvas);
  const heat = new THREE.Sprite(new THREE.SpriteMaterial({
    map: heatTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
    // Walls still hide a heat bloom (depth test on); smoke and fog do not —
    // smoke writes no depth and this material ignores fog.
    depthWrite: false, depthTest: true, fog: false,
  }));
  heat.scale.set(1.7, 2.1, 1);
  heat.position.y = 1.15;
  group.add(heat);
  group.traverse((mesh) => {
    if (mesh.isMesh) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });
  scene.add(group);
  return { group, torso, head, heat, visor, chest };
}

export function createBots(scene, map, random) {
  const bots = [];
  const raycaster = new THREE.Raycaster();
  raycaster.far = 60;
  const probe = new THREE.Box3();
  const tmp = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();
  const tmpEye = new THREE.Vector3();
  let smokeBlocks = null;

  for (let i = 0; i < 4; i += 1) {
    const meshes = buildBotMesh(scene, i);
    const bot = {
      id: i, name: NAMES[i], meshes, routeKey: ROUTE_KEYS[i], routeIndex: i % 2,
      profile: ARCHETYPES[ROLES[i]],
      position: map.botSpawns[i].clone(), yaw: 0, health: HEALTH, alive: true,
      mode: 'patrol', target: new THREE.Vector3(), fireTimer: 1 + random() * 1.5,
      burstLeft: 0, burstTimer: 0, slowUntil: -1, fall: 0, defusing: false,
      holdTimer: 0, convergeVia: null,
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

  function canSee(bot, playerPos, shootables, sightMul = 1) {
    tmp.copy(playerPos);
    tmp.y += 1.2;
    tmpEye.set(bot.position.x, bot.position.y + 1.55, bot.position.z);
    const dist = tmp.distanceTo(tmpEye);
    // A whiteout gust shortens every sightline — bots included.
    if (dist > bot.profile.range * sightMul) return false;
    tmpDir.copy(tmp).sub(tmpEye).normalize();
    raycaster.set(tmpEye, tmpDir);
    raycaster.far = dist;
    const hit = raycaster.intersectObjects(shootables, false)[0];
    if (hit) return false;
    // A smoke cloud between eye and target breaks the sightline.
    if (smokeBlocks && smokeBlocks(tmpEye, tmp)) return false;
    return true;
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
      bot.holdTimer = 0;
      bot.convergeVia = null;
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
    smokeBlocks = ctx.smokeBlocks || null;
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
      const speed = bot.profile.speed * (slowed ? 0.45 : 1);
      const player = ctx.player;
      const playerAlive = player.alive;
      const chargePlanted = ctx.state.charge === 'planted';
      const heardShot = playerAlive && ctx.state.phase === 'live'
        && (time - (ctx.state.lastShotTime ?? -99)) < 3;

      // The flanker works the lane opposite to the player, so one held lane
      // never covers the whole station.
      if (bot.profile.role === 'flanker' && playerAlive && bot.mode === 'patrol') {
        bot.routeKey = player.position.x >= 0 ? 'west' : 'east';
      }

      // Decide the mode: planted charge pulls every bot to the pad; a rusher
      // hunts the sound of a fresh shot; sight means a fight.
      if (chargePlanted) {
        bot.mode = bot.position.distanceTo(map.plantSite) < 3.2 ? 'defuse' : 'converge';
      } else if (bot.profile.role === 'rusher' && heardShot) {
        bot.mode = 'hunt';
      } else if (playerAlive && ctx.state.phase === 'live' && canSee(bot, player.position, map.shootables, ctx.stormSight ?? 1)) {
        bot.mode = 'engage';
      } else if (bot.mode === 'engage' || bot.mode === 'hunt') {
        bot.mode = 'patrol';
      }
      bot.defusing = false;

      if (bot.mode === 'patrol') {
        // Holders and the sniper pause at each waypoint and watch the lane.
        if (bot.holdTimer > 0) {
          bot.holdTimer -= dt;
        } else {
          const route = map.routes[bot.routeKey];
          const dest = route[bot.routeIndex % route.length];
          if (moveToward(bot, dest, dt, speed)) {
            bot.routeIndex += 1;
            bot.holdTimer = bot.profile.hold;
          }
        }
      } else if (bot.mode === 'hunt') {
        moveToward(bot, player.position, dt, speed * 1.15);
      } else if (bot.mode === 'converge') {
        // The flanker cuts across mid on the way to the pad, so the defence
        // cannot just watch the direct lanes.
        if (bot.profile.role === 'flanker' && bot.convergeVia === null) {
          bot.convergeVia = map.routes.mid[2].clone();
        }
        if (bot.convergeVia) {
          if (moveToward(bot, bot.convergeVia, dt, speed * 1.25)) bot.convergeVia = null;
        } else {
          moveToward(bot, map.plantSite, dt, speed * 1.25);
        }
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

        // Burst fire with range- and movement-based inaccuracy, tuned per role.
        bot.fireTimer -= dt;
        if (bot.burstLeft > 0) {
          bot.burstTimer -= dt;
          if (bot.burstTimer <= 0) {
            bot.burstTimer = 0.13;
            bot.burstLeft -= 1;
            const spread = (0.02 + dist * 0.0011 + (slowed ? 0.02 : 0) + ctx.playerSpeed * 0.002)
              * bot.profile.spreadMul;
            ctx.onBotFire(bot, spread, bot.profile.damage);
          }
        } else if (bot.fireTimer <= 0 && dist < bot.profile.range) {
          bot.burstLeft = bot.profile.burstMin + Math.floor(random() * (bot.profile.burstMax - bot.profile.burstMin + 1));
          bot.burstTimer = 0;
          bot.fireTimer = bot.profile.fireGap * (0.8 + random() * 0.5);
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

  function setThermal(on) {
    for (const bot of bots) {
      const { heat, visor, chest } = bot.meshes;
      heat.material.opacity = on && bot.alive ? 0.85 : 0;
      visor.emissiveIntensity = on ? 3.2 : 1.5;
      chest.emissiveIntensity = on ? 2.6 : 1.5;
    }
  }

  return {
    bots, step, damage, reset, aliveCount, hitMeshes, aimPoint, setThermal,
    anyDefusing() {
      return bots.some((bot) => bot.alive && bot.defusing);
    },
  };
}
