// Arctic Relay — boot and the one loop: a fixed 60 Hz simulation feeding a render at
// the display's rate. ?shot=start|play|plant|end with &seed=N sets up a deterministic
// frame for a capture, renders it twice, then freezes it and sets window.__shotReady.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createState, PHASE, WIN } from './state.js';
import { createMap } from './map.js';
import { createPlayer } from './player.js';
import { createInput } from './input.js';
import { createArsenal, WEAPONS, GRENADE_PRICE, ARMOR_PRICE } from './weapons.js';
import { createBots } from './bots.js';
import { createCombat } from './combat.js';
import { createRounds } from './rounds.js';
import { createHud } from './hud.js';
import { createAudio } from './audio.js';

const FIXED_STEP = 1 / 60;
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '7', 10) || 7;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(new THREE.Color('#16283c'), 34, 110);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 260);
scene.add(camera);

const state = createState();
const map = createMap(scene, random);
const player = createPlayer(map.colliders);
const arsenal = createArsenal(camera);
const audio = createAudio();
const hud = createHud();
const bots = createBots(scene, map, random);
const combat = createCombat(scene, map, bots, player, arsenal, audio, hud, state);
const rounds = createRounds(state, map, bots, player, arsenal, combat, hud, audio);
const input = createInput(renderer.domElement, onLockChange);

// The player's hitbox: an invisible box the bots' raycasts test against.
const playerHitMesh = new THREE.Mesh(
  new THREE.BoxGeometry(0.72, 1.74, 0.72),
  new THREE.MeshBasicMaterial({ visible: false }),
);
playerHitMesh.position.set(0, 0.87, 13.5);
scene.add(playerHitMesh);

const body = player.state;
let elapsed = 0;
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();
let firedLastFrame = false;
let targetFov = 75;

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
  if (Math.abs(camera.fov - targetFov) > 0.05) {
    camera.fov += (targetFov - camera.fov) * 0.2;
    camera.updateProjectionMatrix();
  }
}

function syncHitbox() {
  playerHitMesh.position.set(body.position.x, body.position.y + body.height / 2, body.position.z);
}

function syncHud() {
  const def = arsenal.currentDef();
  hud.setHealth(body.health, body.armor);
  hud.setAmmo(arsenal.mag(), arsenal.reserve(), def.name, arsenal.state.grenades);
  hud.setMoney(state.money);
  hud.setScore(state.playerRounds, state.botRounds);
  hud.setRound(state.round, state.maxRounds);
  if (state.phase === PHASE.LIVE) {
    if (state.charge === 'planted') {
      if (bots.anyDefusing()) hud.setPlant(state.defuseProgress, 'defuse');
      else hud.setDetonate(state.detonateLeft);
    } else if (state.charge === 'carried' && body.position.distanceTo(map.plantSite) < 2.8) {
      hud.setPlant(state.chargeProgress, 'plant');
    } else {
      hud.setPlant(0, null);
    }
  } else if (state.phase !== PHASE.BUY) {
    hud.setPlant(0, null);
  }
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
    audio.unlock();
  } else if (state.phase === PHASE.LIVE) {
    hud.showOverlay('paused', state);
  }
}

hud.onPlay(() => {
  if (shot) return;
  audio.unlock();
  if (state.phase === PHASE.MENU || state.phase === PHASE.MATCH_END) {
    rounds.startMatch();
  }
  input.requestLock();
});

hud.onBuy((id) => {
  if (state.phase !== PHASE.BUY) return;
  if (id === 'grenade') {
    const cost = arsenal.buyGrenade(state.money);
    if (cost !== null) {
      state.money -= cost;
      audio.buy();
    }
  } else if (id === 'armor') {
    if (state.money >= ARMOR_PRICE && body.armor < 100) {
      state.money -= ARMOR_PRICE;
      body.armor = 100;
      audio.buy();
    }
  } else {
    const cost = arsenal.buy(id, state.money);
    if (cost !== null) {
      state.money -= cost;
      audio.buy();
      hud.pushFeed(`${WEAPONS[id].name} purchased`);
    }
  }
  hud.setMoney(state.money);
  hud.updateBuy({ money: state.money, owned: arsenal.owned });
});

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function tryFire() {
  const def = arsenal.currentDef();
  const wantFire = input.state.firing && (def.auto || !firedLastFrame);
  firedLastFrame = input.state.firing;
  if (!wantFire || !arsenal.ready()) return;
  if (!combat.shoot(camera, arsenal.spread(player.groundSpeed(), input.state.aiming), random)) return;
  player.recoil(def.id === 'sniper' ? 0.035 : 0.01 + random() * 0.004, (random() * 2 - 1) * 0.004);
  syncHud();
}

function step(dt) {
  elapsed += dt;
  if (state.phase === PHASE.LIVE || state.phase === PHASE.BUY) {
    player.step(dt, input.state.keys, input.state.aiming);
  }
  arsenal.step(dt);
  bots.step(dt, elapsed, {
    player: body,
    playerSpeed: player.groundSpeed(),
    state,
    onBotFire: (bot, spread) => combat.botFire(bot, spread, random, playerHitMesh),
  });
  combat.step(dt, elapsed);
  map.step(dt, elapsed);
  rounds.step(dt, input, elapsed);
  syncHitbox();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    player.look(look.x, look.y);
    if (state.phase === PHASE.LIVE) {
      if (input.wasPressed('Digit1')) arsenal.switchTo('rifle');
      if (input.wasPressed('Digit2')) arsenal.switchTo('smg');
      if (input.wasPressed('Digit3')) arsenal.switchTo('sniper');
      if (input.wasPressed('KeyR') && arsenal.reload()) audio.reload();
      if (input.wasPressed('KeyG') && arsenal.useGrenade()) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        combat.throwGrenade(camera.position.clone().add(dir.clone().multiplyScalar(0.5)), dir);
        syncHud();
      }
      tryFire();
    }
    targetFov = state.phase === PHASE.LIVE && input.state.aiming && arsenal.currentDef().id === 'sniper'
      ? 75 / arsenal.currentDef().zoom : 75;
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
    syncHud();
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

function runShot(name) {
  hud.hideOverlay();
  hud.hideBuy();
  if (name === 'start') {
    body.position.set(0.6, 0, 15.5);
    body.yaw = 0.12;
    body.pitch = 0.02;
    settle(20);
    aimAt(new THREE.Vector3(0, 2.2, -15.5));
    hud.setHealth(100, 0);
    hud.setAmmo(30, 90, 'Aurora Rifle', 0);
    hud.setMoney(800);
    hud.setScore(0, 0);
    hud.setRound(1, 5);
    hud.setTimer(100, false);
    hud.showOverlay('start', state);
  } else if (name === 'play') {
    rounds.startMatch();
    rounds.startLive();
    bots.bots[0].position.set(-4.5, 0, -6);
    bots.bots[1].position.set(5.5, 0, -9);
    bots.bots[2].position.set(-8, 0, -11);
    body.position.set(-1.5, 0, 4.5);
    settle(20);
    aimAt(bots.aimPoint(0));
    combat.shoot(camera, 0, random);
    settle(10);
    combat.shoot(camera, 0, random);
    settle(10);
    combat.shoot(camera, 0, random);
    aimAt(bots.aimPoint(1));
    syncHud();
  } else if (name === 'plant') {
    rounds.startMatch();
    rounds.startLive();
    state.charge = 'planted';
    state.detonateLeft = 17;
    bots.bots[0].position.set(3.5, 0, -7.5);
    bots.bots[0].mode = 'converge';
    bots.bots[1].position.set(-4, 0, -12);
    body.position.set(1.8, 0, -5.2);
    settle(20);
    aimAt(new THREE.Vector3(0, 1.2, -9.6));
    syncHud();
  } else {
    state.phase = PHASE.MATCH_END;
    state.round = 4;
    state.playerRounds = 3;
    state.botRounds = 1;
    state.kills = 7;
    state.matchWinner = WIN.PLAYER;
    body.position.set(-2, 0, 8);
    settle(20);
    aimAt(new THREE.Vector3(0, 2.5, -15.5));
    hud.setScore(3, 1);
    hud.setRound(4, 5);
    hud.showOverlay('matchEnd', state);
  }
  syncCamera();
  syncHud();
  paintTwiceThenReady();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

hud.showOverlay('start', state);
syncCamera();
syncHud();
if (shot) runShot(shot);
else requestAnimationFrame(frame);
