/**
 * Pendulum — phase portrait of the simple pendulum + draggable physical
 * mechanism.
 *
 *   H(q, p) = ½ p² − cos q
 *
 * Phase portrait: a quad in the (q, p) plane, shaded by H. A fragment
 * shader evaluates H directly (one line of GLSL), colors the background
 * by energy sign vs the separatrix at E = 1, and darkens pixels sitting
 * on level sets via a `fract(H / Δ)` band trick. Level sets of H are the
 * phase-space trajectories of Hamilton's flow — so this picture shows
 * every orbit at once, at pixel precision.
 *
 * Physical pendulum hangs next to the phase portrait. Drag the bob to
 * set the angle; the velocity of the drag is converted into angular
 * momentum on release, and the system integrates forward via the
 * `SymplecticGradient` of H.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { cotangentBundle, SymplecticGradient } from '@/math';
import { Euclidean } from '@/math/manifolds';
import type { DifferentiableScalarField } from '@/math/functions/types';
import { integrate } from '@/math/ode';

// --- Hamiltonian: H(q, p) = ½ p² − cos q ------------------------------------

const configLine = new Euclidean(1);
const phase = cotangentBundle(configLine);

const H: DifferentiableScalarField = {
  dim: 2,
  getDomain: () => phase.getDomainBounds(),
  evaluate: (s) => 0.5 * s[1] * s[1] - Math.cos(s[0]),
  computePartials: (s) => {
    const o = new Float64Array(2);
    o[0] = Math.sin(s[0]);  // ∂H/∂q
    o[1] = s[1];            // ∂H/∂p
    return o;
  },
};

const X_H = new SymplecticGradient(phase, H);

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: true });
app.camera.position.set(0, 0, 9);
app.controls.target.set(0, 0, 0);
app.controls.update();
app.backgrounds.setColor(0xf6f7fa);
app.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
const light = new THREE.DirectionalLight(0xffffff, 1.0);
light.position.set(3, 5, 4);
app.scene.add(light);

// --- Phase portrait ---------------------------------------------------------

const Q_MIN = -Math.PI, Q_MAX = Math.PI;
const P_MIN = -3,       P_MAX =  3;

// Size the phase portrait plane.
const PORTRAIT_W = 4.5;
const PORTRAIT_H = 4.5 * (P_MAX - P_MIN) / (Q_MAX - Q_MIN);
const PORTRAIT_X = -2.8;
const PORTRAIT_Y = 0;

const phaseGroup = new THREE.Group();
phaseGroup.position.set(PORTRAIT_X, PORTRAIT_Y, 0);
app.scene.add(phaseGroup);

const phaseShader = new THREE.ShaderMaterial({
  uniforms: {
    uQmin: { value: Q_MIN }, uQmax: { value: Q_MAX },
    uPmin: { value: P_MIN }, uPmax: { value: P_MAX },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float uQmin; uniform float uQmax;
    uniform float uPmin; uniform float uPmax;

    void main() {
      float q = mix(uQmin, uQmax, vUv.x);
      float p = mix(uPmin, uPmax, vUv.y);
      float H = 0.5 * p * p - cos(q);

      // Separatrix at H = 1. Normalize: t = -1 deep librating, 0 at separatrix, +1 deep rotating.
      float t = clamp((H - 1.0) * 0.5, -1.0, 1.0);
      vec3 blue  = vec3(0.28, 0.45, 0.85);
      vec3 white = vec3(0.96, 0.96, 0.97);
      vec3 red   = vec3(0.87, 0.32, 0.28);
      vec3 color = t < 0.0 ? mix(white, blue, -t) : mix(white, red, t);

      // Level-set bands: darken pixels where H is close to an integer multiple
      // of levelSpacing. Anti-aliased by fwidth() so bands are ~1 pixel thick.
      float levelSpacing = 0.25;
      float d = H / levelSpacing;
      float dist = min(fract(d), 1.0 - fract(d));
      float bandWidth = fwidth(d) * 0.5;
      float bandMask = 1.0 - smoothstep(0.0, bandWidth, dist);
      color = mix(color, vec3(0.08, 0.08, 0.1), bandMask * 0.75);

      gl_FragColor = vec4(color, 1.0);
    }
  `,
});

const phaseMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(PORTRAIT_W, PORTRAIT_H),
  phaseShader,
);
phaseGroup.add(phaseMesh);

// Axes (q = 0 and p = 0) + frame.
const axesMat = new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.55 });
const frameMat = new THREE.LineBasicMaterial({ color: 0x333333 });

// q axis (p = 0 → y = 0 in plane coords, but we need plane-local coords).
// In local coords, the plane goes x ∈ [-W/2, W/2], y ∈ [-H/2, H/2].
phaseGroup.add(new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-PORTRAIT_W / 2, 0, 0.001),
    new THREE.Vector3( PORTRAIT_W / 2, 0, 0.001),
  ]),
  axesMat,
));
// p axis (q = 0).
phaseGroup.add(new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -PORTRAIT_H / 2, 0.001),
    new THREE.Vector3(0,  PORTRAIT_H / 2, 0.001),
  ]),
  axesMat,
));
// Frame.
phaseGroup.add(new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-PORTRAIT_W / 2, -PORTRAIT_H / 2, 0.002),
    new THREE.Vector3( PORTRAIT_W / 2, -PORTRAIT_H / 2, 0.002),
    new THREE.Vector3( PORTRAIT_W / 2,  PORTRAIT_H / 2, 0.002),
    new THREE.Vector3(-PORTRAIT_W / 2,  PORTRAIT_H / 2, 0.002),
  ]),
  frameMat,
));

// Marker — a dot on the portrait showing the current (q, p) state.
const marker = new THREE.Mesh(
  new THREE.SphereGeometry(0.065, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x111111 }),
);
phaseGroup.add(marker);

function setMarkerPosition(q: number, p: number) {
  // Wrap q into [-π, π] for display so rotating orbits put the marker back
  // inside the portrait on each lap.
  let qw = q;
  while (qw >  Math.PI) qw -= 2 * Math.PI;
  while (qw < -Math.PI) qw += 2 * Math.PI;
  const x = (qw - Q_MIN) / (Q_MAX - Q_MIN) * PORTRAIT_W - PORTRAIT_W / 2;
  const y = (p  - P_MIN) / (P_MAX - P_MIN) * PORTRAIT_H - PORTRAIT_H / 2;
  marker.position.set(x, y, 0.01);
}

// --- Physical pendulum ------------------------------------------------------

const PENDULUM_X = 2.8;
const PENDULUM_Y = 1.2;
const L = 2.0;                // rod length
const BOB_RADIUS = 0.22;
const ROD_RADIUS = 0.04;
const PIVOT_RADIUS = 0.1;

const pendulumGroup = new THREE.Group();
pendulumGroup.position.set(PENDULUM_X, PENDULUM_Y, 0);
app.scene.add(pendulumGroup);

pendulumGroup.add(new THREE.Mesh(
  new THREE.SphereGeometry(PIVOT_RADIUS, 16, 16),
  new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.35 }),
));

const rod = new THREE.Mesh(
  new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, L, 12),
  new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.45 }),
);
pendulumGroup.add(rod);

const bob = new THREE.Mesh(
  new THREE.SphereGeometry(BOB_RADIUS, 24, 24),
  new THREE.MeshPhysicalMaterial({ color: 0xcc3322, roughness: 0.3, metalness: 0.15 }),
);
pendulumGroup.add(bob);

function setPendulumPose(q: number) {
  // Bob position, with q = 0 hanging straight down.
  const bx = L * Math.sin(q);
  const by = -L * Math.cos(q);
  bob.position.set(bx, by, 0);
  // Rod: midpoint between pivot (origin) and bob.
  rod.position.set(bx / 2, by / 2, 0);
  // Cylinder's axis is +y; rotate so it points from pivot toward bob.
  rod.rotation.z = q;
}

// --- State ------------------------------------------------------------------

let state = [0.3, 0];  // (q, p) — small angle, at rest
const INTEGRATION_DT = 0.01;

type Mode = 'idle' | 'dragging' | 'simulating';
let mode: Mode = 'simulating';

// Draw samples (wall time + angle) during drag so we can estimate release ω.
type DragSample = { time: number; q: number };
const dragSamples: DragSample[] = [];
const DRAG_KEEP = 5;

function applyPose() {
  setPendulumPose(state[0]);
  setMarkerPosition(state[0], state[1]);
}
applyPose();

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

/** Cast a ray from the camera and intersect it with the z = pendulumGroup.z plane. */
function pickWorldOnPlane(): THREE.Vector3 | null {
  raycaster.setFromCamera(ndc, app.camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -pendulumGroup.position.z);
  const hit = new THREE.Vector3();
  return raycaster.ray.intersectPlane(plane, hit);
}

/** Convert a world-space point near the pendulum into an angle q (from vertical-down). */
function worldToAngle(worldPoint: THREE.Vector3): number {
  const local = pendulumGroup.worldToLocal(worldPoint.clone());
  // q = 0 when the bob is straight down: (0, -L, 0). q increases counterclockwise.
  // angle from -y axis: atan2(x, -y).
  return Math.atan2(local.x, -local.y);
}

canvas.addEventListener('pointerdown', (e) => {
  updateNdc(e);
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(bob, false);
  if (hits.length === 0) return;

  mode = 'dragging';
  app.controls.controls.enabled = false;
  canvas.setPointerCapture(e.pointerId);
  dragSamples.length = 0;

  const wp = pickWorldOnPlane();
  if (wp) {
    const q = worldToAngle(wp);
    state = [q, 0];
    dragSamples.push({ time: e.timeStamp, q });
    applyPose();
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (mode !== 'dragging') return;
  updateNdc(e);
  const wp = pickWorldOnPlane();
  if (!wp) return;
  const q = worldToAngle(wp);
  state = [q, 0];
  dragSamples.push({ time: e.timeStamp, q });
  if (dragSamples.length > DRAG_KEEP) dragSamples.shift();
  applyPose();
});

canvas.addEventListener('pointerup', (e) => {
  if (mode !== 'dragging') return;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);

  if (dragSamples.length < 2) { mode = 'idle'; return; }

  // Release angular velocity from the earliest and latest kept samples.
  const first = dragSamples[0];
  const last = dragSamples[dragSamples.length - 1];
  const dtSec = (last.time - first.time) / 1000;
  if (dtSec <= 0) { mode = 'idle'; return; }

  // Handle the ±π wraparound so a drag across the bottom doesn't register
  // as near-infinite velocity.
  let dq = last.q - first.q;
  if (dq >  Math.PI) dq -= 2 * Math.PI;
  if (dq < -Math.PI) dq += 2 * Math.PI;
  const qDot = dq / dtSec;
  // For this Hamiltonian (unit mass, unit length, unit gravity), p = q̇.
  state = [last.q, qDot];
  mode = 'simulating';
});

canvas.addEventListener('pointercancel', () => {
  app.controls.controls.enabled = true;
  mode = 'idle';
});

// --- Simulation tick --------------------------------------------------------

let simTimeAccumulator = 0;

app.addAnimateCallback((_elapsed, delta) => {
  if (mode !== 'simulating') return;

  simTimeAccumulator += Math.min(delta, 0.05);
  while (simTimeAccumulator >= INTEGRATION_DT) {
    const traj = integrate({
      deriv: (s) => Array.from(X_H.evaluate(s)),
      initial: state,
      dt: INTEGRATION_DT,
      steps: 1,
    });
    state = traj.states[traj.states.length - 1];
    simTimeAccumulator -= INTEGRATION_DT;
  }
  applyPose();
});

app.start();

(window as any).setState = (q: number, p: number) => {
  state = [q, p];
  mode = 'simulating';
  applyPose();
};
