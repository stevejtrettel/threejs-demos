/**
 * Heavy symmetric top — precession and nutation under gravity.
 *
 * A rigid body pivoted at the origin, with principal moments
 * `I = diag(I₁, I₁, I₃)` (symmetric), center of mass at distance `l`
 * along the body symmetry axis `ê_3`. Gravity supplies a body-frame
 * torque that depends on the current orientation:
 *
 *   τ_body = −mgl · (ê_3 × Rᵀ·ê_z_world)
 *          = (mgl · z_body[1], −mgl · z_body[0], 0)
 *
 * where `z_body = Rᵀ · ê_z_world` is world-vertical as seen in the body
 * frame. Plugged into the rigid-body splitting integrator (Euler's
 * equation with torque + Lie-group exp step on R) the classical
 * gyroscopic motions emerge:
 *
 *   - **Spin** about the symmetry axis `ê_3` at rate ψ̇.
 *   - **Precession**: the axis `ê_3_world` slowly sweeps out a cone
 *     around the vertical at rate Ω ≈ mgl / (I₃ · ψ̇) in the fast-spin
 *     limit.
 *   - **Nutation**: the tilt angle oscillates slightly as the top
 *     exchanges kinetic and potential energy.
 *
 * Interactions:
 *   - `I₁` (transverse moment), `I₃` (axial moment). Thin tall top → I₃ < I₁.
 *   - `mgl` — gravity × COM offset. Zero gives torque-free dynamics.
 *   - `ψ̇` — initial spin rate. Large ψ̇ → slow precession.
 *   - `θ₀` — initial tilt from vertical.
 *   - play/pause/reset.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import {
  SO3,
  rigidBodyStep,
  so3ToMatrix4,
  type RigidBodyState,
} from '@/math';
import { Matrix } from '@/math/linear-algebra';
import { StreamTube } from '@/math';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

// ── Parameters ──────────────────────────────────────────────────────

let I1 = 1.0;
let I3 = 0.3;
let mgl = 1.0;
let spinRate = 10.0;     // ψ̇ — initial angular velocity about ê_3
let tilt0   = Math.PI / 6;
let running = true;

const ROD_LEN = 1.5;     // visual length of the top
const DT = 0.005;
const STEPS_PER_FRAME = 6;

// ── Scene ───────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: false });
app.camera.position.set(3, 2.2, 3);
app.controls.target.set(0, 0, 0.6);
app.controls.update();
app.backgrounds.setColor(0xf2f3f6);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(4, 6, 3);
app.scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.35);
fill.position.set(-2, 2, -3);
app.scene.add(fill);

// Faint ground grid at z = 0 for a sense of "down".
const grid = new THREE.GridHelper(4, 8, 0xaaaaaa, 0xdddddd);
grid.rotation.x = Math.PI / 2;   // XY plane
app.scene.add(grid);

// Pivot — small dark marker at the origin.
const pivot = new THREE.Mesh(
  new THREE.SphereGeometry(0.04, 16, 12),
  new THREE.MeshStandardMaterial({ color: 0x222222 }),
);
app.scene.add(pivot);

// Gravity indicator — white arrow pointing world −z, placed to the side.
const gravityArrow = new THREE.ArrowHelper(
  new THREE.Vector3(0, 0, -1), new THREE.Vector3(1.8, 0, 1.8),
  0.5, 0x666666, 0.12, 0.07,
);
app.scene.add(gravityArrow);

// Top body — a group with stem + tip + body-frame arrows, rotated by R each frame.
// Body +z is the symmetry axis; pivot at body origin; stem extends to (0, 0, ROD_LEN).
const topGroup = new THREE.Group();
topGroup.matrixAutoUpdate = false;
app.scene.add(topGroup);

// Stem — a thin cylinder along body +z.
const stemGeom = new THREE.CylinderGeometry(0.035, 0.035, ROD_LEN, 20);
stemGeom.rotateX(-Math.PI / 2);             // axis +y → +z
stemGeom.translate(0, 0, ROD_LEN / 2);      // bottom at origin
const stem = new THREE.Mesh(
  stemGeom,
  new THREE.MeshStandardMaterial({ color: 0xaa6633, roughness: 0.45 }),
);
topGroup.add(stem);

// Tip ball at the top, at (0, 0, ROD_LEN) in body frame.
const tipMesh = new THREE.Mesh(
  new THREE.SphereGeometry(0.14, 24, 18),
  new THREE.MeshStandardMaterial({ color: 0xcc6633, roughness: 0.4, metalness: 0.1 }),
);
tipMesh.position.set(0, 0, ROD_LEN);
topGroup.add(tipMesh);

// Body-frame arrows — put the base of the arrow at a fraction up the stem so they
// don't overlap the tip too much. Slight opacity on the symmetry arrow (ê_3) since
// the stem already conveys that axis.
const ARROW_LEN = 0.45;
const ARROW_HEAD = 0.1;
const bodyArrowBase = new THREE.Vector3(0, 0, 0.55);   // offset along stem
topGroup.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), bodyArrowBase, ARROW_LEN, 0xdd3344, ARROW_HEAD, ARROW_HEAD * 0.6));
topGroup.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), bodyArrowBase, ARROW_LEN, 0x33aa44, ARROW_HEAD, ARROW_HEAD * 0.6));

// Tip-path trail on a hemisphere of radius ROD_LEN around the pivot.
// Parametrize (u, v) = (polar angle from +z, azimuth).
const tipSphereSurface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    return new THREE.Vector3(
      ROD_LEN * Math.sin(u) * Math.cos(v),
      ROD_LEN * Math.sin(u) * Math.sin(v),
      ROD_LEN * Math.cos(u),
    );
  },
  getDomain: (): SurfaceDomain => ({
    uMin: 0, uMax: Math.PI,
    vMin: -Infinity, vMax: Infinity,
  }),
};
const trail = new StreamTube(tipSphereSurface, {
  maxPoints: 6000,
  radius: 0.012,
  radialSegments: 6,
  color: 0x3377cc,
  roughness: 0.4,
});
app.scene.add(trail);

// ── State ───────────────────────────────────────────────────────────

let state: RigidBodyState = initialState();

// Continuous azimuth for the trail (prevent StreamTube jumps at ±π).
let azExtended = 0;
let azLast = 0;

function initialState(): RigidBodyState {
  // Initial orientation: tilt by θ₀ about world +y (so body ê_3 leans toward +x).
  const R0 = SO3.exp([0, tilt0, 0]);
  // Initial L_body: pure spin about ê_3 at rate ψ̇.
  const L0 = [0, 0, I3 * spinRate];
  return { R: R0, L: L0 };
}

function torque(R: Matrix, _L: number[]): number[] {
  // z_body = Rᵀ · ê_z_world = third row of R.
  const zb0 = R.data[6], zb1 = R.data[7];
  // τ_body = −mgl · (ê_3 × z_body) = (mgl · z_body[1], −mgl · z_body[0], 0).
  return [mgl * zb1, -mgl * zb0, 0];
}

function resetTrajectory() {
  state = initialState();
  trail.reset();
  // Initial tip azimuth — tip is at R · (0,0,ROD_LEN), i.e. third column of R · ROD_LEN.
  const tipX = state.R.data[2];
  const tipY = state.R.data[5];
  azExtended = Math.atan2(tipY, tipX);
  azLast = azExtended;
  syncVisuals();
}

function syncVisuals() {
  so3ToMatrix4(state.R, topGroup.matrix);

  // Tip position in world frame = R · (0, 0, ROD_LEN).
  // Third column of R scaled by ROD_LEN.
  const tipWorld = new THREE.Vector3(
    state.R.data[2] * ROD_LEN,
    state.R.data[5] * ROD_LEN,
    state.R.data[8] * ROD_LEN,
  );

  // Push tip to trail — convert Cartesian → (colatitude, azimuth).
  const u = Math.acos(Math.max(-1, Math.min(1, tipWorld.z / ROD_LEN)));
  const rawV = Math.atan2(tipWorld.y, tipWorld.x);
  let dv = rawV - azLast;
  if (dv >  Math.PI) dv -= 2 * Math.PI;
  if (dv < -Math.PI) dv += 2 * Math.PI;
  azExtended += dv;
  azLast = rawV;
  trail.push(u, azExtended);

  // Readouts.
  const tiltNow = Math.acos(Math.max(-1, Math.min(1, state.R.data[8])));
  readoutTilt.textContent = `${tiltNow.toFixed(3)} rad  (${(tiltNow * 180 / Math.PI).toFixed(1)}°)`;
}

// ── Simulation tick ────────────────────────────────────────────────

app.addAnimateCallback(() => {
  if (!running) return;
  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    state = rigidBodyStep(state, DT, { inertia: [I1, I1, I3], torque });
  }
  syncVisuals();
});

// ── UI ──────────────────────────────────────────────────────────────

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:10px;left:10px;color:#222;font:11px/1.3 monospace;' +
  'background:rgba(255,255,255,0.92);padding:8px 10px;border-radius:5px;' +
  'display:flex;flex-direction:column;gap:3px;min-width:220px;z-index:10;' +
  'box-shadow:0 1px 3px rgba(0,0,0,0.12);';
panel.innerHTML = `
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>I₁ (transverse)</span><span id="t-I1-val">${I1.toFixed(2)}</span>
  </label>
  <input id="t-I1" type="range" min="0.3" max="3" step="0.01" value="${I1}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>I₃ (axial)</span><span id="t-I3-val">${I3.toFixed(2)}</span>
  </label>
  <input id="t-I3" type="range" min="0.05" max="2" step="0.01" value="${I3}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>m·g·l</span><span id="t-mgl-val">${mgl.toFixed(2)}</span>
  </label>
  <input id="t-mgl" type="range" min="0" max="3" step="0.01" value="${mgl}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>ψ̇ (spin)</span><span id="t-spin-val">${spinRate.toFixed(1)}</span>
  </label>
  <input id="t-spin" type="range" min="0" max="25" step="0.1" value="${spinRate}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>tilt θ₀</span><span id="t-tilt-val">${tilt0.toFixed(2)}</span>
  </label>
  <input id="t-tilt" type="range" min="0" max="1.4" step="0.01" value="${tilt0}" style="height:14px;" />
  <div style="display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:1px;font-size:10px;color:#555;margin-top:4px;">
    <span>current tilt</span><span id="t-tilt-now">—</span>
  </div>
  <div style="display:flex;gap:4px;margin-top:4px;">
    <button id="t-play" style="flex:1;padding:3px 6px;font-size:11px;">${running ? 'Pause' : 'Play'}</button>
    <button id="t-reset" style="flex:1;padding:3px 6px;font-size:11px;">Reset</button>
  </div>
`;
document.body.appendChild(panel);

const readoutTilt = panel.querySelector<HTMLSpanElement>('#t-tilt-now')!;

function bindSlider(id: string, valId: string, onChange: (v: number) => void, fmt: (v: number) => string, resetsTraj: boolean) {
  const s = panel.querySelector<HTMLInputElement>(`#${id}`)!;
  const r = panel.querySelector<HTMLSpanElement>(`#${valId}`)!;
  s.addEventListener('input', () => {
    const v = parseFloat(s.value);
    r.textContent = fmt(v);
    onChange(v);
    if (resetsTraj) resetTrajectory();
  });
}
bindSlider('t-I1',   't-I1-val',   (v) => { I1 = v; },       (v) => v.toFixed(2), true);
bindSlider('t-I3',   't-I3-val',   (v) => { I3 = v; },       (v) => v.toFixed(2), true);
bindSlider('t-mgl',  't-mgl-val',  (v) => { mgl = v; },      (v) => v.toFixed(2), false);
bindSlider('t-spin', 't-spin-val', (v) => { spinRate = v; }, (v) => v.toFixed(1), true);
bindSlider('t-tilt', 't-tilt-val', (v) => { tilt0 = v; },    (v) => v.toFixed(2), true);

const playBtn = panel.querySelector<HTMLButtonElement>('#t-play')!;
playBtn.addEventListener('click', () => {
  running = !running;
  playBtn.textContent = running ? 'Pause' : 'Play';
});
panel.querySelector<HTMLButtonElement>('#t-reset')!.addEventListener('click', resetTrajectory);

// ── Boot ────────────────────────────────────────────────────────────

resetTrajectory();
app.start();
