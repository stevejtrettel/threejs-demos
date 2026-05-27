/**
 * oscillator-quadratic-absorption — absorption spectrum P_abs(ω)
 * for the driven damped quadratic oscillator.
 *
 *   ẍ + 2γẋ + x + ε x² = cos(ω t),    P_abs(ω) = ⟨2γẋ²⟩.
 *
 * The quadratic nonlinearity breaks x → −x symmetry: even-k Fourier
 * coefficients become nonzero, and absorption peaks appear at *every*
 * integer fraction ω = 1, 1/2, 1/3, 1/4, 1/5, … (the cubic case had
 * only odd fractions).
 *
 * Caveat: V = x²/2 + εx³/3 is not bounded below — trajectories escape if
 * amplitude exceeds 1/ε. The ε slider is capped at 0.3 to keep things
 * bounded at γ = 0.3 default.
 *
 * Dashed: linear (ε=0) Lorentzian, analytic.
 * Solid: full nonlinear P_abs, computed by RK4-from-rest, transient
 * decay, then time-averaged 2γẋ² over one drive period. Built up live
 * point-by-point.
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

const N_OMEGA = 300;
const N_PERIOD = 256;
const TARGET_DT = 0.01;

const CHUNK = 2;

// Subharmonic peaks expected at ω = 1/k for ALL integer k (asymmetric case)
const PEAK_KS = [1, 2, 3, 4, 5, 6];

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
  const k1v = -2 * gamma * v - x - eps * x * x + driveAmp * Math.cos(omegaCur * t);
  const x2 = x + half * k1x, v2 = v + half * k1v;
  const k2x = v2;
  const k2v = -2 * gamma * v2 - x2 - eps * x2 * x2 + driveAmp * Math.cos(omegaCur * (t + half));
  const x3 = x + half * k2x, v3 = v + half * k2v;
  const k3x = v3;
  const k3v = -2 * gamma * v3 - x3 - eps * x3 * x3 + driveAmp * Math.cos(omegaCur * (t + half));
  const x4 = x + dt * k3x, v4 = v + dt * k3v;
  const k4x = v4;
  const k4v = -2 * gamma * v4 - x4 - eps * x4 * x4 + driveAmp * Math.cos(omegaCur * (t + dt));
  return [
    x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x),
    v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v),
  ];
}

// --- numerical P_abs at one ω ---------------------------------------------

let omegaCur = 0;

// Continuation: between adjacent ω evaluations in a sweep, carry the final
// state forward as the next IC. Smooths multistability flicker by tracking
// one branch. Resets to "from rest" at the start of each sweep.
let prevX = 0, prevV = 0;
let havePrevState = false;

const N_AVG_PERIODS = 4;  // periods over which to time-average ẋ²

function computeNonlinearPabs(w: number): number {
  omegaCur = w;
  const T = 2 * Math.PI / w;
  const sampleDt = T / N_PERIOD;
  const subSteps = Math.max(1, Math.ceil(sampleDt / TARGET_DT));
  const intDt = sampleDt / subSteps;
  const M = Math.max(20, Math.ceil(40 / (gamma * T)));

  let x = havePrevState ? prevX : 0;
  let v = havePrevState ? prevV : 0;
  let t = 0;

  for (let i = 0; i < M * N_PERIOD; i++) {
    for (let s = 0; s < subSteps; s++) {
      [x, v] = rk4Step(x, v, t, intDt);
      t += intDt;
    }
    // Bail out if trajectory has escaped (potential is unbounded below).
    if (!isFinite(x) || Math.abs(x) > 1e3) {
      havePrevState = false;  // can't continue from a diverged state
      return NaN;
    }
  }

  // Time-average over N_AVG_PERIODS periods.
  const totalSamples = N_AVG_PERIODS * N_PERIOD;
  let sum = 0;
  for (let i = 0; i < totalSamples; i++) {
    sum += v * v;
    for (let s = 0; s < subSteps; s++) {
      [x, v] = rk4Step(x, v, t, intDt);
      t += intDt;
    }
  }

  prevX = x;
  prevV = v;
  havePrevState = true;

  return 2 * gamma * sum / totalSamples;
}

// --- linear P_abs (analytic) ----------------------------------------------

function pAbsLinear(g: number, w: number): number {
  const D = (1 - w * w) ** 2 + 4 * g * g * w * w;
  return driveAmp * driveAmp * g * w * w / D;
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

const guideMat = new THREE.LineBasicMaterial({
  color: FRAME_COLOR, transparent: true, opacity: 0.35,
});

// Faint horizontal grid at log P = 0, -1, -2
for (const logL of [0, -1, -2]) {
  const y = logPabsToY(logL);
  const g = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(PLOT_CX - PLOT_W / 2, y, 0),
    new THREE.Vector3(PLOT_CX + PLOT_W / 2, y, 0),
  ]);
  app.scene.add(new THREE.Line(g, guideMat));
}

// Vertical guides at ω = 1/k for all expected resonances
for (const k of PEAK_KS) {
  const wG = 1 / k;
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

// --- gray bars over NaN (escape) regions ---------------------------------

const MAX_NAN_REGIONS = 20;
const nanBars: THREE.Mesh[] = [];
{
  const sharedGeo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < MAX_NAN_REGIONS; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: FRAME_COLOR, transparent: true, opacity: 0.22,
      depthTest: false, depthWrite: false,
    });
    const mesh = new THREE.Mesh(sharedGeo, mat);
    mesh.visible = false;
    mesh.renderOrder = 4;
    app.scene.add(mesh);
    nanBars.push(mesh);
  }
}

// --- params --------------------------------------------------------------

let gamma = 0.3;
let eps = 0.1;
const driveAmp = 1.0;

const omegaValues = new Float32Array(N_OMEGA);
for (let i = 0; i < N_OMEGA; i++) {
  omegaValues[i] = W_MIN + (W_MAX - W_MIN) * (i / (N_OMEGA - 1));
}
const nonlinearPabs = new Float32Array(N_OMEGA);

let sweepIdx = 0;

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

function updateNanBars() {
  if (sweepIdx < 1) {
    for (const b of nanBars) b.visible = false;
    return;
  }
  const yCenter = PLOT_CY;
  const yHeight = PLOT_H;
  const dW = (W_MAX - W_MIN) / (N_OMEGA - 1);

  let regionStart: number | null = null;
  let regionIndex = 0;

  const commitRegion = (start: number, end: number) => {
    if (regionIndex >= MAX_NAN_REGIONS) return;
    const xLeft = omegaToX(omegaValues[start] - dW * 0.5);
    const xRight = omegaToX(omegaValues[end] + dW * 0.5);
    const wWorld = xRight - xLeft;
    const xCenter = (xLeft + xRight) / 2;
    nanBars[regionIndex].position.set(xCenter, yCenter, 0);
    nanBars[regionIndex].scale.set(wWorld, yHeight, 1);
    nanBars[regionIndex].visible = true;
    regionIndex++;
  };

  for (let i = 0; i < sweepIdx; i++) {
    const isNan = Number.isNaN(nonlinearPabs[i]);
    if (isNan && regionStart === null) regionStart = i;
    else if (!isNan && regionStart !== null) {
      commitRegion(regionStart, i - 1);
      regionStart = null;
    }
  }
  if (regionStart !== null) commitRegion(regionStart, sweepIdx - 1);

  for (let i = regionIndex; i < MAX_NAN_REGIONS; i++) {
    nanBars[i].visible = false;
  }
}

function refreshNonlinearLine() {
  if (sweepIdx < 2) {
    nonlinearLine.visible = false;
    updateNanBars();
    return;
  }
  nonlinearLine.visible = true;

  // For the degenerate tail past sweepIdx, use the last computed *valid* (non-NaN)
  // point so the line doesn't drag NaN positions forward.
  let lastValidIdx = -1;
  for (let i = sweepIdx - 1; i >= 0; i--) {
    if (!Number.isNaN(nonlinearPabs[i])) { lastValidIdx = i; break; }
  }

  for (let i = 0; i < N_OMEGA; i++) {
    let p: number, w: number;
    if (i < sweepIdx) {
      p = nonlinearPabs[i];
      w = omegaValues[i];
    } else if (lastValidIdx >= 0) {
      p = nonlinearPabs[lastValidIdx];
      w = omegaValues[lastValidIdx];
    } else {
      p = NaN;
      w = omegaValues[i];
    }

    if (Number.isNaN(p)) {
      // Break the line: NaN positions are skipped/hidden by the shader, leaving a gap.
      nonlinearPositions[i * 3 + 0] = NaN;
      nonlinearPositions[i * 3 + 1] = NaN;
      nonlinearPositions[i * 3 + 2] = NaN;
    } else {
      const logP = (p > 0 && isFinite(p)) ? Math.log10(p) : LOG_FLOOR;
      nonlinearPositions[i * 3 + 0] = omegaToX(w);
      nonlinearPositions[i * 3 + 1] = logPabsToY(logP);
      nonlinearPositions[i * 3 + 2] = 0;
    }
  }
  nonlinearGeo.setPositions(nonlinearPositions);
  updateNanBars();
}

function restartSweep() {
  sweepIdx = 0;
  havePrevState = false;
  refreshNonlinearLine();
}

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
  .osc-controls { position: fixed; left: 50%; bottom: 38px; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; pointer-events: auto; z-index: 10; }
  .equation-label { position: fixed; left: 50%; top: 32px; transform: translateX(-50%); color: #333; font: 18px/1.2 monospace; letter-spacing: 0; pointer-events: none; z-index: 10; white-space: nowrap; }
  .equation-label .title { margin-right: 18px; color: #666; font-size: 14px; }
  .equation-label .var { font-style: italic; }
  .axis-label { position: fixed; left: 50%; bottom: 92px; transform: translateX(-50%); color: #666; font: 14px/1 monospace; pointer-events: none; z-index: 10; }
`;
document.head.appendChild(sliderStyle);

const equationLabel = document.createElement('div');
equationLabel.className = 'equation-label';
equationLabel.innerHTML =
  '<span class="title">absorption</span>' +
  '<span class="var">x</span>\u2033 + 2\u03b3<span class="var">x</span>\u2032 + ' +
  '<span class="var">x</span> + \u03b5<span class="var">x</span>\u00b2 = ' +
  'cos(\u03c9<span class="var">t</span>)';
document.body.appendChild(equationLabel);

const omegaAxisLabel = document.createElement('div');
omegaAxisLabel.className = 'axis-label';
omegaAxisLabel.textContent = '\u03c9';
document.body.appendChild(omegaAxisLabel);

const sliderWrap = document.createElement('div');
sliderWrap.className = 'osc-controls';
sliderWrap.innerHTML = `
  <div class="osc-row">
    <span class="label">γ</span>
    <input id="osc-gamma" type="range" class="thin-slider" min="0.05" max="1.5" step="0.01" value="${gamma}" />
    <span class="value" id="osc-gamma-v">${gamma.toFixed(2)}</span>
  </div>
  <div class="osc-row">
    <span class="label">ε</span>
    <input id="osc-eps" type="range" class="thin-slider" min="0" max="0.3" step="0.005" value="${eps}" />
    <span class="value" id="osc-eps-v">${eps.toFixed(2)}</span>
  </div>
`;
document.body.appendChild(sliderWrap);

const gammaSlider = sliderWrap.querySelector<HTMLInputElement>('#osc-gamma')!;
const epsSlider = sliderWrap.querySelector<HTMLInputElement>('#osc-eps')!;
const gammaReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-gamma-v')!;
const epsReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-eps-v')!;

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
