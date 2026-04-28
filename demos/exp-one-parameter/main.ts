/**
 * One-parameter subgroup `R(t) = exp(t·ξ)`.
 *
 * Fix a Lie-algebra vector `ξ ∈ so(3)` (equivalently, an axis-angle with
 * |ξ| = rate and `ξ̂` = axis). Its exponential traces a one-parameter
 * subgroup `t ↦ R(t) = exp(t·ξ)` through SO(3), starting at `R(0) = I`
 * and returning to the identity at `t = 2π / |ξ|`.
 *
 * Visually: a body frame (red/green/blue axis arrows) sits at the
 * origin; the axis `ξ̂` points along a fixed line; the tip of the
 * body-frame red arrow traces a circle centered on the axis.
 *
 * Interactions:
 *   - axis sliders (θ_axis, φ_axis): direction of `ξ̂` on the unit sphere.
 *   - |ξ|: angular rate. At |ξ| = 1 the subgroup has period 2π.
 *   - t slider: scrub time manually (pauses auto-play).
 *   - play/pause: continuous animation.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SO3, so3ToMatrix4 } from '@/math';

// ── State ───────────────────────────────────────────────────────────

let axisTheta = Math.PI / 3;    // polar angle from +z
let axisPhi   = 0;              // azimuth
let xiMag     = 1.0;            // |ξ| — rotation rate
let tParam    = 0;              // current t
let playing   = true;

function axisVec(): [number, number, number] {
  return [
    Math.sin(axisTheta) * Math.cos(axisPhi),
    Math.sin(axisTheta) * Math.sin(axisPhi),
    Math.cos(axisTheta),
  ];
}

// ── Scene ───────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: false });
app.camera.position.set(2.2, 1.8, 3.2);
app.controls.target.set(0, 0, 0);
app.controls.update();
app.backgrounds.setColor(0xf4f4f6);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.0);
key.position.set(3, 5, 4);
app.scene.add(key);

// Body frame — triad at origin, rotated by R(t).
const frameRoot = new THREE.Group();
frameRoot.matrixAutoUpdate = false;
app.scene.add(frameRoot);

const FL = 1.0, FH = 0.18;
frameRoot.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), FL, 0xdd3344, FH, FH * 0.6));
frameRoot.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), FL, 0x33aa44, FH, FH * 0.6));
frameRoot.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), FL, 0x3366cc, FH, FH * 0.6));

// Rotation axis — a two-ended arrow through the origin.
let axisArrowPos: THREE.ArrowHelper;
let axisArrowNeg: THREE.ArrowHelper;
const AXIS_LEN = 1.5;
const AXIS_HEAD = 0.2;
function buildAxisArrows() {
  if (axisArrowPos) app.scene.remove(axisArrowPos);
  if (axisArrowNeg) app.scene.remove(axisArrowNeg);
  const [ax, ay, az] = axisVec();
  const dirPos = new THREE.Vector3(ax, ay, az);
  const dirNeg = dirPos.clone().negate();
  axisArrowPos = new THREE.ArrowHelper(dirPos, new THREE.Vector3(), AXIS_LEN, 0x9944aa, AXIS_HEAD, AXIS_HEAD * 0.6);
  axisArrowNeg = new THREE.ArrowHelper(dirNeg, new THREE.Vector3(), AXIS_LEN, 0x9944aa, AXIS_HEAD, AXIS_HEAD * 0.6);
  app.scene.add(axisArrowPos);
  app.scene.add(axisArrowNeg);
}

// Trail — the circle traced by the red arrow's tip as t advances.
const trailLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0xdd3344, transparent: true, opacity: 0.6 }),
);
app.scene.add(trailLine);

function rebuildTrailCircle() {
  // Closed-form: `exp(t·ξ) · ê_x` traces a circle around `ξ̂` through
  // `ê_x`. Compute the plane perpendicular to ξ̂ containing ê_x's
  // projection, and draw the circle explicitly. (Equivalent to sampling
  // `exp(t·ξ) · ê_x` for a grid of t — but the closed form is clean.)
  const [ax, ay, az] = axisVec();
  const axisN = new THREE.Vector3(ax, ay, az);
  const exv = new THREE.Vector3(1, 0, 0);
  const proj = axisN.clone().multiplyScalar(exv.dot(axisN));
  const perp = exv.clone().sub(proj);          // component of ê_x ⟂ axis
  const radius = perp.length();
  const perp2 = new THREE.Vector3().crossVectors(axisN, perp).normalize().multiplyScalar(radius);
  const perp1 = perp.clone();

  const N = 180;
  const positions = new Float32Array((N + 1) * 3);
  for (let i = 0; i <= N; i++) {
    const s = (i / N) * 2 * Math.PI;
    const p = proj.clone()
      .addScaledVector(perp1, Math.cos(s))
      .addScaledVector(perp2, Math.sin(s));
    positions[i * 3 + 0] = p.x;
    positions[i * 3 + 1] = p.y;
    positions[i * 3 + 2] = p.z;
  }
  trailLine.geometry.dispose();
  trailLine.geometry = new THREE.BufferGeometry();
  trailLine.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
}

// ── Update ──────────────────────────────────────────────────────────

function applyRotation() {
  const [ax, ay, az] = axisVec();
  const xi: [number, number, number] = [xiMag * tParam * ax, xiMag * tParam * ay, xiMag * tParam * az];
  const R = SO3.exp(xi);
  so3ToMatrix4(R, frameRoot.matrix);
  readoutT.textContent = tParam.toFixed(2);
}

// ── Tick ────────────────────────────────────────────────────────────

app.addAnimateCallback((_time, dt) => {
  if (!playing) return;
  tParam += dt;
  if (tParam > 2 * Math.PI / Math.max(0.05, xiMag)) tParam = 0;
  tSlider.value = String(tParam);
  applyRotation();
});

// ── UI ──────────────────────────────────────────────────────────────

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:10px;left:10px;color:#222;font:11px/1.3 monospace;' +
  'background:rgba(255,255,255,0.92);padding:8px 10px;border-radius:5px;' +
  'display:flex;flex-direction:column;gap:3px;min-width:230px;z-index:10;' +
  'box-shadow:0 1px 3px rgba(0,0,0,0.12);';
panel.innerHTML = `
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>axis θ (from +z)</span><span id="d-at-val">${axisTheta.toFixed(2)}</span>
  </label>
  <input id="d-at" type="range" min="0" max="3.14" step="0.01" value="${axisTheta}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>axis φ</span><span id="d-ap-val">${axisPhi.toFixed(2)}</span>
  </label>
  <input id="d-ap" type="range" min="-3.14" max="3.14" step="0.01" value="${axisPhi}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>|ξ|  (rate)</span><span id="d-m-val">${xiMag.toFixed(2)}</span>
  </label>
  <input id="d-m" type="range" min="0.2" max="3" step="0.01" value="${xiMag}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>t</span><span id="d-t-val">${tParam.toFixed(2)}</span>
  </label>
  <input id="d-t" type="range" min="0" max="6.28" step="0.01" value="${tParam}" style="height:14px;" />
  <div style="display:flex;gap:4px;margin-top:4px;">
    <button id="d-play" style="flex:1;padding:3px 6px;font-size:11px;">${playing ? 'Pause' : 'Play'}</button>
  </div>
`;
document.body.appendChild(panel);

const readoutT = panel.querySelector<HTMLSpanElement>('#d-t-val')!;
const tSlider = panel.querySelector<HTMLInputElement>('#d-t')!;

function bindSlider(id: string, valId: string, onChange: (v: number) => void, rebuildAxis: boolean, rebuildTrail: boolean) {
  const s = panel.querySelector<HTMLInputElement>(`#${id}`)!;
  const r = panel.querySelector<HTMLSpanElement>(`#${valId}`)!;
  s.addEventListener('input', () => {
    const v = parseFloat(s.value);
    r.textContent = v.toFixed(2);
    onChange(v);
    if (rebuildAxis) buildAxisArrows();
    if (rebuildTrail) rebuildTrailCircle();
    applyRotation();
  });
}
bindSlider('d-at', 'd-at-val', (v) => { axisTheta = v; }, true, true);
bindSlider('d-ap', 'd-ap-val', (v) => { axisPhi   = v; }, true, true);
bindSlider('d-m',  'd-m-val',  (v) => { xiMag     = v; }, false, false);

tSlider.addEventListener('input', () => {
  tParam = parseFloat(tSlider.value);
  playing = false;
  playBtn.textContent = 'Play';
  applyRotation();
});

const playBtn = panel.querySelector<HTMLButtonElement>('#d-play')!;
playBtn.addEventListener('click', () => {
  playing = !playing;
  playBtn.textContent = playing ? 'Pause' : 'Play';
});

// ── Boot ────────────────────────────────────────────────────────────

buildAxisArrows();
rebuildTrailCircle();
applyRotation();
app.start();
