// Arctic Relay — the DOM HUD. It never touches the simulation: main.js pushes numbers
// in, the player reads them out. Health, armour, ammo, money, timer, scores, plant and
// defuse bars, kill feed, the buy menu and every overlay live here.
const BUY_ITEMS = [
  { id: 'smg', name: 'Frostbite SMG', price: 900, desc: 'Fast close-quarters spray, 32-round mag.' },
  { id: 'sniper', name: 'Long Night', price: 1800, desc: 'One-shot precision at range, 5-round mag.' },
  { id: 'grenade', name: 'Cryo Grenade', price: 250, desc: 'Blast + freeze: slows Drifters for 4s.' },
  { id: 'smoke', name: 'Smoke Grenade', price: 200, desc: 'Thick cover for 8s: blocks Drifter sight.' },
  { id: 'armor', name: 'Plated Vest', price: 400, desc: 'Absorbs 60% of damage until it breaks.' },
];

export function createHud() {
  const el = (id) => document.getElementById(id);
  const overlay = el('overlay');
  const overlayTitle = el('overlay-title');
  const overlayCopy = el('overlay-copy');
  const playBtn = el('play');
  const healthBar = el('health-fill');
  const healthNum = el('health-num');
  const armorNum = el('armor-num');
  const ammoMag = el('ammo-mag');
  const ammoReserve = el('ammo-reserve');
  const ammoWeapon = el('ammo-weapon');
  const grenadeNum = el('grenade-num');
  const moneyNum = el('money-num');
  const timerNum = el('timer-num');
  const scoreNum = el('score-num');
  const roundNum = el('round-num');
  const hintBar = el('hint');
  const feedList = el('feed');
  const hitmarker = el('hitmarker');
  const damageVignette = el('damage');
  const plantWrap = el('plant-wrap');
  const plantLabel = el('plant-label');
  const plantFill = el('plant-fill');
  const buyPanel = el('buy');
  const buyMoney = el('buy-money');
  const buyItems = el('buy-items');
  const crosshair = el('crosshair');
  const minimap = el('minimap');
  const minimapCtx = minimap ? minimap.getContext('2d') : null;
  const damageLayer = el('damage-numbers');

  // Floating damage numbers: a small pool of divs, reused so a firefight
  // never allocates DOM nodes mid-frame.
  const damagePool = [];
  let damageIndex = 0;
  if (damageLayer) {
    for (let i = 0; i < 10; i += 1) {
      const div = document.createElement('div');
      div.className = 'dmg-num';
      damageLayer.appendChild(div);
      damagePool.push(div);
    }
  }
  let lastMinimapDraw = 0;

  let lastHealth = -1;
  let lastArmor = -1;
  let lastMag = -1;
  let lastReserve = -1;
  let lastWeapon = '';
  let lastGrenades = -1;
  let lastMoney = -1;
  let lastTimer = -1;
  let lastScore = '';
  let lastRound = '';
  let hitTimer = 0;
  let buyHandler = null;

  for (const item of BUY_ITEMS) {
    const row = document.createElement('div');
    row.className = 'buy-item';
    row.dataset.item = item.id;
    row.innerHTML = `<b>${item.name}</b><span>$${item.price}</span><i>${item.desc}</i>`;
    row.addEventListener('click', () => {
      if (buyHandler) buyHandler(item.id);
    });
    buyItems.appendChild(row);
  }

  function refreshBuy(state) {
    buyMoney.textContent = `$${state.money}`;
    for (const row of buyItems.children) {
      const item = BUY_ITEMS.find((x) => x.id === row.dataset.item);
      const owned = item.id === 'smg' || item.id === 'sniper' ? state.owned?.[item.id] : false;
      const afford = state.money >= item.price;
      row.classList.toggle('owned', !!owned);
      row.classList.toggle('poor', !owned && !afford);
    }
  }

  return {
    setHealth(hp, armor) {
      if (hp === lastHealth && armor === lastArmor) return;
      lastHealth = hp;
      lastArmor = armor;
      healthBar.style.width = `${Math.max(0, hp)}%`;
      healthBar.classList.toggle('low', hp <= 30);
      healthNum.textContent = String(Math.ceil(hp));
      armorNum.textContent = armor > 0 ? `+${Math.ceil(armor)}` : '';
    },
    setAmmo(mag, reserve, weaponName, grenadeText) {
      if (mag !== lastMag || reserve !== lastReserve || weaponName !== lastWeapon || grenadeText !== lastGrenades) {
        lastMag = mag;
        lastReserve = reserve;
        lastWeapon = weaponName;
        lastGrenades = grenadeText;
        ammoMag.textContent = String(mag);
        ammoReserve.textContent = `/ ${reserve}`;
        ammoWeapon.textContent = weaponName;
        grenadeNum.textContent = grenadeText || '';
        el('ammo').classList.toggle('empty', mag === 0);
      }
    },
    setMoney(value) {
      if (value === lastMoney) return;
      lastMoney = value;
      moneyNum.textContent = `$${value}`;
    },
    setTimer(seconds, isBuy) {
      if (seconds === lastTimer) return;
      lastTimer = seconds;
      timerNum.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
      timerNum.classList.toggle('buy', !!isBuy);
    },
    setScore(playerRounds, botRounds) {
      const text = `${playerRounds} : ${botRounds}`;
      if (text === lastScore) return;
      lastScore = text;
      scoreNum.textContent = text;
    },
    setRound(round, maxRounds) {
      const text = `ROUND ${round} / ${maxRounds}`;
      if (text === lastRound) return;
      lastRound = text;
      roundNum.textContent = text;
    },
    damageNumber(x, y, text, kind) {
      if (damagePool.length === 0) return;
      const div = damagePool[damageIndex];
      damageIndex = (damageIndex + 1) % damagePool.length;
      div.textContent = text;
      div.className = `dmg-num ${kind === 'head' ? 'head' : ''}`;
      div.style.left = `${Math.round(x)}px`;
      div.style.top = `${Math.round(y)}px`;
      // Restart the rise-and-fade transition.
      void div.offsetWidth;
      div.classList.add('show');
      setTimeout(() => div.classList.remove('show'), 750);
    },
    // Live minimap: the station bowl, the dome pad, the player arrow and every
    // Drifter still standing. Redrawn at most 8 times a second.
    setMinimap(data) {
      if (!minimapCtx) return;
      const now = performance.now();
      if (now - lastMinimapDraw < 120) return;
      lastMinimapDraw = now;
      const W = 150;
      const H = 140;
      const sx = W / 47;
      const sy = H / 43;
      const px = (x) => (x + 23.5) * sx;
      const pz = (z) => (z + 21.5) * sy;
      const ctx = minimapCtx;
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(10, 22, 38, 0.55)';
      ctx.fillRect(0, 0, W, H);
      // Blocks: hab west, lab east, comms tower, dome.
      ctx.fillStyle = '#8fa5b8';
      ctx.fillRect(px(-15.6), pz(-7.5), 4.2 * sx, 11 * sy);
      ctx.fillRect(px(11.3), pz(-8.5), 4.4 * sx, 9 * sy);
      ctx.fillRect(px(4.3), pz(-8.2), 1.4 * sx, 1.4 * sy);
      ctx.beginPath();
      ctx.arc(px(0), pz(-15.5), 5.2 * sx, 0, Math.PI * 2);
      ctx.fillStyle = '#5f7fa8';
      ctx.fill();
      // Plant pad.
      ctx.beginPath();
      ctx.arc(px(0), pz(-9.6), 2.3 * sx, 0, Math.PI * 2);
      ctx.strokeStyle = data.charge === 'planted' ? '#ff5d47' : '#46e0b6';
      ctx.lineWidth = 2;
      ctx.stroke();
      if (data.charge === 'planted') {
        ctx.beginPath();
        ctx.arc(px(0), pz(-9.6), (2.3 + Math.sin(now / 180) * 0.8) * sx, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 93, 71, 0.6)';
        ctx.stroke();
      }
      // Drifters: red while alive, grey when down.
      for (const bot of data.bots) {
        ctx.beginPath();
        ctx.arc(px(bot.x), pz(bot.z), 3.2, 0, Math.PI * 2);
        ctx.fillStyle = bot.alive ? '#ff5d47' : '#5a6b7c';
        ctx.fill();
      }
      // The player, an arrow pointing where they face (yaw 0 faces north, up).
      ctx.save();
      ctx.translate(px(data.x), pz(data.z));
      ctx.rotate(-data.yaw);
      ctx.fillStyle = '#46e0b6';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4.4, 5);
      ctx.lineTo(-4.4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // Frame.
      ctx.strokeStyle = '#2b4258';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    },
    setHint(text) {
      if (hintBar.textContent !== text) hintBar.textContent = text;
    },

    hitMarker(killed, holdMs = 90) {
      hitmarker.classList.add('on');
      hitmarker.classList.toggle('kill', !!killed);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => hitmarker.classList.remove('on', 'kill'), holdMs);
    },
    damageFlash() {
      damageVignette.classList.add('on');
      setTimeout(() => damageVignette.classList.remove('on'), 180);
    },
    pushFeed(text) {
      const item = document.createElement('div');
      item.className = 'feed-item';
      item.textContent = text;
      feedList.prepend(item);
      while (feedList.children.length > 5) feedList.lastChild.remove();
      setTimeout(() => item.classList.add('fade'), 4200);
    },
    setPlant(progress, mode) {
      if (mode === null || progress <= 0) {
        plantWrap.hidden = true;
        return;
      }
      plantWrap.hidden = false;
      plantLabel.textContent = mode === 'plant' ? 'PLANTING RELAY CHARGE' : mode === 'defuse' ? 'DRIFTER DEFUSING!' : 'CHARGE ARMED';
      plantFill.style.width = `${Math.round(progress * 100)}%`;
      plantFill.classList.toggle('danger', mode === 'defuse');
    },
    setDetonate(seconds) {
      if (seconds <= 0) {
        plantWrap.hidden = true;
        return;
      }
      plantWrap.hidden = false;
      plantLabel.textContent = `DETONATION IN ${Math.ceil(seconds)}s — DEFEND THE PAD`;
      plantFill.style.width = `${Math.round((seconds / 25) * 100)}%`;
      plantFill.classList.remove('danger');
    },
    showBuy(state) {
      buyPanel.hidden = false;
      refreshBuy(state);
      crosshair.style.display = 'none';
    },
    hideBuy() {
      buyPanel.hidden = true;
      crosshair.style.display = '';
    },
    updateBuy(state) {
      if (!buyPanel.hidden) refreshBuy(state);
    },
    showOverlay(mode, state) {
      if (mode === 'start') {
        overlayTitle.textContent = 'ARCTIC RELAY';
        overlayCopy.textContent = 'Relay Station K-7, 78° north. Plant the relay charge at the dome pad — or clear the Drifters. Sable holds the lanes, Rime snipes, Gale hunts your gunfire, Frost flanks. Smoke (Q) breaks their sight.';
        playBtn.textContent = 'Deploy';
      } else if (mode === 'paused') {
        overlayTitle.textContent = 'Paused';
        overlayCopy.textContent = 'The storm waits for no one. Click to return to the station.';
        playBtn.textContent = 'Resume';
      } else if (mode === 'roundEnd') {
        const won = state.roundWinner === 'player';
        overlayTitle.textContent = won ? `Round ${state.round} — Station held` : `Round ${state.round} — Drifters take it`;
        overlayCopy.textContent = `${state.roundReason}. Score ${state.playerRounds} : ${state.botRounds}. Next round in a moment…`;
        playBtn.textContent = 'Stand by';
        playBtn.disabled = true;
        setTimeout(() => { playBtn.disabled = false; }, 500);
      } else if (mode === 'matchEnd') {
        const won = state.matchWinner === 'player';
        overlayTitle.textContent = won ? 'Station secured' : 'Station lost';
        overlayCopy.textContent = won
          ? `The relay sings again. Final score ${state.playerRounds} : ${state.botRounds} — ${state.kills} Drifters eliminated.`
          : `The Drifters hold K-7. Final score ${state.playerRounds} : ${state.botRounds}. Run it back.`;
        playBtn.textContent = 'Play again';
      }
      overlay.hidden = false;
    },
    hideOverlay() {
      overlay.hidden = true;
    },
    onPlay(handler) {
      playBtn.addEventListener('click', handler);
    },
    onBuy(handler) {
      buyHandler = handler;
    },
    showRoundEnd(state) {
      this.showOverlay('roundEnd', state);
    },
    showMatchEnd(state) {
      this.showOverlay('matchEnd', state);
    },
  };
}
