/**
 * oscillator-linear-phase-lag — drive vs steady-state response of the linear
 * damped driven oscillator, with a phasor inset.
 *
 *   ẍ + 2γẋ + x = cos(ω t),  x_ss(t) = Re(χ(ω) e^{iωt}),
 *   χ(ω) = 1 / ((1 − ω²) + 2iγω).
 *
 * Left panel: complex plane. The trace is the locus χ(ω) for ω ∈ (0, ∞);
 * a maroon dot rides along it at the current ω. The dot rotates from the
 * positive real axis (ω → 0, in-phase) through the negative imaginary axis
 * (ω = 1, π/2 lag) and on toward the origin from the negative-real side
 * (ω → ∞, anti-phase).
 *
 * Right panel: drive cos(ωt) (slate blue) and response x_ss(t) (maroon) on
 * shared axes. The phase lag visible between them is the same angle the
 * phasor arrow makes with the positive real axis. The plotted time window
 * shows ~5 drive periods regardless of ω; the y-extent scales with γ so
 * the response always fits.
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
const TRACE_GRAY  = 0xB5B0A4;
const FRAME_COLOR = 0x8FA3B5;

// --- layout ---------------------------------------------------------------

const PHASOR_W  = 2.6;
const PHASOR_H  = 2.6;
const PHASOR_CX = -3.6;

const TIME_W = 6.0;
const TIME_H = 3.0;
const T_CX   = 1.4;

const N_TRACE = 600;     // points along the χ(ω) trace
const N_TIME  = 600;     // points along time curves
const W_MIN_TRACE = 0.01;
const W_MAX_TRACE = 5.0; // ω-range for the locus

const PERIODS_SHOWN = 5;

// --- closed-form pieces ---------------------------------------------------

interface Chi { re: number; im: number; }

function chi(gamma: number, w: number): Chi {
  const D = (1 - w * w) ** 2 + 4 * gamma * gamma * w * w;
  return { re: (1 - w * w) / D, im: -2 * gamma * w / D };
}

// --- scene ----------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 12);
app.camera.fov = 30;
app.camera.updateProjectionMatrix();
app.controls.target.set(0, 0, 0);
app.controls.controls.enabled = false;
app.backgrounds.setColor(BG);

// --- frames ---------------------------------------------------------------

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

app.scene.add(rectFrame(PHASOR_CX, 0, PHASOR_W, PHASOR_H));
app.scene.add(rectFrame(T_CX, 0, TIME_W, TIME_H));

// --- phasor panel: trace, axes through χ-origin, arrow --------------------

interface Transform {
  scale: number;
  xCenter: number;
  yCenter: number;
}

const tracePts: Float32Array = new Float32Array(N_TRACE * 3);
const traceGeometry = new THREE.BufferGeometry();
traceGeometry.setAttribute('position',
  new THREE.BufferAttribute(tracePts, 3).setUsage(THREE.DynamicDrawUsage));
const traceLine = new THREE.Line(
  traceGeometry,
  new THREE.LineBasicMaterial({ color: TRACE_GRAY, depthTest: false }),
);
traceLine.renderOrder = 1;
app.scene.add(traceLine);

// Axes through χ=0 inside the panel (re-axis horizontal, im-axis vertical).
// These get repositioned with γ since the panel's affine transform changes.
const reAxisGeo = new THREE.BufferGeometry();
reAxisGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage));
const reAxis = new THREE.Line(reAxisGeo, frameMat);
app.scene.add(reAxis);

const imAxisGeo = new THREE.BufferGeometry();
imAxisGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage));
const imAxis = new THREE.Line(imAxisGeo, frameMat);
app.scene.add(imAxis);

// Maroon dot riding along the χ(ω) trace at the current ω.
const chiDot = new THREE.Mesh(
  new THREE.CircleGeometry(0.085, 24),
  new THREE.MeshBasicMaterial({ color: MAROON, depthTest: false }),
);
chiDot.renderOrder = 4;
app.scene.add(chiDot);

// --- time panel: drive (slate) + response (maroon) -----------------------

const tFrameZeroGeo = new THREE.BufferGeometry();
tFrameZeroGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3).setUsage(THREE.DynamicDrawUsage));
const tFrameZero = new THREE.Line(tFrameZeroGeo, frameMat);
app.scene.add(tFrameZero);

const driveGeometry = new THREE.BufferGeometry();
const drivePositions = new Float32Array(N_TIME * 3);
driveGeometry.setAttribute('position',
  new THREE.BufferAttribute(drivePositions, 3).setUsage(THREE.DynamicDrawUsage));
const driveLine = new THREE.Line(
  driveGeometry,
  new THREE.LineBasicMaterial({ color: SLATE_BLUE, depthTest: false }),
);
driveLine.renderOrder = 2;
app.scene.add(driveLine);

const responseMat = new LineMaterial({
  color: MAROON, linewidth: 2.5, worldUnits: false, depthTest: false,
});
function updateResponseResolution() {
  responseMat.resolution.set(window.innerWidth, window.innerHeight);
}
updateResponseResolution();
window.addEventListener('resize', updateResponseResolution);

const responsePositions = new Float32Array(N_TIME * 3);
const responseGeometry = new LineGeometry();
const responseLine = new Line2(responseGeometry, responseMat);
responseLine.renderOrder = 3;
app.scene.add(responseLine);

// --- params --------------------------------------------------------------

let gamma = 0.2;
let omega = 0.6;

let phasorXform: Transform = { scale: 1, xCenter: 0, yCenter: 0 };
const yMaxTime = 1.5;

function chiToWorld(re: number, im: number): [number, number] {
  return [
    PHASOR_CX + (re - phasorXform.xCenter) * phasorXform.scale,
    (im - phasorXform.yCenter) * phasorXform.scale,
  ];
}

function timeToWorld(t: number, x: number, tMax: number): [number, number] {
  const wx = T_CX + (t / tMax - 0.5) * TIME_W;
  const wy = (x / yMaxTime) * (TIME_H / 2);
  return [wx, wy];
}

// --- redraw helpers -------------------------------------------------------

function recomputePhasorTransform() {
  let xmin = 0, xmax = 1, ymin = 0, ymax = 0;
  for (let i = 0; i < N_TRACE; i++) {
    const w = W_MIN_TRACE + (W_MAX_TRACE - W_MIN_TRACE) * (i / (N_TRACE - 1));
    const c = chi(gamma, w);
    if (c.re < xmin) xmin = c.re;
    if (c.re > xmax) xmax = c.re;
    if (c.im < ymin) ymin = c.im;
    if (c.im > ymax) ymax = c.im;
  }
  // Always include χ-origin in view.
  xmin = Math.min(xmin, 0);
  xmax = Math.max(xmax, 0);
  ymin = Math.min(ymin, 0);
  ymax = Math.max(ymax, 0);
  const xRange = xmax - xmin;
  const yRange = ymax - ymin;
  const margin = 0.85;
  const scale = Math.min(margin * PHASOR_W / xRange, margin * PHASOR_H / yRange);
  phasorXform = { scale, xCenter: (xmin + xmax) / 2, yCenter: (ymin + ymax) / 2 };
}

function fillTrace() {
  for (let i = 0; i < N_TRACE; i++) {
    const w = W_MIN_TRACE + (W_MAX_TRACE - W_MIN_TRACE) * (i / (N_TRACE - 1));
    const c = chi(gamma, w);
    const [wx, wy] = chiToWorld(c.re, c.im);
    tracePts[i * 3 + 0] = wx;
    tracePts[i * 3 + 1] = wy;
    tracePts[i * 3 + 2] = 0;
  }
  traceGeometry.attributes.position.needsUpdate = true;
}

function fillPhasorAxes() {
  const halfW = PHASOR_W / 2;
  const halfH = PHASOR_H / 2;
  // Im axis: vertical line at χ-re = 0; clip to panel y-range.
  const [imAxX, imAxY0] = chiToWorld(0, 0);
  const reArr = (reAxisGeo.attributes.position.array as Float32Array);
  reArr[0] = PHASOR_CX - halfW; reArr[1] = imAxY0; reArr[2] = 0;
  reArr[3] = PHASOR_CX + halfW; reArr[4] = imAxY0; reArr[5] = 0;
  reAxisGeo.attributes.position.needsUpdate = true;
  const imArr = (imAxisGeo.attributes.position.array as Float32Array);
  imArr[0] = imAxX; imArr[1] = -halfH; imArr[2] = 0;
  imArr[3] = imAxX; imArr[4] =  halfH; imArr[5] = 0;
  imAxisGeo.attributes.position.needsUpdate = true;
}

function fillChiDot() {
  const c = chi(gamma, omega);
  const [wtx, wty] = chiToWorld(c.re, c.im);
  chiDot.position.set(wtx, wty, 0);
}

function fillTimeCurves() {
  const tMax = PERIODS_SHOWN * 2 * Math.PI / omega;
  const c = chi(gamma, omega);
  for (let i = 0; i < N_TIME; i++) {
    const t = (i / (N_TIME - 1)) * tMax;
    const drive = Math.cos(omega * t);
    const resp  = c.re * Math.cos(omega * t) + (-c.im) * Math.sin(omega * t);
    // x_ss(t) = Re(χ e^{iωt}) = Re(χ)cos(ωt) − Im(χ)sin(ωt). Here c.im is
    // negative for ω > 0, so −c.im is positive and the response visibly lags.
    const [wxd, wyd] = timeToWorld(t, drive, tMax);
    drivePositions[i * 3 + 0] = wxd;
    drivePositions[i * 3 + 1] = wyd;
    drivePositions[i * 3 + 2] = 0;
    const [wxr, wyr] = timeToWorld(t, resp, tMax);
    responsePositions[i * 3 + 0] = wxr;
    responsePositions[i * 3 + 1] = wyr;
    responsePositions[i * 3 + 2] = 0;
  }
  driveGeometry.attributes.position.needsUpdate = true;
  responseGeometry.setPositions(responsePositions);

  // Time-panel zero axis spans the full width.
  const zArr = (tFrameZeroGeo.attributes.position.array as Float32Array);
  zArr[0] = T_CX - TIME_W / 2; zArr[1] = 0; zArr[2] = 0;
  zArr[3] = T_CX + TIME_W / 2; zArr[4] = 0; zArr[5] = 0;
  tFrameZeroGeo.attributes.position.needsUpdate = true;
}

function redrawAll() {
  recomputePhasorTransform();
  fillTrace();
  fillPhasorAxes();
  fillChiDot();
  fillTimeCurves();
}

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
  autoplayingOmega = false;
  omega = parseFloat(omegaSlider.value);
  omegaReadout.textContent = omega.toFixed(2);
  redrawAll();
});

// --- ω autoplay: a slow sweep across [ω_lo, ω_hi] until the user grabs it ----

let autoplayingOmega = true;
let autoplayStart: number | null = null;
const OMEGA_LO = 0.2;
const OMEGA_HI = 2.5;
const OMEGA_AUTOPLAY_PERIOD = 16;  // seconds for a full back-and-forth

app.addAnimateCallback((time) => {
  if (!autoplayingOmega) return;
  if (autoplayStart === null) autoplayStart = time;
  const tau = time - autoplayStart;
  const phase = (2 * Math.PI / OMEGA_AUTOPLAY_PERIOD) * tau;
  omega = OMEGA_LO + (OMEGA_HI - OMEGA_LO) * (1 - Math.cos(phase)) / 2;
  omegaSlider.value = omega.toFixed(2);
  omegaReadout.textContent = omega.toFixed(2);
  redrawAll();
});

// --- panel label ---------------------------------------------------------

const phasorLabel = document.createElement('div');
phasorLabel.style.cssText =
  'position:fixed;color:#555;font:italic 16px/1 "Latin Modern Math", "Computer Modern", serif;' +
  'pointer-events:none;z-index:5;transform:translate(-50%, -100%);';
phasorLabel.textContent = 'χ(ω)';
document.body.appendChild(phasorLabel);

function updatePanelLabel() {
  const v = new THREE.Vector3(PHASOR_CX, PHASOR_H / 2, 0);
  v.project(app.camera);
  const x = (v.x + 1) / 2 * window.innerWidth;
  const y = (1 - v.y) / 2 * window.innerHeight;
  phasorLabel.style.left = `${x}px`;
  phasorLabel.style.top = `${y - 8}px`;
}
window.addEventListener('resize', updatePanelLabel);

// --- start ---------------------------------------------------------------

redrawAll();
app.start();
requestAnimationFrame(updatePanelLabel);
