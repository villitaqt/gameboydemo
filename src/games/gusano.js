import { sprite, pad, W, H } from '../gfx.js';

// GUSANO GLOTÓN — un gusano que crece comiendo manzanas. Fondo claro, tinta oscura.
const CW = 20, CH = 16, CS = 8, OY = 16;

export const APPLE = sprite([
  '....33..',
  '...3....',
  '.33.33..',
  '3223333.',
  '3233333.',
  '3333333.',
  '.33333..',
  '..3.3...',
]);
const STAR = sprite([
  '...33...',
  '...33...',
  '33333333',
  '.332233.',
  '..3223..',
  '.333333.',
  '.33..33.',
  '33....33',
]);
const BRICK = sprite([
  '33333333',
  '32223222',
  '32223222',
  '33333333',
  '22322232',
  '22322232',
  '33333333',
  '32223222',
]);
const HEAD = sprite([
  '.333333.',
  '33333333',
  '33033033',
  '33033033',
  '33333333',
  '33333333',
  '33333333',
  '.333333.',
]);
const BODY = sprite([
  '.333333.',
  '33333333',
  '33322333',
  '33222233',
  '33222233',
  '33322333',
  '33333333',
  '.333333.',
]);
const HEART = sprite(['.3.3.', '33333', '33333', '.333.', '..3..']);

const SONG = {
  step: 0.15,
  ch: [
    {
      type: 'square', vol: 0.045,
      seq: 'C5 E5 G5:2 E5 G5 C6:2 A4 C5 E5:2 C5 E5 A5:2 F4 A4 C5:2 A4 C5 F5:2 G4 B4 D5:2 G5 F5 D5:2',
    },
    {
      type: 'triangle', vol: 0.11, gate: 0.55,
      seq: 'C3:2 G3:2 C3:2 G3:2 A2:2 E3:2 A2:2 E3:2 F2:2 C3:2 F2:2 C3:2 G2:2 D3:2 G2:2 D3:2',
    },
  ],
};

// niveles: lista de rectángulos de ladrillo [x,y,w,h] en celdas
const LEVELS = [
  [],
  [[3, 3, 3, 1], [3, 4, 1, 2], [14, 3, 3, 1], [16, 4, 1, 2], [3, 12, 3, 1], [3, 10, 1, 2], [14, 12, 3, 1], [16, 10, 1, 2]],
  [[2, 5, 6, 1], [12, 5, 6, 1], [2, 10, 6, 1], [12, 10, 6, 1]],
  [[6, 2, 1, 5], [6, 9, 1, 5], [13, 2, 1, 5], [13, 9, 1, 5]],
  [[9, 2, 2, 4], [9, 10, 2, 4], [2, 7, 5, 2], [13, 7, 5, 2]],
  [[3, 3, 6, 1], [11, 3, 6, 1], [3, 12, 6, 1], [11, 12, 6, 1], [3, 4, 1, 3], [16, 4, 1, 3], [3, 9, 1, 3], [16, 9, 1, 3]],
];
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export function createGusano(sys) {
  let mode = 'title', t = 0;
  let hi = sys.load('gusano.hi', 0);
  let score, lives, level, eaten, snake, dir, queue, moveT, walls, apple, bonus, ready, dying, grow, paused, newHi, banner, pop;

  const blocked = (x, y) => walls[y * CW + x] === 1;
  const onSnake = (x, y) => snake.some((s) => s.x === x && s.y === y);
  function freeCell() {
    for (let n = 0; n < 500; n++) {
      const x = (Math.random() * CW) | 0, y = (Math.random() * CH) | 0;
      if (!blocked(x, y) && !onSnake(x, y) && !(apple && apple.x === x && apple.y === y) && !(y === 8 && x < 10)) return { x, y };
    }
    return { x: 0, y: 0 };
  }
  function startLevel() {
    walls = new Uint8Array(CW * CH);
    const L = LEVELS[(level - 1) % LEVELS.length];
    for (const [x, y, w, h] of L) for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) walls[j * CW + i] = 1;
    snake = [];
    for (let i = 0; i < 4; i++) snake.push({ x: 5 - i, y: 8 });
    dir = [1, 0];
    queue = [];
    moveT = 0;
    grow = 0;
    apple = null;
    apple = freeCell();
    bonus = null;
    ready = 70;
    dying = 0;
    eaten = 0;
    banner = 70;
  }
  function reset() {
    score = 0; lives = 3; level = 1; paused = false; newHi = false; pop = 0;
    startLevel();
  }
  reset();

  function die() {
    dying = 1;
    sys.noise(0.4, { freq: 1500, slide: 100, vol: 0.28 });
    sys.tone(330, 0.35, { slide: 60, vol: 0.14 });
  }
  function step() {
    while (queue.length) {
      const d = queue.shift();
      if (d[0] !== -dir[0] || d[1] !== -dir[1]) { dir = d; break; }
    }
    const h = snake[0];
    const nx = (h.x + dir[0] + CW) % CW, ny = (h.y + dir[1] + CH) % CH;
    if (blocked(nx, ny) || snake.some((s, i) => s.x === nx && s.y === ny && !(i === snake.length - 1 && grow === 0))) {
      die();
      return;
    }
    snake.unshift({ x: nx, y: ny });
    if (grow > 0) grow--;
    else snake.pop();
    if (apple && nx === apple.x && ny === apple.y) {
      grow += 1;
      eaten++;
      pop = 6;
      score += 10 * level;
      sys.tone(520, 0.05, { vol: 0.12 });
      sys.tone(780, 0.08, { vol: 0.12, delay: 0.05 });
      if (eaten >= 8) {
        level++;
        score += 50;
        [523, 659, 784, 1047, 1319].forEach((f, n) => sys.tone(f, 0.09, { delay: n * 0.08, vol: 0.12 }));
        startLevel();
        return;
      }
      apple = freeCell();
      if (eaten % 3 === 0 && !bonus) {
        const c = freeCell();
        bonus = { x: c.x, y: c.y, t: 420 };
        sys.tone(1568, 0.05, { vol: 0.08 });
        sys.tone(2093, 0.05, { vol: 0.08, delay: 0.06 });
      }
    }
    if (bonus && nx === bonus.x && ny === bonus.y) {
      score += 50 * level;
      grow += 1;
      pop = 10;
      bonus = null;
      [1047, 1319, 1568, 2093].forEach((f, n) => sys.tone(f, 0.06, { delay: n * 0.05, vol: 0.12 }));
    }
  }
  function updatePlay() {
    if (sys.btnp('start') && !dying) {
      paused = !paused;
      sys.tone(paused ? 660 : 880, 0.06, { vol: 0.1 });
    }
    if (sys.btnp('select')) sys.toggleMusic();
    if (paused) return;
    for (const k in DIRS) {
      if (sys.btnp(k) && queue.length < 3) {
        const last = queue.length ? queue[queue.length - 1] : dir;
        const d = DIRS[k];
        if ((d[0] !== last[0] || d[1] !== last[1]) && (d[0] !== -last[0] || d[1] !== -last[1])) queue.push(d);
      }
    }
    if (banner > 0) banner--;
    if (pop > 0) pop--;
    if (dying) {
      dying++;
      if (dying % 4 === 0 && snake.length > 1) snake.pop();
      if (dying > 70) {
        lives--;
        if (lives <= 0) {
          mode = 'over';
          t = 0;
          sys.music(null);
          if (score > hi) { hi = score; newHi = true; sys.save('gusano.hi', hi); }
          [392, 330, 262, 196].forEach((f, n) => sys.tone(f, 0.22, { delay: n * 0.2, vol: 0.12, type: 'triangle' }));
        } else startLevel();
      }
      return;
    }
    if (ready > 0) {
      ready--;
      if (queue.length) ready = Math.min(ready, 6);
      return;
    }
    if (bonus && --bonus.t <= 0) bonus = null;
    const base = Math.max(4, 10 - Math.floor((level - 1) * 0.8));
    const interval = sys.btn('a') || sys.btn('b') ? Math.max(2, base >> 1) : base;
    if (++moveT >= interval) {
      moveT = 0;
      step();
    }
  }
  function drawField(g) {
    g.cls(0);
    // puntos de fondo
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) g.px(x * CS + 4, OY + y * CS + 4, 1);
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (walls[y * CW + x]) g.spr(BRICK, x * CS, OY + y * CS);
    if (apple) {
      const b = (t >> 4) & 1;
      g.spr(APPLE, apple.x * CS, OY + apple.y * CS - b);
    }
    if (bonus && (bonus.t > 120 || (bonus.t >> 2) & 1)) g.spr(STAR, bonus.x * CS, OY + bonus.y * CS);
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      if (dying && (dying >> 2) & 1) continue;
      if (i === 0) {
        const x = s.x * CS, y = OY + s.y * CS;
        g.spr(HEAD, x, y);
        // ojos según la dirección
        g.rect(x + 2, y + 2, 4, 2, 3);
        g.rect(x + 2, y + 2, 4, 2, 3);
        const ex = dir[0], ey = dir[1];
        const e1 = ex !== 0 ? [x + 3 + ex * 2, y + 2] : [x + 2, y + 3 + ey * 2];
        const e2 = ex !== 0 ? [x + 3 + ex * 2, y + 5] : [x + 5, y + 3 + ey * 2];
        g.rect(e1[0] - (ex < 0 ? 0 : 0), e1[1], ex !== 0 ? 2 : 1, ex !== 0 ? 1 : 2, 0);
        g.rect(e2[0], e2[1], ex !== 0 ? 2 : 1, ex !== 0 ? 1 : 2, 0);
        if (pop > 0) g.frame(x - 1, y - 1, 10, 10, 3);
      } else g.spr(BODY, s.x * CS, OY + s.y * CS);
    }
    // HUD
    g.rect(0, 0, W, 15, 3);
    g.rect(0, 15, W, 1, 2);
    g.text(pad(score, 5), 3, 4, 0);
    g.text('NV' + level, 44, 4, 1);
    for (let i = 0; i < 8; i++) {
      if (i < eaten) g.rect(74 + i * 6, 5, 4, 5, 0);
      else g.frame(74 + i * 6, 5, 4, 5, 2);
    }
    for (let i = 0; i < lives; i++) g.spr(HEART, W - 8 - i * 7, 5, false, false, 0);
  }

  return {
    update() {
      t++;
      if (mode === 'title') {
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
        g.cls(0);
        for (let y = 0; y < 18; y++) for (let x = 0; x < CW; x++) g.px(x * 8 + 4, y * 8 + 4, 1);
        g.rect(0, 0, W, 6, 3);
        g.dither(0, 6, W, 3, 3);
        g.text('GUSANO', 28 + 2, 18 + 2, 1, 3);
        g.text('GUSANO', 28, 18, 3, 3);
        g.text('GLOTON', 46 + 1, 46 + 1, 1, 2);
        g.text('GLOTON', 46, 46, 3, 2);
        // gusano que cruza la pantalla ondulando
        const hx = ((t * 0.9) % 240) - 40;
        for (let i = 7; i >= 0; i--) {
          const x = hx - i * 7, y = 82 + Math.round(Math.sin((t - i * 7) * 0.12) * 4);
          g.spr(i === 0 ? HEAD : BODY, x, y);
          if (i === 0) { g.rect(x + 5, y + 2, 2, 1, 0); g.rect(x + 5, y + 5, 2, 1, 0); }
        }
        g.spr(APPLE, 140, 82 - ((t >> 4) & 1));
        if ((t >> 5) & 1) g.ctext('PULSA START', 106, 3);
        g.rect(0, 126, W, 18, 3);
        g.dither(0, 123, W, 3, 3);
        g.text('RECORD ' + pad(hi, 5), 4, 132, 0);
      } else if (mode === 'play') {
        drawField(g);
        if (banner > 0 && !dying) {
          g.rect(40, 56, 80, 30, 0);
          g.frame(40, 56, 80, 30, 3);
          g.frame(42, 58, 76, 26, 2);
          g.ctext('NIVEL ' + level, 62, 3);
          g.ctext(level === 1 ? 'A: TURBO' : 'LISTO?', 73, 2);
        }
        if (paused) {
          g.rect(48, 60, 64, 21, 0);
          g.frame(48, 60, 64, 21, 3);
          g.ctext('PAUSA', 67, 3);
        }
      } else {
        g.cls(0);
        for (let y = 0; y < 18; y++) for (let x = 0; x < CW; x++) g.px(x * 8 + 4, y * 8 + 4, 1);
        g.ctext('FIN DEL', 20, 3, 2);
        g.ctext('BANQUETE', 40, 3, 2);
        g.ctext('PUNTOS ' + pad(score, 5), 70, 3);
        g.ctext('RECORD ' + pad(hi, 5), 82, 2);
        if (newHi && (t >> 3) & 1) g.ctext('* NUEVO RECORD *', 96, 3);
        if (t > 50 && (t >> 5) & 1) g.ctext('START: OTRA VEZ', 116, 3);
        g.ctext('B: TITULO', 130, 2);
      }
    },
  };
}
