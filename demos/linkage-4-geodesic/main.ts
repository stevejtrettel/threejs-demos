/**
 * Planar Linkage — 4-rod pinned chain with geodesic motion on the
 * abstract configuration-space sphere.
 *
 * Center: the 4-rod chain, posed from psi4(phi, t, L).
 * Left: the abstract unit sphere S² used as a visualization shell for the
 * (phi, t) domain. The drawn geometry is an ordinary round sphere; the
 * metric we integrate against is the kinetic-energy pullback computed below.
 *
 * Interaction: drag the red ball on the sphere to set a point. On
 * release, the velocity of the drag (finite-difference of the last few
 * pointer samples) becomes the initial velocity, and we integrate the
 * geodesic of the configuration-space metric forward in time. The chain
 * animates along the trajectory and a blue trail tube grows behind the ball.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import {
  buildPlanarChain,
  setChainAngles,
  LinkageMesh,
  SurfaceMesh,
  MetricSurface,
  GeodesicIntegrator,
  StreamTube,
} from '@/math';
import type { Joint } from '@/math/linkages';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';
import { Matrix } from '@/math/linear-algebra';

// --- Configuration-space map ---

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

// --- Metric ---

/**
 * Pullback of the chain's kinetic-energy metric from T⁴ onto the (φ, t) chart
 * of the configuration-space sphere, via psi4.
 *
 * Returns the three components of the symmetric 2×2 metric:
 *   h_pp = g_{φφ}, h_pt = g_{φt}, h_tt = g_{tt}.
 *
 * This is singular at φ = ±π/2 (pole of the φ chart), at t = 0 and t = π
 * (sign flip of the sub-parameterization), and along the manifold's
 * coordinate branch — the sim clamps φ off the poles and users should
 * keep kicks away from t = 0, π for now.
 */
function chainKineticPullback(phi: number, t: number, L: number): { h_pp: number; h_pt: number; h_tt: number } {
  // Outer level
  const alpha4 = Math.acos((L * L - 8) / (2 * L));
  const A = alpha4 * Math.cos(phi);
  const theta1 = alpha4 * Math.sin(phi);
  const c1 = Math.cos(theta1), s1 = Math.sin(theta1);
  const d = Math.sqrt(L * L - 2 * L * c1 + 1);
  const d_prime = (L * s1) / d;
  const gamma4 = Math.atan2(-s1, L - c1);
  const gamma4_prime = (1 - L * c1) / (d * d);
  const delta = theta1 - gamma4;

  // Sub-parameterization psi³_d
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

  const h_tt = 2 * C1 * C1 + 2 * C1 * C2 * cPhi1mPhi2 + C2 * C2;

  const h_pt =
    A *
    (C1 * (2 * cDmPhi1 + 2 * B1 + B2 * cPhi1mPhi2) +
      C2 * (cDmPhi2 + B1 * cPhi1mPhi2 + B2));

  const h_pp =
    A * A *
    (3 +
      4 * B1 * cDmPhi1 +
      2 * B2 * cDmPhi2 +
      2 * B1 * B1 +
      2 * B1 * B2 * cPhi1mPhi2 +
      B2 * B2);

  return { h_pp, h_pt, h_tt };
}

const CONFIG_DOMAIN: SurfaceDomain = {
  uMin: -Math.PI / 2,
  uMax: Math.PI / 2,
  vMin: 0,
  vMax: 2 * Math.PI,
};

// Visualization shell — a round sphere in R³, unrelated to the kinetic-energy
// metric we actually integrate against. Purely decorative: a canvas on which to
// draw (φ, t) trajectories.
const SPHERE_R = Math.PI;

const abstractShell: Surface = {
  evaluate(phi: number, t: number): THREE.Vector3 {
    return new THREE.Vector3(
      SPHERE_R * Math.cos(phi) * Math.cos(t),
      SPHERE_R * Math.cos(phi) * Math.sin(t),
      SPHERE_R * Math.sin(phi),
    );
  },
  getDomain: () => CONFIG_DOMAIN,
};

/**
 * Build the configuration-space MetricPatch for a given rod length L.
 *
 * The metric is the kinetic-energy pullback from T⁴ (not a JᵀJ in R³), so we
 * compute it by hand and pass it directly. The `display` shell is the round
 * unit sphere — unrelated to the metric, just a canvas to draw (φ, t)
 * trajectories on.
 */
function buildConfigSpace(Lval: number): MetricSurface {
  return new MetricSurface({
    domain: CONFIG_DOMAIN,
    metric: (phi: number, t: number): Matrix => {
      const { h_pp, h_pt, h_tt } = chainKineticPullback(phi, t, Lval);
      const m = new Matrix(2, 2);
      m.data[0] = h_pp; m.data[1] = h_pt;
      m.data[2] = h_pt; m.data[3] = h_tt;
      return m;
    },
    display: abstractShell,
  });
}

// --- State ---

const ROD_LENGTHS = [1, 1, 1, 1];
let L = 3.0;
let patch = buildConfigSpace(L);
let integrator = new GeodesicIntegrator(patch, { stepSize: 0.02 });

// Geodesic state: [phi, t, phiDot, tDot].
const geoState: number[] = [0, 0, 0, 0];

type Mode = 'idle' | 'dragging' | 'simulating';
let mode: Mode = 'idle';

const chain = buildPlanarChain({
  lengths: ROD_LENGTHS,
  pinA: [-L / 2, 0],
  pinB: [L / 2, 0],
});

function setL(newL: number) {
  L = newL;
  patch = buildConfigSpace(L);
  integrator = new GeodesicIntegrator(patch, { stepSize: 0.02 });
  const newJoints: Joint[] = chain.joints.map((j) => {
    if (j.id === 0) return { id: 0, pinned: [-L / 2, 0] };
    if (j.id === chain.joints.length - 1) return { id: j.id, pinned: [L / 2, 0] };
    return { id: j.id };
  });
  chain.params.set('joints', newJoints);
  applyConfig();
}

function applyConfig() {
  const phi = geoState[0];
  const t = geoState[1];
  const angles = psi4(phi, t, L);
  setChainAngles(chain, angles);
  abstractBall.position.set(
    SPHERE_R * Math.cos(phi) * Math.cos(t),
    SPHERE_R * Math.cos(phi) * Math.sin(t),
    SPHERE_R * Math.sin(phi),
  );
}

// --- Scene ---

const app = new App({ antialias: true, debug: true });
app.camera.position.set(0, 0, 9);
app.controls.target.set(0, 0, 0);
app.backgrounds.setColor(0xf4f4f4);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(2, 3, 5);
app.scene.add(key);

// --- Chain ---

const chainMesh = new LinkageMesh(chain, {
  rodRadius: 0.045,
  jointRadius: 0.085,
  rodColor: 0x222222,
  freeJointColor: 0x3388ff,
  pinnedJointColor: 0xff5522,
});
chainMesh.position.set(2.5, 0, 0);
chainMesh.scale.setScalar(1.5);
app.scene.add(chainMesh);

// --- Abstract sphere ---

const SCALE = 0.35;
const BALL_LOCAL_R = 0.35;

const abstractGroup = new THREE.Group();
abstractGroup.position.set(-3, 0, 0);
abstractGroup.scale.setScalar(SCALE);
app.scene.add(abstractGroup);

const abstractMesh = new SurfaceMesh(abstractShell, {
  uSegments: 32,
  vSegments: 64,
  color: 0x3388ff,
  roughness: 0.35,
});
abstractGroup.add(abstractMesh);

const abstractBall = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_LOCAL_R, 20, 20),
  new THREE.MeshPhysicalMaterial({ color: 0xff5522, roughness: 0.3, metalness: 0.1 }),
);
abstractGroup.add(abstractBall);

// --- Trail ---

const trail = new StreamTube(abstractShell, {
  maxPoints: 5000,
  radius: 0.12,
  radialSegments: 6,
  color: 0xff5522,
  roughness: 0.35,
});
abstractGroup.add(trail);

const pushTrail = (phi: number, t: number) => trail.push(phi, t);
const clearTrail = () => trail.reset();

// --- UI: L slider ---

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:16px;left:16px;color:#333;font:14px/1.4 monospace;' +
  'background:rgba(255,255,255,0.9);padding:10px 14px;border-radius:6px;' +
  'display:flex;flex-direction:column;gap:6px;min-width:220px;z-index:10;';
panel.innerHTML = `
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>L</span>
    <span id="lgeo-L-value">${L.toFixed(2)}</span>
  </label>
  <input id="lgeo-L" type="range" min="2" max="4" step="0.01" value="${L}" />
`;
document.body.appendChild(panel);

const slider = panel.querySelector<HTMLInputElement>('#lgeo-L')!;
const readout = panel.querySelector<HTMLSpanElement>('#lgeo-L-value')!;
slider.addEventListener('input', () => {
  const v = parseFloat(slider.value);
  readout.textContent = v.toFixed(2);
  setL(v);
});

// --- Drag interaction ---

const renderer = app.renderManager.renderer;
const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

// Drag samples (time in ms, position in phi/t) — used to compute release velocity.
type DragSample = { time: number; phi: number; t: number };
const dragSamples: DragSample[] = [];
const DRAG_SAMPLE_KEEP = 5;

function updateNdc(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickAbstractHit(hit: THREE.Vector3, now: number) {
  const local = abstractGroup.worldToLocal(hit.clone());
  local.normalize();
  const phi = Math.asin(THREE.MathUtils.clamp(local.z, -1, 1));
  const t = Math.atan2(local.y, local.x);
  geoState[0] = phi;
  geoState[1] = t;
  geoState[2] = 0;
  geoState[3] = 0;
  dragSamples.push({ time: now, phi, t });
  if (dragSamples.length > DRAG_SAMPLE_KEEP) dragSamples.shift();
  applyConfig();
}

function raycastSphere(): THREE.Vector3 | null {
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(abstractMesh, false);
  if (hits.length > 0) return hits[0].point;
  // Closest point on sphere to the ray, projected back to its surface.
  const ray = raycaster.ray;
  const center = new THREE.Vector3();
  abstractGroup.getWorldPosition(center);
  const radius = SPHERE_R * SCALE;
  const oc = new THREE.Vector3().subVectors(center, ray.origin);
  const along = oc.dot(ray.direction);
  const closestOnRay = ray.origin.clone().addScaledVector(ray.direction, along);
  const offset = new THREE.Vector3().subVectors(closestOnRay, center);
  if (offset.lengthSq() < 1e-12) return null;
  offset.normalize();
  return center.clone().addScaledVector(offset, radius);
}

function startDrag(e: PointerEvent) {
  mode = 'dragging';
  app.controls.controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  dragSamples.length = 0;
  clearTrail();
  const hit = raycastSphere();
  if (hit) pickAbstractHit(hit, e.timeStamp);
}

function continueDrag(e: PointerEvent) {
  const hit = raycastSphere();
  if (hit) pickAbstractHit(hit, e.timeStamp);
}

function releaseDrag(e: PointerEvent) {
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  // Compute release velocity from the earliest and latest kept samples.
  if (dragSamples.length < 2) {
    mode = 'idle';
    return;
  }
  const last = dragSamples[dragSamples.length - 1];
  const first = dragSamples[0];
  const dtWall = (last.time - first.time) / 1000; // seconds
  if (dtWall <= 0) {
    mode = 'idle';
    return;
  }
  // atan2 gives t in (-π, π]; wrap the delta to the shorter arc so a drag
  // across the ±π seam doesn't register as a huge velocity the wrong way.
  let dPhi = last.phi - first.phi;
  let dT = last.t - first.t;
  if (dT > Math.PI) dT -= 2 * Math.PI;
  if (dT < -Math.PI) dT += 2 * Math.PI;
  const phiDot = dPhi / dtWall;
  const tDot = dT / dtWall;

  // Normalize to unit speed in the metric: geodesic traces at speed 1
  // regardless of drag magnitude, so only direction matters.
  const g = patch.computeMetric([geoState[0], geoState[1]]).data;
  const E = g[0], F = g[1], G = g[3];
  const v2 =
    E * phiDot * phiDot +
    2 * F * phiDot * tDot +
    G * tDot * tDot;
  const EPS = 1e-8;
  if (v2 < EPS) {
    mode = 'idle';
    return;
  }
  const speed = Math.sqrt(v2);
  geoState[2] = phiDot / speed;
  geoState[3] = tDot / speed;
  pushTrail(geoState[0], geoState[1]);
  mode = 'simulating';
}

canvas.addEventListener('pointerdown', (e) => {
  updateNdc(e);
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(abstractMesh, false);
  if (hits.length === 0) return; // let OrbitControls handle it
  startDrag(e);
});

canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'dragging') return;
  updateNdc(e);
  continueDrag(e);
});

canvas.addEventListener('pointerup', (e) => {
  if (mode !== 'dragging') return;
  releaseDrag(e);
});

canvas.addEventListener('pointercancel', (e) => {
  if (mode !== 'dragging') return;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  mode = 'idle';
});

// --- Simulation tick ---

const STEPS_PER_FRAME = 1;

app.addAnimateCallback(() => {
  if (mode !== 'simulating') return;

  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    // Stay off the poles to avoid tan(phi) blowing up.
    const POLE_MARGIN = 0.01;
    const clamp = Math.PI / 2 - POLE_MARGIN;
    if (geoState[0] > clamp) { geoState[0] = clamp; geoState[2] = -Math.abs(geoState[2]); }
    if (geoState[0] < -clamp) { geoState[0] = -clamp; geoState[2] = Math.abs(geoState[2]); }

    const next = integrator.integrate({
      position: [geoState[0], geoState[1]],
      velocity: [geoState[2], geoState[3]],
    });
    geoState[0] = next.position[0];
    geoState[1] = next.position[1];
    geoState[2] = next.velocity[0];
    geoState[3] = next.velocity[1];
  }

  pushTrail(geoState[0], geoState[1]);
  applyConfig();
});

applyConfig();
app.start();

(window as any).chain = chain;
(window as any).geoState = geoState;
(window as any).mode = () => mode;
