import * as THREE from 'three';
import { W, H } from './gfx.js';

// Pantalla LCD reflectiva: rejilla de píxeles, persistencia (ghosting) y contraste
export class Lcd {
  constructor(width, height) {
    this.data = new Uint8Array(W * H);
    this.disp = new Float32Array(W * H);
    this.tex = new THREE.DataTexture(this.data, W, H, THREE.RedFormat, THREE.UnsignedByteType);
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter;
    this.tex.flipY = false;
    this.tex.needsUpdate = true;
    this.power = 0; // 0 apagada, 1 encendida
    this.contrast = 0.55;

    // área activa centrada dentro del cristal
    const border = 0.04;
    const availW = width * (1 - border * 2), availH = height * (1 - border * 2);
    let ah = availH * 0.93, aw = (ah * W) / H;
    if (aw > availW * 0.95) {
      aw = availW * 0.95;
      ah = (aw * H) / W;
    }
    this.uniforms = {
      map: { value: this.tex },
      power: { value: 0 },
      contrast: { value: this.contrast },
      halfSize: { value: new THREE.Vector2(aw / width / 2, ah / height / 2) },
      border: { value: border },
    };
    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        uniform sampler2D map;
        uniform float power, contrast, border;
        uniform vec2 halfSize;
        const vec2 RES = vec2(160.0,144.0);
        float gSoft;
        float inkAt(vec2 a){
          if(a.x<0.0||a.x>1.0||a.y<0.0||a.y>1.0) return 0.0;
          vec2 p = a*RES;
          // de cerca: píxeles nítidos con rejilla; de lejos: se funde para evitar moiré
          float v = texture2D(map, mix((floor(p)+0.5)/RES, a, gSoft)).r;
          vec2 f = fract(p);
          float g = smoothstep(0.0,0.14,f.x)*smoothstep(0.0,0.14,f.y);
          return v*mix(g, 0.88, gSoft);
        }
        void main(){
          vec2 uv = vec2(vUv.x, 1.0-vUv.y);
          vec2 d = min(uv, 1.0-uv);
          float edge = min(d.x,d.y);
          vec3 glassOff = vec3(0.40,0.50,0.135);
          vec3 inkCol = vec3(0.012,0.032,0.017);
          vec2 a = (uv-0.5)/(halfSize*2.0)+0.5;
          vec2 pp = a*RES;
          gSoft = clamp((max(fwidth(pp.x),fwidth(pp.y))-0.3)/0.4, 0.0, 1.0);
          float inside = step(0.0,a.x)*step(a.x,1.0)*step(0.0,a.y)*step(a.y,1.0);
          float ink = inkAt(a);
          // sombra que proyecta el píxel sobre el fondo reflectante
          float sh = inkAt(a - vec2(0.9,0.9)/RES);
          float c = contrast;
          float k = clamp(ink*(0.35+1.25*c) + inside*max(0.0,c-0.62)*1.6*(0.55+0.45*sin(a.y*7.0)), 0.0, 1.0)*power;
          vec3 col = glassOff*(1.0+0.07*inside*power);
          col *= 1.0 - 0.13*sh*power*(1.0-ink);
          col = mix(col, inkCol, k);
          col *= 0.86 + 0.14*smoothstep(0.0,0.12,edge);
          float n = fract(sin(dot(floor(uv*vec2(420.0,380.0)),vec2(12.9898,78.233)))*43758.5453);
          col *= 0.985+0.03*n;
          // marco negro del cristal
          float bm = smoothstep(border-0.008,border,edge);
          col = mix(vec3(0.012), col, bm);
          gl_FragColor = vec4(col,1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.material);
  }
  update(buf, dt) {
    const k = 1 - Math.exp(-dt * 26);
    const d = this.disp, out = this.data;
    const on = this.power > 0.02;
    for (let i = 0; i < d.length; i++) {
      const t = on ? buf[i] * 85 : 0;
      const v = d[i] + (t - d[i]) * k;
      d[i] = v;
      out[i] = v;
    }
    this.tex.needsUpdate = true;
    this.uniforms.power.value = this.power;
    this.uniforms.contrast.value = this.contrast;
  }
}
