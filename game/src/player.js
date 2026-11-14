// Arctic Relay — the operative's body. Acceleration, friction, gravity, crouch and
// jump, resolved as a capsule-ish box against the map's colliders one axis at a time,
// so a wall never swallows the player and snowdrifts can be stepped onto.
import * as THREE from 'three';

const RADIUS = 0.34;
const HEIGHT_STAND = 1.74;
const HEIGHT_CROUCH = 1.14;
const EYE_STAND = 1.62;
const EYE_CROUCH = 1.04;
const SPEED_WALK = 5.4;
const SPEED_CROUCH = 2.5;
const SPEED_AIM = 3.4;
const ACCEL_GROUND = 46;
const ACCEL_AIR = 10;
const FRICTION = 9.5;
const GRAVITY = 21;
const JUMP = 6.4;

export function createPlayer(colliders) {
  const body = {
    position: new THREE.Vector3(0, 0, 13.5),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    eye: EYE_STAND,
    height: HEIGHT_STAND,
    onGround: true,
    crouching: false,
    aiming: false,
    health: 100,
    armor: 0,
    alive: true,
  };
  const probe = new THREE.Box3();
  const wish = new THREE.Vector3();

  // lift keeps feet and crown out of the horizontal tests, so standing on snow is
  // not read as walking into a wall.
  function hits(x, y, z, height, lift) {
    probe.min.set(x - RADIUS, y + lift, z - RADIUS);
    probe.max.set(x + RADIUS, y + height - lift, z + RADIUS);
    for (const box of colliders) if (probe.intersectsBox(box)) return box;
    return null;
  }

  function look(dx, dy, sensitivity = 0.0021) {
    body.yaw -= dx * sensitivity;
    body.pitch = Math.max(-1.45, Math.min(1.45, body.pitch - dy * sensitivity));
  }

  function recoil(pitchKick, yawKick) {
    body.pitch = Math.min(1.45, body.pitch + pitchKick);
    body.yaw += yawKick;
  }

  function step(dt, keys, aiming) {
    if (!body.alive) return;
    const crouchKey = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC');
    if (crouchKey && !body.crouching) {
      body.crouching = true;
      body.height = HEIGHT_CROUCH;
    } else if (!crouchKey && body.crouching && !hits(body.position.x, body.position.y, body.position.z, HEIGHT_STAND, 0.02)) {
      body.crouching = false;
      body.height = HEIGHT_STAND;
    }
    body.aiming = aiming;
    const eyeTarget = body.crouching ? EYE_CROUCH : EYE_STAND;
    body.eye += (eyeTarget - body.eye) * Math.min(1, dt * 12);

    const forward = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
    const strafe = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0);
    wish.set(0, 0, 0);
    if (forward || strafe) {
      const sin = Math.sin(body.yaw);
      const cos = Math.cos(body.yaw);
      wish.set(-sin * forward + cos * strafe, 0, -cos * forward - sin * strafe).normalize();
    }

    const topSpeed = body.crouching ? SPEED_CROUCH : aiming ? SPEED_AIM : SPEED_WALK;
    const blend = Math.min(1, (body.onGround ? ACCEL_GROUND : ACCEL_AIR) * dt / topSpeed);
    body.velocity.x += (wish.x * topSpeed - body.velocity.x) * blend;
    body.velocity.z += (wish.z * topSpeed - body.velocity.z) * blend;
    if (body.onGround && wish.lengthSq() === 0) {
      const damp = Math.max(0, 1 - FRICTION * dt);
      body.velocity.x *= damp;
      body.velocity.z *= damp;
    }

    if (keys.has('Space') && body.onGround) {
      body.velocity.y = JUMP;
      body.onGround = false;
    }
    body.velocity.y -= GRAVITY * dt;

    const nextX = body.position.x + body.velocity.x * dt;
    if (!hits(nextX, body.position.y, body.position.z, body.height, 0.04)) body.position.x = nextX;
    else body.velocity.x = 0;
    const nextZ = body.position.z + body.velocity.z * dt;
    if (!hits(body.position.x, body.position.y, nextZ, body.height, 0.04)) body.position.z = nextZ;
    else body.velocity.z = 0;

    body.position.y += body.velocity.y * dt;
    body.onGround = false;
    const under = hits(body.position.x, body.position.y, body.position.z, body.height, 0);
    if (under && body.velocity.y <= 0) {
      body.position.y = under.max.y;
      body.velocity.y = 0;
      body.onGround = true;
    } else if (under) {
      body.position.y = under.min.y - body.height;
      body.velocity.y = 0;
    }
    if (body.position.y < 0) {
      body.position.y = 0;
      body.velocity.y = 0;
      body.onGround = true;
    }
    body.velocity.y = Math.max(-32, body.velocity.y);
  }

  function hurt(amount) {
    if (!body.alive) return;
    let rest = amount;
    if (body.armor > 0) {
      const absorbed = Math.min(body.armor, rest * 0.6);
      body.armor -= absorbed;
      rest -= absorbed;
    }
    body.health -= rest;
    if (body.health <= 0) {
      body.health = 0;
      body.alive = false;
    }
  }

  function reset(spawn) {
    body.position.copy(spawn);
    body.velocity.set(0, 0, 0);
    body.yaw = 0;
    body.pitch = 0;
    body.eye = EYE_STAND;
    body.height = HEIGHT_STAND;
    body.crouching = false;
    body.onGround = true;
    body.health = 100;
    body.armor = 0;
    body.alive = true;
  }

  return {
    state: body,
    step,
    look,
    recoil,
    hurt,
    reset,
    groundSpeed() {
      return Math.hypot(body.velocity.x, body.velocity.z);
    },
  };
}
