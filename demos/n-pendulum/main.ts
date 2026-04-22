/**
 * n-pendulum — chain of n rigidly-linked pendulums hanging from a fixed
 * pivot, each free to swing. Configuration is n angles (q₁, …, qₙ)
 * measured from vertical-down; phase space is 2n-dim.
 *
 * Hamiltonian (unit masses, unit rod lengths, unit g):
 *
 *   H(q, p) = ½ p^T M(q)⁻¹ p + V(q)
 *
 *   M(q)_ij = min(i, j) · cos(qᵢ − qⱼ)    (with diagonal `n − i + 1` effectively,
 *                                         see derivation: for unit masses/lengths
 *                                         M_ii = n − i + 1, M_ij = (n − max(i, j) + 1)
 *                                         cos(qᵢ − qⱼ) for i ≠ j)
 *   V(q) = −Σᵢ (n − i + 1) cos(qᵢ)
 *
 * Partials:
 *   ∂H/∂pᵢ = (M⁻¹ p)ᵢ                     (generalized velocity q̇ᵢ)
 *   ∂H/∂qᵢ = ½ q̇ᵀ (∂M/∂qᵢ) q̇ + ∂V/∂qᵢ
 *
 * The whole thing is handed to `SymplecticGradient` on `T*(ℝⁿ)` just like
 * pendulum and Kepler.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { FlatPatch, StreamLine, cotangentBundle, SymplecticGradient } from '@/math';
import { Euclidean } from '@/math/manifolds';
import { Matrix } from '@/math/linear-algebra';
import type { DifferentiableScalarField } from '@/math/functions/types';
import { integrate, gaussLegendre4 } from '@/math/ode';

// --- n-Pendulum Hamiltonian -------------------------------------------------
//
// Deriving M: each bob i has mass m_i and its position is
//   x_i = Σ_{j≤i} L_j sin(q_j),   y_i = −Σ_{j≤i} L_j cos(q_j)
//   ẋ_i = Σ_{j≤i} L_j q̇_j cos(q_j),  ẏ_i = Σ_{j≤i} L_j q̇_j sin(q_j)
//
// Kinetic energy T = ½ Σ_i m_i (ẋ_i² + ẏ_i²) expands out to
//   T = ½ Σ_j Σ_k M_jk q̇_j q̇_k,  with
//   M_jk = (Σ_{i ≥ max(j, k)} m_i) · L_j L_k cos(q_j − q_k)
//
// For unit masses and lengths (m_i = L_i = 1) this simplifies to
//   M_jk = (n − max(j, k) + 1) · cos(q_j − q_k)
// with M_jj = n − j + 1.
//
// Potential V = Σ_i m_i g y_i = −g Σ_i m_i Σ_{j≤i} L_j cos(q_j)
//             = −g Σ_j (Σ_{i≥j} m_i) L_j cos(q_j)
// For unit masses/lengths/g:
//   V = −Σ_j (n − j + 1) cos(q_j)

function massMatrix(n: number, q: number[]): Matrix {
  const M = new Matrix(n, n);
  for (let j = 0; j < n; j++) {
    for (let k = 0; k < n; k++) {
      const coeff = n - Math.max(j, k);                // = (n − max(j, k) + 1) using 1-indexed; here 0-indexed
      M.data[j * n + k] = coeff * Math.cos(q[j] - q[k]);
    }
  }
  return M;
}

/** ∂M/∂q_i as a fresh Matrix. Only entries in row i or column i depend on q_i. */
function massMatrixPartial(n: number, q: number[], i: number): Matrix {
  const dM = new Matrix(n, n);
  for (let k = 0; k < n; k++) {
    if (k === i) continue;
    const coeff = n - Math.max(i, k);
    const d = -coeff * Math.sin(q[i] - q[k]);          // d/dq_i of cos(q_i − q_k)
    dM.data[i * n + k] = d;                             // row i
    dM.data[k * n + i] = d;                             // col i (symmetric)
  }
  return dM;
}

// Gravity. With unit rod length, the small-amplitude period of a single
// pendulum is T = 2π/√g. g = 1 is a glacial ~6.3 s per swing; g = 9.8 gives
// the real-Earth rate of ≈ 2 s per swing. Bump further for a snappier demo.
const G = 9.8;

function potential(n: number, q: number[]): number {
  let V = 0;
  for (let j = 0; j < n; j++) V -= G * (n - j) * Math.cos(q[j]);
  return V;
}

function potentialPartial(n: number, q: number[], i: number): number {
  return G * (n - i) * Math.sin(q[i]);
}

function hamiltonianFor(n: number): DifferentiableScalarField {
  const phase = cotangentBundle(new Euclidean(n));
  return {
    dim: 2 * n,
    getDomain: () => phase.getDomainBounds(),
    evaluate: (s) => {
      const q = s.slice(0, n);
      const p = s.slice(n);
      const Minv = massMatrix(n, q).invert();
      // T = ½ pᵀ M⁻¹ p
      let T = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          T += 0.5 * p[i] * Minv.data[i * n + j] * p[j];
        }
      }
      return T + potential(n, q);
    },
    computePartials: (s) => {
      const q = s.slice(0, n);
      const p = s.slice(n);
      const M = massMatrix(n, q);
      const Minv = M.invert();
      const Minvd = Minv.data;

      // q̇ = M⁻¹ p.
      const qDot = new Float64Array(n);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < n; j++) s += Minvd[i * n + j] * p[j];
        qDot[i] = s;
      }

      const out = new Float64Array(2 * n);
      // ∂H/∂q_i = −½ q̇ᵀ (∂M/∂q_i) q̇ + ∂V/∂q_i
      // The negative sign comes from ∂M⁻¹/∂q = −M⁻¹ (∂M/∂q) M⁻¹.
      for (let i = 0; i < n; i++) {
        const dM = massMatrixPartial(n, q, i).data;
        let kin = 0;
        for (let j = 0; j < n; j++) {
          for (let k = 0; k < n; k++) {
            kin += qDot[j] * dM[j * n + k] * qDot[k];
          }
        }
        out[i] = -0.5 * kin + potentialPartial(n, q, i);
      }
      // ∂H/∂p_i = q̇_i
      for (let i = 0; i < n; i++) out[n + i] = qDot[i];
      return out;
    },
  };
}

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: true });
app.camera.position.set(0, 0, 9);
app.controls.target.set(0, 0, 0);
app.controls.update();
app.controls.controls.enabled = false;     // fixed 2D view — no orbit cam
app.backgrounds.setColor(0x101218);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.7));
const light = new THREE.DirectionalLight(0xffffff, 1.0);
light.position.set(3, 5, 4);
app.scene.add(light);

const PIVOT = new THREE.Vector3(0, 2.5, 0);
const ROD_LENGTH = 1.0;
const BOB_RADIUS = 0.14;
const ROD_RADIUS = 0.035;

const pivotMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.1, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.35 }),
);
pivotMesh.position.copy(PIVOT);
app.scene.add(pivotMesh);

// --- Pendulum chain meshes --------------------------------------------------
//
// We rebuild meshes when n changes. `rods[i]` / `bobs[i]` hold the i-th
// link, positioned each frame from the current q vector.

let rods: THREE.Mesh[] = [];
let bobs: THREE.Mesh[] = [];

const rodMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, roughness: 0.45 });
const bobColors = [0xff5522, 0xffcc44, 0x55cc88, 0x4488ff, 0xcc55cc];

function clearChain() {
  for (const m of rods) { app.scene.remove(m); m.geometry.dispose(); }
  for (const m of bobs) { app.scene.remove(m); m.geometry.dispose(); }
  rods = [];
  bobs = [];
}

function buildChain(n: number) {
  clearChain();
  for (let i = 0; i < n; i++) {
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, ROD_LENGTH, 10),
      rodMat,
    );
    rods.push(rod);
    app.scene.add(rod);

    const bob = new THREE.Mesh(
      new THREE.SphereGeometry(BOB_RADIUS, 20, 20),
      new THREE.MeshPhysicalMaterial({
        color: bobColors[i % bobColors.length],
        roughness: 0.3, metalness: 0.15,
      }),
    );
    bobs.push(bob);
    app.scene.add(bob);
  }
}

function jointPosition(i: number, q: number[]): THREE.Vector3 {
  // joint 0 = pivot, joint i = pivot + Σ_{j<i} L (sin q_j, −cos q_j, 0)
  let x = 0, y = 0;
  for (let j = 0; j < i; j++) {
    x += ROD_LENGTH * Math.sin(q[j]);
    y -= ROD_LENGTH * Math.cos(q[j]);
  }
  return new THREE.Vector3(PIVOT.x + x, PIVOT.y + y, 0);
}

function updateChain(q: number[]) {
  const n = q.length;
  for (let i = 0; i < n; i++) {
    const start = jointPosition(i, q);
    const end = jointPosition(i + 1, q);
    // Rod midpoint + rotation.
    rods[i].position.set((start.x + end.x) / 2, (start.y + end.y) / 2, 0);
    rods[i].rotation.z = q[i];
    // Bob at end.
    bobs[i].position.copy(end);
  }
}

// --- End-bob trail ----------------------------------------------------------
//
// StreamLine over a flat patch covering the plane — same pattern as Kepler.

const TRAIL_EXTENT = 8;
const trailPatch = new FlatPatch({
  domain: {
    uMin: -TRAIL_EXTENT, uMax: TRAIL_EXTENT,
    vMin: -TRAIL_EXTENT, vMax: TRAIL_EXTENT,
  },
});
const trail = new StreamLine(trailPatch, {
  maxPoints: 4000,
  color: 0xff5522,
  lineWidth: 2,
});
app.scene.add(trail);

function pushTrail(q: number[]) {
  const end = jointPosition(q.length, q);
  trail.push(end.x, end.y);
}

// --- State ------------------------------------------------------------------

let n = 3;
let H_field = hamiltonianFor(n);
let X_H = new SymplecticGradient(cotangentBundle(new Euclidean(n)), H_field);
let state: number[] = new Array(2 * n).fill(0);

type Mode = 'dragging' | 'simulating';
let mode: Mode = 'simulating';

type DragSample = { time: number; angle: number };
const dragSamples: DragSample[] = [];
const DRAG_KEEP = 5;

const INTEGRATION_DT = 0.005;

function reset(newN: number) {
  n = newN;
  H_field = hamiltonianFor(n);
  X_H = new SymplecticGradient(cotangentBundle(new Euclidean(n)), H_field);
  state = new Array(2 * n).fill(0);
  // Start with a gentle "slightly-off-vertical" perturbation so it begins to
  // move on its own if released without drag.
  for (let i = 0; i < n; i++) state[i] = 0.1 * (i + 1);
  buildChain(n);
  trail.reset();
  updateChain(state.slice(0, n));
  pushTrail(state.slice(0, n));
}

reset(n);

// --- UI ---------------------------------------------------------------------

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:16px;left:16px;color:#eee;font:14px/1.4 monospace;' +
  'background:rgba(15,15,22,0.85);padding:10px 14px;border-radius:6px;' +
  'display:flex;flex-direction:column;gap:6px;min-width:200px;z-index:10;';
panel.innerHTML = `
  <label style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#aaa;">
    <span>links</span>
    <span id="np-n-value">3</span>
  </label>
  <input id="np-n-slider" type="range" min="2" max="10" step="1" value="3" />
  <div style="font-size:11px;color:#888;margin-top:4px;">
    drag to pose, release to fall
  </div>
`;
document.body.appendChild(panel);

const nSlider = panel.querySelector<HTMLInputElement>('#np-n-slider')!;
const nReadout = panel.querySelector<HTMLSpanElement>('#np-n-value')!;
nSlider.addEventListener('input', () => {
  const v = parseInt(nSlider.value, 10);
  nReadout.textContent = String(v);
  reset(v);
});

// --- Drag interaction -------------------------------------------------------
//
// While dragging, all rod angles are set equal so the chain points directly
// at the cursor. On release, the drag velocity becomes the uniform initial
// angular velocity across all links — then chaos emerges as links diverge.

const canvas = app.renderManager.renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function updateNdc(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickOnPlane(): THREE.Vector3 | null {
  raycaster.setFromCamera(ndc, app.camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, hit);
}

function angleFromPivot(world: THREE.Vector3): number {
  // angle from vertical-down (+y convention): q = atan2(dx, pivot.y − y)
  return Math.atan2(world.x - PIVOT.x, PIVOT.y - world.y);
}

canvas.addEventListener('pointerdown', (e) => {
  updateNdc(e);
  const hit = pickOnPlane();
  if (!hit) return;

  mode = 'dragging';
  canvas.setPointerCapture(e.pointerId);
  dragSamples.length = 0;

  const q = angleFromPivot(hit);
  for (let i = 0; i < n; i++) state[i] = q;
  for (let i = 0; i < n; i++) state[n + i] = 0;

  dragSamples.push({ time: e.timeStamp, angle: q });
  trail.reset();
  updateChain(state.slice(0, n));
  pushTrail(state.slice(0, n));
});

canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'dragging') return;
  updateNdc(e);
  const hit = pickOnPlane();
  if (!hit) return;

  const q = angleFromPivot(hit);
  for (let i = 0; i < n; i++) state[i] = q;

  dragSamples.push({ time: e.timeStamp, angle: q });
  if (dragSamples.length > DRAG_KEEP) dragSamples.shift();
  updateChain(state.slice(0, n));
});

canvas.addEventListener('pointerup', (e) => {
  if (mode !== 'dragging') return;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);

  if (dragSamples.length >= 2) {
    const first = dragSamples[0];
    const last = dragSamples[dragSamples.length - 1];
    const dtSec = (last.time - first.time) / 1000;
    if (dtSec > 0) {
      // Wrap the angle delta to avoid the ±π seam giving a spurious large vel.
      let dq = last.angle - first.angle;
      if (dq >  Math.PI) dq -= 2 * Math.PI;
      if (dq < -Math.PI) dq += 2 * Math.PI;
      const qDot = dq / dtSec;
      // Set initial q̇ uniform across all links; compute corresponding p via p = M q̇.
      const qVec = new Array(n).fill(last.angle);
      const qDotVec = new Array(n).fill(qDot);
      const M = massMatrix(n, qVec).data;
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let j = 0; j < n; j++) s += M[i * n + j] * qDotVec[j];
        state[n + i] = s;
      }
      for (let i = 0; i < n; i++) state[i] = last.angle;
    }
  }

  // Start the trail from the release position, not from wherever it was
  // pointing at pointerdown — otherwise the trail spans the drag range.
  trail.reset();
  pushTrail(state.slice(0, n));

  mode = 'simulating';
});

canvas.addEventListener('pointercancel', () => {
  mode = 'simulating';
});

// --- Simulation tick --------------------------------------------------------

let simAcc = 0;

app.addAnimateCallback((_elapsed, delta) => {
  if (mode !== 'simulating') return;

  simAcc += Math.min(delta, 0.05);
  while (simAcc >= INTEGRATION_DT) {
    const traj = integrate({
      deriv: (s) => Array.from(X_H.evaluate(s)),
      initial: state,
      dt: INTEGRATION_DT,
      steps: 1,
      stepper: gaussLegendre4,  // symplectic, 4th order — bounded energy error
    });
    state = traj.states[traj.states.length - 1];
    simAcc -= INTEGRATION_DT;
  }
  const q = state.slice(0, n);
  updateChain(q);
  pushTrail(q);
});

app.start();

(window as any).setN = (m: number) => reset(m);
