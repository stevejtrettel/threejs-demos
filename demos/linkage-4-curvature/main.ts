/**
 * Curvature-colored config-space sphere for the 4-rod linkage, paired with
 * a live view of the actual mechanism.
 *
 * Left: the abstract (φ, t) sphere colored by the Gaussian curvature of the
 *   kinetic-energy pullback metric, computed cell-by-cell via the library's
 *   `gaussianCurvatureFromMetric`. Non-finite cells render gray.
 * Right: the physical 4-rod planar chain with both endpoints pinned at
 *   distance L apart. Its configuration is determined by (φ, t) through
 *   `psi4`, which gives the four rod angles.
 *
 * Drag the red ball on the sphere: the linkage reposes in real time.
 *
 * The T³ view (radio toggle) replaces the sphere with the parametric
 * embedding of (θ₂, θ₃, θ₄) into a [-π, π]³ cube — curvature texture is
 * the same, indexed by the same (φ, t) uv.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import {
  SurfaceMesh,
  LinkageMesh,
  buildPlanarChain,
  setChainAngles,
} from '@/math';
import { MetricSurface } from '@/math/surfaces/MetricSurface';
import { pullbackMetric as euclideanPullback } from '@/math/surfaces/pullback';
import { gaussianCurvatureFromMetric } from '@/math/surfaces/christoffel';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';
import { Matrix } from '@/math/linear-algebra';
import type { Joint } from '@/math/linkages';

// --- Angle parameterization ---

function psi4(phi: number, t: number, L: number): [number, number, number, number] {
  const alpha4 = Math.acos((L * L - 8) / (2 * L));
  const theta1 = alpha4 * Math.sin(phi);
  const c1 = Math.cos(theta1), s1 = Math.sin(theta1);
  const d = Math.sqrt(L * L - 2 * L * c1 + 1);
  const gamma4 = Math.atan2(-s1, L - c1);

  const alpha3 = Math.acos((d * d - 3) / (2 * d));
  const sub_phi1 = alpha3 * Math.cos(t);
  const sub_c1 = Math.cos(sub_phi1), sub_s1 = Math.sin(sub_phi1);
  const d_sub = Math.sqrt(d * d - 2 * d * sub_c1 + 1);
  const beta3 = Math.acos(d_sub / 2);
  const gamma3 = Math.atan2(-sub_s1, d - sub_c1);
  const sigma = Math.sin(t) >= 0 ? 1 : -1;

  const theta2 = gamma4 + sub_phi1;
  const theta3 = gamma4 + gamma3 + sigma * beta3;
  const theta4 = gamma4 + gamma3 - sigma * beta3;

  return [theta1, theta2, theta3, theta4];
}

// --- Pullback metric (kinetic-energy form on the chain) ---

const USE_ROUND_METRIC = false;
const USE_EUCLIDEAN_PULLBACK = false;

function pullbackMetric(phi: number, t: number, L: number): Matrix {
  const m = new Matrix(2, 2);

  if (USE_ROUND_METRIC) {
    const c = Math.cos(phi);
    m.data[0] = 1;
    m.data[3] = c * c;
    return m;
  }

  const alpha4 = Math.acos((L * L - 8) / (2 * L));
  const A = alpha4 * Math.cos(phi);
  const theta1 = alpha4 * Math.sin(phi);
  const c1 = Math.cos(theta1), s1 = Math.sin(theta1);
  const d = Math.sqrt(L * L - 2 * L * c1 + 1);
  const d_prime = (L * s1) / d;
  const gamma4_prime = (1 - L * c1) / (d * d);
  const delta = theta1 - Math.atan2(-s1, L - c1);

  const alpha3 = Math.acos((d * d - 3) / (2 * d));
  const sinAlpha3 = Math.sin(alpha3);
  const alpha3_prime_d = -(d * d + 3) / (2 * d * d * sinAlpha3);

  const phi1 = alpha3 * Math.cos(t);
  const sPhi1 = Math.sin(phi1), cPhi1 = Math.cos(phi1);
  const dPhi1_dt = -alpha3 * Math.sin(t);
  const dPhi1_dd = alpha3_prime_d * Math.cos(t);

  const d_sub = Math.sqrt(d * d - 2 * d * cPhi1 + 1);
  const dDsub_dt = (d * sPhi1 * dPhi1_dt) / d_sub;
  const dDsub_dd = ((d - cPhi1) + d * sPhi1 * dPhi1_dd) / d_sub;

  const beta3 = Math.acos(d_sub / 2);
  const sinBeta3 = Math.sin(beta3);
  const dBeta3_dt = -dDsub_dt / (2 * sinBeta3);
  const dBeta3_dd = -dDsub_dd / (2 * sinBeta3);

  const dGamma3_dt = ((1 - d * cPhi1) / (d_sub * d_sub)) * dPhi1_dt;
  const dGamma3_dd = (sPhi1 + (1 - d * cPhi1) * dPhi1_dd) / (d_sub * d_sub);

  const sigma = Math.sin(t) >= 0 ? 1 : -1;
  const gamma3 = Math.atan2(-sPhi1, d - cPhi1);
  const phi2 = gamma3 + sigma * beta3;

  const dPhi2_dt = dGamma3_dt + sigma * dBeta3_dt;
  const dPhi2_dd = dGamma3_dd + sigma * dBeta3_dd;

  const B1 = gamma4_prime + d_prime * dPhi1_dd;
  const B2 = gamma4_prime + d_prime * dPhi2_dd;
  const C1 = dPhi1_dt;
  const C2 = dPhi2_dt;

  const cPhi1mPhi2 = Math.cos(phi1 - phi2);
  const cDmPhi1 = Math.cos(delta - phi1);
  const cDmPhi2 = Math.cos(delta - phi2);

  const G_tt = 2 * C1 * C1 + 2 * C1 * C2 * cPhi1mPhi2 + C2 * C2;
  const F_pt = A * (C1 * (2 * cDmPhi1 + 2 * B1 + B2 * cPhi1mPhi2) + C2 * (cDmPhi2 + B1 * cPhi1mPhi2 + B2));
  const E_pp = A * A * (3 + 4 * B1 * cDmPhi1 + 2 * B2 * cDmPhi2 + 2 * B1 * B1 + 2 * B1 * B2 * cPhi1mPhi2 + B2 * B2);

  m.data[0] = E_pp; m.data[1] = F_pt;
  m.data[2] = F_pt; m.data[3] = G_tt;
  return m;
}

const CONFIG_DOMAIN: SurfaceDomain = {
  uMin: -Math.PI / 2, uMax: Math.PI / 2,
  vMin: 0,           vMax: 2 * Math.PI,
};

function buildPatch(L: number): MetricSurface {
  if (USE_EUCLIDEAN_PULLBACK) {
    return euclideanPullback(
      (phi, t) => psi4(phi, t, L),
      CONFIG_DOMAIN,
    );
  }
  return new MetricSurface({
    domain: CONFIG_DOMAIN,
    metric: (phi, t) => pullbackMetric(phi, t, L),
  });
}

// --- Field grid (curvature OR log-area-ratio) ---

const GRID_N = 256;

type Mode = 'curvature' | 'area-ratio';

/**
 * Log of the area form divided by the round-sphere's area form:
 *   log( √(EG − F²) / cos φ )
 * Positive → pullback metric stretches area vs the round sphere. Negative →
 * compresses. Zero → equal. Symmetric around 0 so the diverging colormap
 * lines up naturally.
 */
function logAreaRatio(patch: MetricSurface, phi: number, t: number): number {
  const g = patch.computeMetric([phi, t]).data;
  const E = g[0], F = g[1], G = g[3];
  const det = E * G - F * F;
  if (det <= 0) return NaN;
  const roundDet = Math.cos(phi);
  if (roundDet <= 0) return NaN;
  return 0.5 * Math.log(det) - Math.log(roundDet);
}

/**
 * Numerically integrate √det(g) over the domain — the pullback's total area.
 * Skips non-finite / non-positive-det cells (singular bands).
 */
function integrateArea(patch: MetricSurface): number {
  const duDv = (Math.PI / (GRID_N - 1)) * (2 * Math.PI / GRID_N);
  let totalArea = 0;
  for (let j = 0; j < GRID_N; j++) {
    const tVal = (2 * Math.PI * (j + 0.5)) / GRID_N;
    for (let i = 0; i < GRID_N; i++) {
      const phi = -Math.PI / 2 + (Math.PI * i) / (GRID_N - 1);
      const g = patch.computeMetric([phi, tVal]).data;
      const det = g[0] * g[3] - g[1] * g[1];
      if (Number.isFinite(det) && det > 0) totalArea += Math.sqrt(det) * duDv;
    }
  }
  return totalArea;
}

function buildFieldGrid(L: number, mode: Mode): {
  data: Float32Array;
  scale: number;
  min: number;
  max: number;
} {
  const patch = buildPatch(L);
  const data = new Float32Array(GRID_N * GRID_N);
  const samples: number[] = [];

  // Area-normalize the pullback: rescale the metric by λ = 4π / A_g so that
  // the rescaled total area matches the round sphere's 4π. Since scaling g by
  // λ scales √det(g) by λ, the displayed log-ratio picks up an additive
  // log(λ) shift. This makes "zero" correspond to "locally as stretched as
  // the normalized sphere is on average," removing the global scale.
  let normShift = 0;
  if (mode === 'area-ratio') {
    const A = integrateArea(patch);
    if (A > 0) normShift = Math.log(4 * Math.PI / A);
  }

  for (let j = 0; j < GRID_N; j++) {
    const tVal = (2 * Math.PI * (j + 0.5)) / GRID_N;
    for (let i = 0; i < GRID_N; i++) {
      const phi = -Math.PI / 2 + (Math.PI * i) / (GRID_N - 1);
      let v: number;
      if (mode === 'curvature') {
        v = gaussianCurvatureFromMetric(patch, phi, tVal);
      } else {
        v = logAreaRatio(patch, phi, tVal);
        if (Number.isFinite(v)) v += normShift;
      }
      data[j * GRID_N + i] = Number.isFinite(v) ? v : NaN;
      if (Number.isFinite(v)) samples.push(v);
    }
  }

  samples.sort((a, b) => a - b);
  const lo = samples[Math.floor(samples.length * 0.02)] ?? 0;
  const hi = samples[Math.floor(samples.length * 0.98)] ?? 0;
  const abs = samples.map((v) => Math.abs(v)).sort((a, b) => a - b);
  const scale = abs[Math.floor(abs.length * 0.98)] ?? 1;

  return { data, scale: scale || 1, min: lo, max: hi };
}

function makeCurvatureTexture(data: Float32Array): THREE.DataTexture {
  const tex = new THREE.DataTexture(
    data, GRID_N, GRID_N, THREE.RedFormat, THREE.FloatType,
  );
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

// --- Scene ---

const app = new App({ antialias: true, debug: true });
app.camera.position.set(0, 1, 9);
app.controls.target.set(0, 0, 0);
app.backgrounds.setColor(0xf4f4f4);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const key = new THREE.DirectionalLight(0xffffff, 1.0);
key.position.set(2, 3, 5);
app.scene.add(key);

// --- Curvature shader ---

const fragmentShader = `
uniform sampler2D uK;
uniform float uKScale;

void main() {
  float k = texture2D(uK, vMapUv).r;
  if (!(k == k)) {
    csm_DiffuseColor = vec4(0.6, 0.6, 0.6, 1.0);
    return;
  }
  float s = clamp(k / uKScale, -1.0, 1.0);
  float ss = sign(s) * pow(abs(s), 0.3);
  vec3 white = vec3(1.0, 1.0, 1.0);
  vec3 red   = vec3(0.82, 0.18, 0.18);
  vec3 blue  = vec3(0.18, 0.35, 0.82);
  vec3 color = ss >= 0.0 ? mix(white, red, ss) : mix(white, blue, -ss);
  csm_DiffuseColor = vec4(color, 1.0);
}
`;

let L = 3.0;
let mode: Mode = 'curvature';
const { data: initialData, scale: initScale, min: initMin, max: initMax } =
  buildFieldGrid(L, mode);

const uniforms: Record<string, { value: any }> = {
  uK: { value: makeCurvatureTexture(initialData) },
  uKScale: { value: initScale },
};

// --- Sphere (curvature view) ---

const SPHERE_R = 1.6;
const SPHERE_X = -2.2;

const sphereSurface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    return new THREE.Vector3(
      SPHERE_R * Math.cos(u) * Math.cos(v),
      SPHERE_R * Math.cos(u) * Math.sin(v),
      SPHERE_R * Math.sin(u),
    );
  },
  getDomain(): SurfaceDomain {
    return CONFIG_DOMAIN;
  },
};

const sphereGroup = new THREE.Group();
sphereGroup.position.set(SPHERE_X, 0, 0);
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

// Draggable marker — local coordinates, parented to sphereGroup so it moves
// with the sphere as a rigid unit.
const markerBall = new THREE.Mesh(
  new THREE.SphereGeometry(0.08, 20, 20),
  new THREE.MeshPhysicalMaterial({ color: 0xff5522, roughness: 0.3, metalness: 0.1 }),
);
sphereGroup.add(markerBall);


// --- Linkage (actual mechanism) ---

const ROD_LENGTHS = [1, 1, 1, 1];
const LINKAGE_X = 2.6;
const LINKAGE_SCALE = 1.3;

const chain = buildPlanarChain({
  lengths: ROD_LENGTHS,
  pinA: [-L / 2, 0],
  pinB: [L / 2, 0],
});

const chainMesh = new LinkageMesh(chain, {
  rodRadius: 0.045,
  jointRadius: 0.085,
  rodColor: 0x222222,
  freeJointColor: 0x3388ff,
  pinnedJointColor: 0xff5522,
});
chainMesh.position.set(LINKAGE_X, 0, 0);
chainMesh.scale.setScalar(LINKAGE_SCALE);
app.scene.add(chainMesh);

// --- State & configuration application ---

let phi = 0;
let t = Math.PI / 2; // stay off the σ-flip meridians by default

function setMarkerPosition() {
  markerBall.position.set(
    SPHERE_R * Math.cos(phi) * Math.cos(t),
    SPHERE_R * Math.cos(phi) * Math.sin(t),
    SPHERE_R * Math.sin(phi),
  );
}

function applyConfig() {
  setMarkerPosition();
  const angles = psi4(phi, t, L);
  setChainAngles(chain, angles);
}

function rebuildField() {
  const { data, scale, min, max } = buildFieldGrid(L, mode);
  (uniforms.uK.value as THREE.DataTexture).dispose();
  uniforms.uK.value = makeCurvatureTexture(data);
  uniforms.uKScale.value = scale;
  updateRangeReadout(min, max);
}

function setL(newL: number) {
  L = newL;
  rebuildField();

  // Re-pin the chain endpoints for the new L.
  const newJoints: Joint[] = chain.joints.map((j) => {
    if (j.id === 0) return { id: 0, pinned: [-L / 2, 0] };
    if (j.id === chain.joints.length - 1) return { id: j.id, pinned: [L / 2, 0] };
    return { id: j.id };
  });
  chain.params.set('joints', newJoints);

  applyConfig();
}

function setMode(newMode: Mode) {
  mode = newMode;
  rebuildField();
}

applyConfig();

// --- UI: L slider + view radios ---

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:16px;left:16px;color:#333;font:14px/1.4 monospace;' +
  'background:rgba(255,255,255,0.9);padding:10px 14px;border-radius:6px;' +
  'display:flex;flex-direction:column;gap:6px;min-width:240px;z-index:10;';
panel.innerHTML = `
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>L</span>
    <span id="lc-L-value">${L.toFixed(2)}</span>
  </label>
  <input id="lc-L" type="range" min="2" max="4" step="0.01" value="${L}" />
  <label style="display:flex;justify-content:space-between;gap:8px;font-size:12px;">
    <span id="lc-field-label">K range</span>
    <span id="lc-field-range"></span>
  </label>
  <div style="display:flex;gap:10px;font-size:12px;">
    <label><input type="radio" name="lc-mode" value="curvature" checked /> curvature K</label>
    <label><input type="radio" name="lc-mode" value="area-ratio" /> log(area / round)</label>
  </div>
  <div style="font-size:11px;color:#888;margin-top:4px;">
    drag the red ball to pose the linkage
  </div>
`;
document.body.appendChild(panel);

const slider = panel.querySelector<HTMLInputElement>('#lc-L')!;
const readout = panel.querySelector<HTMLSpanElement>('#lc-L-value')!;
const fieldLabel = panel.querySelector<HTMLSpanElement>('#lc-field-label')!;
const fieldRangeReadout = panel.querySelector<HTMLSpanElement>('#lc-field-range')!;

function updateRangeReadout(min: number, max: number) {
  fieldLabel.textContent = mode === 'curvature' ? 'K range' : 'log-ratio range';
  fieldRangeReadout.textContent = `[${min.toFixed(2)}, ${max.toFixed(2)}]`;
}
updateRangeReadout(initMin, initMax);

slider.addEventListener('input', () => {
  const v = parseFloat(slider.value);
  readout.textContent = v.toFixed(2);
  setL(v);
});

panel.querySelectorAll<HTMLInputElement>('input[name="lc-mode"]').forEach((r) => {
  r.addEventListener('change', () => {
    if (!r.checked) return;
    if (r.value === 'curvature' || r.value === 'area-ratio') {
      setMode(r.value);
    }
  });
});

// --- Drag interaction ---
//
// Raycast against the sphere mesh and read the hit's uv directly — the
// SurfaceMesh UVs run (u, v) ∈ [0, 1]² across the surface's parameter
// domain, so mapping back to (φ, t) is a linear remap.

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

function raycastSphere(): THREE.Intersection | null {
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(sphereMesh, false);
  return hits.length > 0 ? hits[0] : null;
}

function uvToConfig(uv: THREE.Vector2) {
  phi = CONFIG_DOMAIN.uMin + uv.x * (CONFIG_DOMAIN.uMax - CONFIG_DOMAIN.uMin);
  t   = CONFIG_DOMAIN.vMin + uv.y * (CONFIG_DOMAIN.vMax - CONFIG_DOMAIN.vMin);
  applyConfig();
}

canvas.addEventListener('pointerdown', (e) => {
  updateNdc(e);
  const hit = raycastSphere();
  if (!hit || !hit.uv) return;
  dragging = true;
  app.controls.controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  uvToConfig(hit.uv);
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  updateNdc(e);
  const hit = raycastSphere();
  if (hit && hit.uv) uvToConfig(hit.uv);
});

canvas.addEventListener('pointerup', (e) => {
  if (!dragging) return;
  dragging = false;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
});

canvas.addEventListener('pointercancel', (e) => {
  if (!dragging) return;
  dragging = false;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
});

app.start();

(window as any).setL = setL;
(window as any).setConfig = (newPhi: number, newT: number) => {
  phi = newPhi; t = newT; applyConfig();
};
