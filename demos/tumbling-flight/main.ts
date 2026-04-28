/**
 * Tumble-while-falling — free rigid body in `SE(3)` under gravity.
 *
 * For a rigid body whose weight acts through its center of mass, gravity
 * exerts *no torque about the CoM*. So the dynamics decouple into two
 * pieces:
 *
 *   Orientation (SO(3)): Dzhanibekov — `dL/dt = L × (I⁻¹L)`, then
 *                        `R ← R · exp(dt · hat(Ω_body))`.
 *   Translation (ℝ³):    ballistic — `dv/dt = −g · ê_z`,  `dp/dt = v`.
 *
 * The state lives naturally in `SE(3)`: we pack `(R, p)` into a 4×4
 * homogeneous matrix each frame and feed it to THREE via
 * `se3ToMatrix4`.
 *
 * With `I = diag(1, 2, 2.5)` and an initial `L` near the intermediate
 * axis, the tumbling shows the classic Dzhanibekov flip while the
 * center of mass arcs through a parabola.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import {
  SO3,
  SE3,
  rigidBodyStep,
  se3ToMatrix4,
  type RigidBodyState,
} from '@/math';
import { Matrix } from '@/math/linear-algebra';

// ── Parameters ──────────────────────────────────────────────────────

let inertia: [number, number, number] = [1, 2, 2.5];
let tilt = 0.03;          // initial L tilt off e₂
let vUp = 4.5;            // initial upward speed (+z)
let vSide = 1.8;          // initial sideways speed (+x)
let gravity = 4.0;        // |g|, world-frame downward along −z
let running = true;

const DT = 0.004;
const STEPS_PER_FRAME = 6;

const SHAPE_SCALE = 0.4;
const MIN_HALF_SQ = 0.005;

function boxExtents(I: [number, number, number]): [number, number, number] {
  const [I1, I2, I3] = I;
  const a = SHAPE_SCALE * Math.sqrt(Math.max(MIN_HALF_SQ, 1.5 * (I2 + I3 - I1)));
  const b = SHAPE_SCALE * Math.sqrt(Math.max(MIN_HALF_SQ, 1.5 * (I1 + I3 - I2)));
  const c = SHAPE_SCALE * Math.sqrt(Math.max(MIN_HALF_SQ, 1.5 * (I1 + I2 - I3)));
  return [a, b, c];
}

function initialL(t: number): number[] {
  return [Math.sin(t), Math.cos(t), 0];
}

// ── Scene ───────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: false });
app.camera.position.set(4, 4, 3);
app.controls.target.set(0, 0, 1);
app.controls.update();
app.backgrounds.setColor(0xf2f3f6);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.15);
key.position.set(5, 6, 4);
app.scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.35);
fill.position.set(-3, 2, -3);
app.scene.add(fill);

// Ground grid at z = 0 (XY plane), gives a sense of "down".
const grid = new THREE.GridHelper(10, 20, 0xaaaaaa, 0xdddddd);
grid.rotation.x = Math.PI / 2;
app.scene.add(grid);

// Body mesh — unit cube, scaled via `box.scale` when I changes.
const box = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshStandardMaterial({ color: 0x4488cc, roughness: 0.45, metalness: 0.05 }),
);
box.matrixAutoUpdate = false;
app.scene.add(box);

const boxScale = new THREE.Vector3(...boxExtents(inertia));

function updateBoxShape() {
  boxScale.set(...boxExtents(inertia));
}

// Trail — the center-of-mass trajectory as a growing polyline.
const MAX_TRAIL = 2000;
const trailPositions = new Float32Array(MAX_TRAIL * 3);
let trailCount = 0;
const trailGeom = new THREE.BufferGeometry();
trailGeom.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
trailGeom.setDrawRange(0, 0);
const trailLine = new THREE.Line(
  trailGeom,
  new THREE.LineBasicMaterial({ color: 0xff5522, linewidth: 2 }),
);
app.scene.add(trailLine);

function pushTrail(p: number[]) {
  if (trailCount >= MAX_TRAIL) return;
  trailPositions[trailCount * 3 + 0] = p[0];
  trailPositions[trailCount * 3 + 1] = p[1];
  trailPositions[trailCount * 3 + 2] = p[2];
  trailCount++;
  trailGeom.setDrawRange(0, trailCount);
  (trailGeom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
}

function resetTrail() {
  trailCount = 0;
  trailGeom.setDrawRange(0, 0);
}

// Gravity indicator at the scene edge.
app.scene.add(new THREE.ArrowHelper(
  new THREE.Vector3(0, 0, -1), new THREE.Vector3(3, 0, 3),
  0.6, 0x666666, 0.14, 0.08,
));

// ── State ───────────────────────────────────────────────────────────

let orientState: RigidBodyState = { R: SO3.identity(), L: initialL(tilt) };
let pos: number[] = [0, 0, 0.2];
let vel: number[] = [vSide, 0, vUp];

function initialState() {
  orientState = { R: SO3.identity(), L: initialL(tilt) };
  pos = [0, 0, 0.2];
  vel = [vSide, 0, vUp];
}

function resetTrajectory() {
  initialState();
  resetTrail();
  syncVisuals();
}

// Pack `(R, p)` into an `SE(3)` 4×4 matrix, then hand off to THREE.
const se3Buf = new Matrix(4, 4);

function syncVisuals() {
  // Fill SE(3) matrix [[R, p], [0, 1]].
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      se3Buf.data[i * 4 + j] = orientState.R.data[i * 3 + j];
    }
    se3Buf.data[i * 4 + 3] = pos[i];
  }
  // Bottom row.
  se3Buf.data[12] = 0; se3Buf.data[13] = 0; se3Buf.data[14] = 0; se3Buf.data[15] = 1;

  // se3ToMatrix4 writes to box.matrix; we then fold in the shape scale
  // (the SE(3) matrix carries only rigid motion).
  se3ToMatrix4(se3Buf, box.matrix);
  box.matrix.scale(boxScale);

  readoutAlt.textContent = pos[2].toFixed(2);
  readoutSpeed.textContent = Math.hypot(vel[0], vel[1], vel[2]).toFixed(2);
}

// ── Tick ────────────────────────────────────────────────────────────

app.addAnimateCallback(() => {
  if (!running) return;

  for (let step = 0; step < STEPS_PER_FRAME; step++) {
    // Orientation: free rigid body (no torque).
    orientState = rigidBodyStep(orientState, DT, { inertia });

    // Translation: simple Euler ballistic.
    vel[2] -= gravity * DT;
    pos[0] += vel[0] * DT;
    pos[1] += vel[1] * DT;
    pos[2] += vel[2] * DT;
  }

  pushTrail(pos);
  syncVisuals();

  // Auto-reset when the box drops well below the grid so the demo loops.
  if (pos[2] < -6) resetTrajectory();
});

// ── Verify SE(3) assembly via the library (one-time sanity check) ───
//
// We constructed the SE(3) matrix by hand above. Cross-check against
// what `SE3.log / exp` would produce for the same (R, p): exp(log(g))
// should round-trip to g itself. This catches packing mistakes.
function selfCheck() {
  const L = SO3.exp([0.3, -0.1, 0.7]);
  const T: number[] = [1.2, -0.4, 0.9];
  const g = new Matrix(4, 4);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) g.data[i * 4 + j] = L.data[i * 3 + j];
    g.data[i * 4 + 3] = T[i];
  }
  g.data[15] = 1;
  const roundTrip = SE3.exp(SE3.log(g));
  let maxErr = 0;
  for (let k = 0; k < 16; k++) {
    maxErr = Math.max(maxErr, Math.abs(roundTrip.data[k] - g.data[k]));
  }
  if (maxErr > 1e-10) {
    console.warn(`[tumbling-flight] SE(3) round-trip failed: err = ${maxErr}`);
  }
}
selfCheck();

// ── UI ──────────────────────────────────────────────────────────────

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:10px;left:10px;color:#222;font:11px/1.3 monospace;' +
  'background:rgba(255,255,255,0.92);padding:8px 10px;border-radius:5px;' +
  'display:flex;flex-direction:column;gap:3px;min-width:220px;z-index:10;' +
  'box-shadow:0 1px 3px rgba(0,0,0,0.12);';
panel.innerHTML = `
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>I₁</span><span id="tf-I1-v">${inertia[0].toFixed(2)}</span>
  </label>
  <input id="tf-I1" type="range" min="0.5" max="5" step="0.01" value="${inertia[0]}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>I₂ (intermediate)</span><span id="tf-I2-v">${inertia[1].toFixed(2)}</span>
  </label>
  <input id="tf-I2" type="range" min="0.5" max="5" step="0.01" value="${inertia[1]}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>I₃</span><span id="tf-I3-v">${inertia[2].toFixed(2)}</span>
  </label>
  <input id="tf-I3" type="range" min="0.5" max="5" step="0.01" value="${inertia[2]}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>tilt off e₂</span><span id="tf-tilt-v">${tilt.toFixed(3)}</span>
  </label>
  <input id="tf-tilt" type="range" min="0" max="0.6" step="0.001" value="${tilt}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>initial v_up</span><span id="tf-vup-v">${vUp.toFixed(1)}</span>
  </label>
  <input id="tf-vup" type="range" min="0" max="10" step="0.1" value="${vUp}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>initial v_side</span><span id="tf-vside-v">${vSide.toFixed(1)}</span>
  </label>
  <input id="tf-vside" type="range" min="-4" max="4" step="0.1" value="${vSide}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>gravity</span><span id="tf-g-v">${gravity.toFixed(1)}</span>
  </label>
  <input id="tf-g" type="range" min="0" max="10" step="0.1" value="${gravity}" style="height:14px;" />
  <div style="display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:1px;font-size:10px;color:#555;margin-top:4px;">
    <span>z</span><span id="tf-alt">—</span>
    <span>|v|</span><span id="tf-speed">—</span>
  </div>
  <div style="display:flex;gap:4px;margin-top:4px;">
    <button id="tf-play" style="flex:1;padding:3px 6px;font-size:11px;">${running ? 'Pause' : 'Play'}</button>
    <button id="tf-reset" style="flex:1;padding:3px 6px;font-size:11px;">Reset</button>
  </div>
`;
document.body.appendChild(panel);

const readoutAlt   = panel.querySelector<HTMLSpanElement>('#tf-alt')!;
const readoutSpeed = panel.querySelector<HTMLSpanElement>('#tf-speed')!;

function bindSlider(id: string, valId: string, onChange: (v: number) => void, fmt: (v: number) => string, resetTraj: boolean) {
  const s = panel.querySelector<HTMLInputElement>(`#${id}`)!;
  const r = panel.querySelector<HTMLSpanElement>(`#${valId}`)!;
  s.addEventListener('input', () => {
    const v = parseFloat(s.value);
    r.textContent = fmt(v);
    onChange(v);
    if (resetTraj) resetTrajectory();
  });
}

bindSlider('tf-I1',   'tf-I1-v',   (v) => { inertia = [v, inertia[1], inertia[2]]; updateBoxShape(); }, (v) => v.toFixed(2), true);
bindSlider('tf-I2',   'tf-I2-v',   (v) => { inertia = [inertia[0], v, inertia[2]]; updateBoxShape(); }, (v) => v.toFixed(2), true);
bindSlider('tf-I3',   'tf-I3-v',   (v) => { inertia = [inertia[0], inertia[1], v]; updateBoxShape(); }, (v) => v.toFixed(2), true);
bindSlider('tf-tilt', 'tf-tilt-v', (v) => { tilt = v; },  (v) => v.toFixed(3), true);
bindSlider('tf-vup',  'tf-vup-v',  (v) => { vUp = v; },   (v) => v.toFixed(1), true);
bindSlider('tf-vside','tf-vside-v',(v) => { vSide = v; }, (v) => v.toFixed(1), true);
bindSlider('tf-g',    'tf-g-v',    (v) => { gravity = v; }, (v) => v.toFixed(1), false);

const playBtn = panel.querySelector<HTMLButtonElement>('#tf-play')!;
playBtn.addEventListener('click', () => {
  running = !running;
  playBtn.textContent = running ? 'Pause' : 'Play';
});
panel.querySelector<HTMLButtonElement>('#tf-reset')!.addEventListener('click', resetTrajectory);

// ── Boot ────────────────────────────────────────────────────────────

updateBoxShape();
resetTrajectory();
app.start();
