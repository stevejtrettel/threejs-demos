/**
 * Rolling ball — a small ball rolls without slipping (or twisting) on a
 * big sphere, tracing a latitude loop.
 *
 * Physics:
 *   Contact point `p` moves on the big sphere at surface velocity `v`.
 *   Surface normal `n = p / |p|` (outward). The ball's center sits at
 *   `p + r · n` and moves at `v_center = (1 + r/R_big) · v`. The pure
 *   rolling (no slipping, no twist about the normal) constraint fixes
 *   the ball's angular velocity in world frame:
 *
 *     ω = (n × v_center) / r
 *
 *   Orientation ODE on SO(3):
 *
 *     dR/dt = hat(ω) · R
 *
 *   Stepping via `R ← SO3.exp(ω · dt) · R` keeps R exactly on SO(3) —
 *   same Lie-group step pattern as the Dzhanibekov integrator, with
 *   rolling-ω in place of rigid-body-Ω.
 *
 * Intuition:
 *   The loop's reflection symmetry across the xz-plane forces the
 *   final rotation's axis into the xz-plane — no y-component. On a
 *   flat surface the holonomy of rolling a closed loop is zero; here
 *   it's non-zero, and the discrepancy is the signature of the big
 *   sphere's curvature mixed with the "spin about the direction of
 *   motion" that accumulates around the loop. Special cases:
 *     - θ₀ = π/2 (equator): `ω` stays parallel to +z, so the final
 *       rotation is pure z-axis by an angle 2π(R_big + r)/r; at
 *       special radii it lands on the identity.
 *     - θ₀ → 0 or π (near poles): loop shrinks, holonomy → 0.
 *
 * Interactions:
 *   - colatitude θ₀: which latitude loop the contact point traces.
 *   - ball radius: smaller ball → more spin per unit traversal.
 *   - speed: angular speed `dφ/dt`.
 *   - play / pause / reset.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SO3, so3ToMatrix4, StreamTube } from '@/math';
import { Matrix } from '@/math/linear-algebra';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

// ── Physical parameters ─────────────────────────────────────────────

const R_BIG = 2.0;          // radius of the big sphere (the surface)
let r_ball = 0.28;          // radius of the small rolling ball
let theta0 = Math.PI / 3;   // colatitude of the loop
let speed = 0.6;            // dφ/dt in rad/s
let running = true;

// ── Scene ───────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: false });
app.camera.position.set(5, 4, 5);
app.controls.target.set(0, 0, 0);
app.controls.update();
app.backgrounds.setColor(0x181b22);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(4, 6, 5);
app.scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.4);
fill.position.set(-3, -2, -4);
app.scene.add(fill);

// Big sphere — the surface the ball rolls on.
const bigSphere = new THREE.Mesh(
  new THREE.SphereGeometry(R_BIG, 96, 64),
  new THREE.MeshStandardMaterial({
    color: 0x4a6a8a,
    roughness: 0.55,
    metalness: 0.0,
    transparent: true,
    opacity: 0.55,
  }),
);
app.scene.add(bigSphere);

// Latitude loop — redrawn when θ₀ changes.
const loopLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 }),
);
app.scene.add(loopLine);

// Contact-point trail on the big sphere — lifted as a tube via StreamTube.
// Same surface parametrization as the sphere-holonomy demo: (latitude, longitude).
const sphereSurface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    return new THREE.Vector3(
      R_BIG * Math.sin(u) * Math.cos(v),
      R_BIG * Math.sin(u) * Math.sin(v),
      R_BIG * Math.cos(u),
    );
  },
  getDomain: (): SurfaceDomain => ({
    uMin: 0.01, uMax: Math.PI - 0.01,
    vMin: -Infinity, vMax: Infinity,    // extended longitude; StreamTube handles it fine
  }),
};
const trail = new StreamTube(sphereSurface, {
  maxPoints: 4000,
  radius: 0.015,
  radialSegments: 6,
  color: 0xffaa33,
  roughness: 0.4,
});
app.scene.add(trail);

// Rolling ball — mesh + three body-frame axes to make orientation visible.
const ballRoot = new THREE.Group();
ballRoot.matrixAutoUpdate = false;
app.scene.add(ballRoot);

const ballMesh = new THREE.Mesh(
  new THREE.SphereGeometry(1, 32, 20),   // unit radius; we scale via ballRoot.matrix
  new THREE.MeshStandardMaterial({
    color: 0xe6d2a5,
    roughness: 0.4,
    metalness: 0.08,
  }),
);
ballRoot.add(ballMesh);

// Body-frame axes — unit-length arrows in the ball's local frame.
// Length a bit > 1 (= a bit > r_ball after scaling) so they poke through the
// ball surface and are unambiguously visible.
const AXIS_LEN = 1.35;
const AXIS_HEAD = 0.28;
const xAxis = new THREE.ArrowHelper(
  new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0),
  AXIS_LEN, 0xff4444, AXIS_HEAD, AXIS_HEAD * 0.6,
);
const yAxis = new THREE.ArrowHelper(
  new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0),
  AXIS_LEN, 0x44ff66, AXIS_HEAD, AXIS_HEAD * 0.6,
);
const zAxis = new THREE.ArrowHelper(
  new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0),
  AXIS_LEN, 0x4488ff, AXIS_HEAD, AXIS_HEAD * 0.6,
);
ballRoot.add(xAxis);
ballRoot.add(yAxis);
ballRoot.add(zAxis);

// Ghost ball — a faded, static copy at the starting position with the
// identity orientation, so the user can see the live ball pass through
// φ = 0 again after one full loop and tell it apart from the start.
const ghostRoot = new THREE.Group();
ghostRoot.matrixAutoUpdate = false;
app.scene.add(ghostRoot);

ghostRoot.add(new THREE.Mesh(
  new THREE.SphereGeometry(1, 24, 16),
  new THREE.MeshStandardMaterial({
    color: 0xe6d2a5,
    roughness: 0.5,
    transparent: true,
    opacity: 0.35,
  }),
));

function makeGhostAxis(dir: THREE.Vector3, color: number): THREE.ArrowHelper {
  const a = new THREE.ArrowHelper(
    dir, new THREE.Vector3(0, 0, 0),
    AXIS_LEN, color, AXIS_HEAD, AXIS_HEAD * 0.6,
  );
  const fade = (m: THREE.Material) => { m.transparent = true; m.opacity = 0.4; };
  fade(a.line.material as THREE.Material);
  fade(a.cone.material as THREE.Material);
  return a;
}
ghostRoot.add(makeGhostAxis(new THREE.Vector3(1, 0, 0), 0xff4444));
ghostRoot.add(makeGhostAxis(new THREE.Vector3(0, 1, 0), 0x44ff66));
ghostRoot.add(makeGhostAxis(new THREE.Vector3(0, 0, 1), 0x4488ff));

// ── State ──────────────────────────────────────────────────────────

let phi = 0;                   // current longitude along the loop
let R: Matrix = SO3.identity();

function rebuildLoopLine() {
  const N = 256;
  const positions = new Float32Array((N + 1) * 3);
  for (let i = 0; i <= N; i++) {
    const p = sphereSurface.evaluate(theta0, (i / N) * 2 * Math.PI);
    positions[i * 3 + 0] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  }
  loopLine.geometry.dispose();
  loopLine.geometry = new THREE.BufferGeometry();
  loopLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
}

function updateGhost() {
  // Ghost sits at the starting contact point (φ = 0, θ = θ₀) with
  // identity orientation and the same scale as the live ball.
  const n = new THREE.Vector3(Math.sin(theta0), 0, Math.cos(theta0));
  const center = n.clone().multiplyScalar(R_BIG + r_ball);
  const m = new THREE.Matrix4().makeScale(r_ball, r_ball, r_ball);
  m.setPosition(center);
  ghostRoot.matrix.copy(m);
}

function resetTrajectory() {
  phi = 0;
  R = SO3.identity();
  trail.reset();
  updateGhost();
  syncVisuals();
}

const tmpMatrix = new THREE.Matrix4();

function syncVisuals() {
  // Place the ball at contact point + r_ball · n, with orientation R and
  // uniform scale r_ball.
  const n = new THREE.Vector3(
    Math.sin(theta0) * Math.cos(phi),
    Math.sin(theta0) * Math.sin(phi),
    Math.cos(theta0),
  );
  const contact = n.clone().multiplyScalar(R_BIG);
  const center = contact.clone().addScaledVector(n, r_ball);

  // ballRoot.matrix = T(center) · scale(r_ball) · R
  so3ToMatrix4(R, tmpMatrix);
  tmpMatrix.scale(new THREE.Vector3(r_ball, r_ball, r_ball));
  tmpMatrix.setPosition(center);
  ballRoot.matrix.copy(tmpMatrix);

  // Push the contact point to the trail. Longitude is already continuous
  // (we integrate φ unbounded).
  trail.push(theta0, phi);

  // Readouts.
  const axisAngle = SO3.log(R);
  const angle = Math.hypot(axisAngle[0], axisAngle[1], axisAngle[2]);
  readoutPhi.textContent = `${(phi).toFixed(2)} rad  (${(phi / (2 * Math.PI)).toFixed(2)} loops)`;
  readoutAngle.textContent = `${angle.toFixed(3)} rad  (${(angle * 180 / Math.PI).toFixed(1)}°)`;
  if (angle > 1e-6) {
    const ax = axisAngle.map((x) => x / angle);
    readoutAxis.textContent = `(${ax[0].toFixed(2)}, ${ax[1].toFixed(2)}, ${ax[2].toFixed(2)})`;
  } else {
    readoutAxis.textContent = '—';
  }
}

// ── Simulation tick ────────────────────────────────────────────────

const STEPS_PER_FRAME = 4;

app.addAnimateCallback((_t, dt) => {
  if (!running) return;

  const subDt = dt / STEPS_PER_FRAME;

  for (let step = 0; step < STEPS_PER_FRAME; step++) {
    // Analytical surface velocity at the contact point:
    //   p = R_big · (sin θ cos φ, sin θ sin φ, cos θ)
    //   dp/dφ = R_big · sin θ · (−sin φ, cos φ, 0)
    const dphi = speed * subDt;
    const sinT = Math.sin(theta0);
    const n: [number, number, number] = [
      sinT * Math.cos(phi),
      sinT * Math.sin(phi),
      Math.cos(theta0),
    ];
    const dpdphi: [number, number, number] = [
      -R_BIG * sinT * Math.sin(phi),
       R_BIG * sinT * Math.cos(phi),
       0,
    ];
    // v_center = (1 + r_ball/R_BIG) · dp/dφ · dφ/dt
    const kCenter = (1 + r_ball / R_BIG) * speed;
    const vCenter: [number, number, number] = [
      dpdphi[0] * kCenter,
      dpdphi[1] * kCenter,
      dpdphi[2] * kCenter,
    ];
    // ω = (n × v_center) / r_ball
    const omega: [number, number, number] = [
      (n[1] * vCenter[2] - n[2] * vCenter[1]) / r_ball,
      (n[2] * vCenter[0] - n[0] * vCenter[2]) / r_ball,
      (n[0] * vCenter[1] - n[1] * vCenter[0]) / r_ball,
    ];
    // Lie-group step: R ← exp(ω · subDt) · R.
    const dR = SO3.exp([omega[0] * subDt, omega[1] * subDt, omega[2] * subDt]);
    R = dR.multiply(R);
    phi += dphi;
  }

  syncVisuals();
});

// ── UI ──────────────────────────────────────────────────────────────

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:10px;left:10px;color:#e8e8ee;font:11px/1.3 monospace;' +
  'background:rgba(15,15,22,0.85);padding:8px 10px;border-radius:5px;' +
  'display:flex;flex-direction:column;gap:3px;min-width:190px;z-index:10;';
panel.innerHTML = `
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>colatitude θ₀</span><span id="rb-theta-val">${theta0.toFixed(2)}</span>
  </label>
  <input id="rb-theta" type="range" min="0.05" max="3.09" step="0.01" value="${theta0}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>ball radius</span><span id="rb-r-val">${r_ball.toFixed(2)}</span>
  </label>
  <input id="rb-r" type="range" min="0.08" max="0.8" step="0.01" value="${r_ball}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>speed</span><span id="rb-speed-val">${speed.toFixed(2)}</span>
  </label>
  <input id="rb-speed" type="range" min="0.1" max="3" step="0.01" value="${speed}" style="height:14px;" />
  <div style="display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:1px;font-size:10px;color:#aaa;margin-top:4px;">
    <span>φ</span><span id="rb-phi">—</span>
    <span>|R|</span><span id="rb-angle">—</span>
    <span>axis</span><span id="rb-axis">—</span>
  </div>
  <div style="display:flex;gap:4px;margin-top:4px;">
    <button id="rb-play" style="flex:1;padding:3px 6px;font-size:11px;">${running ? 'Pause' : 'Play'}</button>
    <button id="rb-reset" style="flex:1;padding:3px 6px;font-size:11px;">Reset</button>
  </div>
`;
document.body.appendChild(panel);

const readoutPhi   = panel.querySelector<HTMLSpanElement>('#rb-phi')!;
const readoutAngle = panel.querySelector<HTMLSpanElement>('#rb-angle')!;
const readoutAxis  = panel.querySelector<HTMLSpanElement>('#rb-axis')!;

function bindSlider(id: string, valId: string, onChange: (v: number) => void, fmt: (v: number) => string) {
  const s = panel.querySelector<HTMLInputElement>(`#${id}`)!;
  const r = panel.querySelector<HTMLSpanElement>(`#${valId}`)!;
  s.addEventListener('input', () => {
    const v = parseFloat(s.value);
    r.textContent = fmt(v);
    onChange(v);
  });
}

bindSlider('rb-theta', 'rb-theta-val', (v) => { theta0 = v; rebuildLoopLine(); resetTrajectory(); }, (v) => v.toFixed(2));
bindSlider('rb-r',     'rb-r-val',     (v) => { r_ball = v; resetTrajectory(); }, (v) => v.toFixed(2));
bindSlider('rb-speed', 'rb-speed-val', (v) => { speed = v; }, (v) => v.toFixed(2));

const playBtn = panel.querySelector<HTMLButtonElement>('#rb-play')!;
playBtn.addEventListener('click', () => {
  running = !running;
  playBtn.textContent = running ? 'Pause' : 'Play';
});
panel.querySelector<HTMLButtonElement>('#rb-reset')!.addEventListener('click', resetTrajectory);

// ── Boot ────────────────────────────────────────────────────────────

rebuildLoopLine();
updateGhost();
syncVisuals();
app.start();
