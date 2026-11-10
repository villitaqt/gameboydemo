import { Gfx, W, H } from './gfx.js';

// "Firmware" de la consola: encendido, arranque, lectura del cartucho y bucle a 60 Hz
const BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];
const STEP = 1 / 60;

export class System {
  constructor(audio, games) {
    this.audio = audio;
    this.games = games; // { id: {title, create(sys)} }
    this.g = new Gfx();
    this.on = false;
    this.cart = null;
    this.held = {};
    this.latch = {};
    this.now = {};
    this.prev = {};
    this.acc = 0;
    this.state = 'off';
    this.t = 0;
    this.game = null;
    this.onNoCart = null;
    this.api = {
      btn: (n) => !!this.now[n],
      btnp: (n) => !!this.now[n] && !this.prev[n],
      tone: (f, d, o) => this.audio.tone(f, d, o),
      noise: (d, o) => this.audio.noise(d, o),
      music: (s) => this.audio.music(s),
      toggleMusic: () => {
        this.audio.musicOn = !this.audio.musicOn;
        return this.audio.musicOn;
      },
      load: (k, def = 0) => {
        try {
          const v = localStorage.getItem('gb.' + k);
          return v === null ? def : JSON.parse(v);
        } catch {
          return def;
        }
      },
      save: (k, v) => {
        try {
          localStorage.setItem('gb.' + k, JSON.stringify(v));
        } catch {}
      },
    };
  }
  setButton(name, down) {
    this.held[name] = down;
    if (down) this.latch[name] = true; // una pulsación muy breve no se pierde entre dos fotogramas
  }
  powerOn(cart) {
    this.on = true;
    this.cart = cart;
    this.state = 'boot';
    this.t = 0;
    this.acc = 0;
    this.game = null;
    this.g.cls(0);
    this.prev = {};
    this.now = {};
  }
  powerOff() {
    this.on = false;
    this.state = 'off';
    this.game = null;
    this.audio.silence();
  }
  update(dt) {
    if (!this.on) return;
    this.acc += Math.min(dt, 0.1);
    let n = 0;
    while (this.acc >= STEP && n < 4) {
      this.acc -= STEP;
      n++;
      for (const b of BUTTONS) {
        this.now[b] = !!this.held[b] || !!this.latch[b];
        this.latch[b] = false;
      }
      this.tick();
      for (const b of BUTTONS) this.prev[b] = this.now[b];
    }
    if (n === 4) this.acc = 0;
  }
  tick() {
    const g = this.g;
    this.t++;
    if (this.state === 'boot') {
      const t = this.t;
      const DROP = 96, yEnd = 62;
      const y = Math.round(Math.min(1, t / DROP) * (yEnd + 16) - 16);
      g.cls(0);
      if (this.cart) {
        g.ctext('CLAUDE', y, 3, 2);
        if (t > DROP) g.text('+', 119, y - 3, 3);
      } else {
        // sin cartucho: la cabecera se lee como basura, igual que en el hardware real
        g.rect(32, y, 96, 14, 3);
      }
      if (t === DROP + 6) {
        this.audio.tone(1046.5, 0.07, { vol: 0.16 });
        this.audio.tone(2093, 0.5, { vol: 0.16, delay: 0.07 });
      }
      if (t > DROP + 20 && this.cart) g.ctext('JUEGOS ORIGINALES', 86, 2);
      if (t === DROP + 30 && !this.cart) {
        this.state = 'nocart';
        this.onNoCart && this.onNoCart();
      }
      if (t > DROP + 80 && this.cart) {
        this.state = 'fade';
        this.t = 0;
      }
    } else if (this.state === 'fade') {
      g.cls(0);
      if (this.t > 14) {
        this.state = 'game';
        this.game = this.games[this.cart].create(this.api);
      }
    } else if (this.state === 'game') {
      this.game.update();
      this.game.draw(g);
    }
  }
}
export { W, H };
