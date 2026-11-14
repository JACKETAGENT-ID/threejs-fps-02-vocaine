
// Arctic Relay — one store for all match state. Nothing else keeps match state:
// the simulation reads and writes this object, the HUD only reads it.
export const PHASE = {
  MENU: 'menu',
  BUY: 'buy',
  LIVE: 'live',
  ROUND_END: 'roundEnd',
  MATCH_END: 'matchEnd',
};

export const WIN = {
  NONE: 'none',
  PLAYER: 'player',
  BOTS: 'bots',
};

export const WEAPON_IDS = ['rifle', 'smg', 'sniper'];

export function createState() {
  return {
    phase: PHASE.MENU,
    round: 1,
    maxRounds: 5,
    winsToTake: 3,
    playerRounds: 0,
    botRounds: 0,
    roundTime: 100,
    buyTime: 14,
    timeLeft: 0,
    money: 800,
    kills: 0,
    deaths: 0,
    plants: 0,
    defuses: 0,
    charge: 'carried', // carried | planting | planted | defused | detonated
    chargeProgress: 0, // 0..1 while planting
    plantTime: 3,
    detonateTime: 25,
    detonateLeft: 0,
    defuseProgress: 0, // 0..1 while a bot defuses
    defuseTime: 5,
    roundWinner: WIN.NONE,
    roundReason: '',
    matchWinner: WIN.NONE,
    frozen: false,
    lastKill: '',
    feed: [],
  };
}

export function resetRound(state) {
  state.timeLeft = state.roundTime;
  state.charge = 'carried';
  state.chargeProgress = 0;
  state.detonateLeft = state.detonateTime;
  state.defuseProgress = 0;
  state.roundWinner = WIN.NONE;
  state.roundReason = '';
  state.frozen = false;
}

export function pushFeed(state, text) {
  state.feed.unshift(text);
  if (state.feed.length > 5) state.feed.pop();
  state.lastKill = text;
}
