/**
 * oscillator-duffing-absorption — the absorption spectrum P_abs(ω) for the
 * driven damped Duffing oscillator
 *
 *   ẍ + 2γẋ + x + εx³ = cos(ω t),    P_abs(ω) = ⟨2γẋ²⟩.
 *
 * Dashed: linear (ε=0) Lorentzian, analytic — shows just the primary peak
 *   at ω = 1.
 * Solid: full nonlinear P_abs, computed numerically by integrating from rest
 *   long enough to kill transients (γMT ≥ 40), then time-averaging 2γẋ²
 *   over one drive period. Built up live, point by point, as ω sweeps.
 *
 * On a log y-scale, new peaks appear at ω ≈ 1/k for odd k = 3, 5, 7 — these
 * are the *superharmonic resonances*: the response's k-th Fourier component
 * (at frequency kω) hits the linear resonance when kω = 1, amplifying the
 * energy throughput. Each new peak grows with ε; the dashed Lorentzian
 * is recovered as ε → 0.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

// --- palette ---------------------------------------------------------------

const BG          = 0xF0EDE8;
const RUST        = 0xA8521F;
const FRAME_COLOR = 0x8FA3B5;

// --- layout ---------------------------------------------------------------

const PLOT_W  = 8.0;
const PLOT_H  = 4.0;
const PLOT_CX = 0;
const PLOT_CY = 0;

const W_MIN = 0.08;
const W_MAX = 2.0;

const LOG_FLOOR = -3.0;
const LOG_TOP   =  0.5;

const N_OMEGA = 300;        // sweep resolution
const N_PERIOD = 256;       // samples per drive period for time-averaging
const TARGET_DT = 0.01;     // upper bound on RK4 step

const CHUNK = 2;            // ω points computed per animation frame

// --- coordinate maps ------------------------------------------------------

function omegaToX(w: number): number {
  return PLOT_CX + ((w - W_MIN) / (W_MAX - W_MIN) - 0.5) * PLOT_W;
}

function logPabsToY(logP: number): number {
  const y = Math.max(LOG_FLOOR, Math.min(LOG_TOP, logP));
  return (PLOT_CY - PLOT_H / 2) + (y - LOG_FLOOR) / (LOG_TOP - LOG_FLOOR) * PLOT_H;
}

// --- inline RK4 step ------------------------------------------------------

function rk4Step(x: number, v: number, t: number, dt: number): [number, number] {
  const half = 0.5 * dt;
  const k1x = v;
  const k1v = -2 * gamma * v - x - eps * x * x * x + Math.cos(omegaCur * t);
  const x2 = x + half * k1x, v2 = v + half * k1v;
  const k2x = v2;
  const k2v = -2 * gamma * v2 - x2 - eps * x2 * x2 * x2 + Math.cos(omegaCur * (t + half));
  const x3 = x + half * k2x, v3 = v + half * k2v;
  const k3x = v3;
  const k3v = -2 * gamma * v3 - x3 - eps * x3 * x3 * x3 + Math.cos(omegaCur * (t + half));
  const x4 = x + dt * k3x, v4 = v + dt * k3v;
  const k4x = v4;
  const k4v = -2 * gamma * v4 - x4 - eps * x4 * x4 * x4 + Math.cos(omegaCur * (t + dt));
  return [
    x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x),
    v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v),
  ];
}

// --- numerical P_abs at one ω ---------------------------------------------

let omegaCur = 0;  // global accessed by rk4Step (avoids reallocating closure each call)

function computeNonlinearPabs(w: number): number {
  omegaCur = w;
  const T = 2 * Math.PI / w;
  const sampleDt = T / N_PERIOD;
  const subSteps = Math.max(1, Math.ceil(sampleDt / TARGET_DT));
  const intDt = sampleDt / subSteps;
  const M = Math.max(20, Math.ceil(40 / (gamma * T)));

  let x = 0, v = 0, t = 0;
  // Transient — run M*N_PERIOD recorded sample intervals × subSteps RK4 each
  for (let i = 0; i < M * N_PERIOD; i++) {
    for (let s = 0; s < subSteps; s++) {
      [x, v] = rk4Step(x, v, t, intDt);
      t += intDt;
    }
  }
  // Time-average ẋ² over one period (trapezoid rule on N_PERIOD samples).
  let sum = 0;
  for (let i = 0; i < N_PERIOD; i++) {
    sum += v * v;
    for (let s = 0; s < subSteps; s++) {
      [x, v] = rk4Step(x, v, t, intDt);
      t += intDt;
    }
  }
  return 2 * gamma * sum / N_PERIOD;
}

// --- linear P_abs (analytic) ----------------------------------------------

function pAbsLinear(g: number, w: number): number {
  const D = (1 - w * w) ** 2 + 4 * g * g * w * w;
  return g * w * w / D;
}

// --- scene ----------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 12);
app.camera.fov = 30;
app.camera.updateProjectionMatrix();
app.controls.target.set(0, 0, 0);
app.controls.controls.enabled = false;
app.backgrounds.setColor(BG);

// --- frame + grid ---------------------------------------------------------

const frameMat = new THREE.LineBasicMaterial({ color: FRAME_COLOR });

const frameGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(PLOT_CX - PLOT_W / 2, PLOT_CY - PLOT_H / 2, 0),
  new THREE.Vector3(PLOT_CX + PLOT_W / 2, PLOT_CY - PLOT_H / 2, 0),
  new THREE.Vector3(PLOT_CX + PLOT_W / 2, PLOT_CY + PLOT_H / 2, 0),
  new THREE.Vector3(PLOT_CX - PLOT_W / 2, PLOT_CY + PLOT_H / 2, 0),
]);
app.scene.add(new THREE.LineLoop(frameGeo, frameMat));

// Faint horizontal grid at log P = 0, -2, -4
const guideMat = new THREE.LineBasicMaterial({
  color: FRAME_COLOR, transparent: true, opacity: 0.35,
});
for (const logL of [0, -1, -2]) {
  const y = logPabsToY(logL);
  const g = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(PLOT_CX - PLOT_W / 2, y, 0),
    new THREE.Vector3(PLOT_CX + PLOT_W / 2, y, 0),
  ]);
  app.scene.add(new THREE.Line(g, guideMat));
}

// Faint vertical guides at ω = 1, 1/3, 1/5, 1/7
for (const wG of [1, 1/3, 1/5, 1/7]) {
  if (wG < W_MIN || wG > W_MAX) continue;
  const x = omegaToX(wG);
  const g = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x, PLOT_CY - PLOT_H / 2, 0),
    new THREE.Vector3(x, PLOT_CY + PLOT_H / 2, 0),
  ]);
  app.scene.add(new THREE.Line(g, guideMat));
}

// --- linear (dashed) curve ------------------------------------------------

const linearMat = new THREE.LineDashedMaterial({
  color: RUST, dashSize: 0.12, gapSize: 0.08, depthTest: false,
});

const linearPositions = new Float32Array(N_OMEGA * 3);
const linearGeo = new THREE.BufferGeometry();
linearGeo.setAttribute('position',
  new THREE.BufferAttribute(linearPositions, 3).setUsage(THREE.DynamicDrawUsage));
const linearLine = new THREE.Line(linearGeo, linearMat);
linearLine.renderOrder = 2;
app.scene.add(linearLine);

// --- nonlinear (solid) curve, live-filled --------------------------------

const nonlinearMat = new LineMaterial({
  color: RUST, linewidth: 2.5, worldUnits: false, depthTest: false,
});
function updateLineResolution() {
  nonlinearMat.resolution.set(window.innerWidth, window.innerHeight);
}
updateLineResolution();
window.addEventListener('resize', updateLineResolution);

const nonlinearPositions = new Float32Array(N_OMEGA * 3);
const nonlinearGeo = new LineGeometry();
const nonlinearLine = new Line2(nonlinearGeo, nonlinearMat);
nonlinearLine.renderOrder = 3;
app.scene.add(nonlinearLine);

// --- params --------------------------------------------------------------

let gamma = 0.3;
let eps   = 0.1;

// Pre-allocated sweep buffers
const omegaValues = new Float32Array(N_OMEGA);
for (let i = 0; i < N_OMEGA; i++) {
  omegaValues[i] = W_MIN + (W_MAX - W_MIN) * (i / (N_OMEGA - 1));
}
const nonlinearPabs = new Float32Array(N_OMEGA);

let sweepIdx = 0;  // next index to compute

// --- redraw helpers -------------------------------------------------------

function rebuildLinear() {
  for (let i = 0; i < N_OMEGA; i++) {
    const w = omegaValues[i];
    const p = pAbsLinear(gamma, w);
    const logP = p > 0 ? Math.log10(p) : LOG_FLOOR;
    linearPositions[i * 3 + 0] = omegaToX(w);
    linearPositions[i * 3 + 1] = logPabsToY(logP);
    linearPositions[i * 3 + 2] = 0;
  }
  linearGeo.attributes.position.needsUpdate = true;
  linearLine.computeLineDistances();
}

function refreshNonlinearLine() {
  // Hide the line entirely until at least one point is computed — otherwise
  // we'd flash the previous curve's stale data while the new sweep starts.
  if (sweepIdx < 2) {
    nonlinearLine.visible = false;
    return;
  }
  nonlinearLine.visible = true;
  // Positions for i ≥ sweepIdx repeat the last computed point so the Line2
  // appears to "stop" at sweepIdx-1 with a degenerate tail.
  for (let i = 0; i < N_OMEGA; i++) {
    const idx = Math.min(i, sweepIdx - 1);
    const w = omegaValues[idx];
    const p = nonlinearPabs[idx];
    const logP = p > 0 ? Math.log10(p) : LOG_FLOOR;
    nonlinearPositions[i * 3 + 0] = omegaToX(w);
    nonlinearPositions[i * 3 + 1] = logPabsToY(logP);
    nonlinearPositions[i * 3 + 2] = 0;
  }
  nonlinearGeo.setPositions(nonlinearPositions);
}

function restartSweep() {
  sweepIdx = 0;
  refreshNonlinearLine();
}

// --- live-fill in animation loop -----------------------------------------

app.addAnimateCallback(() => {
  if (sweepIdx >= N_OMEGA) return;
  const end = Math.min(sweepIdx + CHUNK, N_OMEGA);
  for (let i = sweepIdx; i < end; i++) {
    nonlinearPabs[i] = computeNonlinearPabs(omegaValues[i]);
  }
  sweepIdx = end;
  refreshNonlinearLine();
});

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
    <span class="label">ε</span>
    <input id="osc-eps" type="range" class="thin-slider" min="0" max="1" step="0.01" value="${eps}" />
    <span class="value" id="osc-eps-v">${eps.toFixed(2)}</span>
  </div>
`;
document.body.appendChild(sliderWrap);

const gammaSlider = sliderWrap.querySelector<HTMLInputElement>('#osc-gamma')!;
const epsSlider   = sliderWrap.querySelector<HTMLInputElement>('#osc-eps')!;
const gammaReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-gamma-v')!;
const epsReadout   = sliderWrap.querySelector<HTMLSpanElement>('#osc-eps-v')!;

function onParamsChanged() {
  rebuildLinear();
  restartSweep();
}

gammaSlider.addEventListener('input', () => {
  gamma = parseFloat(gammaSlider.value);
  gammaReadout.textContent = gamma.toFixed(2);
  onParamsChanged();
});

epsSlider.addEventListener('input', () => {
  eps = parseFloat(epsSlider.value);
  epsReadout.textContent = eps.toFixed(2);
  onParamsChanged();
});

// --- start ---------------------------------------------------------------

rebuildLinear();
refreshNonlinearLine();
restartSweep();
app.start();
