import * as THREE from 'three';
import { Lcd } from './lcd.js';
import { paintLabel } from './labels.js';
import { tween, ease } from './tween.js';

const REST_POS = new THREE.Vector3(0.5, 2.16, 0.5);
const HOLD_POS = new THREE.Vector3(0, 10.6, 0);
const REST_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0.2, 'XYZ'));
const HOLD_Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0, 0));

const DESK = {
  astro: { p: new THREE.Vector3(-11.6, 0.03, -3.5), yaw: 0.3 },
  gusano: { p: new THREE.Vector3(11.8, 0.03, -2.5), yaw: -0.24 },
};
function deskQuat(yaw) {
  // etiqueta hacia arriba, parte superior alejada del espectador
  const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI + yaw);
  return q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
}

export class GameBoy {
  constructor(gltf, renderer, stage) {
    this.stage = stage;
    this.rig = new THREE.Group();
    this.spin = new THREE.Group();
    this.kick = new THREE.Group();
    this.rig.add(this.spin);
    this.spin.add(this.kick);
    this.kick.add(gltf.scene);
    gltf.scene.scale.setScalar(100); // 1 unidad = 1 cm; RootNode trabaja en mm
    stage.scene.add(this.rig);
    this.rig.updateMatrixWorld(true);
    const root = (this.root = gltf.scene.getObjectByName('RootNode'));

    gltf.scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        if (o.material.map) o.material.map.anisotropy = renderer.capabilities.getMaxAnisotropy();
      }
    });

    this.hold = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.led = 0;
    this.held = new Set();
    this._kx = 0;
    this._ky = 0;
    this._bp = 0;
    this._bv = 0;

    this._setupCarts(root, renderer);
    this._setupButtons(root);
    this._setupScreen(root, stage);
    this._setupSwitch(root);
    this._setupWheels(root);
    this.update(0, 0);
  }

  // ---------- cartuchos ----------
  _setupCarts(root, renderer) {
    const scene = this.stage.scene;
    const cA = root.getObjectByName('cartridge_low');
    const chipA = root.getObjectByName('chip_low');
    this.slot = new THREE.Object3D();
    this.slot.position.copy(cA.position);
    root.add(this.slot);
    root.updateMatrixWorld(true);

    const wrapA = new THREE.Group();
    scene.add(wrapA);
    this.slot.matrixWorld.decompose(wrapA.position, wrapA.quaternion, wrapA.scale);
    wrapA.updateMatrixWorld(true);
    wrapA.attach(cA);
    wrapA.attach(chipA);
    cA.updateMatrix();

    const g1 = root.getObjectByName('Group001');
    const cB = g1.getObjectByName('cartridge_low001');
    const chipB = g1.getObjectByName('chip_low001');
    const WB = cB.matrixWorld.clone().multiply(cA.matrix.clone().invert());
    const wrapB = new THREE.Group();
    scene.add(wrapB);
    WB.decompose(wrapB.position, wrapB.quaternion, wrapB.scale);
    wrapB.updateMatrixWorld(true);
    wrapB.attach(cB);
    wrapB.attach(chipB);
    g1.removeFromParent();
    this.cartScale = wrapA.scale.clone();
    wrapB.scale.copy(this.cartScale);

    const mk = (id, wrap, mesh) => {
      wrap.userData.hit = { type: 'cart', id };
      let m = null;
      mesh.traverse((o) => o.isMesh && (m = o));
      paintLabel(THREE, m.material, id, renderer);
      return { id, wrap, where: 'desk', flying: false, blown: false, deskP: DESK[id].p, deskQ: deskQuat(DESK[id].yaw) };
    };
    this.carts = { astro: mk('astro', wrapA, cA), gusano: mk('gusano', wrapB, cB) };
    this.carts.astro.where = 'slot';
    const b = this.carts.gusano;
    b.wrap.position.copy(b.deskP);
    b.wrap.quaternion.copy(b.deskQ);
  }
  slotPose(lift = 0) {
    this.rig.updateMatrixWorld(true);
    const p = new THREE.Vector3(0, lift, 0).applyMatrix4(this.slot.matrixWorld);
    const q = this.slot.getWorldQuaternion(new THREE.Quaternion());
    return { p, q };
  }
  flyCart(cart, getPose, dur, e = ease.inOut, arc = 0) {
    const p0 = cart.wrap.position.clone(), q0 = cart.wrap.quaternion.clone();
    return tween(dur, (k) => {
      const { p, q } = getPose();
      cart.wrap.position.lerpVectors(p0, p, k);
      cart.wrap.position.y += Math.sin(Math.PI * Math.min(1, Math.max(0, k))) * arc;
      cart.wrap.quaternion.slerpQuaternions(q0, q, k);
    }, e);
  }

  // ---------- botones ----------
  _setupButtons(root) {
    this.buttons = {};
    const add = (name, obj, travel, rubber = false) => {
      obj.userData.hit = { type: 'btn', name };
      this.buttons[name] = { obj, base: obj.position.clone(), travel, v: 0, rubber };
    };
    // en el modelo, el botón de la derecha (A) se llama b_low
    add('a', root.getObjectByName('b_low'), 1.5);
    add('b', root.getObjectByName('a_low'), 1.5);

    // START y SELECT comparten malla: se separan por la mitad
    const selNode = root.getObjectByName('select_low');
    let selMesh = null;
    selNode.traverse((o) => o.isMesh && (selMesh = o));
    const geo = selMesh.geometry;
    geo.computeBoundingBox();
    const midX = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
    const pos = geo.attributes.position, idx = geo.index.array;
    const L = [], R = [];
    for (let i = 0; i < idx.length; i += 3) {
      const cx = (pos.getX(idx[i]) + pos.getX(idx[i + 1]) + pos.getX(idx[i + 2])) / 3;
      (cx < midX ? L : R).push(idx[i], idx[i + 1], idx[i + 2]);
    }
    const part = (ind, name) => {
      const g = geo.clone();
      g.setIndex(ind);
      const m = new THREE.Mesh(g, selMesh.material);
      m.castShadow = m.receiveShadow = true;
      selMesh.parent.add(m);
      add(name, m, 0.9, true);
    };
    part(L, 'select');
    part(R, 'start');
    selMesh.visible = false;

    // cruceta: bascula sobre su centro
    const pad = root.getObjectByName('movement_low');
    const knobs = root.getObjectByName('movementknobs_low');
    const pivot = new THREE.Group();
    pivot.position.set(pad.position.x, pad.position.y, 12.5);
    root.add(pivot);
    pivot.attach(pad);
    pivot.attach(knobs);
    pivot.userData.hit = { type: 'dpad' };
    this.dpad = { pivot, base: pivot.position.clone(), x: 0, y: 0, push: 0 };
  }
  dpadDir(worldPoint) {
    const p = this.dpad.pivot.worldToLocal(worldPoint.clone());
    if (Math.abs(p.x) > Math.abs(p.y)) return p.x > 0 ? 'right' : 'left';
    return p.y > 0 ? 'up' : 'down';
  }
  setHeld(name, down) {
    if (down) this.held.add(name);
    else this.held.delete(name);
  }

  // ---------- pantalla y LED ----------
  _setupScreen(root, stage) {
    const scr = root.getObjectByName('screen_low');
    scr.visible = false;
    this.lcd = new Lcd(53.13, 48.12);
    this.lcd.mesh.position.set(scr.position.x, scr.position.y, scr.position.z + 0.02);
    root.add(this.lcd.mesh);
    this.screenLight = new THREE.PointLight(0xc6e070, 0, 16, 2);
    this.screenLight.position.set(scr.position.x, scr.position.y, 26);
    root.add(this.screenLight);

    const bat = root.getObjectByName('battery_low');
    let batMesh = null;
    bat.traverse((o) => o.isMesh && (batMesh = o));
    const shared = batMesh.material;
    this.ledMat = shared.clone();
    batMesh.material = this.ledMat;
    shared.emissive.set(0x000000);
    this.ledMat.emissive.set(0xff2a1a);
    this.ledMat.emissiveIntensity = 0;
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: stage.dotTex, color: 0xff3a20, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    glow.scale.setScalar(11);
    glow.position.set(bat.position.x, bat.position.y, bat.position.z + 2.2);
    glow.raycast = () => {};
    root.add(glow);
    this.ledGlow = glow;
  }

  // ---------- interruptor ----------
  _setupSwitch(root) {
    const sw = root.getObjectByName('switch_low');
    this.sw = { obj: sw, base: sw.position.clone(), v: 0 };
    sw.userData.hit = { type: 'power' };
    const proxy = new THREE.Mesh(
      new THREE.BoxGeometry(17, 7, 10),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false })
    );
    proxy.position.set(sw.position.x + 1.5, sw.position.y + 2.5, sw.position.z);
    proxy.userData.hit = { type: 'power' };
    root.add(proxy);
    this._proxyMat = proxy.material;
  }
  setSwitch(on) {
    const from = this.sw.v, to = on ? 1 : 0;
    return tween(0.09, (k) => (this.sw.v = from + (to - from) * k), ease.out);
  }

  // ---------- ruedas de contraste y volumen ----------
  _setupWheels(root) {
    this.wheels = {};
    const mk = (which, name, px) => {
      const node = root.getObjectByName(name);
      const pivot = new THREE.Group();
      pivot.position.copy(node.position);
      root.add(pivot);
      pivot.attach(node);
      pivot.userData.hit = { type: 'wheel', which };
      const proxy = new THREE.Mesh(new THREE.BoxGeometry(7, 17, 7), this._proxyMat);
      proxy.position.set(px, node.position.y, node.position.z);
      proxy.userData.hit = { type: 'wheel', which };
      root.add(proxy);
      this.wheels[which] = { pivot };
    };
    mk('contrast', 'channel_low', -46.5);
    mk('volume', 'vol_low', 46.5);
  }
  setWheel(which, v) {
    this.wheels[which].pivot.rotation.z = (v - 0.5) * 2.2 * (which === 'volume' ? -1 : 1);
  }

  bounce(v) {
    this._bv += v;
  }

  pick(raycaster) {
    const hits = raycaster.intersectObjects([this.rig, this.carts.astro.wrap, this.carts.gusano.wrap], true);
    for (const h of hits) {
      let o = h.object;
      if (o.visible === false) continue;
      while (o) {
        if (o.userData.hit) return { ...o.userData.hit, point: h.point };
        o = o.parent;
      }
      return { type: 'body', point: h.point };
    }
    return null;
  }

  update(dt, time) {
    const e = this.hold;
    const k = (r) => 1 - Math.exp(-dt * r);
    // postura: sobre la mesa <-> en la mano
    this.rig.position.lerpVectors(REST_POS, HOLD_POS, e);
    this.rig.position.y += Math.sin(e * Math.PI) * 1.2 + Math.sin(time * 1.25) * 0.09 * e;
    this.rig.quaternion.slerpQuaternions(REST_Q, HOLD_Q, e);
    this.spin.rotation.set(this.pitch * e + Math.sin(time * 0.9) * 0.012 * e, this.yaw * e + Math.sin(time * 0.62) * 0.022 * e, 0);

    // botones
    const h = this.held;
    for (const n in this.buttons) {
      const b = this.buttons[n];
      const t = h.has(n) ? 1 : 0;
      b.v += (t - b.v) * k(t ? 60 : 32);
      b.obj.position.z = b.base.z - b.v * b.travel;
    }
    const tx = (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0);
    const ty = (h.has('up') ? 1 : 0) - (h.has('down') ? 1 : 0);
    const d = this.dpad;
    d.x += (tx - d.x) * k(50);
    d.y += (ty - d.y) * k(50);
    d.push += ((tx || ty ? 1 : 0) - d.push) * k(50);
    d.pivot.rotation.set(-d.y * 0.11, d.x * 0.11, 0);
    d.pivot.position.z = d.base.z - d.push * 0.35;

    // la consola cede un poco bajo los pulgares
    const pressR = h.has('a') || h.has('b') ? 1 : 0;
    const pressL = tx || ty ? 1 : 0;
    this._ky += ((pressR - pressL) * 0.014 * e - this._ky) * k(18);
    this._kx += ((pressR + pressL + (h.has('start') || h.has('select') ? 1 : 0)) * 0.008 * e - this._kx) * k(18);
    // rebote (inserción del cartucho, interruptor)
    this._bv += (-this._bp * 260 - this._bv * 16) * dt;
    this._bp += this._bv * dt;
    this.kick.rotation.set(this._kx, this._ky, 0);
    this.kick.position.set(0, this._bp, -(pressR + pressL) * 0.035 * e);

    // interruptor y LED
    this.sw.obj.position.x = this.sw.base.x + this.sw.v * 3.4;
    this.ledMat.emissiveIntensity = this.led * 5;
    this.ledGlow.material.opacity = this.led * 0.75;
    this.screenLight.intensity = this.lcd.power * 14;

    this.rig.updateMatrixWorld(true);
    for (const id in this.carts) {
      const c = this.carts[id];
      if (c.where === 'slot' && !c.flying) {
        const { p, q } = this.slotPose(0);
        c.wrap.position.copy(p);
        c.wrap.quaternion.copy(q);
      }
    }
  }
}
