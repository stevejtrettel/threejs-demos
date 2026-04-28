/**
 * Side-by-side geodesic comparison.
 *
 *   Left sphere:  analytic metric4 → Christoffel → RK4 (via GeodesicIntegrator)
 *   Right sphere: embedded RHS — second-partials of psi4Position projected
 *                 onto the tangent plane, integrated with custom RK4.
 *
 * Click-drag on either sphere to set the launch state — both spheres receive
 * the same initial (φ, t, φ̇, ṫ) and integrate independently. A live readout
 * between the spheres shows ||q_A(s) − q_C(s)|| on the unit visualization
 * sphere; staying small confirms both methods agree on the geodesic.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SurfaceMesh, MetricSurface, GeodesicIntegrator, StreamTube } from '@/math';
import { Matrix } from '@/math/linear-algebra';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

// --- ψ4 position-coordinate form (post 2 §5) -------------------------------

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

// --- embedded geodesic RHS via tangent-projected acceleration --------------

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

// --- visualization sphere --------------------------------------------------

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

// --- state -----------------------------------------------------------------

let L = 3.0;
const STEP = 0.02;

let phiA = 0, tA = 0.3, phiDotA = 0, tDotA = 0;
let stateC: [number, number, number, number] = [0, 0.3, 0, 0];

type Mode = 'idle' | 'dragging' | 'simulating';
let mode: Mode = 'idle';

function buildPatchA(Lval: number): MetricSurface {
  return new MetricSurface({
    domain: CONFIG_DOMAIN,
    metric: (phi: number, t: number): Matrix => {
      const { h_pp, h_pt, h_tt } = metric4(phi, t, Lval);
      const m = new Matrix(2, 2);
      m.data[0] = h_pp; m.data[1] = h_pt; m.data[2] = h_pt; m.data[3] = h_tt;
      return m;
    },
    display: abstractSurface,
  });
}

let patchA = buildPatchA(L);
let integratorA = new GeodesicIntegrator(patchA, { stepSize: STEP });

// --- scene -----------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 14);
(app.camera as THREE.PerspectiveCamera).fov = 25;
(app.camera as THREE.PerspectiveCamera).updateProjectionMatrix();
app.controls.target.set(0, 0, 0);
app.backgrounds.setColor(0xf0ede8);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(2, 3, 5);
app.scene.add(key);

const SCALE = 0.65;
const X_OFFSET = 2.6;

function makeSphereGroup(xOffset: number, ballColor: number, trailColor: number) {
  const group = new THREE.Group();
  group.position.set(xOffset, 0, 0);
  group.scale.setScalar(SCALE);
  app.scene.add(group);

  const mesh = new SurfaceMesh(abstractSurface, {
    uSegments: 48,
    vSegments: 96,
    color: 0xe2d8c0,
    roughness: 0.32,
    metalness: 0.0,
  });
  group.add(mesh);

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 24, 24),
    new THREE.MeshPhysicalMaterial({ color: ballColor, roughness: 0.3 }),
  );
  group.add(ball);

  const trail = new StreamTube(abstractSurface, {
    maxPoints: 6000, radius: 0.05, radialSegments: 8,
    color: trailColor, roughness: 0.3,
  });
  group.add(trail);

  return { group, mesh, ball, trail };
}

const sideA = makeSphereGroup(-X_OFFSET, 0x222222, 0x222222);
const sideC = makeSphereGroup(+X_OFFSET, 0x4a7d3a, 0x4a7d3a);

function setBallTo(ball: THREE.Mesh, phi: number, t: number) {
  ball.position.set(
    SPHERE_R * Math.cos(phi) * Math.cos(t),
    SPHERE_R * Math.cos(phi) * Math.sin(t),
    SPHERE_R * Math.sin(phi),
  );
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

function setLaunchPoint(phi: number, t: number) {
  phiA = phi; tA = t; phiDotA = 0; tDotA = 0;
  stateC = [phi, t, 0, 0];
  setBallTo(sideA.ball, phi, t);
  setBallTo(sideC.ball, phi, t);
}

function pickHit(group: THREE.Group, hit: THREE.Vector3, now: number) {
  const local = group.worldToLocal(hit.clone());
  local.normalize();
  const phi = Math.asin(THREE.MathUtils.clamp(local.z, -1, 1));
  const t = Math.atan2(local.y, local.x);
  setLaunchPoint(phi, t);
  dragSamples.push({ time: now, phi, t });
  if (dragSamples.length > DRAG_SAMPLE_KEEP) dragSamples.shift();
}

// Track which sphere the drag started on so pointermove keeps using it.
let activeGroup: THREE.Group | null = null;
let activeMesh: THREE.Mesh | null = null;

function raycastActive(): THREE.Vector3 | null {
  if (!activeMesh || !activeGroup) return null;
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(activeMesh, false);
  if (hits.length > 0) return hits[0].point;
  // Fallback: closest point on the active sphere.
  const ray = raycaster.ray;
  const center = new THREE.Vector3();
  activeGroup.getWorldPosition(center);
  const radius = SPHERE_R * SCALE;
  const oc = new THREE.Vector3().subVectors(center, ray.origin);
  const along = oc.dot(ray.direction);
  const closestOnRay = ray.origin.clone().addScaledVector(ray.direction, along);
  const offset = new THREE.Vector3().subVectors(closestOnRay, center);
  if (offset.lengthSq() < 1e-12) return null;
  offset.normalize();
  return center.clone().addScaledVector(offset, radius);
}

canvas.addEventListener('pointerdown', (e) => {
  updateNdc(e);
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObjects([sideA.mesh, sideC.mesh, sideA.ball, sideC.ball], false);
  if (hits.length === 0) return;
  // Whichever sphere the click landed on becomes the active drag surface.
  const hitObj = hits[0].object;
  if (hitObj === sideA.mesh || hitObj === sideA.ball) {
    activeGroup = sideA.group; activeMesh = sideA.mesh;
  } else {
    activeGroup = sideC.group; activeMesh = sideC.mesh;
  }
  mode = 'dragging';
  app.controls.controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  dragSamples.length = 0;
  sideA.trail.reset();
  sideC.trail.reset();
  pickHit(activeGroup, hits[0].point, e.timeStamp);
});

canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'dragging' || !activeGroup) return;
  updateNdc(e);
  const hit = raycastActive();
  if (hit) pickHit(activeGroup, hit, e.timeStamp);
});

function endDrag(e: PointerEvent) {
  if (mode !== 'dragging') return;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  activeGroup = null; activeMesh = null;

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

  const { h_pp, h_pt, h_tt } = metric4(phiA, tA, L);
  const v2 = h_pp * phiDotRaw * phiDotRaw + 2 * h_pt * phiDotRaw * tDotRaw + h_tt * tDotRaw * tDotRaw;
  if (v2 < 1e-8) { mode = 'idle'; return; }
  const speed = Math.sqrt(v2);
  phiDotA = phiDotRaw / speed; tDotA = tDotRaw / speed;
  stateC = [phiA, tA, phiDotA, tDotA];

  sideA.trail.push(phiA, tA);
  sideC.trail.push(stateC[0], stateC[1]);
  mode = 'simulating';
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', (e) => {
  if (mode !== 'dragging') return;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  activeGroup = null; activeMesh = null;
  mode = 'idle';
});

// --- HUD: labels above each sphere + delta + L slider ----------------------

const labelStyle =
  'position:fixed;top:18px;color:#333;font:14px/1.2 monospace;' +
  'background:rgba(255,255,255,0.85);padding:6px 12px;border-radius:4px;' +
  'transform:translateX(-50%);pointer-events:none;z-index:10;';

const labelA = document.createElement('div');
labelA.style.cssText = labelStyle + 'left:25%;';
labelA.textContent = 'intrinsic';
document.body.appendChild(labelA);

const labelC = document.createElement('div');
labelC.style.cssText = labelStyle + 'left:75%;';
labelC.textContent = 'extrinsic';
document.body.appendChild(labelC);

const deltaReadout = document.createElement('div');
deltaReadout.style.cssText =
  'position:fixed;bottom:62px;left:50%;transform:translateX(-50%);' +
  'color:#333;font:14px/1 monospace;pointer-events:none;z-index:10;';
deltaReadout.textContent = 'Δ = 0.00000';
document.body.appendChild(deltaReadout);

const sliderStyle = document.createElement('style');
sliderStyle.textContent = `
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
`;
document.head.appendChild(sliderStyle);

const sliderWrap = document.createElement('div');
sliderWrap.style.cssText =
  'position:fixed;bottom:18px;left:50%;transform:translateX(-50%);' +
  'color:#333;font:13px/1.3 monospace;background:rgba(255,255,255,0.9);' +
  'padding:8px 14px;border-radius:6px;display:flex;gap:10px;align-items:center;' +
  'pointer-events:auto;z-index:10;';
sliderWrap.innerHTML = `
  <span>L</span>
  <input id="cmp-L" type="range" class="thin-slider"
    min="2.05" max="3.95" step="0.01" value="${L}" style="width:240px;" />
  <span id="cmp-L-val">${L.toFixed(2)}</span>
`;
document.body.appendChild(sliderWrap);

const slider = sliderWrap.querySelector<HTMLInputElement>('#cmp-L')!;
const lReadout = sliderWrap.querySelector<HTMLSpanElement>('#cmp-L-val')!;
slider.addEventListener('input', () => {
  L = parseFloat(slider.value);
  lReadout.textContent = L.toFixed(2);
  patchA = buildPatchA(L);
  integratorA = new GeodesicIntegrator(patchA, { stepSize: STEP });
  sideA.trail.reset();
  sideC.trail.reset();
  mode = 'idle';
});

// --- tick ------------------------------------------------------------------

const POLE_MARGIN = 0.01;
const POLE_CLAMP = Math.PI / 2 - POLE_MARGIN;

function stepA() {
  if (phiA > POLE_CLAMP) { phiA = POLE_CLAMP; phiDotA = -Math.abs(phiDotA); }
  if (phiA < -POLE_CLAMP) { phiA = -POLE_CLAMP; phiDotA = Math.abs(phiDotA); }
  const next = integratorA.integrate({ position: [phiA, tA], velocity: [phiDotA, tDotA] });
  phiA = next.position[0]; tA = next.position[1];
  phiDotA = next.velocity[0]; tDotA = next.velocity[1];
}

function stepC() {
  if (stateC[0] > POLE_CLAMP) { stateC[0] = POLE_CLAMP; stateC[2] = -Math.abs(stateC[2]); }
  if (stateC[0] < -POLE_CLAMP) { stateC[0] = -POLE_CLAMP; stateC[2] = Math.abs(stateC[2]); }
  stateC = rk4StepEmbedded(stateC, STEP, L);
}

function unitSpherePos(phi: number, t: number): [number, number, number] {
  return [Math.cos(phi) * Math.cos(t), Math.cos(phi) * Math.sin(t), Math.sin(phi)];
}

app.addAnimateCallback(() => {
  if (mode === 'simulating') {
    stepA();
    stepC();
    sideA.trail.push(phiA, tA);
    sideC.trail.push(stateC[0], stateC[1]);
    setBallTo(sideA.ball, phiA, tA);
    setBallTo(sideC.ball, stateC[0], stateC[1]);
  }
  // Chord distance on the unit visualization sphere.
  const a = unitSpherePos(phiA, tA);
  const c = unitSpherePos(stateC[0], stateC[1]);
  const dx = a[0] - c[0], dy = a[1] - c[1], dz = a[2] - c[2];
  const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);
  deltaReadout.textContent = `Δ = ${delta.toFixed(5)}`;
});

setLaunchPoint(0, 0.3);
app.start();
