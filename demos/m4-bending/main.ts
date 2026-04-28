/**
 * m4-bending — total bending |II|² of M⁴_L in ℝ⁶
 *
 * Left panel: M⁴_L sphere colored by the squared norm of the second
 * fundamental form |II|² in an orthonormal tangent frame:
 *   |II|² = |II_11|² + 2|II_12|² + |II_22|²
 * always ≥ 0 → sequential heat colormap (cream → orange → deep red).
 *
 * Right panel: live 4-rod chain at the current (φ, t). Drag the burgundy
 * marker on the sphere to repose.
 *
 * II is computed numerically via the combined firstAndSecondFundamentalForms
 * helper (one 9-point stencil → both forms, no duplicated stencil work).
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SurfaceMesh } from '@/math';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

// --- palette ---------------------------------------------------------------

const BG       = 0xF0EDE8;
const BURGUNDY = 0xB02A3E;
const SILVER   = 0xD8D0C2;

// --- ψ4 embedding ----------------------------------------------------------

function psi4Position(phi: number, t: number, L: number): {
  p1: [number, number]; p2: [number, number]; p3: [number, number];
} {
  const alpha = Math.acos((L * L - 8) / (2 * L));
  const theta = alpha * Math.sin(phi);

  const p3_re = L - Math.cos(theta);
  const p3_im =   - Math.sin(theta);
  const d     = Math.hypot(p3_re, p3_im);
  const p3_hat_re = p3_re / d;
  const p3_hat_im = p3_im / d;

  const c        = Math.cos(t);
  const alpha_in = Math.acos((d * d - 3) / (2 * d));
  const theta_in = alpha_in * Math.sin(t);

  const num   = 2 * d * (Math.cos(theta_in) - (d * d - 3) / (2 * d));
  const nu_in = Math.abs(c) < 1e-6
              ? Math.sign(c || 1) * Math.sqrt(d * alpha_in * Math.sin(alpha_in))
              : c * Math.sqrt(num / (c * c));

  const e_re   = Math.cos(theta_in);
  const e_im   = Math.sin(theta_in);
  const rot_re = p3_hat_re * e_re - p3_hat_im * e_im;
  const rot_im = p3_hat_re * e_im + p3_hat_im * e_re;
  const p2_re  = p3_re - rot_re;
  const p2_im  = p3_im - rot_im;
  const p2_abs = Math.hypot(p2_re, p2_im);

  const k     = nu_in / (2 * p2_abs);
  const p1_re = p2_re / 2 - k * p2_im;
  const p1_im = p2_im / 2 + k * p2_re;

  return { p1: [p1_re, p1_im], p2: [p2_re, p2_im], p3: [p3_re, p3_im] };
}

// --- combined first + second fundamental forms ----------------------------
//
// 9-point stencil on psi4Position. Returns first form (E, F, G) alongside
// the three second-form components II_pp, II_pt, II_tt as length-6 vectors
// in N_p ⊂ ℝ⁶ (the part of ∂_a ∂_b q that is normal to the tangent plane).

function firstAndSecondFundamentalForms(phi: number, t: number, L: number): {
  E: number; F: number; G: number;
  II_pp: number[]; II_pt: number[]; II_tt: number[];
} {
  const eps = 1e-4;
  const e2 = eps * eps;

  const Q = (ph: number, tt: number): number[] => {
    const { p1, p2, p3 } = psi4Position(ph, tt, L);
    return [p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]];
  };

  const p   = Q(phi,       t      );
  const pPh = Q(phi + eps, t      );
  const pPl = Q(phi - eps, t      );
  const pTh = Q(phi,       t + eps);
  const pTl = Q(phi,       t - eps);
  const pPP = Q(phi + eps, t + eps);
  const pPN = Q(phi + eps, t - eps);
  const pNP = Q(phi - eps, t + eps);
  const pNN = Q(phi - eps, t - eps);

  const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

  const dPp: number[] = new Array(6);
  const dTp: number[] = new Array(6);
  const dPPp: number[] = new Array(6);
  const dTTp: number[] = new Array(6);
  const dPTp: number[] = new Array(6);
  for (let i = 0; i < 6; i++) {
    dPp[i]  = (pPh[i] - pPl[i]) / (2 * eps);
    dTp[i]  = (pTh[i] - pTl[i]) / (2 * eps);
    dPPp[i] = (pPh[i] - 2 * p[i] + pPl[i]) / e2;
    dTTp[i] = (pTh[i] - 2 * p[i] + pTl[i]) / e2;
    dPTp[i] = (pPP[i] - pPN[i] - pNP[i] + pNN[i]) / (4 * e2);
  }

  const E = dot(dPp, dPp);
  const F = dot(dPp, dTp);
  const G = dot(dTp, dTp);
  const D = E * G - F * F;

  // Subtract the tangential part (cP·∂_φq + cT·∂_tq) using the metric system.
  const projectNormal = (v: number[]): number[] => {
    const bP = dot(v, dPp);
    const bT = dot(v, dTp);
    const cP = (G * bP - F * bT) / D;
    const cT = (E * bT - F * bP) / D;
    const out: number[] = new Array(6);
    for (let i = 0; i < 6; i++) out[i] = v[i] - cP * dPp[i] - cT * dTp[i];
    return out;
  };

  return {
    E, F, G,
    II_pp: projectNormal(dPPp),
    II_pt: projectNormal(dPTp),
    II_tt: projectNormal(dTTp),
  };
}

function totalBending(phi: number, t: number, L: number): number {
  const { E, F, G, II_pp, II_pt, II_tt } = firstAndSecondFundamentalForms(phi, t, L);
  const D = E * G - F * F;
  if (!(D > 0)) return NaN;
  const sqrtD = Math.sqrt(D);

  // Change of basis to orthonormal tangent frame {e_1, e_2}, per the blog post.
  const II_11: number[] = new Array(6);
  const II_12: number[] = new Array(6);
  const II_22: number[] = new Array(6);
  for (let i = 0; i < 6; i++) {
    II_11[i] = II_pp[i] / E;
    II_12[i] = -F / (E * sqrtD) * II_pp[i] + II_pt[i] / sqrtD;
    II_22[i] = (F * F) / (E * D) * II_pp[i] - (2 * F / D) * II_pt[i] + (E / D) * II_tt[i];
  }

  let s11 = 0, s12 = 0, s22 = 0;
  for (let i = 0; i < 6; i++) {
    s11 += II_11[i] * II_11[i];
    s12 += II_12[i] * II_12[i];
    s22 += II_22[i] * II_22[i];
  }
  return s11 + 2 * s12 + s22;
}

// --- domain & visualization sphere ----------------------------------------

const SPHERE_R = Math.PI;
const CONFIG_DOMAIN: SurfaceDomain = {
  uMin: -Math.PI / 2, uMax: Math.PI / 2, vMin: 0, vMax: 2 * Math.PI,
};

const sphereSurface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    return new THREE.Vector3(
      SPHERE_R * Math.cos(u) * Math.cos(v),
      SPHERE_R * Math.cos(u) * Math.sin(v),
      SPHERE_R * Math.sin(u),
    );
  },
  getDomain: () => CONFIG_DOMAIN,
};

// --- field grid ------------------------------------------------------------

const GRID_N = 256;

function buildBendingGrid(L: number): {
  data: Float32Array; scaleMax: number; min: number; max: number;
} {
  const data = new Float32Array(GRID_N * GRID_N);
  const samples: number[] = [];

  for (let j = 0; j < GRID_N; j++) {
    const tVal = (2 * Math.PI * (j + 0.5)) / GRID_N;
    for (let i = 0; i < GRID_N; i++) {
      const phi = -Math.PI / 2 + (Math.PI * i) / (GRID_N - 1);
      const v = totalBending(phi, tVal, L);
      data[j * GRID_N + i] = Number.isFinite(v) ? v : NaN;
      if (Number.isFinite(v)) samples.push(v);
    }
  }

  samples.sort((a, b) => a - b);
  const lo = samples[Math.floor(samples.length * 0.02)] ?? 0;
  const hi = samples[Math.floor(samples.length * 0.98)] ?? 1;
  return { data, scaleMax: hi || 1, min: lo, max: hi };
}

function makeFieldTexture(data: Float32Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(data, GRID_N, GRID_N, THREE.RedFormat, THREE.FloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// --- scene -----------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 14);
(app.camera as THREE.PerspectiveCamera).fov = 25;
(app.camera as THREE.PerspectiveCamera).updateProjectionMatrix();
app.controls.target.set(0, 0, 0);
app.backgrounds.setColor(BG);

app.scene.add(new THREE.AmbientLight(0xfff3e0, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.4);
key.position.set(4, 5, 6);
app.scene.add(key);
const fill = new THREE.DirectionalLight(0xffe6c4, 0.6);
fill.position.set(-5, -2, 4);
app.scene.add(fill);

// --- left: |II|²-colored sphere -------------------------------------------

const fragmentShader = `
uniform sampler2D uField;
uniform float uMaxScale;

void main() {
  float v = texture2D(uField, vMapUv).r;
  if (!(v == v)) {
    csm_DiffuseColor = vec4(0.55, 0.55, 0.55, 1.0);
    csm_Emissive = vec3(0.0);
    return;
  }
  float s = clamp(v / uMaxScale, 0.0, 1.0);
  // Compress dynamic range so the upper tail doesn't swallow midtones.
  float ss = pow(s, 0.4);

  // Heat colormap: cream → orange → deep red
  vec3 cream  = vec3(1.0, 0.97, 0.88);
  vec3 orange = vec3(0.98, 0.55, 0.10);
  vec3 deep   = vec3(0.55, 0.05, 0.02);
  vec3 color  = ss < 0.5
    ? mix(cream,  orange, ss * 2.0)
    : mix(orange, deep,  (ss - 0.5) * 2.0);

  csm_DiffuseColor = vec4(color, 1.0);
  csm_Emissive = color * 0.85;
}
`;

let L = 3.0;
const initial = buildBendingGrid(L);
const uniforms: Record<string, { value: any }> = {
  uField: { value: makeFieldTexture(initial.data) },
  uMaxScale: { value: initial.scaleMax },
};

const SPHERE_PANEL_SCALE = 0.40;
const sphereGroup = new THREE.Group();
sphereGroup.position.set(-2.9, 0, 0);
sphereGroup.scale.setScalar(SPHERE_PANEL_SCALE);
app.scene.add(sphereGroup);

const sphereMesh = new SurfaceMesh(sphereSurface, {
  uSegments: 96,
  vSegments: 192,
  roughness: 0.4,
  metalness: 0.05,
  fragmentShader,
  uniforms,
});
sphereGroup.add(sphereMesh);

const markerBall = new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 24, 24),
  new THREE.MeshPhysicalMaterial({ color: BURGUNDY, roughness: 0.22, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.18 }),
);
sphereGroup.add(markerBall);

// --- right: 4-rod chain ---------------------------------------------------

const CHAIN_SCALE = 1.55;
const chainGroup = new THREE.Group();
chainGroup.position.set(1.7, 0, 0);
chainGroup.scale.setScalar(CHAIN_SCALE);
app.scene.add(chainGroup);

const ROD_RADIUS    = 0.05;
const JOINT_RADIUS  = 0.10;
const PINNED_RADIUS = 0.13;

const rodMat = new THREE.MeshPhysicalMaterial({
  color: SILVER, roughness: 0.32, metalness: 0.85, clearcoat: 0.4, clearcoatRoughness: 0.25,
});
const ballMat = new THREE.MeshPhysicalMaterial({
  color: BURGUNDY, roughness: 0.22, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.18,
});

const rodGeo = new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, 1, 16, 1);
const rod1 = new THREE.Mesh(rodGeo, rodMat);
const rod2 = new THREE.Mesh(rodGeo, rodMat);
const rod3 = new THREE.Mesh(rodGeo, rodMat);
const rod4 = new THREE.Mesh(rodGeo, rodMat);
chainGroup.add(rod1, rod2, rod3, rod4);

const pinSphereGeo   = new THREE.SphereGeometry(PINNED_RADIUS, 24, 24);
const jointSphereGeo = new THREE.SphereGeometry(JOINT_RADIUS, 24, 24);
const pinA   = new THREE.Mesh(pinSphereGeo, ballMat);
const pinB   = new THREE.Mesh(pinSphereGeo, ballMat);
const joint1 = new THREE.Mesh(jointSphereGeo, ballMat);
const joint2 = new THREE.Mesh(jointSphereGeo, ballMat);
const joint3 = new THREE.Mesh(jointSphereGeo, ballMat);
chainGroup.add(pinA, pinB, joint1, joint2, joint3);

const _yAxis = new THREE.Vector3(0, 1, 0);
function placeRod(rod: THREE.Mesh, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  rod.position.set((ax + bx) / 2, (ay + by) / 2, 0);
  rod.scale.set(1, len, 1);
  rod.quaternion.setFromUnitVectors(_yAxis, new THREE.Vector3(dx / len, dy / len, 0));
}

// --- state -----------------------------------------------------------------

let phi = 0;
let t = Math.PI / 2;

function applyConfig() {
  markerBall.position.set(
    SPHERE_R * Math.cos(phi) * Math.cos(t),
    SPHERE_R * Math.cos(phi) * Math.sin(t),
    SPHERE_R * Math.sin(phi),
  );

  const { p1, p2, p3 } = psi4Position(phi, t, L);
  const dx = -L / 2;
  const ax = 0 + dx,     ay = 0;
  const px = p1[0] + dx, py = p1[1];
  const qx = p2[0] + dx, qy = p2[1];
  const rx = p3[0] + dx, ry = p3[1];
  const bx = L + dx,     by = 0;

  pinA.position.set(ax, ay, 0);
  pinB.position.set(bx, by, 0);
  joint1.position.set(px, py, 0);
  joint2.position.set(qx, qy, 0);
  joint3.position.set(rx, ry, 0);
  placeRod(rod1, ax, ay, px, py);
  placeRod(rod2, px, py, qx, qy);
  placeRod(rod3, qx, qy, rx, ry);
  placeRod(rod4, rx, ry, bx, by);
}

function rebuildField() {
  const { data, scaleMax, min, max } = buildBendingGrid(L);
  (uniforms.uField.value as THREE.DataTexture).dispose();
  uniforms.uField.value = makeFieldTexture(data);
  uniforms.uMaxScale.value = scaleMax;
  rangeReadout.textContent = `|II|² ∈ [${min.toFixed(2)}, ${max.toFixed(2)}]`;
}

applyConfig();

// --- drag interaction -----------------------------------------------------

const renderer = app.renderManager.renderer;
const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let dragging = false;

function updateNdc(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function uvToConfig(uv: THREE.Vector2) {
  phi = CONFIG_DOMAIN.uMin + uv.x * (CONFIG_DOMAIN.uMax - CONFIG_DOMAIN.uMin);
  t   = CONFIG_DOMAIN.vMin + uv.y * (CONFIG_DOMAIN.vMax - CONFIG_DOMAIN.vMin);
  applyConfig();
}

canvas.addEventListener('pointerdown', (e) => {
  updateNdc(e);
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(sphereMesh, false);
  if (hits.length === 0 || !hits[0].uv) return;
  dragging = true;
  app.controls.controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  uvToConfig(hits[0].uv);
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  updateNdc(e);
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(sphereMesh, false);
  if (hits.length > 0 && hits[0].uv) uvToConfig(hits[0].uv);
});

function endDrag(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// --- HUD -------------------------------------------------------------------

const sliderStyle = document.createElement('style');
sliderStyle.textContent = `
  .thin-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 5px; margin: 0; background: transparent; outline: none; cursor: pointer; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35)); }
  .thin-slider::-webkit-slider-runnable-track { height: 5px; background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.45); border-radius: 999px; box-sizing: border-box; }
  .thin-slider::-moz-range-track { height: 5px; background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.45); border-radius: 999px; box-sizing: border-box; }
  .thin-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; margin-top: -5px; background: #fff; border: 1.5px solid rgba(0,0,0,0.8); border-radius: 50%; box-sizing: border-box; cursor: pointer; }
  .thin-slider::-moz-range-thumb { width: 14px; height: 14px; background: #fff; border: 1.5px solid rgba(0,0,0,0.8); border-radius: 50%; box-sizing: border-box; cursor: pointer; }
  .thin-slider:focus { outline: none; }
`;
document.head.appendChild(sliderStyle);

const rangeReadout = document.createElement('div');
rangeReadout.style.cssText =
  'position:fixed;top:16px;right:16px;color:#333;font:13px/1 monospace;' +
  'pointer-events:none;z-index:10;';
rangeReadout.textContent = `|II|² ∈ [${initial.min.toFixed(2)}, ${initial.max.toFixed(2)}]`;
document.body.appendChild(rangeReadout);

const sliderWrap = document.createElement('div');
sliderWrap.style.cssText =
  'position:fixed;bottom:16px;right:16px;width:280px;padding:8px 10px;' +
  'background:transparent;pointer-events:auto;z-index:10;';
sliderWrap.innerHTML = `
  <input id="bd-L" type="range" class="thin-slider" min="2.05" max="3.95" step="0.01" value="${L}" />
`;
document.body.appendChild(sliderWrap);

const slider = sliderWrap.querySelector<HTMLInputElement>('#bd-L')!;

slider.addEventListener('input', () => {
  L = parseFloat(slider.value);
  rebuildField();
  applyConfig();
});

app.start();
