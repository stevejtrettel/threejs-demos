/**
 * oscillator-quadratic-transients — initial conditions for the asymmetric
 * (quadratic-nonlinearity) oscillator still collapse onto a steady state,
 * but the steady state is no longer sinusoidal and is biased.
 *
 *   ẍ + 2γẋ + x + εx² = A cos(ω t).
 *
 * Same two-panel layout as oscillator-duffing-transients: small (x, ẋ)
 * phase-space box on the left, x(t) plot on the right. Click and drag
 * inside the IC box to pick an initial condition; release to commit.
 * On load, an autoplay sweep cycles a slate-blue phase point through ICs,
 * drawing the matching trajectory live.
 *
 * The trajectory is integrated with RK4 (no closed form for ε ≠ 0).
 * The potential V = x²/2 + (ε/3)x³ is unbounded below, so trajectories
 * with enough energy escape to −∞. The ε slider is capped at 0.5 to keep
 * default-amplitude motion bounded.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

// --- palette ---------------------------------------------------------------

const BG          = 0xF0EDE8;
const MAROON      = 0x7A1F2C;
const LIGHT_GRAY  = 0xB5B0A4;
const IC_DOT_GRAY = 0xA8A299;
const FRAME_COLOR = 0x8FA3B5;

// --- layout ---------------------------------------------------------------

const IC_W   = 2.6;
const IC_H   = 2.6;
const IC_CX  = -3.6;

const TIME_W = 6.0;
const TIME_H = 3.0;
const T_CX   = 1.4;

const X_MIN = -3, X_MAX = 3;
const V_MIN = -3, V_MAX = 3;

const T_MIN = 0;
const T_MAX = 80;
const DT    = 0.1;
const N_SAMPLES = Math.round((T_MAX - T_MIN) / DT) + 1;  // 801
const Y_MIN = -3, Y_MAX = 3;

const MAX_COMMITTED = 8;

// --- coordinate maps ------------------------------------------------------

function icToWorld(x: number, v: number): [number, number] {
  const wx = IC_CX + ((x - X_MIN) / (X_MAX - X_MIN) - 0.5) * IC_W;
  const wy = ((v - V_MIN) / (V_MAX - V_MIN) - 0.5) * IC_H;
  return [wx, wy];
}

function worldToIc(wx: number, wy: number): [number, number] {
  const x = X_MIN + ((wx - IC_CX) / IC_W + 0.5) * (X_MAX - X_MIN);
  const v = V_MIN + (wy / IC_H + 0.5) * (V_MAX - V_MIN);
  return [x, v];
}

function timeToWorld(t: number, x: number): [number, number] {
  const wx = T_CX + ((t - T_MIN) / (T_MAX - T_MIN) - 0.5) * TIME_W;
  const wy = ((x - Y_MIN) / (Y_MAX - Y_MIN) - 0.5) * TIME_H;
  return [wx, wy];
}

function inIcBox(wx: number, wy: number): boolean {
  return Math.abs(wx - IC_CX) <= IC_W / 2 && Math.abs(wy) <= IC_H / 2;
}

// --- inline RK4 integrator (allocation-free) -----------------------------
//
// Integrates ẍ + 2γẋ + x + εx² = A cos(ω t) with RK4 over [0, T_MAX] at fixed
// dt, writing each (t, x) sample directly into the supplied position buffer.

function integrateInto(positions: Float32Array, x0: number, v0: number) {
  let x = x0;
  let v = v0;
  let t = T_MIN;

  let [wx, wy] = timeToWorld(t, x);
  positions[0] = wx;
  positions[1] = wy;
  positions[2] = 0;

  const halfDt = 0.5 * DT;

  for (let i = 1; i < N_SAMPLES; i++) {
    // k1
    const k1x = v;
    const k1v = -2 * gamma * v - x - eps * x * x + driveAmp * Math.cos(omega * t);
    // k2
    const x2 = x + halfDt * k1x;
    const v2 = v + halfDt * k1v;
    const k2x = v2;
    const k2v = -2 * gamma * v2 - x2 - eps * x2 * x2 + driveAmp * Math.cos(omega * (t + halfDt));
    // k3
    const x3 = x + halfDt * k2x;
    const v3 = v + halfDt * k2v;
    const k3x = v3;
    const k3v = -2 * gamma * v3 - x3 - eps * x3 * x3 + driveAmp * Math.cos(omega * (t + halfDt));
    // k4
    const x4 = x + DT * k3x;
    const v4 = v + DT * k3v;
    const k4x = v4;
    const k4v = -2 * gamma * v4 - x4 - eps * x4 * x4 + driveAmp * Math.cos(omega * (t + DT));

    x = x + (DT / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    v = v + (DT / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    t += DT;

    [wx, wy] = timeToWorld(t, x);
    positions[i * 3 + 0] = wx;
    positions[i * 3 + 1] = wy;
    positions[i * 3 + 2] = 0;
  }
}

// --- scene ----------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 12);
app.camera.fov = 30;
app.camera.updateProjectionMatrix();
app.controls.target.set(0, 0, 0);
app.controls.controls.enabled = false;
app.backgrounds.setColor(BG);

// --- frames + axes --------------------------------------------------------

const frameMat = new THREE.LineBasicMaterial({ color: FRAME_COLOR });

function rectFrame(cx: number, cy: number, w: number, h: number): THREE.LineLoop {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(cx - w / 2, cy - h / 2, 0),
    new THREE.Vector3(cx + w / 2, cy - h / 2, 0),
    new THREE.Vector3(cx + w / 2, cy + h / 2, 0),
    new THREE.Vector3(cx - w / 2, cy + h / 2, 0),
  ]);
  return new THREE.LineLoop(geo, frameMat);
}

function segment(p1: [number, number], p2: [number, number]): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(p1[0], p1[1], 0),
    new THREE.Vector3(p2[0], p2[1], 0),
  ]);
  return new THREE.Line(geo, frameMat);
}

app.scene.add(rectFrame(IC_CX, 0, IC_W, IC_H));
app.scene.add(rectFrame(T_CX, 0, TIME_W, TIME_H));
app.scene.add(segment(icToWorld(X_MIN, 0), icToWorld(X_MAX, 0)));
app.scene.add(segment(icToWorld(0, V_MIN), icToWorld(0, V_MAX)));
app.scene.add(segment(timeToWorld(T_MIN, 0), timeToWorld(T_MAX, 0)));

// --- preview (Line2, slate blue, thick) and active dot -------------------

const previewMat = new LineMaterial({
  color: MAROON, linewidth: 3, worldUnits: false, depthTest: false,
});

function updateLineResolution() {
  previewMat.resolution.set(window.innerWidth, window.innerHeight);
}
updateLineResolution();
window.addEventListener('resize', updateLineResolution);

interface Preview {
  x0: number; v0: number;
  geometry: LineGeometry;
  positions: Float32Array;
  line: Line2;
}

let preview: Preview | null = null;

function makePreview(x0: number, v0: number): Preview {
  const positions = new Float32Array(N_SAMPLES * 3);
  const geometry = new LineGeometry();
  const line = new Line2(geometry, previewMat);
  line.renderOrder = 3;
  app.scene.add(line);
  const p: Preview = { x0, v0, geometry, positions, line };
  fillPreview(p);
  return p;
}

function fillPreview(p: Preview) {
  integrateInto(p.positions, p.x0, p.v0);
  p.geometry.setPositions(p.positions);
}

function disposePreview(p: Preview) {
  app.scene.remove(p.line);
  p.geometry.dispose();
}

const activeDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.07, 24),
  new THREE.MeshBasicMaterial({ color: MAROON, depthTest: false }),
);
activeDot.renderOrder = 5;
activeDot.visible = false;
app.scene.add(activeDot);

function moveActiveDot(x: number, v: number) {
  const [wx, wy] = icToWorld(x, v);
  activeDot.position.set(wx, wy, 0);
}

// --- committed curves (light gray) + IC trail dots -----------------------

const committedMat = new THREE.LineBasicMaterial({ color: LIGHT_GRAY, depthTest: false });
const trailDotMat = new THREE.MeshBasicMaterial({ color: IC_DOT_GRAY, depthTest: false });
const trailDotGeo = new THREE.CircleGeometry(0.045, 20);

interface Committed {
  x0: number; v0: number;
  geometry: THREE.BufferGeometry;
  positions: Float32Array;
  line: THREE.Line;
  dot: THREE.Mesh;
}

const committed: Committed[] = [];

function makeCommitted(x0: number, v0: number): Committed {
  const positions = new Float32Array(N_SAMPLES * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  const line = new THREE.Line(geometry, committedMat);
  line.renderOrder = 1;
  app.scene.add(line);

  const dot = new THREE.Mesh(trailDotGeo, trailDotMat);
  dot.renderOrder = 2;
  const [wx, wy] = icToWorld(x0, v0);
  dot.position.set(wx, wy, 0);
  app.scene.add(dot);

  const c: Committed = { x0, v0, geometry, positions, line, dot };
  fillCommitted(c);
  return c;
}

function fillCommitted(c: Committed) {
  integrateInto(c.positions, c.x0, c.v0);
  c.geometry.attributes.position.needsUpdate = true;
}

function disposeCommitted(c: Committed) {
  app.scene.remove(c.line);
  app.scene.remove(c.dot);
  c.geometry.dispose();
}

// --- params --------------------------------------------------------------

let gamma = 0.3;
let omega = 0.5;
let eps   = 0.1;
let driveAmp = 1.0;

function redrawAll() {
  for (const c of committed) fillCommitted(c);
  if (preview) fillPreview(preview);
}

// --- autoplay ------------------------------------------------------------

let autoplaying = true;
let autoplayStart: number | null = null;

app.addAnimateCallback((time) => {
  if (!autoplaying || !preview) return;
  if (autoplayStart === null) autoplayStart = time;
  const tau = time - autoplayStart;
  const x0 = 2.0 * Math.cos(0.4 * tau);
  const v0 = 2.2 * Math.sin(0.55 * tau);
  preview.x0 = x0;
  preview.v0 = v0;
  fillPreview(preview);
  moveActiveDot(x0, v0);
});

// --- pointer interaction -------------------------------------------------

const renderer = app.renderManager.renderer;
const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

let dragging = false;
// True once a preview has been left in place by a release (so the next click
// commits it to gray). False while autoplay is driving the preview, since
// the autoplay's preview is throwaway demonstration, not user-authored.
let previewIsStatic = false;

function pointerToIc(e: PointerEvent): [number, number] | null {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, app.camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(dragPlane, hit)) return null;
  if (!inIcBox(hit.x, hit.y)) return null;
  return worldToIc(hit.x, hit.y);
}

canvas.addEventListener('pointerdown', (e) => {
  const ic = pointerToIc(e);
  if (!ic) return;
  autoplaying = false;
  dragging = true;
  canvas.setPointerCapture(e.pointerId);

  // If a previous release left a static blue preview behind, demote it to gray now.
  if (preview && previewIsStatic) {
    committed.push(makeCommitted(preview.x0, preview.v0));
    while (committed.length > MAX_COMMITTED) disposeCommitted(committed.shift()!);
    disposePreview(preview);
    preview = null;
  }

  if (!preview) {
    preview = makePreview(ic[0], ic[1]);
  } else {
    preview.x0 = ic[0];
    preview.v0 = ic[1];
    fillPreview(preview);
  }
  previewIsStatic = false;
  activeDot.visible = true;
  moveActiveDot(ic[0], ic[1]);
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging || !preview) return;
  const ic = pointerToIc(e);
  if (!ic) return;
  preview.x0 = ic[0];
  preview.v0 = ic[1];
  fillPreview(preview);
  moveActiveDot(ic[0], ic[1]);
});

function endDrag(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  // Leave the blue preview and active dot in place — they get demoted to
  // gray on the *next* pointerdown, not on release.
  previewIsStatic = true;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// --- DOM sliders ---------------------------------------------------------

const sliderStyle = document.createElement('style');
sliderStyle.textContent = `
  .thin-slider { -webkit-appearance: none; appearance: none; width: 200px; height: 5px; margin: 0; background: transparent; outline: none; cursor: pointer; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.25)); }
  .thin-slider::-webkit-slider-runnable-track { height: 5px; background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.45); border-radius: 999px; box-sizing: border-box; }
  .thin-slider::-moz-range-track { height: 5px; background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.45); border-radius: 999px; box-sizing: border-box; }
  .thin-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; margin-top: -5px; background: #fff; border: 1.5px solid rgba(0,0,0,0.8); border-radius: 50%; box-sizing: border-box; cursor: pointer; }
  .thin-slider::-moz-range-thumb { width: 14px; height: 14px; background: #fff; border: 1.5px solid rgba(0,0,0,0.8); border-radius: 50%; box-sizing: border-box; cursor: pointer; }
  .thin-slider:focus { outline: none; }
  .osc-row { display: flex; align-items: center; gap: 10px; color: #333; font: 14px/1 monospace; }
  .osc-row .label { width: 14px; text-align: right; }
  .osc-row .value { width: 40px; color: #666; font-size: 12px; }
  .osc-controls { position: fixed; left: 50%; bottom: 38px; transform: translateX(-50%); display: grid; grid-template-columns: max-content max-content; column-gap: 30px; row-gap: 10px; pointer-events: auto; z-index: 10; }
  .equation-label { position: fixed; left: 50%; top: 32px; transform: translateX(-50%); color: #333; font: 18px/1.2 monospace; letter-spacing: 0; pointer-events: none; z-index: 10; white-space: nowrap; }
  .equation-label .title { margin-right: 18px; color: #666; font-size: 14px; }
  .equation-label .var { font-style: italic; }
  .ic-label { position: fixed; transform: translate(-50%, 0); color: #666; font: 14px/1 monospace; pointer-events: none; z-index: 10; white-space: nowrap; }
`;
document.head.appendChild(sliderStyle);

const equationLabel = document.createElement('div');
equationLabel.className = 'equation-label';
equationLabel.innerHTML =
  '<span class="title">solutions</span>' +
  '<span class="var">x</span>\u2033 + 2\u03b3<span class="var">x</span>\u2032 + ' +
  '<span class="var">x</span> + \u03b5<span class="var">x</span>\u00b2 = ' +
  '<span class="var">A</span> cos(\u03c9<span class="var">t</span>)';
document.body.appendChild(equationLabel);

const icLabel = document.createElement('div');
icLabel.className = 'ic-label';
icLabel.innerHTML = '(<span class="var">x</span>, <span class="var">x</span>\u2032)';
document.body.appendChild(icLabel);

const icLabelWorld = new THREE.Vector3(IC_CX, -IC_H / 2 - 0.18, 0);
const icLabelScreen = new THREE.Vector3();

function updateIcLabelPosition() {
  const rect = app.renderManager.renderer.domElement.getBoundingClientRect();
  icLabelScreen.copy(icLabelWorld).project(app.camera);
  icLabel.style.left = `${rect.left + (icLabelScreen.x * 0.5 + 0.5) * rect.width}px`;
  icLabel.style.top = `${rect.top + (-icLabelScreen.y * 0.5 + 0.5) * rect.height}px`;
}

updateIcLabelPosition();
window.addEventListener('resize', updateIcLabelPosition);

const sliderWrap = document.createElement('div');
sliderWrap.className = 'osc-controls';
sliderWrap.innerHTML = `
  <div class="osc-row">
    <span class="label">ε</span>
    <input id="osc-eps" type="range" class="thin-slider" min="0" max="0.5" step="0.005" value="${eps}" />
    <span class="value" id="osc-eps-v">${eps.toFixed(2)}</span>
  </div>
  <div class="osc-row">
    <span class="label">A</span>
    <input id="osc-drive" type="range" class="thin-slider" min="0" max="2" step="0.01" value="${driveAmp}" />
    <span class="value" id="osc-drive-v">${driveAmp.toFixed(2)}</span>
  </div>
  <div class="osc-row">
    <span class="label">γ</span>
    <input id="osc-gamma" type="range" class="thin-slider" min="0.05" max="1.5" step="0.01" value="${gamma}" />
    <span class="value" id="osc-gamma-v">${gamma.toFixed(2)}</span>
  </div>
  <div class="osc-row">
    <span class="label">ω</span>
    <input id="osc-omega" type="range" class="thin-slider" min="0.1" max="3" step="0.01" value="${omega}" />
    <span class="value" id="osc-omega-v">${omega.toFixed(2)}</span>
  </div>
`;
document.body.appendChild(sliderWrap);

const gammaSlider = sliderWrap.querySelector<HTMLInputElement>('#osc-gamma')!;
const omegaSlider = sliderWrap.querySelector<HTMLInputElement>('#osc-omega')!;
const epsSlider   = sliderWrap.querySelector<HTMLInputElement>('#osc-eps')!;
const driveSlider = sliderWrap.querySelector<HTMLInputElement>('#osc-drive')!;
const gammaReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-gamma-v')!;
const omegaReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-omega-v')!;
const epsReadout   = sliderWrap.querySelector<HTMLSpanElement>('#osc-eps-v')!;
const driveReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-drive-v')!;

gammaSlider.addEventListener('input', () => {
  gamma = parseFloat(gammaSlider.value);
  gammaReadout.textContent = gamma.toFixed(2);
  redrawAll();
});

omegaSlider.addEventListener('input', () => {
  omega = parseFloat(omegaSlider.value);
  omegaReadout.textContent = omega.toFixed(2);
  redrawAll();
});

epsSlider.addEventListener('input', () => {
  eps = parseFloat(epsSlider.value);
  epsReadout.textContent = eps.toFixed(2);
  redrawAll();
});

driveSlider.addEventListener('input', () => {
  driveAmp = parseFloat(driveSlider.value);
  driveReadout.textContent = driveAmp.toFixed(2);
  redrawAll();
});

// --- start ---------------------------------------------------------------

preview = makePreview(2.0, 0);
activeDot.visible = true;
moveActiveDot(2.0, 0);
app.start();
