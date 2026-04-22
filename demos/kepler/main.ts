/**
 * Kepler problem — 2D planet orbiting a fixed sun.
 *
 *   H(q, p) = ½ |p|² − 1/|q|          (unit masses, G = 1)
 *
 * Phase space is 4D: (qx, qy, px, py). The symplectic gradient of H is
 * Hamilton's equations, integrated via RK4 on the n-D ODE layer.
 *
 * Two pieces work together:
 *   - Static predicted orbit: on each drag-release, integrate many steps
 *     forward and render the full curve as a faint line. Shows the whole
 *     shape of the orbit immediately.
 *   - Animated planet: each frame, integrate state forward by δt via RK4;
 *     the planet dot follows along the curve at physical speed.
 *
 * Drag the planet to reposition; release with velocity to launch. Slow
 * flick → bound ellipse; fast flick → hyperbolic escape.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { cotangentBundle, SymplecticGradient } from '@/math';
import { Euclidean } from '@/math/manifolds';
import type { DifferentiableScalarField } from '@/math/functions/types';
import { integrate } from '@/math/ode';

// --- Hamiltonian ------------------------------------------------------------

const R2 = new Euclidean(2);
const phase = cotangentBundle(R2);

const H: DifferentiableScalarField = {
  dim: 4,
  getDomain: () => phase.getDomainBounds(),
  evaluate: (s) => {
    const [qx, qy, px, py] = s;
    const r = Math.sqrt(qx * qx + qy * qy);
    return 0.5 * (px * px + py * py) - 1 / r;
  },
  computePartials: (s) => {
    const [qx, qy, px, py] = s;
    const r2 = qx * qx + qy * qy;
    const r3 = r2 * Math.sqrt(r2);
    const o = new Float64Array(4);
    o[0] = qx / r3;   // ∂H/∂qx
    o[1] = qy / r3;   // ∂H/∂qy
    o[2] = px;        // ∂H/∂px
    o[3] = py;        // ∂H/∂py
    return o;
  },
};

const X_H = new SymplecticGradient(phase, H);

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: true });
app.camera.position.set(0, 0, 10);
app.controls.target.set(0, 0, 0);
app.controls.update();
// Fixed 2D view — no orbit cam. Keeps clicks from being swallowed by
// OrbitControls before they reach the planet-drag handler.
app.controls.controls.enabled = false;
app.backgrounds.setColor(0x0c0f14);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.4));

// --- Sun --------------------------------------------------------------------

const SUN_RADIUS = 0.18;
app.scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(SUN_RADIUS, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffcc55 }),
));
app.scene.add(new THREE.PointLight(0xffcc88, 2, 12, 2));

// --- Planet -----------------------------------------------------------------

const PLANET_RADIUS = 0.1;
const planet = new THREE.Mesh(
  new THREE.SphereGeometry(PLANET_RADIUS, 24, 24),
  new THREE.MeshPhysicalMaterial({
    color: 0x4488ff,
    roughness: 0.35,
    metalness: 0.1,
    emissive: 0x112244,
    emissiveIntensity: 0.4,
  }),
);
app.scene.add(planet);

// --- Predicted orbit line ---------------------------------------------------
//
// A dedicated THREE.Line that we rebuild every time the initial conditions
// change (drag-release). Its geometry is a sequence of (qx, qy) points from
// integrating the ODE far forward.

const ORBIT_STEPS = 40000;    // ~200 time units at ORBIT_DT = 0.005 — many orbital periods for bound cases
const ORBIT_DT = 0.005;
const ORBIT_MAX_R = 30;       // stop if we fly off screen
const ORBIT_MIN_R = 0.05;     // stop near the gravitational singularity

const orbitGeometry = new THREE.BufferGeometry();
// Allocate a positions buffer big enough for the worst case.
const orbitPositions = new Float32Array(ORBIT_STEPS * 3);
orbitGeometry.setAttribute(
  'position',
  new THREE.BufferAttribute(orbitPositions, 3).setUsage(THREE.DynamicDrawUsage),
);
const orbitLine = new THREE.Line(
  orbitGeometry,
  new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.55 }),
);
app.scene.add(orbitLine);

function rebuildOrbitCurve(initial: number[]) {
  // Clone so we don't mutate the live state array during integration.
  let cur = initial.slice();
  let count = 0;
  orbitPositions[count * 3 + 0] = cur[0];
  orbitPositions[count * 3 + 1] = cur[1];
  orbitPositions[count * 3 + 2] = 0;
  count++;

  for (let i = 1; i < ORBIT_STEPS; i++) {
    const traj = integrate({
      deriv: (s) => Array.from(X_H.evaluate(s)),
      initial: cur,
      dt: ORBIT_DT,
      steps: 1,
    });
    cur = traj.states[traj.states.length - 1];
    const r = Math.sqrt(cur[0] * cur[0] + cur[1] * cur[1]);
    if (!Number.isFinite(r) || r > ORBIT_MAX_R || r < ORBIT_MIN_R) break;

    orbitPositions[count * 3 + 0] = cur[0];
    orbitPositions[count * 3 + 1] = cur[1];
    orbitPositions[count * 3 + 2] = 0;
    count++;
  }

  orbitGeometry.setDrawRange(0, count);
  orbitGeometry.attributes.position.needsUpdate = true;
}

function hideOrbitCurve() {
  orbitGeometry.setDrawRange(0, 0);
}

// --- State ------------------------------------------------------------------

// Initial: r = 1, pₓ = 0, pᵧ = 0.9 → slightly elliptical bound orbit.
let state = [1, 0, 0, 0.9];
const INTEGRATION_DT = 0.005;

type Mode = 'dragging' | 'simulating';
let mode: Mode = 'simulating';

type DragSample = { time: number; qx: number; qy: number };
const dragSamples: DragSample[] = [];
const DRAG_KEEP = 5;

// Mouse-derived velocity is in world-units/sec; at screen resolution + camera
// z=10 this is 10–50 for typical flicks, well above escape velocity
// (v_esc = √(2/r) ≈ 1.4 at r=1). Two-stage damping:
//   1) Linear scale so gentle drags give bound orbits.
//   2) Magnitude cap at 95% of escape velocity so the hardest flicks are
//      just barely escape-bound rather than wildly hyperbolic.
const VELOCITY_SCALE = 0.04;
const MAX_V_FRACTION = 0.95;   // fraction of v_escape to cap at

function setPlanetFromState() {
  planet.position.set(state[0], state[1], 0);
}
setPlanetFromState();
rebuildOrbitCurve(state);

// --- Drag interaction -------------------------------------------------------

const renderer = app.renderManager.renderer;
const canvas = renderer.domElement;
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

canvas.addEventListener('pointerdown', (e) => {
  updateNdc(e);
  const hit = pickOnPlane();
  if (!hit) return;

  // Grab-anywhere: teleport the planet to the click, regardless of whether
  // the cursor is on the current planet mesh. That makes it trivial to pick
  // up and repose even when the planet is mid-flight.
  mode = 'dragging';
  canvas.setPointerCapture(e.pointerId);
  dragSamples.length = 0;

  state = [hit.x, hit.y, 0, 0];
  dragSamples.push({ time: e.timeStamp, qx: hit.x, qy: hit.y });
  setPlanetFromState();
  hideOrbitCurve();
});

canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'dragging') return;
  updateNdc(e);
  const hit = pickOnPlane();
  if (!hit) return;
  state = [hit.x, hit.y, 0, 0];
  dragSamples.push({ time: e.timeStamp, qx: hit.x, qy: hit.y });
  if (dragSamples.length > DRAG_KEEP) dragSamples.shift();
  setPlanetFromState();
});

canvas.addEventListener('pointerup', (e) => {
  if (mode !== 'dragging') return;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);

  // Release velocity from first/last drag sample.
  if (dragSamples.length >= 2) {
    const first = dragSamples[0];
    const last = dragSamples[dragSamples.length - 1];
    const dtSec = (last.time - first.time) / 1000;
    if (dtSec > 0) {
      let vx = (last.qx - first.qx) / dtSec * VELOCITY_SCALE;
      let vy = (last.qy - first.qy) / dtSec * VELOCITY_SCALE;

      // Cap magnitude at MAX_V_FRACTION · v_escape(r) at release radius.
      const r = Math.sqrt(last.qx * last.qx + last.qy * last.qy);
      const vEsc = Math.sqrt(2 / r);
      const vMax = MAX_V_FRACTION * vEsc;
      const vMag = Math.sqrt(vx * vx + vy * vy);
      if (vMag > vMax) {
        const k = vMax / vMag;
        vx *= k;
        vy *= k;
      }

      state = [last.qx, last.qy, vx, vy];
    }
  }

  rebuildOrbitCurve(state);
  mode = 'simulating';
});

canvas.addEventListener('pointercancel', () => {
  mode = 'simulating';
});

// --- Simulation tick --------------------------------------------------------

let simAccumulator = 0;

app.addAnimateCallback((_elapsed, delta) => {
  if (mode !== 'simulating') return;

  simAccumulator += Math.min(delta, 0.05);
  while (simAccumulator >= INTEGRATION_DT) {
    const traj = integrate({
      deriv: (s) => Array.from(X_H.evaluate(s)),
      initial: state,
      dt: INTEGRATION_DT,
      steps: 1,
    });
    state = traj.states[traj.states.length - 1];
    simAccumulator -= INTEGRATION_DT;
  }
  setPlanetFromState();
});

app.start();

(window as any).setState = (qx: number, qy: number, px: number, py: number) => {
  state = [qx, qy, px, py];
  rebuildOrbitCurve(state);
  mode = 'simulating';
};
