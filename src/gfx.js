// Framebuffer de 160x144 con 4 tonos (0 = más claro, 3 = más oscuro)
export const W = 160;
export const H = 144;

const F = {
  A: '01110 10001 10001 11111 10001 10001 10001',
  B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110',
  D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111',
  F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111',
  H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110',
  J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001',
  L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001',
  N: '10001 11001 10101 10011 10001 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110',
  P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101',
  R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110',
  T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110',
  V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 11011 10001',
  X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100',
  Z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10001 10011 10101 11001 10001 01110',
  1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01110 10001 00001 00010 00100 01000 11111',
  3: '11110 00001 00001 01110 00001 00001 11110',
  4: '00010 00110 01010 10010 11111 00010 00010',
  5: '11111 10000 11110 00001 00001 10001 01110',
  6: '00110 01000 10000 11110 10001 10001 01110',
  7: '11111 00001 00010 00100 01000 01000 01000',
  8: '01110 10001 10001 01110 10001 10001 01110',
  9: '01110 10001 10001 01111 00001 00010 01100',
  ' ': '00000 00000 00000 00000 00000 00000 00000',
  '.': '00000 00000 00000 00000 00000 01100 01100',
  ',': '00000 00000 00000 00000 01100 00100 01000',
  '!': '00100 00100 00100 00100 00100 00000 00100',
  '?': '01110 10001 00001 00010 00100 00000 00100',
  '-': '00000 00000 00000 11111 00000 00000 00000',
  ':': '00000 01100 01100 00000 01100 01100 00000',
  '+': '00000 00100 00100 11111 00100 00100 00000',
  '/': '00001 00001 00010 00100 01000 10000 10000',
  x: '00000 00000 10001 01010 00100 01010 10001',
  $: '00000 01010 11111 11111 01110 00100 00000', // corazón
  '*': '00000 10101 01110 11111 01110 10101 00000',
  '>': '01000 00100 00010 00001 00010 00100 01000',
  '<': '00010 00100 01000 10000 01000 00100 00010',
  "'": '00100 00100 01000 00000 00000 00000 00000',
  '#': '11111 11111 11111 11111 11111 11111 11111',
};
const FONT = {};
for (const k in F) FONT[k] = F[k].split(' ').map((r) => parseInt(r, 2));

// Crea un sprite a partir de filas de texto: '.' transparente, '0'-'3' tono
export function sprite(rows) {
  const w = Math.max(...rows.map((r) => r.length));
  const h = rows.length;
  const d = new Int8Array(w * h).fill(-1);
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const ch = r[x];
      if (ch >= '0' && ch <= '3') d[y * w + x] = ch.charCodeAt(0) - 48;
    }
  });
  return { w, h, d };
}

export class Gfx {
  constructor() {
    this.buf = new Uint8Array(W * H);
  }
  cls(c = 0) {
    this.buf.fill(c);
  }
  px(x, y, c) {
    x |= 0;
    y |= 0;
    if (x >= 0 && x < W && y >= 0 && y < H) this.buf[y * W + x] = c;
  }
  rect(x, y, w, h, c) {
    x = Math.round(x);
    y = Math.round(y);
    let x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
    const x0 = Math.max(0, x), y0 = Math.max(0, y);
    for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) this.buf[j * W + i] = c;
  }
  frame(x, y, w, h, c) {
    this.rect(x, y, w, 1, c);
    this.rect(x, y + h - 1, w, 1, c);
    this.rect(x, y, 1, h, c);
    this.rect(x + w - 1, y, 1, h, c);
  }
  dither(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if ((i + j) & 1) this.px(i, j, c);
  }
  circ(cx, cy, r, c) {
    const r2 = r * r;
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) if (i * i + j * j <= r2 + r * 0.5) this.px(cx + i, cy + j, c);
  }
  spr(s, x, y, flipX = false, flipY = false, tint = -1) {
    x = Math.round(x);
    y = Math.round(y);
    for (let j = 0; j < s.h; j++) {
      const py = y + j;
      if (py < 0 || py >= H) continue;
      const sj = flipY ? s.h - 1 - j : j;
      for (let i = 0; i < s.w; i++) {
        const px = x + i;
        if (px < 0 || px >= W) continue;
        const v = s.d[sj * s.w + (flipX ? s.w - 1 - i : i)];
        if (v >= 0) this.buf[py * W + px] = tint >= 0 ? tint : v;
      }
    }
  }
  textW(str, scale = 1) {
    return String(str).length * 6 * scale - scale;
  }
  text(str, x, y, c = 3, scale = 1) {
    str = String(str);
    x = Math.round(x);
    y = Math.round(y);
    for (let n = 0; n < str.length; n++) {
      const g = FONT[str[n]] || FONT['?'];
      for (let j = 0; j < 7; j++) {
        const row = g[j];
        if (!row) continue;
        for (let i = 0; i < 5; i++) {
          if (row & (16 >> i)) {
            if (scale === 1) this.px(x + i, y + j, c);
            else this.rect(x + i * scale, y + j * scale, scale, scale, c);
          }
        }
      }
      x += 6 * scale;
    }
  }
  ctext(str, y, c = 3, scale = 1) {
    this.text(str, (W - this.textW(str, scale)) / 2, y, c, scale);
  }
  // texto con sombra/contorno para legibilidad sobre fondos
  otext(str, x, y, c, o, scale = 1) {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) this.text(str, x + dx * scale, y + dy * scale, o, scale);
    this.text(str, x, y, c, scale);
  }
  octext(str, y, c, o, scale = 1) {
    this.otext(str, Math.round((W - this.textW(str, scale)) / 2), y, c, o, scale);
  }
}

export function pad(n, len) {
  return String(Math.max(0, n | 0)).padStart(len, '0');
}
