import { sprite, pad, W, H } from '../gfx.js';

// ASTRO PATRULLA — matamarcianos vertical. Fondo oscuro, sprites claros.
export const SHIP = sprite([
  '.....0.....',
  '.....0.....',
  '....010....',
  '....010....',
  '...00100...',
  '0..01110..0',
  '0.0011100.0',
  '00001110000',
  '00.00000.00',
  '0...1.1...0',
]);
export const SAUCER = sprite([
  '...0000...',
  '.00111100.',
  '0020110200',
  '0000000000',
  '.01100110.',
  '..0....0..',
  '.0......0.',
]);
const BUG = sprite([
  '0.......0',
  '.0.000.0.',
  '..00000..',
  '.0020200.',
  '000000000',
  '0.00000.0',
  '0.0...0.0',
  '...0.0...',
]);
const DIVER = sprite([
  '0...0...0',
  '00..0..00',
  '000.0.000',
  '.0000000.',
  '..01110..',
  '..01210..',
  '...010...',
  '...010...',
  '....0....',
]);
const CAP_P = sprite(['.00000.', '0333330', '0300030', '0333330', '0300000', '0300000', '.00000.'].map((r) => r.replace(/3/g, '3')));
const CAP_B = sprite(['.00000.', '0333300', '0300030', '0333300', '0300030', '0333300', '.00000.']);
const HEART = sprite(['.0.0.', '00000', '00000', '.000.', '..0..']);
const BOMB = sprite(['..0..', '.000.', '00000', '.000.', '..0..']);

const SONG = {
  step: 0.14,
  ch: [
    {
      type: 'square', vol: 0.05,
      seq: 'E5:2 C5:1 A4:1 C5:2 E5:2 F5:2 C5:1 A4:1 C5:2 F5:2 G5:2 E5:1 C5:1 E5:2 G5:2 G5:1 F5:1 D5:1 B4:1 D5:2 B4:2',
    },
    {
      type: 'triangle', vol: 0.11, gate: 0.6,
      seq: 'A2 A3 A2 A3 A2 A3 A2 A3 F2 F3 F2 F3 F2 F3 F2 F3 C3 C4 C3 C4 C3 C4 C3 C4 G2 G3 G2 G3 G2 G3 B2 B3',
    },
  ],
};

export function createAstro(sys) {
  let mode = 'title';
  let t = 0;
  let hi = sys.load('astro.hi', 0);
  let score, lives, bombs, level, kills, power, inv, cool, px, py, dead, flash, banner, nextLife, paused, newHi, shake;
  let bullets, enemies, shots, parts, picks, spawnT;
  const stars = [];
  for (let i = 0; i < 34; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, s: i % 3 });

  function reset() {
    score = 0; lives = 3; bombs = 2; level = 1; kills = 0; power = 0; inv = 90; cool = 0;
    px = 80; py = 122; dead = 0; flash = 0; banner = 100; nextLife = 1500; paused = false; newHi = false; shake = 0;
    bullets = []; enemies = []; shots = []; parts = []; picks = []; spawnT = 60;
  }
  reset();

  function boom(x, y, n = 8, big = false) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, s = 0.4 + Math.random() * (big ? 2.2 : 1.4);
      parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, l: 12 + Math.random() * (big ? 26 : 14) });
    }
  }
  function spawn() {
    const r = Math.random();
    const x = 12 + Math.random() * (W - 24);
    let type = 'saucer';
    if (level >= 2 && r < 0.3) type = 'bug';
    if (level >= 3 && r < 0.14 + level * 0.012) type = 'diver';
    if (r > 0.9 - Math.min(0.06, level * 0.01)) type = 'rock';
    const e = { type, x, y: -12, t: 0, x0: x, hp: 1, w: 10, h: 8, pts: 10, vx: 0 };
    if (type === 'bug') { e.pts = 20; e.w = 9; e.ph = Math.random() * 6; }
    if (type === 'diver') { e.pts = 30; e.w = 9; e.h = 9; }
    if (type === 'rock') { e.pts = 50; e.hp = 3; e.w = 13; e.h = 13; e.vx = (Math.random() - 0.5) * 0.5; e.r = 6; }
    enemies.push(e);
  }
  function kill(e, i) {
    enemies.splice(i, 1);
    score += e.pts * (level > 5 ? 2 : 1);
    kills++;
    boom(e.x, e.y, e.type === 'rock' ? 16 : 8, e.type === 'rock');
    sys.noise(e.type === 'rock' ? 0.3 : 0.14, { freq: 2600, slide: 300, vol: 0.2 });
    if ((e.type === 'rock' && Math.random() < 0.6) || Math.random() < 0.04) {
      picks.push({ x: e.x, y: e.y, k: Math.random() < 0.65 ? 'P' : 'B', t: 0 });
    }
    if (kills >= level * 10 + 4) {
      kills = 0;
      level++;
      banner = 110;
      score += 100;
      [523, 659, 784, 1047].forEach((f, n) => sys.tone(f, 0.09, { delay: n * 0.08, vol: 0.12 }));
    }
    if (score >= nextLife) {
      nextLife += 2500;
      if (lives < 5) lives++;
      [784, 988, 1175, 1568].forEach((f, n) => sys.tone(f, 0.07, { delay: n * 0.06, vol: 0.13 }));
    }
  }
  function hurt() {
    if (inv > 0 || dead) return;
    lives--;
    power = 0;
    shake = 14;
    boom(px, py, 22, true);
    sys.noise(0.5, { freq: 1800, slide: 120, vol: 0.3 });
    sys.tone(220, 0.4, { slide: 50, vol: 0.14, type: 'sawtooth' });
    if (lives <= 0) {
      dead = 1;
      sys.music(null);
    } else inv = 130;
  }
  const hit = (ax, ay, aw, ah, bx, by, bw, bh) => Math.abs(ax - bx) * 2 < aw + bw && Math.abs(ay - by) * 2 < ah + bh;

  function updatePlay() {
    if (sys.btnp('start') && !dead) {
      paused = !paused;
      sys.tone(paused ? 660 : 880, 0.06, { vol: 0.1 });
    }
    if (sys.btnp('select')) sys.toggleMusic();
    if (paused) return;
    for (const s of stars) {
      s.y += 0.25 + s.s * 0.35;
      if (s.y >= H) { s.y -= H; s.x = Math.random() * W; }
    }
    if (dead) {
      dead++;
      if (dead > 90) {
        mode = 'over';
        t = 0;
        if (score > hi) { hi = score; newHi = true; sys.save('astro.hi', hi); }
        [392, 330, 262, 196].forEach((f, n) => sys.tone(f, 0.22, { delay: n * 0.2, vol: 0.12, type: 'triangle' }));
      }
    } else {
      const sp = 1.45;
      if (sys.btn('left')) px -= sp;
      if (sys.btn('right')) px += sp;
      if (sys.btn('up')) py -= sp * 0.85;
      if (sys.btn('down')) py += sp * 0.85;
      px = Math.max(7, Math.min(W - 7, px));
      py = Math.max(24, Math.min(H - 8, py));
      if (cool > 0) cool--;
      if (sys.btn('a') && cool === 0) {
        cool = power > 0 ? 8 : 10;
        if (power > 0) {
          bullets.push({ x: px - 4, y: py - 4, vx: -0.25 }, { x: px + 4, y: py - 4, vx: 0.25 });
        } else bullets.push({ x: px, y: py - 6, vx: 0 });
        sys.tone(1350, 0.07, { slide: 520, vol: 0.07 });
      }
      if (sys.btnp('b') && bombs > 0) {
        bombs--;
        flash = 10;
        shake = 10;
        shots = [];
        for (let i = enemies.length - 1; i >= 0; i--) if (enemies[i].y > -6) kill(enemies[i], i);
        sys.noise(0.7, { freq: 4000, slide: 150, vol: 0.35 });
        sys.tone(90, 0.6, { slide: 40, vol: 0.2, type: 'triangle' });
      }
      if (inv > 0) inv--;
      if (power > 0) power--;
    }
    if (flash > 0) flash--;
    if (shake > 0) shake--;
    if (banner > 0) banner--;

    // generación de enemigos
    if (!dead && banner < 60 && --spawnT <= 0) {
      spawn();
      spawnT = Math.max(16, 62 - level * 6) * (0.7 + Math.random() * 0.6);
    }
    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.y -= 4.2;
      b.x += b.vx;
      if (b.y < 8) bullets.splice(i, 1);
    }
    const spd = 1 + Math.min(1.2, level * 0.07);
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      e.t++;
      if (e.type === 'saucer') {
        e.y += 0.55 * spd;
        if (level >= 4 && e.t % 110 === 50 && e.y < 100) shots.push({ x: e.x, y: e.y + 4, vx: 0, vy: 1.5 });
      } else if (e.type === 'bug') {
        e.y += 0.6 * spd;
        e.x = e.x0 + Math.sin(e.t * 0.06 + e.ph) * 26;
        if (level >= 3 && e.t % 90 === 40 && e.y < 100) shots.push({ x: e.x, y: e.y + 4, vx: 0, vy: 1.6 });
      } else if (e.type === 'diver') {
        if (e.t < 40) e.y += 1.1;
        else if (e.t < 85) e.x += Math.sign(px - e.x) * Math.min(0.9, Math.abs(px - e.x));
        else {
          if (e.t === 85) {
            e.vx = Math.max(-1, Math.min(1, (px - e.x) / 40));
            sys.tone(900, 0.25, { slide: 300, vol: 0.06, type: 'sawtooth' });
          }
          e.y += 2.7 * Math.min(1.4, spd);
          e.x += e.vx;
        }
      } else {
        e.y += 0.42 * spd;
        e.x += e.vx;
      }
      if (e.y > H + 14) { enemies.splice(i, 1); continue; }
      let gone = false;
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (hit(b.x, b.y, 3, 7, e.x, e.y, e.w, e.h)) {
          bullets.splice(j, 1);
          e.hp--;
          e.hitT = 4;
          if (e.hp <= 0) { kill(e, i); gone = true; break; }
          sys.tone(300, 0.04, { vol: 0.08 });
        }
      }
      if (gone) continue;
      if (e.hitT > 0) e.hitT--;
      if (!dead && hit(px, py, 7, 7, e.x, e.y, e.w - 2, e.h - 2)) {
        if (inv <= 0) { hurt(); if (e.type !== 'rock') { enemies.splice(i, 1); boom(e.x, e.y); } }
      }
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.x += s.vx;
      s.y += s.vy;
      if (s.y > H + 4) { shots.splice(i, 1); continue; }
      if (!dead && hit(px, py, 5, 6, s.x, s.y, 2, 4)) { shots.splice(i, 1); hurt(); }
    }
    for (let i = picks.length - 1; i >= 0; i--) {
      const p = picks[i];
      p.y += 0.5;
      p.t++;
      if (p.y > H + 6) { picks.splice(i, 1); continue; }
      if (!dead && hit(px, py, 11, 10, p.x, p.y, 8, 8)) {
        picks.splice(i, 1);
        if (p.k === 'P') power = 600;
        else bombs = Math.min(3, bombs + 1);
        score += 25;
        sys.tone(880, 0.06, { vol: 0.12 });
        sys.tone(1320, 0.12, { vol: 0.12, delay: 0.06 });
      }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      if (--p.l <= 0) parts.splice(i, 1);
    }
  }

  function drawStars(g) {
    for (const s of stars) g.px(s.x, s.y, s.s === 2 ? 0 : s.s === 1 ? 1 : 2);
  }
  function drawPlay(g) {
    g.cls(3);
    const ox = shake > 0 ? Math.round((Math.random() - 0.5) * 3) : 0;
    drawStars(g);
    for (const p of picks) if (p.t % 16 < 12) g.spr(p.k === 'P' ? CAP_P : CAP_B, p.x - 3 + ox, p.y - 3);
    for (const e of enemies) {
      const tint = e.hitT > 0 ? 0 : -1;
      if (e.type === 'saucer') g.spr(SAUCER, e.x - 5 + ox, e.y - 3, false, false, tint);
      else if (e.type === 'bug') g.spr(BUG, e.x - 4 + ox, e.y - 4, (e.t >> 3) & 1, false, tint);
      else if (e.type === 'diver') g.spr(DIVER, e.x - 4 + ox, e.y - 4, false, false, tint);
      else {
        const x = Math.round(e.x) + ox, y = Math.round(e.y);
        g.circ(x, y, 6, e.hitT > 0 ? 0 : 1);
        if (!(e.hitT > 0)) {
          g.circ(x - 2, y - 2, 1, 0);
          g.circ(x + 2, y + 2, 2, 2);
          g.px(x - 3, y + 3, 2);
          g.px(x + 3, y - 3, 2);
          if (e.hp < 3) { g.px(x, y - 1, 3); g.px(x + 1, y, 3); g.px(x - 1, y - 2, 3); }
          if (e.hp < 2) { g.px(x - 2, y + 1, 3); g.px(x - 3, y, 3); g.px(x + 2, y - 1, 3); }
        }
      }
    }
    for (const b of bullets) g.rect(b.x - 1 + ox, b.y - 3, 2, 6, 0);
    for (const s of shots) { g.rect(s.x - 1 + ox, s.y - 2, 2, 4, 1); g.px(s.x + ox, s.y + 2, 0); }
    for (const p of parts) g.px(p.x + ox, p.y, p.l > 12 ? 0 : p.l > 6 ? 1 : 2);
    if (!dead && (inv <= 0 || (inv >> 2) & 1)) {
      g.spr(SHIP, px - 5 + ox, py - 5);
      const f = (t >> 1) & 1;
      g.px(px - 1 + ox, py + 5, f ? 0 : 1);
      g.px(px + 1 + ox, py + 5, f ? 1 : 0);
      if (f) g.px(px + ox, py + 6, 1);
      if (power > 0 && (power > 120 || (power >> 3) & 1)) { g.px(px - 6 + ox, py, 0); g.px(px + 6 + ox, py, 0); }
    }
    // HUD
    g.rect(0, 0, W, 11, 3);
    g.rect(0, 11, W, 1, 2);
    g.text(pad(score, 5), 3, 2, 0);
    for (let i = 0; i < lives; i++) g.spr(HEART, W - 8 - i * 7, 3);
    for (let i = 0; i < bombs; i++) g.spr(BOMB, 44 + i * 7, 3, false, false, 1);
    g.text('OLA' + level, 76, 2, 1);
    if (banner > 0 && !dead && (banner > 30 || (banner >> 2) & 1)) {
      g.octext('OLA ' + level, 56, 0, 3, 2);
      if (level === 1) g.octext('A DISPARO  B BOMBA', 80, 1, 3);
    }
    if (paused) {
      g.rect(48, 60, 64, 21, 3);
      g.frame(48, 60, 64, 21, 0);
      g.ctext('PAUSA', 67, 0);
    }
    if (flash > 0 && flash & 1) for (let i = 0; i < g.buf.length; i++) g.buf[i] = 3 - g.buf[i];
  }

  return {
    update() {
      t++;
      if (mode === 'title') {
        for (const s of stars) { s.y += 0.2 + s.s * 0.25; if (s.y >= H) s.y -= H; }
        if (t === 2) sys.music(SONG);
        if (sys.btnp('select')) sys.toggleMusic();
        if (sys.btnp('start') || sys.btnp('a')) {
          reset();
          mode = 'play';
          sys.tone(660, 0.08, { vol: 0.12 });
          sys.tone(990, 0.16, { vol: 0.12, delay: 0.08 });
        }
      } else if (mode === 'play') updatePlay();
      else {
        for (const s of stars) { s.y += 0.2; if (s.y >= H) s.y -= H; }
        if (t > 50 && (sys.btnp('start') || sys.btnp('a'))) {
          reset();
          mode = 'play';
          sys.music(SONG);
        }
        if (t > 50 && sys.btnp('b')) { mode = 'title'; t = 0; }
      }
    },
    draw(g) {
      if (mode === 'title') {
        g.cls(3);
        drawStars(g);
        g.circ(128, 150, 44, 2);
        g.circ(124, 154, 44, 1);
        g.dither(80, 124, 80, 20, 2);
        const by = Math.round(Math.sin(t * 0.05) * 3);
        g.octext('ASTRO', 20, 0, 2, 3);
        g.octext('PATRULLA', 46, 0, 2, 2);
        g.spr(SHIP, 30, 84 + by);
        g.px(34, 94 + by, (t >> 2) & 1 ? 0 : 1);
        g.px(36, 94 + by, (t >> 2) & 1 ? 1 : 0);
        g.spr(SAUCER, 60, 78 - by);
        g.spr(BUG, 84, 86 + by, (t >> 4) & 1);
        if ((t >> 5) & 1) g.octext('PULSA START', 104, 0, 3);
        g.otext('RECORD ' + pad(hi, 5), 4, 132, 1, 3);
      } else if (mode === 'play') drawPlay(g);
      else {
        g.cls(3);
        drawStars(g);
        g.octext('FIN DE LA', 22, 0, 2, 2);
        g.octext('MISION', 42, 0, 2, 2);
        g.ctext('PUNTOS ' + pad(score, 5), 70, 0);
        g.ctext('RECORD ' + pad(hi, 5), 82, 1);
        if (newHi && (t >> 3) & 1) g.ctext('* NUEVO RECORD *', 96, 0);
        if (t > 50 && (t >> 5) & 1) g.ctext('START: OTRA VEZ', 116, 0);
        g.ctext('B: TITULO', 130, 2);
      }
    },
  };
}
