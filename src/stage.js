import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Escenario: una mesa de trabajo de noche, bajo la luz cálida de un flexo.
export function createStage(renderer) {
  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x070b0a);
  scene.background = BG;
  scene.fog = new THREE.Fog(BG, 55, 135);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.32;

  // --- tapete de corte ---
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const x = c.getContext('2d');
  x.fillStyle = '#1b3a33';
  x.fillRect(0, 0, 1024, 1024);
  // moteado
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.035})`;
    x.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
  }
  const u = 1024 / 10; // 1 cm
  for (let i = 0; i <= 10; i++) {
    const major = i % 5 === 0;
    x.strokeStyle = major ? 'rgba(160,215,190,0.42)' : 'rgba(150,205,180,0.16)';
    x.lineWidth = major ? 3 : 1.5;
    x.beginPath();
    x.moveTo(i * u, 0);
    x.lineTo(i * u, 1024);
    x.moveTo(0, i * u);
    x.lineTo(1024, i * u);
    x.stroke();
  }
  // marcas de medio centímetro en las líneas principales
  x.strokeStyle = 'rgba(160,215,190,0.3)';
  x.lineWidth = 1.5;
  for (let i = 0; i < 20; i++) {
    for (const m of [0, 5]) {
      x.beginPath();
      x.moveTo((i + 0.5) * u * 0.5 + 0, m * u - 5);
      x.lineTo((i + 0.5) * u * 0.5, m * u + 5);
      x.moveTo(m * u - 5, (i + 0.5) * u * 0.5);
      x.lineTo(m * u + 5, (i + 0.5) * u * 0.5);
      x.stroke();
    }
  }
  const matTex = new THREE.CanvasTexture(c);
  matTex.colorSpace = THREE.SRGBColorSpace;
  matTex.wrapS = matTex.wrapT = THREE.RepeatWrapping;
  matTex.repeat.set(30, 30);
  matTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const desk = new THREE.Mesh(
    new THREE.PlaneGeometry(300, 300),
    new THREE.MeshStandardMaterial({ map: matTex, roughness: 0.82, metalness: 0.0, envMapIntensity: 0.5 })
  );
  desk.rotation.x = -Math.PI / 2;
  desk.receiveShadow = true;
  scene.add(desk);

  // --- luces ---
  const key = new THREE.SpotLight(0xffdfb8, 5.2, 0, 0.62, 0.85, 0);
  key.position.set(-20, 46, 26);
  key.target.position.set(1, 5, -1);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 20;
  key.shadow.camera.far = 90;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.03;
  key.shadow.radius = 5;
  scene.add(key, key.target);

  const rim = new THREE.DirectionalLight(0x6fa6ff, 1.5);
  rim.position.set(24, 18, -30);
  scene.add(rim);
  const fill = new THREE.HemisphereLight(0x9fc4c0, 0x101a14, 0.42);
  scene.add(fill);
  const front = new THREE.DirectionalLight(0xfff1e0, 0.5);
  front.position.set(6, 14, 40);
  scene.add(front);

  // --- motas de polvo en el haz de luz ---
  const dotC = document.createElement('canvas');
  dotC.width = dotC.height = 64;
  const dx = dotC.getContext('2d');
  const gr = dx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.4, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  dx.fillStyle = gr;
  dx.fillRect(0, 0, 64, 64);
  const dotTex = new THREE.CanvasTexture(dotC);

  const N = 140;
  const pos = new Float32Array(N * 3);
  const seed = [];
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 60;
    pos[i * 3 + 1] = Math.random() * 30 + 1;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 44;
    seed.push(Math.random() * 100);
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({
      map: dotTex, size: 0.22, transparent: true, opacity: 0.32, depthWrite: false,
      blending: THREE.AdditiveBlending, color: 0xffe6c4, sizeAttenuation: true,
    })
  );
  dust.raycast = () => {};
  scene.add(dust);

  // --- partículas del soplido ---
  const PN = 48;
  const ppos = new Float32Array(PN * 3).fill(-999);
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
  const puffMat = new THREE.PointsMaterial({
    map: dotTex, size: 0.5, transparent: true, opacity: 0.5, depthWrite: false,
    blending: THREE.AdditiveBlending, color: 0xfff0d8,
  });
  const puffPts = new THREE.Points(pgeo, puffMat);
  puffPts.frustumCulled = false;
  puffPts.raycast = () => {};
  scene.add(puffPts);
  const pv = [];
  let puffLife = 0;

  return {
    scene,
    dotTex,
    puff(origin, dir) {
      puffLife = 1;
      pv.length = 0;
      for (let i = 0; i < PN; i++) {
        ppos[i * 3] = origin.x + (Math.random() - 0.5) * 3.5;
        ppos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * 0.4;
        ppos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.6;
        const s = 3 + Math.random() * 9;
        pv.push(new THREE.Vector3(dir.x * s + (Math.random() - 0.5) * 4, dir.y * s + (Math.random() - 0.5) * 4, dir.z * s + (Math.random() - 0.5) * 4));
      }
    },
    update(dt, time) {
      const p = dustGeo.attributes.position;
      for (let i = 0; i < N; i++) {
        const s = seed[i];
        p.array[i * 3] += Math.sin(time * 0.21 + s) * 0.12 * dt;
        p.array[i * 3 + 1] += (Math.sin(time * 0.33 + s * 2) * 0.1 - 0.05) * dt;
        p.array[i * 3 + 2] += Math.cos(time * 0.17 + s) * 0.1 * dt;
        if (p.array[i * 3 + 1] < 0.5) p.array[i * 3 + 1] = 30;
      }
      p.needsUpdate = true;
      if (puffLife > 0) {
        puffLife -= dt * 0.9;
        for (let i = 0; i < PN; i++) {
          const v = pv[i];
          ppos[i * 3] += v.x * dt;
          ppos[i * 3 + 1] += v.y * dt;
          ppos[i * 3 + 2] += v.z * dt;
          v.multiplyScalar(Math.exp(-dt * 3));
          v.y += dt * 0.6;
        }
        pgeo.attributes.position.needsUpdate = true;
        puffMat.opacity = Math.max(0, puffLife) * 0.5;
        if (puffLife <= 0) ppos.fill(-999);
      }
    },
  };
}
