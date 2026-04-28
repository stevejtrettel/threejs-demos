/**
 * m4-jacobi — Jacobi geodesic-divergence visualization
 *
 * Same K-colored sphere as m4-gaussK. Drag-and-release on the sphere launches
 * a fan of N geodesics from the click point with slightly perturbed initial
 * velocities. Each geodesic gets a trail on the sphere and a superimposed
 * linkage instance on the right. High-K regions keep them bunched, low/
 * negative-K regions pull them apart — direct visualization of
 *   J̈ + K(γ) J = 0.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SurfaceMesh, MetricSurface, StreamTube } from '@/math';
import { gaussianCurvatureFromMetric } from '@/math/surfaces/christoffel';
import { Matrix } from '@/math/linear-algebra';
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

// --- analytic metric4 ------------------------------------------------------

function metric4(phi: number, t: number, L: number): { h_pp: number; h_pt: number; h_tt: number } {
  const alpha = Math.acos((L * L - 8) / (2 * L));
  const cphi = Math.cos(phi);
  const sphi = Math.sin(phi);
  const theta = alpha * sphi;
  const ctheta = Math.cos(theta);
  const stheta = Math.sin(theta);
  const d = Math.sqrt(L * L - 2 * L * ctheta + 1);
  const R = Math.atan2(-stheta, L - ctheta);
  const dthetaP = alpha * cphi;
  const ddP = (L * stheta / d) * dthetaP;
  const dRP = ((1 - L * ctheta) / (d * d)) * dthetaP;

  const alpha_in = Math.acos((d * d - 3) / (2 * d));
  const sin_ai = Math.sqrt(Math.max((d * d - 1) * (9 - d * d), 0)) / (2 * d);
  const ct = Math.cos(t);
  const st = Math.sin(t);
  const theta_in = alpha_in * st;
  const ctin = Math.cos(theta_in);

  const dthetainT = alpha_in * ct;
  const dalphainP = -((d * d + 3) / (2 * d * d * sin_ai)) * ddP;
  const dthetainP = dalphainP * st;

  const u4 = [ctheta, stheta];
  const u3_arg = R + theta_in;
  const u3 = [Math.cos(u3_arg), Math.sin(u3_arg)];
  const p2 = [(L - ctheta) - u3[0], -stheta - u3[1]];
  const p2_abs = Math.hypot(p2[0], p2[1]);

  const num = 2 * d * (ctin - (d * d - 3) / (2 * d));
  const nu_in = Math.abs(ct) < 1e-6
              ? Math.sign(ct || 1) * Math.sqrt(d * alpha_in * sin_ai * 2 * d)
              : ct * Math.sqrt(num / (ct * ct));

  const dt_p2: [number, number] = [u3[1] * dthetainT, -u3[0] * dthetainT];
  const c1 = dthetaP, c2 = dRP + dthetainP;
  const dphi_p2: [number, number] = [u4[1] * c1 + u3[1] * c2, -(u4[0] * c1 + u3[0] * c2)];

  const Omega = (v: [number, number]): number => {
    const im = (p2[0] * v[1] - p2[1] * v[0]) / (p2_abs * p2_abs);
    const re = (p2[0] * v[0] + p2[1] * v[1]) / (p2_abs * nu_in);
    return im - re;
  };
  const Omega_t = Omega(dt_p2);
  const Omega_phi = Omega(dphi_p2);

  const u34_dot = u3[0] * u4[0] + u3[1] * u4[1];

  const h_tt = Omega_t * Omega_t + dthetainT * dthetainT;
  const h_pp = Omega_phi * Omega_phi
             + 2 * dthetaP * dthetaP
             + (dRP + dthetainP) * (dRP + dthetainP)
             + 2 * dthetaP * (dRP + dthetainP) * u34_dot;
  const h_pt = Omega_t * Omega_phi
             + dthetainT * (dthetaP * u34_dot + dRP + dthetainP);

  return { h_pp, h_pt, h_tt };
}

// --- embedded geodesic RHS (single FD layer) -------------------------------

function geodesicRHSEmbedded(state: [number, number, number, number], L: number): [number, number, number, number] {
  const [phi, t, phidot, tdot] = state;
  const eps = 1e-4;

  const Q = (ph: number, tt: number): number[] => {
    const { p1, p2, p3 } = psi4Position(ph, tt, L);
    return [p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]];
  };
  const sub = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);
  const add = (...vs: number[][]) => vs.reduce((s, v) => s.map((x, i) => x + v[i]));
  const scale = (a: number[], c: number) => a.map((x) => c * x);
  const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

  const Q00 = Q(phi, t);
  const Qpp = Q(phi + eps, t),  Qpm = Q(phi - eps, t);
  const Qtp = Q(phi, t + eps),  Qtm = Q(phi, t - eps);
  const Qpt_pp = Q(phi + eps, t + eps), Qpt_pm = Q(phi + eps, t - eps);
  const Qpt_mp = Q(phi - eps, t + eps), Qpt_mm = Q(phi - eps, t - eps);

  const q_phi    = scale(sub(Qpp, Qpm), 1 / (2 * eps));
  const q_t      = scale(sub(Qtp, Qtm), 1 / (2 * eps));
  const q_phiphi = scale(add(Qpp, scale(Q00, -2), Qpm), 1 / (eps * eps));
  const q_tt     = scale(add(Qtp, scale(Q00, -2), Qtm), 1 / (eps * eps));
  const q_phit   = scale(sub(sub(Qpt_pp, Qpt_pm), sub(Qpt_mp, Qpt_mm)), 1 / (4 * eps * eps));

  const W = add(
    scale(q_phiphi, phidot * phidot),
    scale(q_phit, 2 * phidot * tdot),
    scale(q_tt, tdot * tdot),
  );

  const E = dot(q_phi, q_phi);
  const F = dot(q_phi, q_t);
  const G = dot(q_t, q_t);
  const D = E * G - F * F;
  const bP = -dot(q_phi, W);
  const bT = -dot(q_t, W);
  const phiddot = (G * bP - F * bT) / D;
  const tddot   = (E * bT - F * bP) / D;
  return [phidot, tdot, phiddot, tddot];
}

function rk4StepEmbedded(state: [number, number, number, number], h: number, L: number): [number, number, number, number] {
  const k1 = geodesicRHSEmbedded(state, L);
  const s2: [number, number, number, number] = [state[0] + 0.5*h*k1[0], state[1] + 0.5*h*k1[1], state[2] + 0.5*h*k1[2], state[3] + 0.5*h*k1[3]];
  const k2 = geodesicRHSEmbedded(s2, L);
  const s3: [number, number, number, number] = [state[0] + 0.5*h*k2[0], state[1] + 0.5*h*k2[1], state[2] + 0.5*h*k2[2], state[3] + 0.5*h*k2[3]];
  const k3 = geodesicRHSEmbedded(s3, L);
  const s4: [number, number, number, number] = [state[0] + h*k3[0], state[1] + h*k3[1], state[2] + h*k3[2], state[3] + h*k3[3]];
  const k4 = geodesicRHSEmbedded(s4, L);
  return [
    state[0] + (h / 6) * (k1[0] + 2*k2[0] + 2*k3[0] + k4[0]),
    state[1] + (h / 6) * (k1[1] + 2*k2[1] + 2*k3[1] + k4[1]),
    state[2] + (h / 6) * (k1[2] + 2*k2[2] + 2*k3[2] + k4[2]),
    state[3] + (h / 6) * (k1[3] + 2*k2[3] + 2*k3[3] + k4[3]),
  ];
}

// --- domain, sphere shell, K-grid (same as m4-gaussK) ---------------------

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

function buildPatch(L: number): MetricSurface {
  return new MetricSurface({
    domain: CONFIG_DOMAIN,
    metric: (phi: number, t: number): Matrix => {
      const { h_pp, h_pt, h_tt } = metric4(phi, t, L);
      const m = new Matrix(2, 2);
      m.data[0] = h_pp; m.data[1] = h_pt; m.data[2] = h_pt; m.data[3] = h_tt;
      return m;
    },
    display: sphereSurface,
  });
}

const GRID_N = 256;

function buildKGrid(L: number) {
  const patch = buildPatch(L);
  const data = new Float32Array(GRID_N * GRID_N);
  const samples: number[] = [];
  for (let j = 0; j < GRID_N; j++) {
    const tVal = (2 * Math.PI * (j + 0.5)) / GRID_N;
    for (let i = 0; i < GRID_N; i++) {
      const phi = -Math.PI / 2 + (Math.PI * i) / (GRID_N - 1);
      const k = gaussianCurvatureFromMetric(patch, phi, tVal);
      data[j * GRID_N + i] = Number.isFinite(k) ? k : NaN;
      if (Number.isFinite(k)) samples.push(k);
    }
  }
  samples.sort((a, b) => a - b);
  const lo = samples[Math.floor(samples.length * 0.02)] ?? 0;
  const hi = samples[Math.floor(samples.length * 0.98)] ?? 0;
  const pos = samples.filter((v) => v > 0);
  const neg = samples.filter((v) => v < 0).map((v) => -v).sort((a, b) => a - b);
  const scalePos = pos[Math.floor(pos.length * 0.98)] ?? 1;
  const scaleNeg = neg.length > 0 ? (neg[Math.floor(neg.length * 0.98)] ?? scalePos) : scalePos;
  return { data, scalePos: scalePos || 1, scaleNeg: scaleNeg || 1, min: lo, max: hi };
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

// --- left: K-colored sphere -----------------------------------------------

const fragmentShader = `
uniform sampler2D uK;
uniform float uKScalePos;
uniform float uKScaleNeg;

void main() {
  float k = texture2D(uK, vMapUv).r;
  if (!(k == k)) {
    csm_DiffuseColor = vec4(0.55, 0.55, 0.55, 1.0);
    csm_Emissive = vec3(0.0);
    return;
  }
  float s;
  if (k >= 0.0) s =  clamp( k / uKScalePos, 0.0, 1.0);
  else          s = -clamp(-k / uKScaleNeg, 0.0, 1.0);
  float ss = sign(s) * pow(abs(s), 0.2);
  vec3 white = vec3(1.0, 1.0, 1.0);
  vec3 red   = vec3(0.85, 0.05, 0.10);
  vec3 blue  = vec3(0.05, 0.20, 0.85);
  vec3 color = ss >= 0.0 ? mix(white, red, ss) : mix(white, blue, -ss);
  csm_DiffuseColor = vec4(color, 1.0);
  csm_Emissive = color * 0.85;
}
`;

let L = 3.0;
const initial = buildKGrid(L);
const uniforms: Record<string, { value: any }> = {
  uK: { value: makeFieldTexture(initial.data) },
  uKScalePos: { value: initial.scalePos },
  uKScaleNeg: { value: initial.scaleNeg },
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

// Marker at the launch point — only visible while idle/dragging.
const markerBall = new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 24, 24),
  new THREE.MeshPhysicalMaterial({ color: BURGUNDY, roughness: 0.22, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.18 }),
);
sphereGroup.add(markerBall);

// --- right: N superimposed chains -----------------------------------------

const N_GEODESICS = 10;
const FAN_HALF = 0.05; // radians; total fan ≈ 5.7°

const CHAIN_SCALE = 1.55;
const chainGroup = new THREE.Group();
chainGroup.position.set(1.7, 0, 0);
chainGroup.scale.setScalar(CHAIN_SCALE);
app.scene.add(chainGroup);

// Thinner rods + smaller joints so 10 stacked chains read as a "feather"
// rather than a single blob.
const ROD_RADIUS    = 0.025;
const JOINT_RADIUS  = 0.055;
const PINNED_RADIUS = 0.075;

const rodMat = new THREE.MeshPhysicalMaterial({
  color: SILVER, roughness: 0.32, metalness: 0.85, clearcoat: 0.4, clearcoatRoughness: 0.25,
  transparent: true, opacity: 0.55,
});
const ballMat = new THREE.MeshPhysicalMaterial({
  color: BURGUNDY, roughness: 0.22, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.18,
  transparent: true, opacity: 0.55,
});

const rodGeo = new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, 1, 12, 1);
const pinSphereGeo   = new THREE.SphereGeometry(PINNED_RADIUS, 16, 16);
const jointSphereGeo = new THREE.SphereGeometry(JOINT_RADIUS, 16, 16);

interface ChainUnit {
  rods: [THREE.Mesh, THREE.Mesh, THREE.Mesh, THREE.Mesh];
  pins: [THREE.Mesh, THREE.Mesh];
  joints: [THREE.Mesh, THREE.Mesh, THREE.Mesh];
}

function makeChainUnit(): ChainUnit {
  const rods = [
    new THREE.Mesh(rodGeo, rodMat),
    new THREE.Mesh(rodGeo, rodMat),
    new THREE.Mesh(rodGeo, rodMat),
    new THREE.Mesh(rodGeo, rodMat),
  ] as ChainUnit['rods'];
  const pins = [
    new THREE.Mesh(pinSphereGeo, ballMat),
    new THREE.Mesh(pinSphereGeo, ballMat),
  ] as ChainUnit['pins'];
  const joints = [
    new THREE.Mesh(jointSphereGeo, ballMat),
    new THREE.Mesh(jointSphereGeo, ballMat),
    new THREE.Mesh(jointSphereGeo, ballMat),
  ] as ChainUnit['joints'];
  for (const m of [...rods, ...pins, ...joints]) chainGroup.add(m);
  return { rods, pins, joints };
}

const chainUnits: ChainUnit[] = [];
for (let i = 0; i < N_GEODESICS; i++) chainUnits.push(makeChainUnit());

const _yAxis = new THREE.Vector3(0, 1, 0);
function placeRod(rod: THREE.Mesh, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  rod.position.set((ax + bx) / 2, (ay + by) / 2, 0);
  rod.scale.set(1, len, 1);
  rod.quaternion.setFromUnitVectors(_yAxis, new THREE.Vector3(dx / len, dy / len, 0));
}

function poseChain(unit: ChainUnit, phi: number, t: number) {
  const { p1, p2, p3 } = psi4Position(phi, t, L);
  const dx = -L / 2;
  const ax = 0 + dx,     ay = 0;
  const px = p1[0] + dx, py = p1[1];
  const qx = p2[0] + dx, qy = p2[1];
  const rx = p3[0] + dx, ry = p3[1];
  const bx = L + dx,     by = 0;
  unit.pins[0].position.set(ax, ay, 0);
  unit.pins[1].position.set(bx, by, 0);
  unit.joints[0].position.set(px, py, 0);
  unit.joints[1].position.set(qx, qy, 0);
  unit.joints[2].position.set(rx, ry, 0);
  placeRod(unit.rods[0], ax, ay, px, py);
  placeRod(unit.rods[1], px, py, qx, qy);
  placeRod(unit.rods[2], qx, qy, rx, ry);
  placeRod(unit.rods[3], rx, ry, bx, by);
}

// --- N trails on the sphere ------------------------------------------------

const trails: StreamTube[] = [];
for (let i = 0; i < N_GEODESICS; i++) {
  const trail = new StreamTube(sphereSurface, {
    maxPoints: 4000, radius: 0.025, radialSegments: 6,
    color: BURGUNDY, roughness: 0.25,
  });
  sphereGroup.add(trail);
  trails.push(trail);
}

// --- state -----------------------------------------------------------------

const STEP = 0.02;

// One state per geodesic: [phi, t, phidot, tdot].
let states: [number, number, number, number][] = [];
for (let i = 0; i < N_GEODESICS; i++) states.push([0, Math.PI / 2, 0, 0]);

type Mode = 'idle' | 'dragging' | 'simulating';
let mode: Mode = 'idle';

function setMarkerVisible(v: boolean) { markerBall.visible = v; }
function setMarkerAt(phi: number, t: number) {
  markerBall.position.set(
    SPHERE_R * Math.cos(phi) * Math.cos(t),
    SPHERE_R * Math.cos(phi) * Math.sin(t),
    SPHERE_R * Math.sin(phi),
  );
}

function setAllChainsTo(phi: number, t: number) {
  for (const unit of chainUnits) poseChain(unit, phi, t);
}

// --- launch helpers --------------------------------------------------------

/**
 * Fan a unit-metric-speed launch direction (vphi, vt) at point (phi, t) into
 * N nearby unit directions, evenly spaced by angle in the metric-orthonormal
 * tangent frame.
 */
function fanInitialVelocities(phi: number, t: number, vphi0: number, vt0: number): [number, number][] {
  const { h_pp: E, h_pt: F, h_tt: G } = metric4(phi, t, L);

  // e1 = launch direction (assumed unit-metric).
  const e1: [number, number] = [vphi0, vt0];

  // Pick a non-parallel helper, Gram-Schmidt to get e2 ⟂ e1.
  let helper: [number, number] = Math.abs(vphi0) < Math.abs(vt0) ? [1, 0] : [0, 1];
  const g_he1 = E * helper[0] * e1[0] + F * (helper[0] * e1[1] + helper[1] * e1[0]) + G * helper[1] * e1[1];
  const w: [number, number] = [helper[0] - g_he1 * e1[0], helper[1] - g_he1 * e1[1]];
  const w2 = E * w[0] * w[0] + 2 * F * w[0] * w[1] + G * w[1] * w[1];
  if (w2 < 1e-12) return [[vphi0, vt0]];
  const wn = Math.sqrt(w2);
  const e2: [number, number] = [w[0] / wn, w[1] / wn];

  const dirs: [number, number][] = [];
  for (let i = 0; i < N_GEODESICS; i++) {
    const theta = N_GEODESICS === 1
      ? 0
      : -FAN_HALF + (2 * FAN_HALF * i) / (N_GEODESICS - 1);
    const c = Math.cos(theta), s = Math.sin(theta);
    dirs.push([c * e1[0] + s * e2[0], c * e1[1] + s * e2[1]]);
  }
  return dirs;
}

// --- drag interaction ------------------------------------------------------

const renderer = app.renderManager.renderer;
const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

type DragSample = { time: number; phi: number; t: number };
const dragSamples: DragSample[] = [];
const DRAG_SAMPLE_KEEP = 5;

function updateNdc(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function uvToPhiT(uv: THREE.Vector2): [number, number] {
  return [
    CONFIG_DOMAIN.uMin + uv.x * (CONFIG_DOMAIN.uMax - CONFIG_DOMAIN.uMin),
    CONFIG_DOMAIN.vMin + uv.y * (CONFIG_DOMAIN.vMax - CONFIG_DOMAIN.vMin),
  ];
}

function pickSphere(): { phi: number; t: number } | null {
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(sphereMesh, false);
  if (hits.length === 0 || !hits[0].uv) return null;
  const [phi, t] = uvToPhiT(hits[0].uv);
  return { phi, t };
}

canvas.addEventListener('pointerdown', (e) => {
  updateNdc(e);
  const hit = pickSphere();
  if (!hit) return;
  mode = 'dragging';
  app.controls.controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  dragSamples.length = 0;
  for (const tr of trails) tr.reset();
  setMarkerVisible(true);
  setMarkerAt(hit.phi, hit.t);
  setAllChainsTo(hit.phi, hit.t);
  dragSamples.push({ time: e.timeStamp, phi: hit.phi, t: hit.t });
});

canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'dragging') return;
  updateNdc(e);
  const hit = pickSphere();
  if (!hit) return;
  setMarkerAt(hit.phi, hit.t);
  setAllChainsTo(hit.phi, hit.t);
  dragSamples.push({ time: e.timeStamp, phi: hit.phi, t: hit.t });
  if (dragSamples.length > DRAG_SAMPLE_KEEP) dragSamples.shift();
});

function endDrag(e: PointerEvent) {
  if (mode !== 'dragging') return;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);

  if (dragSamples.length < 2) { mode = 'idle'; return; }
  const last = dragSamples[dragSamples.length - 1];
  const first = dragSamples[0];
  const dtWall = (last.time - first.time) / 1000;
  if (dtWall <= 0) { mode = 'idle'; return; }

  let dPhi = last.phi - first.phi;
  let dT = last.t - first.t;
  if (dT > Math.PI) dT -= 2 * Math.PI;
  if (dT < -Math.PI) dT += 2 * Math.PI;
  const phiDotRaw = dPhi / dtWall;
  const tDotRaw = dT / dtWall;

  // Normalize to unit metric speed.
  const phi0 = last.phi, t0 = last.t;
  const { h_pp, h_pt, h_tt } = metric4(phi0, t0, L);
  const v2 = h_pp * phiDotRaw * phiDotRaw + 2 * h_pt * phiDotRaw * tDotRaw + h_tt * tDotRaw * tDotRaw;
  if (v2 < 1e-8) { mode = 'idle'; return; }
  const speed = Math.sqrt(v2);
  const v0: [number, number] = [phiDotRaw / speed, tDotRaw / speed];

  const dirs = fanInitialVelocities(phi0, t0, v0[0], v0[1]);
  states = dirs.map((d) => [phi0, t0, d[0], d[1]]);

  for (let i = 0; i < N_GEODESICS; i++) trails[i].push(phi0, t0);
  setMarkerVisible(false);
  mode = 'simulating';
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', (e) => {
  if (mode !== 'dragging') return;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  mode = 'idle';
});

// --- tick ------------------------------------------------------------------

const POLE_MARGIN = 0.01;
const POLE_CLAMP = Math.PI / 2 - POLE_MARGIN;

app.addAnimateCallback(() => {
  if (mode !== 'simulating') return;
  for (let i = 0; i < N_GEODESICS; i++) {
    const s = states[i];
    if (s[0] >  POLE_CLAMP) { s[0] =  POLE_CLAMP; s[2] = -Math.abs(s[2]); }
    if (s[0] < -POLE_CLAMP) { s[0] = -POLE_CLAMP; s[2] =  Math.abs(s[2]); }
    states[i] = rk4StepEmbedded(s, STEP, L);
    trails[i].push(states[i][0], states[i][1]);
    poseChain(chainUnits[i], states[i][0], states[i][1]);
  }
});

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
rangeReadout.textContent = `K ∈ [${initial.min.toFixed(2)}, ${initial.max.toFixed(2)}]`;
document.body.appendChild(rangeReadout);

const sliderWrap = document.createElement('div');
sliderWrap.style.cssText =
  'position:fixed;bottom:16px;right:16px;width:280px;padding:8px 10px;' +
  'background:transparent;pointer-events:auto;z-index:10;';
sliderWrap.innerHTML = `
  <input id="jc-L" type="range" class="thin-slider" min="2.05" max="3.95" step="0.01" value="${L}" />
`;
document.body.appendChild(sliderWrap);

const slider = sliderWrap.querySelector<HTMLInputElement>('#jc-L')!;

function rebuildField() {
  const { data, scalePos, scaleNeg, min, max } = buildKGrid(L);
  (uniforms.uK.value as THREE.DataTexture).dispose();
  uniforms.uK.value = makeFieldTexture(data);
  uniforms.uKScalePos.value = scalePos;
  uniforms.uKScaleNeg.value = scaleNeg;
  rangeReadout.textContent = `K ∈ [${min.toFixed(2)}, ${max.toFixed(2)}]`;
}

slider.addEventListener('input', () => {
  L = parseFloat(slider.value);
  rebuildField();
  for (const tr of trails) tr.reset();
  mode = 'idle';
  setAllChainsTo(0, Math.PI / 2);
  setMarkerVisible(true);
  setMarkerAt(0, Math.PI / 2);
});

setAllChainsTo(0, Math.PI / 2);
setMarkerAt(0, Math.PI / 2);
app.start();
