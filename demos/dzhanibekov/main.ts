/**
 * Dzhanibekov / tumbling T-handle.
 *
 * Torque-free rigid-body dynamics on `SO(3) × ℝ³`. State is `(R, L)`:
 * `R` the body-to-world rotation, `L` the body-frame angular momentum.
 * The Hamiltonian `H(L) = ½ Σ L_i² / I_i` depends only on `L`; `L`
 * evolves via Euler's equation `dL/dt = L × I⁻¹L` on the coadjoint sphere
 * `|L| = const`, and `R` is driven by `dR/dt = R · hat(I⁻¹ L)`.
 *
 * For `I₁ < I₂ < I₃`, rotation about the extremal axes `e₁` and `e₃` is
 * stable; about the intermediate axis `e₂` it is unstable. A small
 * perturbation grows — `L` doesn't just wobble, it loops all the way
 * around to `−e₂`, crosses the unstable saddle, and comes back (the
 * "tennis racket theorem" or Dzhanibekov effect).
 *
 * Layout:
 *   - Left: the box with principal semi-axes (2, 1, 0.5), rotated by `R`.
 *   - Right: a translucent unit sphere (the coadjoint orbit `|L| = 1`)
 *     with a bright dot at `L/|L|` and a StreamTube trail behind it.
 *
 * Drag the `tilt` slider up from zero to perturb `L₀` away from the
 * intermediate axis — around `tilt = 0.02 rad` the classic flip emerges.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import {
  SO3,
  rigidBodyStep,
  so3ToMatrix4,
  StreamTube,
  type RigidBodyState,
} from '@/math';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

// ── Parameters (mutable via UI) ─────────────────────────────────────

// Defaults stay just off the I₁+I₂ = I₃ edge (which would give a flat plate).
let inertia: [number, number, number] = [1, 2, 2.5];
let tilt = 0.02;       // radians off the intermediate axis e₂
let running = true;

const STEPS_PER_FRAME = 4;
const DT = 0.005;

/**
 * Half-extents of a uniform-density rectangular box from principal moments.
 *
 *   I₁ = (m/3)(b² + c²), I₂ = (m/3)(a² + c²), I₃ = (m/3)(a² + b²)
 * ⇒  a² = 3(I₂ + I₃ − I₁)/(2m), etc.
 *
 * The physical triangle inequalities `I_i + I_j ≥ I_k` can fail under
 * arbitrary slider combinations; clamp the squared extent to a small
 * floor so the rendered box never collapses to a line. Mass is unit.
 */
const SHAPE_SCALE = 0.4;
const MIN_HALF_EXTENT_SQ = 0.005;

function boxHalfExtents(I: [number, number, number]): [number, number, number] {
  const [I1, I2, I3] = I;
  const aSq = Math.max(MIN_HALF_EXTENT_SQ, 1.5 * (I2 + I3 - I1));
  const bSq = Math.max(MIN_HALF_EXTENT_SQ, 1.5 * (I1 + I3 - I2));
  const cSq = Math.max(MIN_HALF_EXTENT_SQ, 1.5 * (I1 + I2 - I3));
  return [
    SHAPE_SCALE * Math.sqrt(aSq),
    SHAPE_SCALE * Math.sqrt(bSq),
    SHAPE_SCALE * Math.sqrt(cSq),
  ];
}

// Initial angular momentum lives on the unit coadjoint sphere |L| = 1.
function initialL(t: number): number[] {
  return [Math.sin(t), Math.cos(t), 0];
}

// ── Scene ────────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 7);
app.controls.target.set(0, 0, 0);
app.backgrounds.setColor(0xf4f4f6);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(3, 4, 5);
app.scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.4);
fill.position.set(-2, -1, 3);
app.scene.add(fill);

// ── Left side: the tumbling box ─────────────────────────────────────

const BOX_CENTER = new THREE.Vector3(-2.2, 0, 0);

// Unit cube geometry — resized via `box.scale` when I changes, rotated via
// `box.matrix` each frame. Keeping shape as a per-node scale (rather than
// rebuilding BoxGeometry) costs nothing at slider-drag speed.
const box = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),   // half-extents of 1 each, so `box.scale` = (a, b, c)
  new THREE.MeshStandardMaterial({ color: 0x4488ff, roughness: 0.45, metalness: 0.05 }),
);
box.matrixAutoUpdate = false;
app.scene.add(box);

const boxScale = new THREE.Vector3(...boxHalfExtents(inertia));

function updateBoxShape() {
  boxScale.set(...boxHalfExtents(inertia));
}

// ── Right side: the coadjoint orbit sphere ──────────────────────────

const SPHERE_R = 1.0;
const SPHERE_CENTER = new THREE.Vector3(2.2, 0, 0);

// Parametric sphere — u = latitude ∈ [-π/2, π/2], v = longitude.
// StreamTube uses `evaluate(u, v)` to lift each trail point to 3D.
const sphereSurface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    return new THREE.Vector3(
      SPHERE_R * Math.cos(u) * Math.cos(v),
      SPHERE_R * Math.cos(u) * Math.sin(v),
      SPHERE_R * Math.sin(u),
    );
  },
  getDomain: (): SurfaceDomain => ({
    uMin: -Math.PI / 2,
    uMax:  Math.PI / 2,
    vMin: -Math.PI,
    vMax:  Math.PI,
  }),
};

const sphereGroup = new THREE.Group();
sphereGroup.position.copy(SPHERE_CENTER);
app.scene.add(sphereGroup);

const sphereMesh = new THREE.Mesh(
  new THREE.SphereGeometry(SPHERE_R, 48, 32),
  new THREE.MeshStandardMaterial({
    color: 0xbbcccc,
    roughness: 0.5,
    metalness: 0.0,
    transparent: true,
    opacity: 0.35,
  }),
);
sphereGroup.add(sphereMesh);

// Trail tube on the sphere.
const trail = new StreamTube(sphereSurface, {
  maxPoints: 4000,
  radius: 0.015,
  radialSegments: 6,
  color: 0xff5522,
  roughness: 0.4,
});
sphereGroup.add(trail);

// Current-L marker.
const dot = new THREE.Mesh(
  new THREE.SphereGeometry(0.045, 20, 20),
  new THREE.MeshStandardMaterial({ color: 0xff5522, roughness: 0.3, metalness: 0.1 }),
);
sphereGroup.add(dot);

// ── Simulation state ────────────────────────────────────────────────

let state: RigidBodyState = {
  R: SO3.identity(),
  L: initialL(tilt),
};

// Continuous longitude on the sphere — prevents the StreamTube from jumping
// across the v = ±π branch when L rolls around the sphere.
let longitudeExtended = Math.atan2(state.L[1], state.L[0]);
let longitudeLast = longitudeExtended;

function resetTrajectory() {
  state = { R: SO3.identity(), L: initialL(tilt) };
  trail.reset();
  longitudeExtended = Math.atan2(state.L[1], state.L[0]);
  longitudeLast = longitudeExtended;
  syncVisuals();
}

function syncVisuals() {
  // Box: scale · rotate, then set center. `so3ToMatrix4` writes R into the
  // upper-left 3×3; `scale` right-multiplies by diag(a, b, c), giving the
  // composed matrix `R·S` acting on the unit cube.
  so3ToMatrix4(state.R, box.matrix);
  box.matrix.scale(boxScale);
  box.matrix.setPosition(BOX_CENTER);

  // Unit-length L direction on the sphere.
  const Lmag = Math.hypot(state.L[0], state.L[1], state.L[2]);
  const x = state.L[0] / Lmag;
  const y = state.L[1] / Lmag;
  const z = state.L[2] / Lmag;
  dot.position.set(SPHERE_R * x, SPHERE_R * y, SPHERE_R * z);

  // Extend the longitude so the trail stays continuous across v = ±π.
  const rawV = Math.atan2(y, x);
  let dv = rawV - longitudeLast;
  if (dv >  Math.PI) dv -= 2 * Math.PI;
  if (dv < -Math.PI) dv += 2 * Math.PI;
  longitudeExtended += dv;
  longitudeLast = rawV;

  const latitude = Math.asin(Math.max(-1, Math.min(1, z)));
  trail.push(latitude, longitudeExtended);
}

// ── Simulation tick ─────────────────────────────────────────────────

app.addAnimateCallback(() => {
  if (!running) return;
  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    state = rigidBodyStep(state, DT, { inertia });
  }
  syncVisuals();
});

// ── UI ──────────────────────────────────────────────────────────────

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:16px;left:16px;color:#222;font:13px/1.35 monospace;' +
  'background:rgba(255,255,255,0.92);padding:12px 14px;border-radius:6px;' +
  'display:flex;flex-direction:column;gap:8px;min-width:240px;z-index:10;' +
  'box-shadow:0 1px 3px rgba(0,0,0,0.12);';
panel.innerHTML = `
  <div style="font-weight:bold;">Dzhanibekov</div>
  <label style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
    <span>I₁</span><span id="dzh-I1-val">${inertia[0].toFixed(2)}</span>
  </label>
  <input id="dzh-I1" type="range" min="0.5" max="5" step="0.01" value="${inertia[0]}" />
  <label style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
    <span>I₂ (intermediate)</span><span id="dzh-I2-val">${inertia[1].toFixed(2)}</span>
  </label>
  <input id="dzh-I2" type="range" min="0.5" max="5" step="0.01" value="${inertia[1]}" />
  <label style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
    <span>I₃</span><span id="dzh-I3-val">${inertia[2].toFixed(2)}</span>
  </label>
  <input id="dzh-I3" type="range" min="0.5" max="5" step="0.01" value="${inertia[2]}" />
  <label style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
    <span>tilt off e₂ (rad)</span><span id="dzh-tilt-val">${tilt.toFixed(3)}</span>
  </label>
  <input id="dzh-tilt" type="range" min="0" max="0.6" step="0.001" value="${tilt}" />
  <div style="display:flex;gap:6px;">
    <button id="dzh-play" style="flex:1;padding:4px 8px;">${running ? 'Pause' : 'Play'}</button>
    <button id="dzh-reset" style="flex:1;padding:4px 8px;">Reset</button>
  </div>
`;
document.body.appendChild(panel);

function bindSlider(id: string, valId: string, onChange: (v: number) => void, fmt: (v: number) => string) {
  const s = panel.querySelector<HTMLInputElement>(`#${id}`)!;
  const r = panel.querySelector<HTMLSpanElement>(`#${valId}`)!;
  s.addEventListener('input', () => {
    const v = parseFloat(s.value);
    r.textContent = fmt(v);
    onChange(v);
  });
}

bindSlider('dzh-I1', 'dzh-I1-val', (v) => { inertia = [v, inertia[1], inertia[2]]; updateBoxShape(); }, (v) => v.toFixed(2));
bindSlider('dzh-I2', 'dzh-I2-val', (v) => { inertia = [inertia[0], v, inertia[2]]; updateBoxShape(); }, (v) => v.toFixed(2));
bindSlider('dzh-I3', 'dzh-I3-val', (v) => { inertia = [inertia[0], inertia[1], v]; updateBoxShape(); }, (v) => v.toFixed(2));
bindSlider('dzh-tilt', 'dzh-tilt-val', (v) => { tilt = v; resetTrajectory(); }, (v) => v.toFixed(3));

const playBtn = panel.querySelector<HTMLButtonElement>('#dzh-play')!;
playBtn.addEventListener('click', () => {
  running = !running;
  playBtn.textContent = running ? 'Pause' : 'Play';
});
panel.querySelector<HTMLButtonElement>('#dzh-reset')!.addEventListener('click', resetTrajectory);

// ── Boot ────────────────────────────────────────────────────────────

syncVisuals();
app.start();
