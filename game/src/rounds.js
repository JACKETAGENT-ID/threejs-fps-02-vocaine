// Arctic Relay — the round machine. Buy phase, live phase, plant and defuse, round
// end and match end. It owns the clock and the money awards; the HUD only displays
// what it decides, and the simulation only moves while it says LIVE.
import { PHASE, WIN, resetRound, pushFeed } from './state.js';

const WIN_MONEY = 300;
const LOSS_MONEY = 150;
const PLANT_MONEY = 150;

export function createRounds(state, map, bots, player, arsenal, combat, hud, audio) {
  let roundEndTimer = 0;
  let lastTickSecond = -1;

  function startMatch() {
    state.round = 1;
    state.playerRounds = 0;
    state.botRounds = 0;
    state.money = 800;
    state.kills = 0;
    state.deaths = 0;
    state.plants = 0;
    state.defuses = 0;
    state.matchWinner = WIN.NONE;
    startBuy();
  }

  function startBuy() {
    resetRound(state);
    state.phase = PHASE.BUY;
    state.timeLeft = state.buyTime;
    player.reset(map.playerSpawn);
    bots.reset();
    combat.reset();
    arsenal.refill();
    hud.showBuy({ money: state.money, owned: arsenal.owned });
    hud.setRound(state.round, state.maxRounds);
    hud.setScore(state.playerRounds, state.botRounds);
  }

  function startLive() {
    state.phase = PHASE.LIVE;
    state.timeLeft = state.roundTime;
    lastTickSecond = -1;
    hud.hideBuy();
    hud.setHint('Plant the relay charge at the dome pad — or clear the Drifters.');
  }

  function endRound(winner, reason) {
    state.roundWinner = winner;
    state.roundReason = reason;
    if (winner === WIN.PLAYER) {
      state.playerRounds += 1;
      state.money += WIN_MONEY;
      audio.roundWin();
      pushFeed(state, `Round ${state.round} won — ${reason}  +$${WIN_MONEY}`);
    } else {
      state.botRounds += 1;
      state.money += LOSS_MONEY;
      audio.roundLose();
      pushFeed(state, `Round ${state.round} lost — ${reason}  +$${LOSS_MONEY}`);
    }
    if (winner === WIN.BOTS && !player.state.alive) state.deaths += 1;
    state.phase = PHASE.ROUND_END;
    roundEndTimer = 4;
    hud.setScore(state.playerRounds, state.botRounds);
    hud.showRoundEnd(state);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function endMatch() {
    state.matchWinner = state.playerRounds > state.botRounds ? WIN.PLAYER : WIN.BOTS;
    state.phase = PHASE.MATCH_END;
    hud.showMatchEnd(state);
    if (document.pointerLockElement) document.exitPointerLock();
  }

  function step(dt, input, time) {
    if (state.phase === PHASE.BUY) {
      state.timeLeft -= dt;
      hud.setTimer(Math.ceil(state.timeLeft), true);
      if (input.wasPressed('Enter') || input.wasPressed('Space') || state.timeLeft <= 0) {
        startLive();
      }
      return;
    }
    if (state.phase === PHASE.ROUND_END) {
      roundEndTimer -= dt;
      if (roundEndTimer <= 0) {
        if (state.playerRounds >= state.winsToTake || state.botRounds >= state.winsToTake || state.round >= state.maxRounds) {
          endMatch();
        } else {
          state.round += 1;
          startBuy();
        }
      }
      return;
    }
    if (state.phase !== PHASE.LIVE) return;

    state.timeLeft -= dt;
    const whole = Math.ceil(state.timeLeft);
    if (whole !== lastTickSecond) {
      lastTickSecond = whole;
      hud.setTimer(whole, false);
    }

    const playerAlive = player.state.alive;
    const nearSite = player.state.position.distanceTo(map.plantSite) < 2.8;

    // Planting: hold E on the pad while carrying the charge.
    if (state.charge === 'carried' && playerAlive) {
      if (nearSite && input.state.keys.has('KeyE')) {
        state.chargeProgress += dt / state.plantTime;
        if (Math.floor(state.chargeProgress * 10) !== Math.floor((state.chargeProgress - dt / state.plantTime) * 10)) audio.plantTick();
        if (state.chargeProgress >= 1) {
          state.charge = 'planted';
          state.detonateLeft = state.detonateTime;
          state.plants += 1;
          state.money += PLANT_MONEY;
          audio.planted();
          pushFeed(state, `Charge planted — detonation in ${state.detonateTime}s  +$${PLANT_MONEY}`);
          hud.setHint('Charge planted — defend the pad!');
        }
      } else {
        state.chargeProgress = Math.max(0, state.chargeProgress - dt / state.plantTime);
      }
    }

    // Planted charge: the countdown runs, a defusing bot channels against it.
    if (state.charge === 'planted') {
      state.detonateLeft -= dt;
      if (bots.anyDefusing()) {
        state.defuseProgress += dt / state.defuseTime;
        if (Math.random() < dt * 2) audio.defuseTick();
        if (state.defuseProgress >= 1) {
          state.charge = 'defused';
          state.defuses += 1;
          endRound(WIN.BOTS, 'charge defused');
          return;
        }
      } else {
        state.defuseProgress = Math.max(0, state.defuseProgress - dt / (state.defuseTime * 2));
      }
      if (state.detonateLeft <= 0) {
        state.charge = 'detonated';
        endRound(WIN.PLAYER, 'relay charge detonated');
        return;
      }
    }

    if (!playerAlive) {
      endRound(WIN.BOTS, 'operative down');
      return;
    }
    if (bots.aliveCount() === 0) {
      endRound(WIN.PLAYER, 'all Drifters eliminated');
      return;
    }
    if (state.timeLeft <= 0) {
      endRound(WIN.BOTS, 'time expired');
    }
  }

  return { startMatch, startBuy, startLive, endRound, endMatch, step };
}
