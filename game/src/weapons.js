// Arctic Relay — the armoury. Three hitscan weapons plus a cryo grenade, each with its
// own view model, magazine, damage, spread and price. The module owns the numbers and
// the models; main.js owns the ray, combat.js owns the damage.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  rifle: {
    id: 'rifle', name: 'Aurora Rifle', price: 0, magSize: 30, reserveStart: 90,
    fireGap: 0.105, reloadTime: 1.9, damage: 34, headDamage: 100,
    spreadStill: 0.0022, spreadMoving: 0.026, auto: true, zoom: 1,
  },
  smg: {
    id: 'smg', name: 'Frostbite SMG', price: 900, magSize: 32, reserveStart: 128,
    fireGap: 0.072, reloadTime: 1.5, damage: 22, headDamage: 66,
    spreadStill: 0.004, spreadMoving: 0.034, auto: true, zoom: 1,
  },
  sniper: {
    id: 'sniper', name: 'Long Night', price: 1800, magSize: 5, reserveStart: 15,
    fireGap: 1.15, reloadTime: 2.9, damage: 95, headDamage: 250,
    spreadStill: 0.0006, spreadMoving: 0.02, auto: false, zoom: 2.4,
    // Aiming the Long Night switches on its thermal scope: Drifters flare
    // orange through fog and smoke, the counterplay to a whiteout gust.
    thermal: true,
  },
};
export const GRENADE_PRICE = 250;
export const SMOKE_PRICE = 200;
export const ARMOR_PRICE = 400;

function buildViewModel(def, palette) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.steelDark), roughness: 0.65, metalness: 0.3 });
  const bodyMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.ink), roughness: 0.45, metalness: 0.4 });
  const accentMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.accent), roughness: 0.4, metalness: 0.2, emissive: new THREE.Color(palette.accent), emissiveIntensity: 0.35 });
  const model = new THREE.Group();
  if (def.id === 'rifle') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.44), bodyMat);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.42), grip);
    barrel.position.set(0, 0.03, -0.4);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.24), grip);
    stock.position.set(0, -0.02, 0.32);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.045, 0.09), accentMat);
    sight.position.set(0, 0.08, -0.05);
    model.add(receiver, barrel, stock, sight);
  } else if (def.id === 'smg') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.3), bodyMat);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.26), grip);
    barrel.position.set(0, 0.02, -0.27);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.09), grip);
    mag.position.set(0, -0.14, 0.02);
    mag.rotation.x = 0.18;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.16), grip);
    stock.position.set(0, -0.01, 0.22);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.02, 0.2), accentMat);
    stripe.position.set(0, 0.03, -0.02);
    model.add(receiver, barrel, mag, stock, stripe);
  } else {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.5), bodyMat);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 10), grip);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, -0.5);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 12), grip);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.1, -0.05);
    const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.03), accentMat);
    bolt.position.set(0.06, 0.03, 0.08);
    const bipod = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), grip);
    bipod.position.set(0, -0.12, -0.3);
    model.add(receiver, barrel, scope, bolt, bipod);
  }
  // Slim and low, clear of the sightline: the view model frames the aim
  // instead of covering a quarter of the screen.
  model.position.set(0.29, -0.28, -0.6);
  model.scale.setScalar(0.72);
  return model;
}

export function createArsenal(camera) {
  const models = {};
  for (const def of Object.values(WEAPONS)) {
    const model = buildViewModel(def, PALETTE);
    model.visible = false;
    camera.add(model);
    models[def.id] = model;
  }
  models.rifle.visible = true;

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.26, 0.26),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.tracer), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.29, -0.25, -1.14);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.tracer), 0, 6);
  flashLight.position.set(0.29, -0.23, -0.8);
  camera.add(flashLight);

  const owned = { rifle: true, smg: false, sniper: false };
  const ammo = {};
  for (const def of Object.values(WEAPONS)) ammo[def.id] = { mag: def.magSize, reserve: def.reserveStart };
  const state = {
    current: 'rifle', cooldown: 0, reloadLeft: 0, flash: 0, kick: 0,
    grenades: { cryo: 0, smoke: 0 }, switching: 0,
  };

  function def() {
    return WEAPONS[state.current];
  }

  function step(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flash = Math.max(0, state.flash - dt);
    state.switching = Math.max(0, state.switching - dt);
    state.kick += (0 - state.kick) * Math.min(1, dt * 13);
    const model = models[state.current];
    model.position.z = -0.6 + state.kick;
    model.position.y = -0.28 + state.kick * 0.4;
    model.rotation.x = state.kick * 2.4;
    flash.visible = state.flash > 0;
    flash.rotation.z = state.flash * 28;
    flashLight.intensity = state.flash > 0 ? 20 : 0;
    if (state.reloadLeft > 0) {
      state.reloadLeft = Math.max(0, state.reloadLeft - dt);
      const d = def();
      model.rotation.x = -0.6 * Math.min(1, (d.reloadTime - state.reloadLeft) * 2);
      if (state.reloadLeft === 0) {
        const slot = ammo[state.current];
        const need = d.magSize - slot.mag;
        const take = Math.min(need, slot.reserve);
        slot.mag += take;
        slot.reserve -= take;
      }
    }
  }

  function ready() {
    const slot = ammo[state.current];
    return slot.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0 && state.switching === 0;
  }

  function pullTrigger() {
    const d = def();
    state.cooldown = d.fireGap;
    state.flash = 0.06;
    state.kick = d.id === 'sniper' ? 0.11 : 0.05;
  }

  function takeRound() {
    const slot = ammo[state.current];
    if (slot.mag <= 0) return false;
    slot.mag -= 1;
    return true;
  }

  function reload() {
    const d = def();
    const slot = ammo[state.current];
    if (state.reloadLeft > 0 || slot.mag === d.magSize || slot.reserve === 0) return false;
    state.reloadLeft = d.reloadTime;
    return true;
  }

  function spread(speed, aiming) {
    const d = def();
    const moving = Math.min(1, speed / 5.4);
    let value = d.spreadStill + moving * d.spreadMoving;
    if (aiming) value *= 0.45;
    return value;
  }

  function switchTo(id) {
    if (!owned[id] || id === state.current || state.reloadLeft > 0) return false;
    models[state.current].visible = false;
    state.current = id;
    models[id].visible = true;
    state.switching = 0.35;
    state.cooldown = Math.max(state.cooldown, 0.2);
    return true;
  }

  function buy(id, money) {
    const d = WEAPONS[id];
    if (!d || owned[id] || money < d.price) return null;
    owned[id] = true;
    return d.price;
  }

  function buyGrenade(money, type = 'cryo') {
    const price = type === 'smoke' ? SMOKE_PRICE : GRENADE_PRICE;
    if (money < price) return null;
    state.grenades[type] += 1;
    return price;
  }

  function refill() {
    for (const d of Object.values(WEAPONS)) {
      ammo[d.id].mag = d.magSize;
      ammo[d.id].reserve = d.reserveStart;
    }
    state.cooldown = 0;
    state.reloadLeft = 0;
    state.flash = 0;
    state.kick = 0;
  }

  function useGrenade(type = 'cryo') {
    if (state.grenades[type] <= 0) return false;
    state.grenades[type] -= 1;
    return true;
  }

  function grenadeText() {
    const parts = [];
    if (state.grenades.cryo > 0) parts.push(`CRYO ${state.grenades.cryo}`);
    if (state.grenades.smoke > 0) parts.push(`SMOKE ${state.grenades.smoke}`);
    return parts.join(' · ');
  }

  return {
    state, owned, ammo, WEAPONS,
    step, ready, pullTrigger, takeRound, reload, spread, switchTo,
    buy, buyGrenade, refill, useGrenade, grenadeText,
    currentDef: def,
    mag() { return ammo[state.current].mag; },
    reserve() { return ammo[state.current].reserve; },
  };
}
