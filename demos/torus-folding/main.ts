/**
 * Torus Folding
 *
 * Rolls a flat square into two tori side by side:
 *   Left  — Clifford torus (conformal: grid squares stay square)
 *   Right — torus of revolution (non-conformal: grid squares deform)
 *
 * Both start from a square domain [0,2π]². The rolling-up uses:
 *   g_τ(u,v) = [f(τu, τv) − f(τπ, τπ)] / τ
 * At τ→0 this is the tangent plane (flat square); at τ=1 the torus closes.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import CustomShaderMaterial from 'three-custom-shader-material/vanilla';
import { buildGridGeometry } from './buildGridGeometry';
import * as clifford from './cliffordTorus';
import * as revolution from './revolutionTorus';
import gridFrag from './grid.frag.glsl?raw';

// --- Surface info: precompute tangent frame at origin ---

interface SurfaceInfo {
  evaluate: (u: number, v: number) => THREE.Vector3;
  normalFn: (u: number, v: number) => THREE.Vector3;
  eu: THREE.Vector3; // unit tangent in u at origin
  ev: THREE.Vector3; // unit tangent in v at origin
  n0: THREE.Vector3; // unit normal at origin
  lu: number;        // |f_u(0,0)|
  lv: number;        // |f_v(0,0)|
}

function makeSurfaceInfo(
  evaluate: (u: number, v: number) => THREE.Vector3,
  normalFn: (u: number, v: number) => THREE.Vector3,
): SurfaceInfo {
  const h = 1e-4;
  const fu = evaluate(h, 0).sub(evaluate(-h, 0)).divideScalar(2 * h);
  const fv = evaluate(0, h).sub(evaluate(0, -h)).divideScalar(2 * h);
  const lu = fu.length();
  const lv = fv.length();
  const eu = fu.normalize();
  const ev = fv.normalize();
  const n0 = new THREE.Vector3().crossVectors(eu, ev).normalize();
  return { evaluate, normalFn, eu, ev, n0, lu, lv };
}

// --- Rolling-up geometry update ---
// Expand around (0,0) with domain [−π, π]². The tangent frame at (0,0) is
// constant for all τ, so both center and orientation stay fixed.

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

      // g_τ(u,v) = [f(τu, τv) − f(0, 0)] / τ
      _p.copy(info.evaluate(t * u, t * v)).sub(origin).divideScalar(t);

      // Rescale tangent components to square the domain at τ=0
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
app.backgrounds.setColor(0xf0f0f0);

const key = new THREE.DirectionalLight(0xffffff, 1.5);
key.position.set(5, 8, 5);
app.scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.6);
fill.position.set(-4, 3, -2);
app.scene.add(fill);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.8));

// Fixed camera
app.camera.position.set(8, 14, 24);
app.controls.target.set(0, 0, 0);
app.controls.update();

// --- Geometry ---

const SEG = 64;
const geo1 = buildGridGeometry(SEG, SEG);
const geo2 = buildGridGeometry(SEG, SEG);

// Surface info (precomputed tangent frames)
const info1 = makeSurfaceInfo(clifford.evaluate, clifford.normal);
const info2 = makeSurfaceInfo(revolution.evaluate, revolution.normal);

// Initialize at τ ≈ 0 (flat square)
updateGeometry(geo1, info1, 0, SEG, SEG);
updateGeometry(geo2, info2, 0, SEG, SEG);

// --- Materials ---

const uvTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
uvTex.needsUpdate = true;

function makeUniforms(fillColor: number) {
  return {
    uGridCount: { value: 10 },
    uLineWidth: { value: 0.04 },
    uGridColor: { value: new THREE.Color(0xffffff) },
    uFillColor: { value: new THREE.Color(fillColor) },
  };
}

function makeMaterial(uniforms: Record<string, { value: unknown }>) {
  return new CustomShaderMaterial({
    baseMaterial: THREE.MeshPhysicalMaterial,
    fragmentShader: gridFrag,
    uniforms,
    side: THREE.DoubleSide,
    roughness: 0.45,
    metalness: 0.0,
    clearcoat: 0.3,
    map: uvTex,
  });
}

// --- Meshes ---

const uniforms1 = makeUniforms(0x6699dd);
const uniforms2 = makeUniforms(0xdd6666);

const mesh1 = new THREE.Mesh(geo1, makeMaterial(uniforms1));
mesh1.position.x = -5;

const mesh2 = new THREE.Mesh(geo2, makeMaterial(uniforms2));
mesh2.position.x = 5;

app.scene.add(mesh1, mesh2);

// --- UI ---

app.overlay.addSlider({
  label: 'fold',
  min: 0, max: 1, step: 0.005, value: 0,
  format: (v) => `τ = ${v.toFixed(3)}`,
  onChange: (tau) => {
    updateGeometry(geo1, info1, tau, SEG, SEG);
    updateGeometry(geo2, info2, tau, SEG, SEG);
  },
});

// --- Start ---

app.start();
