// Arctic Relay — procedural sound, no audio files. A tiny WebAudio synth for shots,
// reload clicks, plant beeps and round stingers. Everything is guarded: no context
// exists until the player first clicks, and a missing AudioContext is never fatal.
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) return context;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = 0.22;
    master.connect(context.destination);
    return context;
  }

  function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function noiseBurst(duration, filterFreq, gainValue) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = gainValue;
    source.connect(filter).connect(gain).connect(master);
    source.start();
  }

  function tone(freq, duration, type, gainValue, slideTo) {
    const ctx = ensure();
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), ctx.currentTime + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainValue, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  return {
    unlock,
    shot(kind) {
      if (kind === 'sniper') noiseBurst(0.22, 1400, 0.9);
      else if (kind === 'smg') noiseBurst(0.07, 2600, 0.5);
      else noiseBurst(0.12, 1900, 0.7);
    },
    dryFire() {
      tone(1400, 0.04, 'square', 0.12);
    },
    reload() {
      tone(520, 0.05, 'square', 0.1);
      setTimeout(() => tone(760, 0.05, 'square', 0.1), 120);
    },
    hit() {
      tone(2100, 0.05, 'sine', 0.14);
    },
    kill() {
      tone(880, 0.09, 'sine', 0.16, 1320);
    },
    hurt() {
      tone(220, 0.16, 'sawtooth', 0.16, 110);
    },
    plantTick() {
      tone(1180, 0.07, 'sine', 0.16);
    },
    planted() {
      tone(660, 0.12, 'sine', 0.18);
      setTimeout(() => tone(990, 0.16, 'sine', 0.18), 130);
    },
    defuseTick() {
      tone(1560, 0.05, 'square', 0.1);
    },
    explosion() {
      noiseBurst(0.7, 420, 1.0);
      tone(70, 0.6, 'sine', 0.5, 32);
    },
    grenade() {
      noiseBurst(0.3, 900, 0.6);
      tone(320, 0.3, 'sine', 0.2, 90);
    },
    roundWin() {
      [523, 659, 784].forEach((freq, i) => setTimeout(() => tone(freq, 0.16, 'triangle', 0.18), i * 120));
    },
    roundLose() {
      [392, 330, 262].forEach((freq, i) => setTimeout(() => tone(freq, 0.18, 'triangle', 0.16), i * 130));
    },
    buy() {
      tone(1046, 0.07, 'sine', 0.14);
      setTimeout(() => tone(1318, 0.09, 'sine', 0.14), 80);
    },
    setMuted(value) {
      muted = value;
    },
  };
}
