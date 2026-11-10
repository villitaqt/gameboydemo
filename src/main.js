import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createStage } from './stage.js';
import { GameBoy } from './console.js';
import { AudioSys } from './audio.js';
import { System } from './system.js';
import { createAstro } from './games/astro.js';
import { createGusano } from './games/gusano.js';
import { tween, wait, updateTweens, ease, lerp } from './tween.js';

const GAMES = {
  astro: { title: 'Astro Patrulla', create: createAstro },
  gusano: { title: 'Gusano Glotón', create: createGusano },
};

const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const stage = createStage(renderer);
const camera = new THREE.PerspectiveCamera(32, 1, 1, 400);
const audio = new AudioSys();
const sys = new System(audio, GAMES);

const CAM = {
  rest: { pos: new THREE.Vector3(0, 37, 25), look: new THREE.Vector3(0, 1.2, -1.2) },
  hold: { pos: new THREE.Vector3(0, 14.6, 36.5), look: new THREE.Vector3(0, 9.9, 0) },
};
const S = {
  ready: false,
  held: false,
  busy: false,
  power: false,
  cart: 'astro',
  zoom: 1,
  zoomT: 1,
  contrast: 0.55,
  volume: 0.7,
  yawVel: 0,
  swapK: 0, // 0..1: la cámara se aleja para ver el cambio de cartucho
  mx: 0,
  my: 0,
  pmx: 0,
  pmy: 0,
};
let gb = null;

// ---------- interfaz mínima ----------
const $ = (id) => document.getElementById(id);
let toastT = 0, quietT = 0;
function toast(msg, ms = 2600) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), ms);
}
function tip(msg) {
  const el = $('tip');
  if (msg) el.textContent = msg;
  el.classList.toggle('show', !!msg);
}
function wake() {
  document.body.classList.remove('quiet');
  clearTimeout(quietT);
  quietT = setTimeout(() => document.body.classList.add('quiet'), 9000);
}

// ---------- acciones ----------
async function pickUp() {
  if (S.held) return;
  S.held = true;
  document.body.classList.add('held');
  wake();
  audio.mech('whoosh');
  await tween(1.05, (k) => (gb.hold = k), ease.inOut);
}
async function putDown() {
  if (!S.held || S.busy) return;
  S.busy = true;
  S.held = false;
  document.body.classList.remove('held');
  const y0 = gb.yaw, p0 = gb.pitch;
  const yT = Math.round(y0 / (Math.PI * 2)) * Math.PI * 2;
  S.yawVel = 0;
  audio.mech('whoosh');
  await tween(0.95, (k) => {
    gb.hold = 1 - k;
    gb.yaw = lerp(y0, yT, Math.min(1, k * 1.6));
    gb.pitch = lerp(p0, 0, Math.min(1, k * 1.6));
  }, ease.inOut);
  gb.yaw = gb.pitch = 0;
  audio.mech('deskBig');
  S.busy = false;
}
async function setPower(on) {
  if (S.power === on) return;
  S.power = on;
  audio.mech('switch');
  gb.bounce(on ? -0.6 : 0.6);
  gb.setSwitch(on);
  if (on) {
    sys.powerOn(S.cart);
    audio.tone(60, 0.05, { vol: 0.2, type: 'triangle' });
    tween(0.12, (k) => (gb.led = k));
    tween(0.4, (k) => (gb.lcd.power = k), ease.out);
  } else {
    sys.powerOff();
    tween(0.5, (k) => (gb.led = 1 - k), ease.out);
    tween(0.28, (k) => (gb.lcd.power = 1 - k), ease.in);
  }
}
function togglePower() {
  if (S.busy) return;
  setPower(!S.power);
}

// contactos hacia el espectador, etiqueta hacia arriba
const BLOW_Q = new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1.82)
  .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
async function changeCart(target) {
  if (S.busy || !S.ready) return;
  if (target === S.cart) target = null; // clic en el cartucho insertado: expulsar
  S.busy = true;
  tip('');
  if (!S.held) await pickUp();
  if (S.power) {
    await setPower(false);
    await wait(0.4);
  }
  // girar la consola para ver la ranura
  S.yawVel = 0;
  const y0 = gb.yaw, p0 = gb.pitch;
  const yBack = Math.round((y0 - Math.PI) / (Math.PI * 2)) * Math.PI * 2 + Math.PI;
  const z0 = S.zoomT;
  S.zoomT = 1;
  await tween(0.8, (k) => {
    gb.yaw = lerp(y0, yBack, k);
    gb.pitch = lerp(p0, 0.42, k);
    S.swapK = k;
  });

  if (S.cart) {
    const c = gb.carts[S.cart];
    c.flying = true;
    audio.mech('slideOut');
    gb.bounce(0.5);
    await tween(0.42, (k) => {
      const { p, q } = gb.slotPose(72 * k);
      c.wrap.position.copy(p);
      c.wrap.quaternion.copy(q);
    }, ease.out);
    await gb.flyCart(c, () => ({ p: c.deskP, q: c.deskQ }), 0.75, ease.inOut, 3.5);
    audio.mech('desk');
    c.where = 'desk';
    c.flying = false;
    S.cart = null;
  }
  if (target) {
    const c = gb.carts[target];
    c.flying = true;
    c.where = 'air';
    if (!c.blown) {
      // el ritual: soplar los contactos antes de meterlo
      const bp = new THREE.Vector3(0, 12.2, 23);
      await gb.flyCart(c, () => ({ p: bp, q: BLOW_Q }), 0.65, ease.inOut, 2);
      audio.mech('blow');
      stage.puff(new THREE.Vector3(0, 13.1, 26.2), new THREE.Vector3(0, 0.6, -0.55));
      const q0 = c.wrap.quaternion.clone();
      await tween(0.55, (k) => {
        c.wrap.position.z = bp.z - Math.sin(k * Math.PI) * 0.5;
        c.wrap.quaternion.copy(q0).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(k * Math.PI) * 0.08, 0, 0)));
      }, ease.linear);
      c.blown = true;
    }
    await gb.flyCart(c, () => gb.slotPose(72), 0.7, ease.inOut, 1.5);
    await wait(0.08);
    audio.mech('slideIn');
    await tween(0.26, (k) => {
      const { p, q } = gb.slotPose(72 * (1 - k));
      c.wrap.position.copy(p);
      c.wrap.quaternion.copy(q);
    }, ease.in);
    audio.mech('clunk');
    gb.bounce(-2.4);
    c.where = 'slot';
    c.flying = false;
    S.cart = target;
    toast(GAMES[target].title + ' · listo', 2200);
  }
  await wait(0.22);
  await tween(0.8, (k) => {
    gb.yaw = lerp(yBack, yBack + Math.PI, k);
    gb.pitch = lerp(0.42, 0, k);
    S.swapK = 1 - k;
  });
  gb.yaw = 0;
  S.zoomT = z0;
  S.busy = false;
  if (!S.cart) toast('Sin cartucho · elige uno de la mesa', 3000);
}
function cycleCart() {
  changeCart(S.cart === 'astro' ? 'gusano' : 'astro');
}
function resetView() {
  if (S.busy) return;
  const y0 = gb.yaw, p0 = gb.pitch;
  const yT = Math.round(y0 / (Math.PI * 2)) * Math.PI * 2;
  S.yawVel = 0;
  tween(0.6, (k) => {
    gb.yaw = lerp(y0, yT, k);
    gb.pitch = lerp(p0, 0, k);
  });
  S.zoomT = 1;
}

// ---------- botones (físicos y teclado comparten el mismo camino) ----------
const sources = {};
function press(name, src, down) {
  const set = (sources[name] ||= new Set());
  const was = set.size > 0;
  if (down) set.add(src);
  else set.delete(src);
  const is = set.size > 0;
  if (was === is) return;
  gb.setHeld(name, is);
  sys.setButton(name, is);
  const rubber = name === 'start' || name === 'select';
  audio.mech((rubber ? 'rubber' : 'btn') + (is ? 'Down' : 'Up'));
}

const KEYS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  KeyX: 'a', KeyK: 'a', Space: 'a', KeyZ: 'b', KeyJ: 'b',
  Enter: 'start', ShiftLeft: 'select', ShiftRight: 'select', Backspace: 'select',
};
window.addEventListener('keydown', (e) => {
  if (!S.ready || e.ctrlKey || e.metaKey || e.altKey) return;
  audio.unlock();
  const b = KEYS[e.code];
  if (b) {
    e.preventDefault();
    if (!e.repeat) press(b, 'key:' + e.code, true);
    return;
  }
  if (e.repeat) return;
  wake();
  if (e.code === 'KeyP') togglePower();
  else if (e.code === 'KeyC') cycleCart();
  else if (e.code === 'KeyR') resetView();
  else if (e.code === 'Escape') S.held ? putDown() : !S.busy && pickUp();
});
window.addEventListener('keyup', (e) => {
  const b = KEYS[e.code];
  if (b && gb) press(b, 'key:' + e.code, false);
});
window.addEventListener('blur', () => {
  for (const n in sources) for (const s of [...sources[n]]) press(n, s, false);
});

// ---------- puntero ----------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pickAt(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  return gb.pick(ray);
}
const ptr = new Map(); // pointerId -> { mode, name, x, y }
const TIPS = {
  power: () => (S.power ? 'Apagar · P' : 'Encender · P'),
  cart: (h) => (h.id === S.cart ? 'Expulsar cartucho' : 'Insertar ' + GAMES[h.id].title),
  wheel: (h) => (h.which === 'contrast' ? 'Contraste · arrastra' : 'Volumen · arrastra'),
};
function setWheel(which, v) {
  v = Math.max(0, Math.min(1, v));
  const prev = S[which];
  if (Math.floor(prev * 24) !== Math.floor(v * 24)) audio.mech('wheel');
  S[which] = v;
  gb.setWheel(which, v);
  if (which === 'contrast') gb.lcd.contrast = v;
  else audio.setVolume(v);
}

canvas.addEventListener('pointerdown', (e) => {
  if (!S.ready) return;
  audio.unlock();
  wake();
  canvas.setPointerCapture(e.pointerId);
  const h = pickAt(e);
  const st = { mode: 'none', x: e.clientX, y: e.clientY, moved: 0 };
  ptr.set(e.pointerId, st);
  if (S.busy) return;
  if (h?.type === 'cart') return void changeCart(h.id);
  if (!S.held) return void pickUp();
  if (h?.type === 'btn') {
    st.mode = 'btn';
    st.name = h.name;
    press(h.name, 'ptr' + e.pointerId, true);
  } else if (h?.type === 'dpad') {
    st.mode = 'dpad';
    st.name = gb.dpadDir(h.point);
    press(st.name, 'ptr' + e.pointerId, true);
  } else if (h?.type === 'power') togglePower();
  else if (h?.type === 'wheel') {
    st.mode = 'wheel';
    st.which = h.which;
    canvas.style.cursor = 'ns-resize';
  } else {
    st.mode = 'rotate';
    canvas.style.cursor = 'grabbing';
  }
});
canvas.addEventListener('pointermove', (e) => {
  S.mx = (e.clientX / innerWidth) * 2 - 1;
  S.my = (e.clientY / innerHeight) * 2 - 1;
  if (!S.ready) return;
  const st = ptr.get(e.pointerId);
  if (!st) {
    // hover
    const h = S.busy ? null : pickAt(e);
    const t = h && TIPS[h.type];
    const active = h && (h.type !== 'body' || !S.held);
    canvas.style.cursor = active && (h.type !== 'body') ? 'pointer' : S.held ? 'grab' : 'pointer';
    tip(t && (S.held || h.type === 'cart') ? t(h) : '');
    return;
  }
  const dx = e.clientX - st.x, dy = e.clientY - st.y;
  st.x = e.clientX;
  st.y = e.clientY;
  if (st.mode === 'rotate') {
    gb.yaw += dx * 0.0075;
    gb.pitch = Math.max(-1.15, Math.min(1.15, gb.pitch + dy * 0.006));
    S.yawVel = dx * 0.0075 * 60;
  } else if (st.mode === 'wheel') {
    setWheel(st.which, S[st.which] - dy * 0.006);
  } else if (st.mode === 'dpad') {
    const h = pickAt(e);
    if (h?.type === 'dpad') {
      const d = gb.dpadDir(h.point);
      if (d !== st.name) {
        press(st.name, 'ptr' + e.pointerId, false);
        st.name = d;
        press(d, 'ptr' + e.pointerId, true);
      }
    }
  }
});
function endPtr(e) {
  const st = ptr.get(e.pointerId);
  if (!st) return;
  ptr.delete(e.pointerId);
  if (st.mode === 'btn' || st.mode === 'dpad') press(st.name, 'ptr' + e.pointerId, false);
  canvas.style.cursor = S.held ? 'grab' : 'pointer';
}
canvas.addEventListener('pointerup', endPtr);
canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('dblclick', (e) => {
  const h = pickAt(e);
  if (S.held && (!h || h.type === 'body')) resetView();
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (!S.ready) return;
  const h = S.held && !S.busy ? pickAt(e) : null;
  if (h?.type === 'wheel') setWheel(h.which, S[h.which] - Math.sign(e.deltaY) * 0.05);
  else S.zoomT = Math.max(0.5, Math.min(1.35, S.zoomT * (e.deltaY > 0 ? 1.08 : 0.926)));
}, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- bucle ----------
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

let last = performance.now(), time = 0;
const vPos = new THREE.Vector3(), vLook = new THREE.Vector3();
function step(dt) {
  time += dt;
  updateTweens(dt);
  if (gb) {
    // inercia del giro
    if (![...ptr.values()].some((p) => p.mode === 'rotate') && !S.busy) {
      gb.yaw += S.yawVel * dt;
      S.yawVel *= Math.exp(-dt * 5);
    }
    sys.update(dt);
    gb.lcd.update(sys.g.buf, dt);
    gb.update(dt, time);
    stage.update(dt, time);

    const e = ease.inOut(gb.hold);
    S.zoom += (S.zoomT - S.zoom) * (1 - Math.exp(-dt * 8));
    S.pmx += (S.mx - S.pmx) * (1 - Math.exp(-dt * 3));
    S.pmy += (S.my - S.pmy) * (1 - Math.exp(-dt * 3));
    const af = Math.max(1, 1.12 / camera.aspect);
    vLook.lerpVectors(CAM.rest.look, CAM.hold.look, e);
    vPos.lerpVectors(CAM.rest.pos, CAM.hold.pos, e).sub(vLook).multiplyScalar(af * lerp(1, S.zoom, e) * (1 + S.swapK * 0.3)).add(vLook);
    // al acercarse, el encuadre sube hacia la pantalla; en el cambio de cartucho, hacia la ranura
    const lift = (Math.max(0, 1 - S.zoom) * 6.4 + S.swapK * 4.2) * e;
    vLook.y += lift;
    vPos.y += lift;
    vPos.x += S.pmx * 0.5;
    vPos.y -= S.pmy * 0.3;
    camera.position.copy(vPos);
    camera.lookAt(vLook);
  }
  renderer.render(stage.scene, camera);
}
function frame() {
  const nowMs = performance.now();
  const dt = Math.min(0.05, (nowMs - last) / 1000);
  last = nowMs;
  step(dt);
  requestAnimationFrame(frame);
}
frame();

// ---------- carga ----------
new GLTFLoader().load(
  '/models/gameboy/gameboy.glb',
  (gltf) => {
    gb = new GameBoy(gltf, renderer, stage);
    gb.setWheel('contrast', S.contrast);
    gb.setWheel('volume', S.volume);
    gb.lcd.contrast = S.contrast;
    sys.onNoCart = () => toast('Sin cartucho · pulsa C para insertar uno', 3600);
    renderer.compile(stage.scene, camera);
    S.ready = true;
    canvas.style.cursor = 'pointer';
    $('loader').classList.add('done');
    window.__gb = { S, gb, sys, audio, press, setPower, changeCart, pickUp, putDown, camera, stage, step };
  },
  undefined,
  (err) => {
    console.error(err);
    $('loader').firstElementChild.textContent = 'no se pudo cargar el modelo';
  }
);
