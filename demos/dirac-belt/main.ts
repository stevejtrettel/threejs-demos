/**
 * Dirac belt / double cover — `SU(2) → SO(3)` made visible.
 *
 * Rotating an object by `2π` in SO(3) returns it to the same apparent
 * orientation — but the lifted SU(2) representative has flipped sign:
 * `q(2π) = −identity`. Only at `4π` does the quaternion truly return
 * to `+identity`. This demo exposes the sign-flip by tinting the
 * object's color according to `sign(w)` of the current quaternion, and
 * by tracking `w` itself on a horizontal meter.
 *
 *   θ = 0  :   w = +1   (blue)
 *   θ = π  :   w =  0   (pale)
 *   θ = 2π :   w = −1   (orange)    — same spatial pose as start!
 *   θ = 3π :   w =  0   (pale)
 *   θ = 4π :   w = +1   (blue)      — exact identity
 *
 * The object's spatial pose at `θ = 2π` is indistinguishable from
 * `θ = 0`; only the color reveals the SU(2)-level distinction that the
 * double cover captures.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SU2, su2ToQuaternion } from '@/math';

// ── State ───────────────────────────────────────────────────────────

let theta = 0;                  // in radians, range [0, 4π]
let axisTheta = Math.PI / 3;    // polar angle of rotation axis from +z
let speed = 0.7;                // rad/s
let running = true;

function axisVec(): [number, number, number] {
  // Fix azimuth = 0; user only controls elevation. One slider, clearer story.
  return [Math.sin(axisTheta), 0, Math.cos(axisTheta)];
}

// ── Scene ───────────────────────────────────────────────────────────

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 1.8, 5);
app.controls.target.set(0, 0.3, 0);
app.controls.update();
app.backgrounds.setColor(0xf5f6f8);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 1.1);
key.position.set(3, 5, 4);
app.scene.add(key);
const fill = new THREE.DirectionalLight(0xffffff, 0.4);
fill.position.set(-2, 2, -3);
app.scene.add(fill);

// Object — non-uniform box with visible body-frame arrows.
const boxMaterial = new THREE.MeshStandardMaterial({
  color: 0x4488cc,
  roughness: 0.45,
  metalness: 0.05,
});
const box = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.4), boxMaterial);
box.position.set(0, 0.9, 0);
app.scene.add(box);

const AXIS_LEN = 1.3, AXIS_HEAD = 0.2;
box.add(new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(), AXIS_LEN, 0xdd3344, AXIS_HEAD, AXIS_HEAD * 0.6));
box.add(new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), AXIS_LEN, 0x33aa44, AXIS_HEAD, AXIS_HEAD * 0.6));
box.add(new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(), AXIS_LEN, 0x3366cc, AXIS_HEAD, AXIS_HEAD * 0.6));

// Rotation-axis indicator — faint purple line through the box center.
const axisLine = new THREE.Line(
  new THREE.BufferGeometry(),
  new THREE.LineBasicMaterial({ color: 0x9944bb, transparent: true, opacity: 0.6 }),
);
axisLine.position.copy(box.position);
app.scene.add(axisLine);

function rebuildAxisLine() {
  const [ax, ay, az] = axisVec();
  const len = 1.4;
  const pts = new Float32Array([-ax*len, -ay*len, -az*len, ax*len, ay*len, az*len]);
  axisLine.geometry.dispose();
  axisLine.geometry = new THREE.BufferGeometry();
  axisLine.geometry.setAttribute('position', new THREE.BufferAttribute(pts, 3));
}

// ── Quaternion meter (w ∈ [-1, 1] track, bottom of the scene) ──────

const METER_WIDTH = 3.6;
const METER_Y = -1.4;

const meterTrack = new THREE.Line(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-METER_WIDTH / 2, METER_Y, 0),
    new THREE.Vector3( METER_WIDTH / 2, METER_Y, 0),
  ]),
  new THREE.LineBasicMaterial({ color: 0x888888 }),
);
app.scene.add(meterTrack);

// Tick marks at w = −1, 0, +1.
app.scene.add(new THREE.LineSegments(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-METER_WIDTH / 2, METER_Y - 0.08, 0),
    new THREE.Vector3(-METER_WIDTH / 2, METER_Y + 0.08, 0),
    new THREE.Vector3(METER_WIDTH / 2, METER_Y - 0.08, 0),
    new THREE.Vector3(METER_WIDTH / 2, METER_Y + 0.08, 0),
    new THREE.Vector3(0, METER_Y - 0.04, 0),
    new THREE.Vector3(0, METER_Y + 0.04, 0),
  ]),
  new THREE.LineBasicMaterial({ color: 0x888888 }),
));

// Marker bead
const marker = new THREE.Mesh(
  new THREE.SphereGeometry(0.07, 20, 14),
  new THREE.MeshStandardMaterial({ color: 0x4488cc, roughness: 0.3, metalness: 0.2 }),
);
app.scene.add(marker);

// ── Color interpolation (w → RGB) ──────────────────────────────────

const COLOR_BLUE   = new THREE.Color(0x4488cc);
const COLOR_CREAM  = new THREE.Color(0xeeeae0);
const COLOR_ORANGE = new THREE.Color(0xdd6633);

function colorForW(w: number): THREE.Color {
  // w ∈ [-1, 1] — cream at 0, blue at +1, orange at −1.
  if (w >= 0) return COLOR_CREAM.clone().lerp(COLOR_BLUE,   w);
  else        return COLOR_CREAM.clone().lerp(COLOR_ORANGE, -w);
}

// ── Update ──────────────────────────────────────────────────────────

const tmpQ = new THREE.Quaternion();

function update() {
  const [ax, ay, az] = axisVec();
  const q = SU2.exp([theta * ax, theta * ay, theta * az]);

  // Apply to the box.
  su2ToQuaternion(q, tmpQ);
  box.quaternion.copy(tmpQ);

  // Color and marker from the real part.
  const w = q.data[0];
  const c = colorForW(w);
  boxMaterial.color.copy(c);
  (marker.material as THREE.MeshStandardMaterial).color.copy(c);
  marker.position.set(w * (METER_WIDTH / 2), METER_Y, 0);

  readoutTheta.textContent = `${theta.toFixed(2)} rad  (${(theta / Math.PI).toFixed(2)} π)`;
  readoutW.textContent     = w.toFixed(4);
  readoutCycle.textContent = w >= 0 ? '+ identity side' : '− identity side';
}

// ── Tick ────────────────────────────────────────────────────────────

app.addAnimateCallback((_time, dt) => {
  if (!running) return;
  theta += speed * dt;
  if (theta > 4 * Math.PI) theta = 0;
  thetaSlider.value = String(theta);
  update();
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
    <span>θ</span><span id="db-t-val">${theta.toFixed(2)}</span>
  </label>
  <input id="db-t" type="range" min="0" max="12.566" step="0.01" value="${theta}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>axis elevation</span><span id="db-a-val">${axisTheta.toFixed(2)}</span>
  </label>
  <input id="db-a" type="range" min="0" max="3.14" step="0.01" value="${axisTheta}" style="height:14px;" />
  <label style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
    <span>speed</span><span id="db-s-val">${speed.toFixed(2)}</span>
  </label>
  <input id="db-s" type="range" min="0" max="3" step="0.01" value="${speed}" style="height:14px;" />
  <div style="display:grid;grid-template-columns:auto 1fr;column-gap:8px;row-gap:1px;font-size:10px;color:#555;margin-top:4px;">
    <span>θ</span><span id="db-theta">—</span>
    <span>w</span><span id="db-w">—</span>
    <span>side</span><span id="db-cycle">—</span>
  </div>
  <div style="display:flex;gap:4px;margin-top:4px;">
    <button id="db-play" style="flex:1;padding:3px 6px;font-size:11px;">${running ? 'Pause' : 'Play'}</button>
    <button id="db-reset" style="flex:1;padding:3px 6px;font-size:11px;">Reset</button>
  </div>
`;
document.body.appendChild(panel);

const thetaSlider   = panel.querySelector<HTMLInputElement>('#db-t')!;
const readoutTheta  = panel.querySelector<HTMLSpanElement>('#db-theta')!;
const readoutW      = panel.querySelector<HTMLSpanElement>('#db-w')!;
const readoutCycle  = panel.querySelector<HTMLSpanElement>('#db-cycle')!;

thetaSlider.addEventListener('input', () => {
  theta = parseFloat(thetaSlider.value);
  panel.querySelector<HTMLSpanElement>('#db-t-val')!.textContent = theta.toFixed(2);
  running = false;
  playBtn.textContent = 'Play';
  update();
});

const axSlider = panel.querySelector<HTMLInputElement>('#db-a')!;
axSlider.addEventListener('input', () => {
  axisTheta = parseFloat(axSlider.value);
  panel.querySelector<HTMLSpanElement>('#db-a-val')!.textContent = axisTheta.toFixed(2);
  rebuildAxisLine();
  update();
});

const spSlider = panel.querySelector<HTMLInputElement>('#db-s')!;
spSlider.addEventListener('input', () => {
  speed = parseFloat(spSlider.value);
  panel.querySelector<HTMLSpanElement>('#db-s-val')!.textContent = speed.toFixed(2);
});

const playBtn = panel.querySelector<HTMLButtonElement>('#db-play')!;
playBtn.addEventListener('click', () => {
  running = !running;
  playBtn.textContent = running ? 'Pause' : 'Play';
});
panel.querySelector<HTMLButtonElement>('#db-reset')!.addEventListener('click', () => {
  theta = 0;
  thetaSlider.value = '0';
  panel.querySelector<HTMLSpanElement>('#db-t-val')!.textContent = '0.00';
  update();
});

// ── Boot ────────────────────────────────────────────────────────────

rebuildAxisLine();
update();
app.start();
