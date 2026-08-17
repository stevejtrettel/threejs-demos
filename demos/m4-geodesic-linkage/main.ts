/**
 * Blog: Dynamics for Sphere Linkages — Demo
 *
 * Same visual layout as m4-parametric-linkage (cream sphere + grid + burgundy
 * ball on the left, silver 4-rod chain on the right) but the dynamics are
 * different: the ball traces a *geodesic* of the kinetic-energy metric on
 * the configuration sphere, and the chain follows along.
 *
 * Drag the ball to set an initial point; release with momentum to launch a
 * geodesic from that direction. The trail behind the ball is the (φ, t)
 * trajectory drawn back on S². L slider deforms the metric.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { fitView } from '@/scene/fitView';
import { SurfaceMesh, MetricSurface, GeodesicIntegrator, StreamTube } from '@/math';
import { Matrix } from '@/math/linear-algebra';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

// --- Palette ---

const BG          = 0xF0EDE8;
const BURGUNDY    = 0x7A1F2C;
const CREAM       = 0xE2D8C0;
const CREAM_DEEP  = 0xBFB294;
const SILVER      = 0xBCB6AC;

// --- ψ^4_L position-coordinate form (post 2 §5) ---

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

  // ν = 2·sign(c)·√(d sin A sin B) with A = (α+θ)/2, B = (α−θ)/2. Identical to
  // c·√(num/c²) away from cos t = 0. At cos t = 0 that form is 0/0, and the
  // guarded branch it used there returned the limit of √(num/c²) instead of the
  // limit of ν — short a factor of c, so it gave a nonzero amplitude where ν
  // actually vanishes and pulled the linkage apart. Rewriting num via
  // 2·d(cos θ − cos α) = 4·d·sin A sin B removes both the 0/0 and the
  // catastrophic cancellation in num, with no branch left to get wrong.
  const halfSum  = (alpha_in + theta_in) / 2;
  const halfDiff = (alpha_in - theta_in) / 2;
  const nu_in = (c < 0 ? -2 : 2) * Math.sqrt(d * Math.sin(halfSum) * Math.sin(halfDiff));

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

// --- metric4: kinetic-energy pullback h_ab = ∑_k <∂_a p_k, ∂_b p_k> ---
//
// Closed-form derivation through Ω = Im(∂p₂/p₂) − ∂|p₂|/ν_in. Verified against
// finite-differences of psi4Position in geodesic-metric-compare.

function metric4(phi: number, t: number, L: number): number[][] {
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

  return [[h_pp, h_pt], [h_pt, h_tt]];
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

// Geodesic state: position (φ, t) and velocity (φ̇, ṫ) in the (φ, t) chart.
let phiState   = 0;
let tState     = 0.3;
let phiDot     = 0;
let tDot       = 0;

type Mode = 'idle' | 'dragging' | 'simulating';
let mode: Mode = 'idle';

// MetricSurface + GeodesicIntegrator are rebuilt when L changes.
function buildPatch(Lval: number): MetricSurface {
  return new MetricSurface({
    domain: CONFIG_DOMAIN,
    metric: (phi: number, t: number): Matrix => {
      const m = metric4(phi, t, Lval);
      const mat = new Matrix(2, 2);
      mat.data[0] = m[0][0]; mat.data[1] = m[0][1];
      mat.data[2] = m[1][0]; mat.data[3] = m[1][1];
      return mat;
    },
    display: abstractSurface,
  });
}

let patch = buildPatch(L);
let integrator = new GeodesicIntegrator(patch, { stepSize: 0.02 });

// --- Scene ---

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 5.8);
app.controls.target.set(0, 0, 0);
// Blog iframes are narrower than the window this was laid out in, and a
// fixed camera would let the two panels run off the sides. Extents cover
// the widest linkage the L slider allows, so the framing is stable as L
// moves; on a viewport wide enough for the intended framing this is a
// no-op.
fitView(app.camera, app.controls.target, { halfWidth: 6.5, halfHeight: 1.9 });
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

// --- Sphere grid (same as m4-parametric-linkage) ---

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
function placeRod(rod: THREE.Mesh, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  rod.position.set((ax + bx) / 2, (ay + by) / 2, 0);
  rod.scale.set(1, len, 1);
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
  // Fallback: closest point on the sphere to the cursor's ray
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
  // Mid-sim drag interrupts the geodesic.
  mode = 'dragging';
  cancelResume();
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

/**
 * A press that produced no usable flick leaves the ball parked.
 *
 * Left there the demo is a dead end: the reader tapped the sphere, the motion
 * stopped, and nothing brings it back. Instead fall idle briefly and then
 * relaunch from wherever they left it, matching how m4-parametric-linkage
 * resumes its own animation after a drag.
 */
const RESUME_DELAY_MS = 1400;
let resumeTimer: number | null = null;

function cancelResume(): void {
  if (resumeTimer !== null) { clearTimeout(resumeTimer); resumeTimer = null; }
}

function idleThenResume(): void {
  mode = 'idle';
  cancelResume();
  resumeTimer = window.setTimeout(() => {
    resumeTimer = null;
    if (mode !== 'idle') return;
    // Relaunch from where the reader parked it, not from the demo's opening
    // configuration, so their choice of starting point is what gets explored.
    relaunchFromHere();
  }, RESUME_DELAY_MS);
}

function endDrag(e: PointerEvent) {
  if (mode !== 'dragging') return;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);

  // Compute (φ̇, ṫ) from the earliest and latest kept drag samples.
  if (dragSamples.length < 2) { idleThenResume(); return; }
  const last = dragSamples[dragSamples.length - 1];
  const first = dragSamples[0];
  const dtWall = (last.time - first.time) / 1000; // seconds
  if (dtWall <= 0) { idleThenResume(); return; }
  let dPhi = last.phi - first.phi;
  let dT = last.t - first.t;
  // Wrap dt to the shorter arc so a drag across the ±π seam doesn't blow up.
  if (dT > Math.PI)  dT -= 2 * Math.PI;
  if (dT < -Math.PI) dT += 2 * Math.PI;

  const phiDotRaw = dPhi / dtWall;
  const tDotRaw   = dT / dtWall;

  // Normalize to unit speed in the metric so geodesic plays at a consistent
  // pace regardless of how hard the reader flicks.
  const g = patch.computeMetric([phiState, tState]).data;
  const E = g[0], F = g[1], G = g[3];
  const v2 = E * phiDotRaw * phiDotRaw + 2 * F * phiDotRaw * tDotRaw + G * tDotRaw * tDotRaw;
  if (v2 < 1e-8) { idleThenResume(); return; }
  const speed = Math.sqrt(v2);
  phiDot = phiDotRaw / speed;
  tDot   = tDotRaw   / speed;

  cancelResume();
  trail.push(phiState, tState);
  mode = 'simulating';
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', (e) => {
  if (mode !== 'dragging') return;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  idleThenResume();
});

// --- Simulation tick ---

const STEPS_PER_FRAME = 1;
const POLE_MARGIN = 0.01;    // clamp φ off ±π/2 to avoid the chart singularity
const POLE_CLAMP  = Math.PI / 2 - POLE_MARGIN;

app.addAnimateCallback(() => {
  if (mode !== 'simulating') return;

  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    // Reflect off the pole rather than diverge — keeps the demo coherent
    // even when a kick aims for the singular charts.
    if (phiState >  POLE_CLAMP) { phiState =  POLE_CLAMP; phiDot = -Math.abs(phiDot); }
    if (phiState < -POLE_CLAMP) { phiState = -POLE_CLAMP; phiDot =  Math.abs(phiDot); }

    const next = integrator.integrate({
      position: [phiState, tState],
      velocity: [phiDot, tDot],
    });
    phiState = next.position[0];
    tState   = next.position[1];
    phiDot   = next.velocity[0];
    tDot     = next.velocity[1];
  }

  trail.push(phiState, tState);
  update();
});

// --- UI: inline pill slider, lower-right ---

const style = document.createElement('style');
style.textContent = `
  .slider-wrapper {
    position: absolute;
    bottom: 16px;
    right: 16px;
    left: auto;
    max-width: 33%;
    min-width: 200px;
    padding: 8px 10px;
    background: transparent;
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
  .readout {
    position: absolute; bottom: 16px; left: 16px; z-index: 10;
    font: 12px/1.6 ui-monospace, monospace; color: #5A5148;
    font-variant-numeric: tabular-nums;
  }
`;
document.head.appendChild(style);

const sliderWrap = document.createElement('div');
sliderWrap.className = 'slider-wrapper';
sliderWrap.innerHTML = `
  <input id="psi4-L" type="range" class="thin-slider"
    min="2.05" max="3.95" step="0.01" value="${L}" />
`;
document.body.appendChild(sliderWrap);

// The slider is a bare pill with no label, so name what it controls. Matches
// the readout in the other three demos of this set.
const readout = document.createElement('div');
readout.className = 'readout';
document.body.appendChild(readout);

function updateReadout(): void {
  readout.innerHTML = [
    `L = ${L.toFixed(2)}`,
  ].join('<br>');
}

const lSlider = sliderWrap.querySelector<HTMLInputElement>('#psi4-L')!;
lSlider.addEventListener('input', () => {
  L = parseFloat(lSlider.value);
  updateReadout();
  patch = buildPatch(L);
  integrator = new GeodesicIntegrator(patch, { stepSize: 0.02 });
  trail.reset();
  // Reset to the auto-launch initial condition when L changes.
  launchAuto();
});

// --- Auto-launch a geodesic on load so the demo is alive when the reader arrives ---

/** Launch a geodesic from the current point, in the demo's default direction. */
function relaunchFromHere() {
  launchFrom(phiState, tState);
}

function launchAuto() {
  launchFrom(0, 0.3);
}

function launchFrom(phi0: number, t0: number) {
  phiState = phi0;
  tState   = t0;
  // Direction (slightly off-axis) — normalized to unit speed below.
  const phiDotRaw = 0.5;
  const tDotRaw   = 1.0;
  const g = patch.computeMetric([phiState, tState]).data;
  const E = g[0], F = g[1], G = g[3];
  const v2 = E * phiDotRaw * phiDotRaw + 2 * F * phiDotRaw * tDotRaw + G * tDotRaw * tDotRaw;
  const speed = Math.sqrt(Math.max(v2, 1e-8));
  phiDot = phiDotRaw / speed;
  tDot   = tDotRaw   / speed;
  trail.reset();
  trail.push(phiState, tState);
  update();
  mode = 'simulating';
}

launchAuto();
app.start();

updateReadout();
