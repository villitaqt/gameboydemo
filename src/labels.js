import { SHIP, SAUCER } from './games/astro.js';
import { APPLE } from './games/gusano.js';

// Etiquetas de los cartuchos, pintadas sobre la textura original del modelo.
function pix(ctx, s, x, y, px, pal) {
  for (let j = 0; j < s.h; j++)
    for (let i = 0; i < s.w; i++) {
      const v = s.d[j * s.w + i];
      if (v < 0) continue;
      ctx.fillStyle = pal[v];
      ctx.fillRect(x + i * px, y + j * px, px + 0.5, px + 0.5);
    }
}
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function strip(ctx, w, h, bg, fg, left, right) {
  ctx.fillStyle = bg;
  ctx.fillRect(0, h - 34, w, 34);
  ctx.fillStyle = fg;
  ctx.font = '700 15px "Trebuchet MS", Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(left, 16, h - 16);
  ctx.textAlign = 'right';
  ctx.fillText(right, w - 16, h - 16);
}
function title(ctx, txt, x, y, size, fill, stroke, shadow) {
  ctx.font = `italic 900 ${size}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.fillStyle = shadow;
  ctx.fillText(txt, x + 4, y + 5);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 8;
  ctx.strokeText(txt, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(txt, x, y);
}

function astro(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0d1238');
  g.addColorStop(0.6, '#2a1a5e');
  g.addColorStop(1, '#5a2a7a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.7})`;
    const r = rnd() < 0.15 ? 3 : 2;
    ctx.fillRect(rnd() * w, rnd() * (h - 40), r, r);
  }
  // planeta
  ctx.fillStyle = '#ff7a3d';
  ctx.beginPath();
  ctx.arc(w * 0.86, h * 0.98, 120, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#ffb14a';
  ctx.beginPath();
  ctx.arc(w * 0.83, h * 0.95, 104, 0, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,240,200,0.8)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.ellipse(w * 0.84, h * 0.82, 170, 26, -0.25, 3.3, 6.4);
  ctx.stroke();
  // estela y nave
  const sx = 58, sy = 118, px = 9;
  const tg = ctx.createLinearGradient(0, sy + 80, 0, h);
  tg.addColorStop(0, 'rgba(120,230,255,0.9)');
  tg.addColorStop(1, 'rgba(120,230,255,0)');
  ctx.fillStyle = tg;
  ctx.fillRect(sx + 4 * px, sy + 9 * px, px, 120);
  ctx.fillRect(sx + 6 * px, sy + 9 * px, px, 120);
  pix(ctx, SHIP, sx, sy, px, ['#f4f6ff', '#55d6ff', '#ff5a7a', '#000']);
  pix(ctx, SAUCER, 196, 132, 6, ['#b6ff6a', '#2a6a3a', '#ff5a7a', '#000']);
  pix(ctx, SAUCER, 252, 96, 4, ['#b6ff6a', '#2a6a3a', '#ff5a7a', '#000']);
  title(ctx, 'ASTRO', w / 2 - 6, 62, 62, '#ffe14a', '#1a0d3a', '#ff3d7a');
  title(ctx, 'PATRULLA', w / 2 + 14, 104, 40, '#ffffff', '#1a0d3a', '#ff3d7a');
  strip(ctx, w, h, '#0a0a1e', '#cfd4ff', 'CARTUCHO 01', '1989 · A-PTR');
}

function gusano(ctx, w, h) {
  ctx.fillStyle = '#c6e23c';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#b4d42c';
  for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) if ((i + j) & 1) ctx.fillRect(i * 28, j * 28, 28, 28);
  // sol/halo
  ctx.fillStyle = 'rgba(255,255,220,0.45)';
  ctx.beginPath();
  ctx.arc(250, 190, 78, 0, 7);
  ctx.fill();
  // gusano
  const pts = [];
  for (let i = 0; i < 9; i++) pts.push([36 + i * 23, 214 + Math.sin(i * 0.9) * 26]);
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const r = i === pts.length - 1 ? 25 : 19;
    ctx.fillStyle = '#12401c';
    ctx.beginPath();
    ctx.arc(x, y, r + 4, 0, 7);
    ctx.fill();
    ctx.fillStyle = i % 2 ? '#3fae3a' : '#57c94a';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 7);
    ctx.fill();
  }
  const [hx, hy] = pts[pts.length - 1];
  for (const dy of [-9, 9]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(hx + 9, hy + dy - 2, 7, 0, 7);
    ctx.fill();
    ctx.fillStyle = '#12401c';
    ctx.beginPath();
    ctx.arc(hx + 12, hy + dy - 2, 3.5, 0, 7);
    ctx.fill();
  }
  pix(ctx, APPLE, 252 - 28, 190 - 36, 8, ['#fff', '#fff', '#ff9a8a', '#d8262e']);
  title(ctx, 'GUSANO', w / 2 - 14, 66, 62, '#fffbe0', '#12401c', '#e8402a');
  title(ctx, 'GLOTÓN', w / 2 + 26, 114, 46, '#ffe14a', '#12401c', '#e8402a');
  strip(ctx, w, h, '#12401c', '#d8f08a', 'CARTUCHO 02', '1989 · G-GLT');
}

const PAINT = { astro, gusano };

export function paintLabel(THREE, material, id, renderer) {
  const img = material.map.image;
  const S = 2;
  const c = document.createElement('canvas');
  c.width = c.height = 1024 * S;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, c.width, c.height);
  // zona de la etiqueta en la textura (está volteada en vertical)
  const X = 2, Y0 = 543, Y1 = 864, LW = 333, LH = Y1 - Y0;
  ctx.save();
  ctx.translate((X + LW) * S, Y1 * S);
  ctx.scale(-S, -S);
  rrect(ctx, 0, 0, LW, LH, 9);
  ctx.clip();
  PAINT[id](ctx, LW, LH);
  // brillo del papel
  const sh = ctx.createLinearGradient(0, 0, LW, LH);
  sh.addColorStop(0, 'rgba(255,255,255,0.10)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, LW, LH);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 7;
  rrect(ctx, 0, 0, LW, LH, 9);
  ctx.stroke();
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  material.map = tex;
  material.needsUpdate = true;
}
