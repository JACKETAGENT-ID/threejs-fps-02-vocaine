// Arctic Relay — Relay Station K-7. A snowy plateau ringed by ice ridges: the Relay
// Dome and its plant pad at the north end, Hab and Lab modules on the west and east
// lanes, a comms tower mid-map, crates, drums and ice walls for cover. Everything is
// plain geometry and lights — no models, no textures, no network.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

const GROUND_W = 46;
const GROUND_D = 42;

export function createMap(scene, random) {
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const shootables = [];

  const mats = {
    snow: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.snow), roughness: 0.96, metalness: 0 }),
    snowShadow: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.snowShadow), roughness: 0.95, metalness: 0 }),
    ice: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ice), roughness: 0.32, metalness: 0.05, transparent: true, opacity: 0.86 }),
    deepIce: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.deepIce), roughness: 0.5, metalness: 0.08 }),
    steel: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.steel), roughness: 0.62, metalness: 0.45 }),
    dome: new THREE.MeshStandardMaterial({ color: new THREE.Color('#6b7f95'), roughness: 0.55, metalness: 0.35 }),
    steelDark: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.steelDark), roughness: 0.7, metalness: 0.4 }),
    hab: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hab), roughness: 0.85, metalness: 0.05 }),
    glow: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.habGlow), emissive: new THREE.Color(PALETTE.habGlow), emissiveIntensity: 1.6, roughness: 0.4 }),
    accent: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), emissive: new THREE.Color(PALETTE.accent), emissiveIntensity: 1.2, roughness: 0.4 }),
    danger: new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.danger), emissive: new THREE.Color(PALETTE.danger), emissiveIntensity: 1.4, roughness: 0.4 }),
  };

  function box(w, h, d, x, y, z, mat, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[mat]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
      shootables.push(mesh);
    }
    return mesh;
  }

  function cylinder(rt, rb, h, x, y, z, mat, segments = 18, collide = true) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), mats[mat]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
      shootables.push(mesh);
    }
    return mesh;
  }

  // Snow field, ringed by ice ridges so the player never leaves the station.
  box(GROUND_W + 1, 0.4, GROUND_D + 1, 0, -0.2, 0, 'snow');
  box(1.4, 3.4, GROUND_D, -GROUND_W / 2 - 0.5, 1.7, 0, 'deepIce');
  box(1.4, 3.4, GROUND_D, GROUND_W / 2 + 0.5, 1.7, 0, 'deepIce');
  box(GROUND_W, 3.4, 1.4, 0, 1.7, -GROUND_D / 2 - 0.5, 'deepIce');
  box(GROUND_W, 3.4, 1.4, 0, 1.7, GROUND_D / 2 + 0.5, 'deepIce');

  // The Relay Dome: a steel half-sphere over the plant pad, north end.
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5.2, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), mats.dome);
  dome.position.set(0, 0, -15.5);
  dome.castShadow = true;
  dome.receiveShadow = true;
  group.add(dome);
  colliders.push(new THREE.Box3().setFromObject(dome));
  shootables.push(dome);
  const domeBand = new THREE.Mesh(new THREE.TorusGeometry(5.25, 0.09, 8, 40), mats.accent);
  domeBand.position.set(0, 0.9, -15.5);
  domeBand.rotation.x = Math.PI / 2;
  group.add(domeBand);

  // Plant pad: a marked circle in front of the dome.
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.12, 28), mats.steelDark);
  pad.position.set(0, 0.06, -9.6);
  pad.receiveShadow = true;
  group.add(pad);
  const padRing = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.07, 8, 40), mats.accent);
  padRing.position.set(0, 0.16, -9.6);
  padRing.rotation.x = Math.PI / 2;
  group.add(padRing);
  const beacon = cylinder(0.09, 0.14, 2.6, 0, 1.3, -9.6, 'steelDark');
  const beaconLight = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mats.accent);
  beaconLight.position.set(0, 2.75, -9.6);
  group.add(beaconLight);

  // Hab module, west lane: long block with warm lit windows and a door.
  box(4.2, 3.1, 11, -13.5, 1.55, -2, 'hab');
  box(4.4, 0.5, 11.4, -13.5, 3.25, -2, 'steelDark');
  box(0.12, 0.9, 2.6, -11.35, 1.7, -4.5, 'glow', false);
  box(0.12, 0.9, 2.6, -11.35, 1.7, 0.5, 'glow', false);
  box(0.12, 1.8, 1.1, -11.35, 0.9, -2, 'steelDark', false);

  // Lab module, east lane: pale block with an ice-glass skylight strip.
  box(4.4, 3.4, 9, 13.5, 1.7, -4, 'snowShadow');
  box(4.6, 0.4, 9.4, 13.5, 3.55, -4, 'steel');
  box(0.12, 0.8, 3.2, 11.25, 2.2, -4, 'ice', false);
  box(0.12, 1.8, 1.1, 11.25, 0.9, -4, 'steelDark', false);

  // Comms tower, mid-map: a mast with a blinking red eye.
  box(1.4, 8.6, 1.4, 5, 4.3, -7.5, 'steel');
  cylinder(0.06, 0.06, 3.4, 5, 10.2, -7.5, 'steelDark', 8, false);
  const towerEye = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), mats.danger);
  towerEye.position.set(5, 9.1, -7.5);
  group.add(towerEye);

  // Cover: crates, drums and ice walls along both lanes and mid.
  box(1.5, 1.5, 1.5, -6.5, 0.75, 2, 'steel');
  box(1.5, 1.5, 1.5, -6.5, 0.75, 3.6, 'steelDark');
  box(1.5, 1.5, 1.5, -5, 0.75, 2.8, 'hab');
  box(1.5, 1.5, 1.5, 7.5, 0.75, 1, 'steelDark');
  box(1.5, 1.5, 1.5, 7.5, 0.75, 2.6, 'steel');
  box(2.2, 1.1, 1.2, -2.5, 0.55, -5.5, 'steelDark');
  box(2.2, 1.1, 1.2, 3.2, 0.55, -13.2, 'hab');
  box(1.2, 2.4, 1.2, -9.5, 1.2, -8.5, 'ice');
  box(1.2, 2.4, 1.2, 9.8, 1.2, -9.5, 'ice');
  box(3.2, 1.0, 0.9, -0.5, 0.5, 6.5, 'snowShadow');
  box(3.2, 1.0, 0.9, -14.5, 0.5, 8.5, 'snowShadow');
  box(3.2, 1.0, 0.9, 14.5, 0.5, 7.5, 'snowShadow');
  cylinder(0.55, 0.55, 1.25, -3.5, 0.62, -1.5, 'danger');
  cylinder(0.55, 0.55, 1.25, 11, 0.62, 3.5, 'danger');
  cylinder(0.55, 0.55, 1.25, -11.5, 0.62, 5.5, 'steel');
  cylinder(0.55, 0.55, 1.25, 2.5, 0.62, -11.5, 'steel');

  // Snowdrifts: soft mounds the player wades through (visual only, no collider).
  const driftGeo = new THREE.SphereGeometry(1, 14, 10);
  const driftSpots = [
    [2.2, 0.32, -2, 4.5], [-8, 0.26, 7, 3.6], [10.5, 0.3, -12, 4.0],
    [-4, 0.24, -13, 3.2], [6, 0.28, 9, 3.8], [-16.5, 0.3, 3, 3.4], [16.5, 0.26, -1, 3.4],
  ];
  for (const [x, y, z, s] of driftSpots) {
    const drift = new THREE.Mesh(driftGeo, mats.snow);
    drift.scale.set(s, y, s * 0.7);
    drift.position.set(x, 0, z);
    drift.receiveShadow = true;
    group.add(drift);
  }

  // Sky: a huge gradient dome, stars, and three aurora ribbons that slowly wave.
  const skyGeo = new THREE.SphereGeometry(120, 24, 16);
  const skyColors = new Float32Array(skyGeo.attributes.position.count * 3);
  const top = new THREE.Color('#04101f');
  const mid = new THREE.Color('#0a2438');
  const low = new THREE.Color('#274b63');
  const tmpColor = new THREE.Color();
  for (let i = 0; i < skyGeo.attributes.position.count; i += 1) {
    const y = skyGeo.attributes.position.getY(i) / 120;
    if (y > 0.25) tmpColor.copy(mid).lerp(top, (y - 0.25) / 0.75);
    else tmpColor.copy(low).lerp(mid, Math.max(0, y + 0.1) / 0.35);
    skyColors[i * 3] = tmpColor.r;
    skyColors[i * 3 + 1] = tmpColor.g;
    skyColors[i * 3 + 2] = tmpColor.b;
  }
  skyGeo.setAttribute('color', new THREE.BufferAttribute(skyColors, 3));
  const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(sky);

  const starCount = 420;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const a = random() * Math.PI * 2;
    const e = 0.15 + random() * 1.35;
    const r = 110;
    starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
    starPos[i * 3 + 1] = Math.sin(e) * r;
    starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  // A soft round sprite, drawn once on a canvas, so snow and stars read as flakes
  // and points of light instead of squares.
  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = 32;
  spriteCanvas.height = 32;
  const spriteCtx = spriteCanvas.getContext('2d');
  const gradient = spriteCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  spriteCtx.fillStyle = gradient;
  spriteCtx.fillRect(0, 0, 32, 32);
  const sprite = new THREE.CanvasTexture(spriteCanvas);

  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: new THREE.Color(PALETTE.ink), size: 0.9, sizeAttenuation: false, fog: false, map: sprite, transparent: true, depthWrite: false }));
  scene.add(stars);

  const ribbons = [];
  const ribbonColors = [0x46e0b6, 0x59c8f5, 0x9be07a];
  for (let r = 0; r < 3; r += 1) {
    const geo = new THREE.PlaneGeometry(70, 9, 40, 1);
    const mat = new THREE.MeshBasicMaterial({
      color: ribbonColors[r], transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, depthWrite: false, fog: false,
    });
    const ribbon = new THREE.Mesh(geo, mat);
    ribbon.position.set(-20 + r * 20, 42 + r * 6, -70 - r * 8);
    ribbon.rotation.x = -0.5;
    ribbon.rotation.y = (r - 1) * 0.35;
    scene.add(ribbon);
    ribbons.push({ mesh: ribbon, base: geo.attributes.position.array.slice(), phase: r * 2.1 });
  }

  // Snowfall: 900 flakes drifting down inside the station bowl, wrapping around.
  const flakeCount = 900;
  const flakePos = new Float32Array(flakeCount * 3);
  const flakeSpeed = new Float32Array(flakeCount);
  for (let i = 0; i < flakeCount; i += 1) {
    flakePos[i * 3] = (random() * 2 - 1) * 24;
    flakePos[i * 3 + 1] = random() * 22;
    flakePos[i * 3 + 2] = (random() * 2 - 1) * 22;
    flakeSpeed[i] = 0.9 + random() * 1.6;
  }
  const flakeGeo = new THREE.BufferGeometry();
  flakeGeo.setAttribute('position', new THREE.BufferAttribute(flakePos, 3));
  const flakes = new THREE.Points(flakeGeo, new THREE.PointsMaterial({ color: new THREE.Color('#ffffff'), size: 0.14, transparent: true, opacity: 0.85, map: sprite, depthWrite: false }));
  scene.add(flakes);

  // Light: cold moonlight as the key, a soft sky fill, warm door lamps.
  const moon = new THREE.DirectionalLight(new THREE.Color('#bcd6f5'), 2.4);
  moon.position.set(-14, 26, 12);
  moon.target.position.set(0, 0, -4);
  moon.castShadow = true;
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.camera.left = -26;
  moon.shadow.camera.right = 26;
  moon.shadow.camera.top = 26;
  moon.shadow.camera.bottom = -26;
  moon.shadow.camera.far = 70;
  moon.shadow.bias = -0.0005;
  scene.add(moon, moon.target);
  scene.add(new THREE.HemisphereLight(new THREE.Color('#5f7fa8'), new THREE.Color('#1d2a3a'), 1.15));
  const habLamp = new THREE.PointLight(new THREE.Color(PALETTE.habGlow), 14, 12);
  habLamp.position.set(-10.6, 2.2, -2);
  scene.add(habLamp);
  const labLamp = new THREE.PointLight(new THREE.Color('#bcd6f5'), 10, 10);
  labLamp.position.set(10.6, 2.4, -4);
  scene.add(labLamp);

  // Routes the bots patrol, and the spawns both sides use.
  const routes = {
    west: [new THREE.Vector3(-13, 0, 8), new THREE.Vector3(-13, 0, -8), new THREE.Vector3(-6, 0, -12), new THREE.Vector3(-6, 0, 2)],
    east: [new THREE.Vector3(13, 0, 8), new THREE.Vector3(13, 0, -10), new THREE.Vector3(6, 0, -12), new THREE.Vector3(6, 0, 2)],
    mid: [new THREE.Vector3(0, 0, 6), new THREE.Vector3(0, 0, -6), new THREE.Vector3(5, 0, -12), new THREE.Vector3(-5, 0, -12)],
  };
  const playerSpawn = new THREE.Vector3(0, 0, 14.5);
  const botSpawns = [
    new THREE.Vector3(-6, 0, -13),
    new THREE.Vector3(6, 0, -13),
    new THREE.Vector3(-11, 0, -10),
    new THREE.Vector3(11, 0, -10),
  ];
  const plantSite = new THREE.Vector3(0, 0, -9.6);

  function step(dt, time) {
    for (const ribbon of ribbons) {
      const pos = ribbon.mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 1) {
        const bx = ribbon.base[i * 3];
        const by = ribbon.base[i * 3 + 1];
        pos.setY(i, by + Math.sin(time * 0.55 + bx * 0.09 + ribbon.phase) * 1.6);
        pos.setZ(i, Math.sin(time * 0.4 + bx * 0.06 + ribbon.phase) * 0.8);
      }
      pos.needsUpdate = true;
      ribbon.mesh.material.opacity = 0.12 + Math.sin(time * 0.3 + ribbon.phase) * 0.05;
    }
    const positions = flakeGeo.attributes.position;
    for (let i = 0; i < flakeCount; i += 1) {
      let y = positions.getY(i) - flakeSpeed[i] * dt;
      let x = positions.getX(i) + Math.sin(time * 0.7 + i) * dt * 0.35;
      if (y < 0) {
        y = 20 + random() * 2;
        x = (random() * 2 - 1) * 24;
        positions.setZ(i, (random() * 2 - 1) * 22);
      }
      positions.setY(i, y);
      positions.setX(i, x);
    }
    positions.needsUpdate = true;
    beaconLight.material = mats.accent;
    const pulse = 1.0 + Math.sin(time * 4) * 0.6;
    beaconLight.scale.setScalar(pulse);
    towerEye.material = mats.danger;
    towerEye.scale.setScalar(time % 1.4 < 0.18 ? 1.5 : 1.0);
  }

  return { colliders, shootables, group, routes, playerSpawn, botSpawns, plantSite, padRing, step };
}
