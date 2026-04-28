/**
 * oscillator-linear-transients — every initial condition collapses onto the
 * same steady state for the driven damped linear oscillator
 *
 *   ẍ + 2γẋ + x = cos(ω t).
 *
 * Left panel: small (x, ẋ) phase-space box. Right panel: x(t) over a fixed
 * window, drawn analytically.
 *
 * On load, an autoplay sweep cycles a slate-blue phase point through ICs,
 * drawing the matching solution curve live. Click inside the IC box to take
 * over: drag to preview, release to commit. Released curves stay in light
 * gray with a small dot in phase space marking their IC. The dashed maroon
 * curve is the unique steady-state attractor; sliding γ or ω redraws every
 * trajectory and the reference.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

// --- palette ---------------------------------------------------------------

const BG          = 0xF0EDE8;
const MAROON      = 0x7A1F2C;
const SLATE_BLUE  = 0x4A6B8A;
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
const Y_MIN = -3, Y_MAX = 3;
const N_SAMPLES = 600;

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

// --- closed-form solution -------------------------------------------------

interface Params { gamma: number; omega: number; }

interface SteadyState { a: number; b: number; x0: number; v0: number; }

function steadyState({ gamma, omega }: Params): SteadyState {
  const D = (1 - omega * omega) ** 2 + 4 * gamma * gamma * omega * omega;
  const a = (1 - omega * omega) / D;
  const b = (2 * gamma * omega) / D;
  return { a, b, x0: a, v0: omega * b };
}

type Eval = (t: number) => number;

function solve(p: Params, x0: number, v0: number): Eval {
  const { gamma, omega } = p;
  const ss = steadyState(p);
  const dx = x0 - ss.x0;
  const dv = v0 - ss.v0;

  if (gamma < 1 - 1e-9) {
    const wd = Math.sqrt(1 - gamma * gamma);
    const C1 = dx;
    const C2 = (dv + gamma * dx) / wd;
    return (t) =>
      ss.a * Math.cos(omega * t) + ss.b * Math.sin(omega * t)
      + Math.exp(-gamma * t) * (C1 * Math.cos(wd * t) + C2 * Math.sin(wd * t));
  }
  if (gamma > 1 + 1e-9) {
    const mu = Math.sqrt(gamma * gamma - 1);
    const lp = -gamma + mu;
    const lm = -gamma - mu;
    const a = (dv - lm * dx) / (2 * mu);
    const b = dx - a;
    return (t) =>
      ss.a * Math.cos(omega * t) + ss.b * Math.sin(omega * t)
      + a * Math.exp(lp * t) + b * Math.exp(lm * t);
  }
  const a = dx;
  const b = dv + dx;
  return (t) =>
    ss.a * Math.cos(omega * t) + ss.b * Math.sin(omega * t)
    + Math.exp(-t) * (a + b * t);
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

// --- steady-state dashed reference ---------------------------------------

const dashedMat = new THREE.LineDashedMaterial({
  color: MAROON, dashSize: 0.14, gapSize: 0.10, depthTest: false,
});

const ssGeometry = new THREE.BufferGeometry();
const ssPositions = new Float32Array(N_SAMPLES * 3);
ssGeometry.setAttribute('position',
  new THREE.BufferAttribute(ssPositions, 3).setUsage(THREE.DynamicDrawUsage));
const ssLine = new THREE.Line(ssGeometry, dashedMat);
ssLine.renderOrder = 4;
app.scene.add(ssLine);

// --- preview (Line2, slate blue, thick) and active dot -------------------

const previewMat = new LineMaterial({
  color: SLATE_BLUE,
  linewidth: 3,
  worldUnits: false,
  depthTest: false,
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
  const f = solve({ gamma, omega }, p.x0, p.v0);
  for (let i = 0; i < N_SAMPLES; i++) {
    const t = T_MIN + (T_MAX - T_MIN) * (i / (N_SAMPLES - 1));
    const [wx, wy] = timeToWorld(t, f(t));
    p.positions[i * 3 + 0] = wx;
    p.positions[i * 3 + 1] = wy;
    p.positions[i * 3 + 2] = 0;
  }
  p.geometry.setPositions(p.positions);
}

function disposePreview(p: Preview) {
  app.scene.remove(p.line);
  p.geometry.dispose();
}

// Active dot in phase space — slate blue, follows the live preview's IC.
const activeDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.07, 24),
  new THREE.MeshBasicMaterial({ color: SLATE_BLUE, depthTest: false }),
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
  const f = solve({ gamma, omega }, c.x0, c.v0);
  for (let i = 0; i < N_SAMPLES; i++) {
    const t = T_MIN + (T_MAX - T_MIN) * (i / (N_SAMPLES - 1));
    const [wx, wy] = timeToWorld(t, f(t));
    c.positions[i * 3 + 0] = wx;
    c.positions[i * 3 + 1] = wy;
    c.positions[i * 3 + 2] = 0;
  }
  c.geometry.attributes.position.needsUpdate = true;
}

function disposeCommitted(c: Committed) {
  app.scene.remove(c.line);
  app.scene.remove(c.dot);
  c.geometry.dispose();
}

// --- params --------------------------------------------------------------

let gamma = 0.2;
let omega = 0.25;

function fillSteadyState() {
  const ss = steadyState({ gamma, omega });
  for (let i = 0; i < N_SAMPLES; i++) {
    const t = T_MIN + (T_MAX - T_MIN) * (i / (N_SAMPLES - 1));
    const x = ss.a * Math.cos(omega * t) + ss.b * Math.sin(omega * t);
    const [wx, wy] = timeToWorld(t, x);
    ssPositions[i * 3 + 0] = wx;
    ssPositions[i * 3 + 1] = wy;
    ssPositions[i * 3 + 2] = 0;
  }
  ssGeometry.attributes.position.needsUpdate = true;
  ssLine.computeLineDistances();
}

function redrawAll() {
  fillSteadyState();
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
  // Slow Lissajous through (x, ẋ) so a range of ICs is visited.
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
  if (!preview) {
    preview = makePreview(ic[0], ic[1]);
  } else {
    preview.x0 = ic[0];
    preview.v0 = ic[1];
    fillPreview(preview);
  }
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
  if (preview) {
    committed.push(makeCommitted(preview.x0, preview.v0));
    while (committed.length > MAX_COMMITTED) disposeCommitted(committed.shift()!);
    disposePreview(preview);
    preview = null;
    activeDot.visible = false;
  }
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
`;
document.head.appendChild(sliderStyle);

const sliderWrap = document.createElement('div');
sliderWrap.style.cssText =
  'position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:8px;' +
  'pointer-events:auto;z-index:10;';
sliderWrap.innerHTML = `
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

const gammaSlider  = sliderWrap.querySelector<HTMLInputElement>('#osc-gamma')!;
const omegaSlider  = sliderWrap.querySelector<HTMLInputElement>('#osc-omega')!;
const gammaReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-gamma-v')!;
const omegaReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-omega-v')!;

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

// --- start ---------------------------------------------------------------

fillSteadyState();
preview = makePreview(2.0, 0);
activeDot.visible = true;
moveActiveDot(2.0, 0);
app.start();
