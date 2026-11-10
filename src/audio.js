// Audio: sintetizador "de consola" (pasa por un altavoz diminuto) + sonidos mecánicos
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteFreq(n) {
  const m = /^([A-G])(#?)(\d)$/.exec(n);
  if (!m) return 0;
  const semi = NOTE[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * Math.pow(2, (semi - 69) / 12);
}
function parseSeq(str) {
  return str.trim().split(/\s+/).map((tok) => {
    const [n, l] = tok.split(':');
    return { f: n === '-' ? 0 : noteFreq(n), len: Number(l || 1) };
  });
}

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.volume = 0.7;
    this.musicOn = true;
    this._song = null;
    this._timer = null;
  }
  // debe llamarse desde un gesto del usuario
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.out = ctx.createGain();
    this.out.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    this.out.connect(comp).connect(ctx.destination);
    // cadena del altavoz de la consola
    this.spkVol = ctx.createGain();
    this.spkVol.gain.value = this.volume;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 420;
    const pk = ctx.createBiquadFilter();
    pk.type = 'peaking';
    pk.frequency.value = 2400;
    pk.gain.value = 5;
    pk.Q.value = 0.9;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6500;
    hp.connect(pk).connect(lp).connect(this.spkVol).connect(this.out);
    this.spkIn = hp;
    this._newBus();
    // ruido
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  _newBus() {
    this.bus = this.ctx.createGain();
    this.bus.connect(this.spkIn);
  }
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.spkVol) this.spkVol.gain.setTargetAtTime(this.volume * this.volume * 1.2, this.ctx.currentTime, 0.02);
  }
  // corta todo el sonido de la consola (apagado)
  silence() {
    this.music(null);
    if (!this.ctx) return;
    const old = this.bus;
    old.gain.setTargetAtTime(0, this.ctx.currentTime, 0.015);
    setTimeout(() => old.disconnect(), 200);
    this._newBus();
  }

  // ---- voces de la consola ----
  tone(freq, dur = 0.1, o = {}) {
    if (!this.ctx || !freq) return;
    const ctx = this.ctx;
    const t = (o.at ?? ctx.currentTime) + (o.delay || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
    const g = ctx.createGain();
    const v = o.vol ?? 0.12;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.004);
    g.gain.setValueAtTime(v, t + Math.max(0.005, dur * 0.6));
    g.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(g).connect(this.bus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  noise(dur = 0.1, o = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + (o.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 3000, t);
    if (o.slide) f.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
    const g = ctx.createGain();
    const v = o.vol ?? 0.15;
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
  // song: { step: seg, ch: [{type, vol, seq:"C4:2 -:1 ..."}] }
  music(song) {
    clearInterval(this._timer);
    this._timer = null;
    this._song = song;
    if (!song || !this.ctx) return;
    const ctx = this.ctx;
    const chans = song.ch.map((c) => ({ ...c, notes: parseSeq(c.seq), i: 0, t: ctx.currentTime + 0.06 }));
    const tick = () => {
      if (!this.musicOn) {
        chans.forEach((c) => (c.t = Math.max(c.t, ctx.currentTime)));
        return;
      }
      const horizon = ctx.currentTime + 0.25;
      for (const c of chans) {
        if (c.t < ctx.currentTime - 0.3) c.t = ctx.currentTime;
        while (c.t < horizon) {
          const n = c.notes[c.i];
          const d = n.len * song.step;
          if (n.f) this.tone(n.f, d * (c.gate || 0.85), { type: c.type, vol: c.vol, at: c.t });
          c.t += d;
          c.i = (c.i + 1) % c.notes.length;
        }
      }
    };
    tick();
    this._timer = setInterval(tick, 60);
  }

  // ---- sonidos mecánicos (no pasan por el altavoz) ----
  _mech(dur, { freq = 2000, q = 1, vol = 0.3, type = 'bandpass', delay = 0, slide = 0, attack = 0.001 } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    src.connect(f).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
  _thump(freq, dur, vol, delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  mech(kind) {
    switch (kind) {
      case 'btnDown':
        this._mech(0.03, { freq: 1500 + Math.random() * 300, q: 1.2, vol: 0.22 });
        this._thump(150, 0.05, 0.22);
        break;
      case 'btnUp':
        this._mech(0.025, { freq: 2300 + Math.random() * 300, q: 1.5, vol: 0.09 });
        break;
      case 'rubberDown':
        this._mech(0.035, { freq: 700, q: 0.8, vol: 0.14 });
        this._thump(110, 0.05, 0.16);
        break;
      case 'rubberUp':
        this._mech(0.03, { freq: 1100, q: 1, vol: 0.05 });
        break;
      case 'switch':
        this._mech(0.02, { freq: 3400, q: 2.5, vol: 0.4 });
        this._mech(0.035, { freq: 2100, q: 2, vol: 0.35, delay: 0.05 });
        this._thump(210, 0.04, 0.25, 0.05);
        break;
      case 'slideOut':
        this._mech(0.26, { freq: 900, slide: 2400, q: 0.7, vol: 0.12, attack: 0.05 });
        this._mech(0.03, { freq: 2600, q: 2, vol: 0.25 });
        break;
      case 'slideIn':
        this._mech(0.2, { freq: 2200, slide: 800, q: 0.7, vol: 0.12, attack: 0.04 });
        break;
      case 'clunk':
        this._mech(0.04, { freq: 1800, q: 1.4, vol: 0.45 });
        this._thump(95, 0.12, 0.5);
        this._mech(0.03, { freq: 2900, q: 2, vol: 0.2, delay: 0.035 });
        break;
      case 'desk':
        this._mech(0.05, { freq: 900, q: 0.8, vol: 0.3 });
        this._thump(180, 0.07, 0.3);
        this._mech(0.03, { freq: 1300, q: 1, vol: 0.12, delay: 0.07 });
        break;
      case 'deskBig':
        this._mech(0.07, { freq: 600, q: 0.7, vol: 0.4 });
        this._thump(90, 0.14, 0.55);
        break;
      case 'blow':
        this._mech(0.42, { freq: 650, slide: 1100, q: 0.5, vol: 0.2, attack: 0.07 });
        break;
      case 'whoosh':
        this._mech(0.5, { freq: 300, slide: 900, q: 0.4, vol: 0.06, attack: 0.2 });
        break;
      case 'wheel':
        this._mech(0.012, { freq: 4200, q: 3, vol: 0.12 });
        break;
    }
  }
}
