/**
 * m4-geodesic-massweighted — geodesic dynamics on M⁴_L with the mass-weighted
 * kinetic-energy metric.
 *
 * Same visual layout as m4-geodesic (cream sphere + grid + burgundy ball on
 * the left, silver 4-rod chain on the right) but the dynamics use the mass-
 * weighted metric from "Realistic Sphere Linkages". Uses the embedded RHS
 * approach (see geodesic-metric-compare): differentiate ψ4 twice in (φ, t),
 * enforce g-normality of the ambient acceleration to solve for (φ̈, ẗ),
 * step with custom RK4. The only difference from the embedded path in
 * geodesic-metric-compare is that all ambient inner products use
 * weightedDot6 with M = tridiag(a, b) ⊗ I_2,  a = 2 m_e/3 + m_v,  b = m_e/6.
 *
 * Drag the ball to set an initial point; release with momentum to launch a
 * geodesic. Sliders for L, m_e, m_v.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SurfaceMesh, StreamTube } from '@/math';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

// --- Palette ---

const BG          = 0xF0EDE8;
const BURGUNDY    = 0x7A1F2C;
const CREAM       = 0xE2D8C0;
const CREAM_DEEP  = 0xBFB294;
const SILVER      = 0xBCB6AC;

// --- ψ⁴_L position-coordinate form (post 2 §5) ---

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

  return {
    p1: [p1_re, p1_im],
    p2: [p2_re, p2_im],
    p3: [p3_re, p3_im],
  };
}

// --- mass-weighted ambient inner product ----------------------------------

type AmbientMetric = { a: number; b: number };
function ambientMetric(m_e: number, m_v: number): AmbientMetric {
  return { a: 2 * m_e / 3 + m_v, b: m_e / 6 };
}

function weightedDot6(g: AmbientMetric, U: number[], V: number[]): number {
  const { a, b } = g;
  const diag =
    a * (U[0]*V[0] + U[1]*V[1]) +
    a * (U[2]*V[2] + U[3]*V[3]) +
    a * (U[4]*V[4] + U[5]*V[5]);
  const cross =
    b * (U[0]*V[2] + U[1]*V[3] + U[2]*V[0] + U[3]*V[1]) +
    b * (U[2]*V[4] + U[3]*V[5] + U[4]*V[2] + U[5]*V[3]);
  return diag + cross;
}

// --- embedded geodesic RHS via g-tangent-projected acceleration -----------
//
// Same idea as geodesic-metric-compare's geodesicRHSEmbedded, but inner
// products are M-weighted. The 2×2 system <p_a, p_b>_g · (φ̈, ẗ)^T = -<p_a, W>_g
// where W = p_φφ φ̇² + 2 p_φt φ̇ ṫ + p_tt ṫ² (the velocity-quadratic part of
// the ambient acceleration). Pre-built ambient metric `g` is closed over.

function geodesicRHSEmbedded(
  state: [number, number, number, number],
  L: number,
  g: AmbientMetric,
): [number, number, number, number] {
  const [phi, t, phidot, tdot] = state;
  const eps = 1e-4;

  const Q = (ph: number, tt: number): number[] => {
    const { p1, p2, p3 } = psi4Position(ph, tt, L);
    return [p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]];
  };

  const sub = (a: number[], b: number[]) => a.map((x, i) => x - b[i]);
  const add = (...vs: number[][]) => vs.reduce((s, v) => s.map((x, i) => x + v[i]));
  const scale = (a: number[], c: number) => a.map((x) => c * x);

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

  const E = weightedDot6(g, q_phi, q_phi);
  const F = weightedDot6(g, q_phi, q_t);
  const G = weightedDot6(g, q_t, q_t);
  const D = E * G - F * F;
  const bP = -weightedDot6(g, q_phi, W);
  const bT = -weightedDot6(g, q_t, W);
  const phiddot = (G * bP - F * bT) / D;
  const tddot   = (E * bT - F * bP) / D;

  return [phidot, tdot, phiddot, tddot];
}

function rk4StepEmbedded(
  state: [number, number, number, number],
  h: number,
  L: number,
  g: AmbientMetric,
): [number, number, number, number] {
  const k1 = geodesicRHSEmbedded(state, L, g);
  const s2: [number, number, number, number] = [
    state[0] + 0.5*h*k1[0], state[1] + 0.5*h*k1[1],
    state[2] + 0.5*h*k1[2], state[3] + 0.5*h*k1[3],
  ];
  const k2 = geodesicRHSEmbedded(s2, L, g);
  const s3: [number, number, number, number] = [
    state[0] + 0.5*h*k2[0], state[1] + 0.5*h*k2[1],
    state[2] + 0.5*h*k2[2], state[3] + 0.5*h*k2[3],
  ];
  const k3 = geodesicRHSEmbedded(s3, L, g);
  const s4: [number, number, number, number] = [
    state[0] + h*k3[0], state[1] + h*k3[1],
    state[2] + h*k3[2], state[3] + h*k3[3],
  ];
  const k4 = geodesicRHSEmbedded(s4, L, g);
  return [
    state[0] + (h / 6) * (k1[0] + 2*k2[0] + 2*k3[0] + k4[0]),
    state[1] + (h / 6) * (k1[1] + 2*k2[1] + 2*k3[1] + k4[1]),
    state[2] + (h / 6) * (k1[2] + 2*k2[2] + 2*k3[2] + k4[2]),
    state[3] + (h / 6) * (k1[3] + 2*k2[3] + 2*k3[3] + k4[3]),
  ];
}

// First fundamental form via numerical pullback at one point — used to
// normalize the launch velocity to unit g-speed.
function firstFundamental(phi: number, t: number, L: number, g: AmbientMetric): [number, number, number] {
  const eps = 1e-4;
  const Q = (ph: number, tt: number): number[] => {
    const { p1, p2, p3 } = psi4Position(ph, tt, L);
    return [p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]];
  };
  const Qpp = Q(phi + eps, t),  Qpm = Q(phi - eps, t);
  const Qtp = Q(phi, t + eps),  Qtm = Q(phi, t - eps);
  const q_phi: number[] = new Array(6);
  const q_t:   number[] = new Array(6);
  for (let i = 0; i < 6; i++) {
    q_phi[i] = (Qpp[i] - Qpm[i]) / (2 * eps);
    q_t[i]   = (Qtp[i] - Qtm[i]) / (2 * eps);
  }
  return [
    weightedDot6(g, q_phi, q_phi),
    weightedDot6(g, q_phi, q_t),
    weightedDot6(g, q_t,   q_t),
  ];
}

// --- Sphere shell (visualization domain) ---

const SPHERE_R = Math.PI;
const CONFIG_DOMAIN: SurfaceDomain = {
  uMin: -Math.PI / 2, uMax: Math.PI / 2, vMin: 0, vMax: 2 * Math.PI,
};

const abstractSurface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    return new THREE.Vector3(
      SPHERE_R * Math.cos(u) * Math.cos(v),
      SPHERE_R * Math.cos(u) * Math.sin(v),
      SPHERE_R * Math.sin(u),
    );
  },
  getDomain: () => CONFIG_DOMAIN,
};

// --- State ---

let L = 3.0;
let m_e = 0.0;
let m_v = 1.0;
let g = ambientMetric(m_e, m_v);

const STEP = 0.02;

// Geodesic state: (φ, t, φ̇, ṫ).
let phiState   = 0;
let tState     = 0.3;
let phiDot     = 0;
let tDot       = 0;

type Mode = 'idle' | 'dragging' | 'simulating';
let mode: Mode = 'idle';

// --- Scene ---

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 5.8);
app.controls.target.set(0, 0, 0);
app.backgrounds.setColor(BG);

app.scene.add(new THREE.AmbientLight(0xfff3e0, 0.55));

const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(4, 5, 6);
app.scene.add(key);

const fill = new THREE.DirectionalLight(0xffe6c4, 0.7);
fill.position.set(-5, -2, 4);
app.scene.add(fill);

const rim = new THREE.DirectionalLight(0xfff8ec, 0.6);
rim.position.set(-2, 4, -3);
app.scene.add(rim);

// --- Layout ---

const SPHERE_PANEL_SCALE = 0.40;

// === LEFT PANEL: abstract S² ===

const sphereGroup = new THREE.Group();
sphereGroup.position.set(-2.9, 0, 0);
sphereGroup.scale.setScalar(SPHERE_PANEL_SCALE);
app.scene.add(sphereGroup);

const abstractMesh = new SurfaceMesh(abstractSurface, {
  uSegments: 48,
  vSegments: 96,
  color: CREAM,
  roughness: 0.32,
  metalness: 0.0,
});
{
  const mat = abstractMesh.material as THREE.MeshPhysicalMaterial;
  mat.clearcoat = 0.85;
  mat.clearcoatRoughness = 0.18;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
}
sphereGroup.add(abstractMesh);

const abstractBall = new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 24, 24),
  new THREE.MeshPhysicalMaterial({
    color: BURGUNDY,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18,
  }),
);
sphereGroup.add(abstractBall);

// --- Sphere grid (same as m4-geodesic) ---

const N_LAT_MAJOR = 5;
const N_LON_MAJOR = 8;
const N_LAT_TOTAL = 2 * N_LAT_MAJOR + 1;
const N_LON_TOTAL = 2 * N_LON_MAJOR;
const SAMPLES_PER_LINE = 240;
const MAJOR_RADIUS = 0.025;
const MINOR_RADIUS = 0.011;

const lineMat = new THREE.MeshPhysicalMaterial({
  color: CREAM_DEEP,
  roughness: 0.4,
  metalness: 0.0,
  clearcoat: 0.4,
  clearcoatRoughness: 0.3,
});

function buildLineTube(samples: THREE.Vector3[], closed: boolean, radius: number): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(samples, closed, 'catmullrom', 0.5);
  const geom = new THREE.TubeGeometry(curve, samples.length, radius, 8, closed);
  return new THREE.Mesh(geom, lineMat);
}

function buildSphereGrid(): THREE.Group {
  const group = new THREE.Group();
  const ev = (u: number, v: number) => abstractSurface.evaluate(u, v);
  for (let i = 1; i <= N_LAT_TOTAL; i++) {
    const phi = -Math.PI / 2 + (i * Math.PI) / (N_LAT_TOTAL + 1);
    const radius = i % 2 === 0 ? MAJOR_RADIUS : MINOR_RADIUS;
    const samples: THREE.Vector3[] = new Array(SAMPLES_PER_LINE);
    for (let j = 0; j < SAMPLES_PER_LINE; j++) {
      samples[j] = ev(phi, (2 * Math.PI * j) / SAMPLES_PER_LINE);
    }
    group.add(buildLineTube(samples, true, radius));
  }
  for (let k = 0; k < N_LON_TOTAL; k++) {
    const v = (2 * Math.PI * k) / N_LON_TOTAL;
    const radius = k % 2 === 0 ? MAJOR_RADIUS : MINOR_RADIUS;
    const samples: THREE.Vector3[] = new Array(SAMPLES_PER_LINE);
    for (let j = 0; j < SAMPLES_PER_LINE; j++) {
      const phi = -Math.PI / 2 + (Math.PI * j) / (SAMPLES_PER_LINE - 1);
      samples[j] = ev(phi, v);
    }
    group.add(buildLineTube(samples, false, radius));
  }
  return group;
}

sphereGroup.add(buildSphereGrid());

// --- Geodesic trail on the sphere ---

const TRAIL_MAX_POINTS = 5000;
const trail = new StreamTube(abstractSurface, {
  maxPoints: TRAIL_MAX_POINTS,
  radius: 0.06,
  radialSegments: 8,
  color: BURGUNDY,
  roughness: 0.25,
});
sphereGroup.add(trail);

// === RIGHT PANEL: 4-rod chain ===

const CHAIN_SCALE = 1.55;

const chainGroup = new THREE.Group();
chainGroup.position.set(1.7, 0, 0);
chainGroup.scale.setScalar(CHAIN_SCALE);
app.scene.add(chainGroup);

const ROD_RADIUS    = 0.05;
const JOINT_RADIUS  = 0.10;
const PINNED_RADIUS = 0.13;

const rodMat = new THREE.MeshPhysicalMaterial({
  color: SILVER,
  roughness: 0.32,
  metalness: 0.85,
  clearcoat: 0.4,
  clearcoatRoughness: 0.25,
});

const ballMat = new THREE.MeshPhysicalMaterial({
  color: BURGUNDY,
  roughness: 0.22,
  metalness: 0.05,
  clearcoat: 0.8,
  clearcoatRoughness: 0.18,
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

// Mass-driven visual scales. Geometry has rod radius 0.05 / joint radius 0.10
// baked in; we scale the meshes around those to hit:
//   rod radius:   0.025 + 0.020 * sqrt(m_e)   → scale = 0.5 + 0.4 * sqrt(m_e)
//   ball radius:  0.05  + 0.07  * cbrt(m_v)   → scale = 0.5 + 0.7 * cbrt(m_v)
// sqrt for rods (cylinder mass ∝ r²·ℓ at fixed length) and cbrt for balls
// (sphere mass ∝ r³). Pinned endpoints aren't part of the moving system and
// stay at their original size.
let rodScale = 1.0;

function applyMassVisuals() {
  rodScale = 0.5 + 0.4 * Math.sqrt(m_e);
  const ballScale = 0.5 + 0.7 * Math.cbrt(m_v);
  joint1.scale.setScalar(ballScale);
  joint2.scale.setScalar(ballScale);
  joint3.scale.setScalar(ballScale);
}

function placeRod(rod: THREE.Mesh, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  rod.position.set((ax + bx) / 2, (ay + by) / 2, 0);
  rod.scale.set(rodScale, len, rodScale);
  rod.quaternion.setFromUnitVectors(_yAxis, new THREE.Vector3(dx / len, dy / len, 0));
}

// --- Update ---

function update() {
  abstractBall.position.set(
    SPHERE_R * Math.cos(phiState) * Math.cos(tState),
    SPHERE_R * Math.cos(phiState) * Math.sin(tState),
    SPHERE_R * Math.sin(phiState),
  );

  const { p1, p2, p3 } = psi4Position(phiState, tState, L);
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

// --- Drag interaction (drag → release → launch geodesic) ---

const renderer = app.renderManager.renderer;
const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

type DragSample = { time: number; phi: number; t: number };
const dragSamples: DragSample[] = [];
const DRAG_SAMPLE_KEEP = 5;

function updateNdcFromPointer(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickAbstractHit(hit: THREE.Vector3, now: number) {
  const local = sphereGroup.worldToLocal(hit.clone());
  local.normalize();
  phiState = Math.asin(THREE.MathUtils.clamp(local.z, -1, 1));
  tState = Math.atan2(local.y, local.x);
  phiDot = 0;
  tDot = 0;
  dragSamples.push({ time: now, phi: phiState, t: tState });
  if (dragSamples.length > DRAG_SAMPLE_KEEP) dragSamples.shift();
  update();
}

function raycastSphere(): THREE.Vector3 | null {
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(abstractMesh, false);
  if (hits.length > 0) return hits[0].point;
  const ray = raycaster.ray;
  const center = new THREE.Vector3();
  sphereGroup.getWorldPosition(center);
  const radius = SPHERE_R * SPHERE_PANEL_SCALE;
  const oc = new THREE.Vector3().subVectors(center, ray.origin);
  const along = oc.dot(ray.direction);
  const closestOnRay = ray.origin.clone().addScaledVector(ray.direction, along);
  const offset = new THREE.Vector3().subVectors(closestOnRay, center);
  if (offset.lengthSq() < 1e-12) return null;
  offset.normalize();
  return center.clone().addScaledVector(offset, radius);
}

canvas.addEventListener('pointerdown', (e) => {
  updateNdcFromPointer(e);
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObjects([abstractMesh, abstractBall], false);
  if (hits.length === 0) return;
  mode = 'dragging';
  app.controls.controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  dragSamples.length = 0;
  trail.reset();
  pickAbstractHit(hits[0].point, e.timeStamp);
});

canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'dragging') return;
  updateNdcFromPointer(e);
  const hit = raycastSphere();
  if (hit) pickAbstractHit(hit, e.timeStamp);
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
  if (dT > Math.PI)  dT -= 2 * Math.PI;
  if (dT < -Math.PI) dT += 2 * Math.PI;

  const phiDotRaw = dPhi / dtWall;
  const tDotRaw   = dT / dtWall;

  const [E, F, G] = firstFundamental(phiState, tState, L, g);
  const v2 = E * phiDotRaw * phiDotRaw + 2 * F * phiDotRaw * tDotRaw + G * tDotRaw * tDotRaw;
  if (v2 < 1e-8) { mode = 'idle'; return; }
  const speed = Math.sqrt(v2);
  phiDot = phiDotRaw / speed;
  tDot   = tDotRaw   / speed;

  trail.push(phiState, tState);
  mode = 'simulating';
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', (e) => {
  if (mode !== 'dragging') return;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  mode = 'idle';
});

// --- Simulation tick ---

const STEPS_PER_FRAME = 1;
const POLE_MARGIN = 0.01;
const POLE_CLAMP  = Math.PI / 2 - POLE_MARGIN;

app.addAnimateCallback(() => {
  if (mode !== 'simulating') return;

  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    if (phiState >  POLE_CLAMP) { phiState =  POLE_CLAMP; phiDot = -Math.abs(phiDot); }
    if (phiState < -POLE_CLAMP) { phiState = -POLE_CLAMP; phiDot =  Math.abs(phiDot); }

    const next = rk4StepEmbedded(
      [phiState, tState, phiDot, tDot],
      STEP, L, g,
    );
    phiState = next[0];
    tState   = next[1];
    phiDot   = next[2];
    tDot     = next[3];
  }

  trail.push(phiState, tState);
  update();
});

// --- UI: stacked sliders, lower-right ---

const style = document.createElement('style');
style.textContent = `
  .slider-wrapper {
    position: absolute;
    bottom: 16px;
    right: 16px;
    width: 280px;
    padding: 10px 12px;
    background: rgba(255, 255, 255, 0.85);
    border-radius: 6px;
    pointer-events: auto;
    z-index: 10;
  }
  .thin-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 5px;
    margin: 0;
    background: transparent;
    outline: none;
    cursor: pointer;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
  }
  .thin-slider::-webkit-slider-runnable-track {
    height: 5px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.45);
    border-radius: 999px;
    box-sizing: border-box;
  }
  .thin-slider::-moz-range-track {
    height: 5px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.45);
    border-radius: 999px;
    box-sizing: border-box;
  }
  .thin-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    margin-top: -5px;
    background: #fff;
    border: 1.5px solid rgba(0, 0, 0, 0.8);
    border-radius: 50%;
    box-shadow: none;
    box-sizing: border-box;
    cursor: pointer;
  }
  .thin-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: #fff;
    border: 1.5px solid rgba(0, 0, 0, 0.8);
    border-radius: 50%;
    box-shadow: none;
    box-sizing: border-box;
    cursor: pointer;
  }
  .thin-slider:focus { outline: none; }
  .slider-row { display: flex; align-items: center; gap: 10px; color: #333; font: 12px/1.2 monospace; margin-bottom: 6px; }
  .slider-row:last-child { margin-bottom: 0; }
  .slider-row .label { width: 36px; }
  .slider-row .val   { width: 40px; text-align: right; }
`;
document.head.appendChild(style);

const sliderWrap = document.createElement('div');
sliderWrap.className = 'slider-wrapper';
sliderWrap.innerHTML = `
  <div class="slider-row"><span class="label">L</span>
    <input id="psi4-L"  type="range" class="thin-slider" min="2.05" max="3.95" step="0.01" value="${L}"   />
    <span class="val" id="psi4-L-val">${L.toFixed(2)}</span></div>
  <div class="slider-row"><span class="label">m_e</span>
    <input id="psi4-me" type="range" class="thin-slider" min="0"    max="8"    step="0.01" value="${m_e}" />
    <span class="val" id="psi4-me-val">${m_e.toFixed(2)}</span></div>
  <div class="slider-row"><span class="label">m_v</span>
    <input id="psi4-mv" type="range" class="thin-slider" min="0"    max="4"    step="0.01" value="${m_v}" />
    <span class="val" id="psi4-mv-val">${m_v.toFixed(2)}</span></div>
`;
document.body.appendChild(sliderWrap);

const lSlider  = sliderWrap.querySelector<HTMLInputElement>('#psi4-L')!;
const meSlider = sliderWrap.querySelector<HTMLInputElement>('#psi4-me')!;
const mvSlider = sliderWrap.querySelector<HTMLInputElement>('#psi4-mv')!;
const lVal  = sliderWrap.querySelector<HTMLSpanElement>('#psi4-L-val')!;
const meVal = sliderWrap.querySelector<HTMLSpanElement>('#psi4-me-val')!;
const mvVal = sliderWrap.querySelector<HTMLSpanElement>('#psi4-mv-val')!;

function refreshAndRelaunch() {
  if (m_e === 0 && m_v === 0) {
    // Degenerate metric — bump m_v off zero so g stays positive-definite.
    m_v = 0.01;
    mvSlider.value = '0.01';
    mvVal.textContent = '0.01';
  }
  g = ambientMetric(m_e, m_v);
  applyMassVisuals();
  trail.reset();
  launchAuto();
}

lSlider.addEventListener('input', () => {
  L = parseFloat(lSlider.value);
  lVal.textContent = L.toFixed(2);
  refreshAndRelaunch();
});
meSlider.addEventListener('input', () => {
  m_e = parseFloat(meSlider.value);
  meVal.textContent = m_e.toFixed(2);
  refreshAndRelaunch();
});
mvSlider.addEventListener('input', () => {
  m_v = parseFloat(mvSlider.value);
  mvVal.textContent = m_v.toFixed(2);
  refreshAndRelaunch();
});

// --- Auto-launch a geodesic on load so the demo is alive when the reader arrives ---

function launchAuto() {
  phiState = 0;
  tState   = 0.3;
  const phiDotRaw = 0.5;
  const tDotRaw   = 1.0;
  const [E, F, G] = firstFundamental(phiState, tState, L, g);
  const v2 = E * phiDotRaw * phiDotRaw + 2 * F * phiDotRaw * tDotRaw + G * tDotRaw * tDotRaw;
  const speed = Math.sqrt(Math.max(v2, 1e-8));
  phiDot = phiDotRaw / speed;
  tDot   = tDotRaw   / speed;
  trail.reset();
  trail.push(phiState, tState);
  update();
  mode = 'simulating';
}

applyMassVisuals();
launchAuto();
app.start();
