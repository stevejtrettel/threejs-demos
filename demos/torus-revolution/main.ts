/**
 * Torus of Revolution — Non-conformal folding
 *
 * Rolls a flat square into a skinny torus of revolution.
 * The grid squares visibly stretch on the outside and compress
 * on the inside, demonstrating the non-conformal metric
 * ds² = (R + r cos v)² du² + r² dv².
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { buildGridGeometry } from './buildGridGeometry';
import gridFrag from './grid.frag.glsl?raw';

// --- Torus of revolution (skinny, R >> r for dramatic distortion) ---

const R = 2;
const r = 0.8;

function evaluate(u: number, v: number): THREE.Vector3 {
  const bigR = R + r * Math.cos(v);
  return new THREE.Vector3(
    bigR * Math.cos(u),
    bigR * Math.sin(u),
    r * Math.sin(v),
  );
}

function normal(u: number, v: number): THREE.Vector3 {
  return new THREE.Vector3(
    Math.cos(v) * Math.cos(u),
    Math.cos(v) * Math.sin(u),
    Math.sin(v),
  );
}

// --- Surface info: precompute tangent frame at origin ---

interface SurfaceInfo {
  evaluate: (u: number, v: number) => THREE.Vector3;
  normalFn: (u: number, v: number) => THREE.Vector3;
  eu: THREE.Vector3;
  ev: THREE.Vector3;
  n0: THREE.Vector3;
  lu: number;
  lv: number;
}

function makeSurfaceInfo(
  evalFn: (u: number, v: number) => THREE.Vector3,
  normalFn: (u: number, v: number) => THREE.Vector3,
): SurfaceInfo {
  const h = 1e-4;
  const fu = evalFn(h, 0).sub(evalFn(-h, 0)).divideScalar(2 * h);
  const fv = evalFn(0, h).sub(evalFn(0, -h)).divideScalar(2 * h);
  const lu = fu.length();
  const lv = fv.length();
  const eu = fu.normalize();
  const ev = fv.normalize();
  const n0 = new THREE.Vector3().crossVectors(eu, ev).normalize();
  return { evaluate: evalFn, normalFn, eu, ev, n0, lu, lv };
}

// --- Rolling-up geometry update ---

const TAU_MIN = 0.001;
const TWO_PI = 2 * Math.PI;
const _p = new THREE.Vector3();

function updateGeometry(
  geo: THREE.BufferGeometry,
  info: SurfaceInfo,
  tau: number,
  uSeg: number,
  vSeg: number,
) {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const norm = geo.attributes.normal as THREE.BufferAttribute;
  const t = Math.max(tau, TAU_MIN);

  const su = (1 - t) / info.lu + t;
  const sv = (1 - t) / info.lv + t;

  const origin = info.evaluate(0, 0);

  let idx = 0;
  for (let i = 0; i <= vSeg; i++) {
    const v = TWO_PI * (i / vSeg) - Math.PI;
    for (let j = 0; j <= uSeg; j++) {
      const u = TWO_PI * (j / uSeg) - Math.PI;

      _p.copy(info.evaluate(t * u, t * v)).sub(origin).divideScalar(t);

      const cu = _p.dot(info.eu);
      const cv = _p.dot(info.ev);
      _p.addScaledVector(info.eu, (su - 1) * cu);
      _p.addScaledVector(info.ev, (sv - 1) * cv);

      pos.setXYZ(idx, _p.x, _p.y, _p.z);

      const n = info.normalFn(t * u, t * v);
      norm.setXYZ(idx, n.x, n.y, n.z);

      idx++;
    }
  }

  pos.needsUpdate = true;
  norm.needsUpdate = true;
  geo.computeBoundingSphere();
}

// --- Scene ---

const app = new App({ antialias: true, debug: true });
app.camera.fov = 20;
app.camera.updateProjectionMatrix();
app.backgrounds.loadHDR('/assets/hdri/studio.hdr', {
  asEnvironment: true,
  asBackground: false,
  intensity: 1.5,
});
app.backgrounds.setColor(0xf0f0f0);

// Fixed camera
app.camera.position.set(8, 14, 24);
app.controls.target.set(0, 0, 0);
app.controls.update();

// --- Geometry ---

const SEG = 64;
const geo = buildGridGeometry(SEG, SEG);
const info = makeSurfaceInfo(evaluate, normal);

updateGeometry(geo, info, 0, SEG, SEG);

// --- Material ---

const uvTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
uvTex.needsUpdate = true;

const uniforms = {
  uGridCount: { value: 20 },
  uLineWidth: { value: 0.02 },
  uGridColor: { value: new THREE.Color(0x999999) },
  uFillColor: { value: new THREE.Color(0xf0ece8) },
};

const material = new CustomShaderMaterial({
  baseMaterial: THREE.MeshPhysicalMaterial,
  fragmentShader: gridFrag,
  uniforms,
  side: THREE.DoubleSide,
  roughness: 0.1,
  metalness: 0.1,
  clearcoat: 1.0,
  clearcoatRoughness: 0.05,
  map: uvTex,
});

// --- Mesh ---

const mesh = new THREE.Mesh(geo, material);
app.scene.add(mesh);

// --- Animation ---

const PERIOD = 15;       // total loop period
const CAM_DIST = 30;
const CAM_HEIGHT = 12;

app.addAnimateCallback((elapsed) => {
  // Sinusoidal fold: 0 → 1 → 0 → …
  const tau = 0.5 - 0.5 * Math.cos(TWO_PI * elapsed / PERIOD);
  updateGeometry(geo, info, tau, SEG, SEG);

  const angle = TWO_PI * elapsed / PERIOD;
  app.camera.position.set(
    CAM_DIST * Math.cos(angle),
    CAM_HEIGHT,
    CAM_DIST * Math.sin(angle),
  );
  app.controls.target.set(0, 0, 0);
  app.controls.update();
});

// --- Start ---

app.start();
