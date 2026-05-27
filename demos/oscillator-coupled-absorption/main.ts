/**
 * oscillator-coupled-absorption — absorption spectrum P_abs(Omega) for the
 * coupled, damped, driven anharmonic system.
 *
 *   V(x_1, x_2) = 1/2 omega_1^2 x_1^2 + 1/2 omega_2^2 x_2^2 + epsilon x_1^2 x_2
 *   x_i'' + 2 gamma x_i' + d V / d x_i = A cos(Omega t)        (i = 1, 2)
 *
 * Both oscillators dissipate energy, so total absorbed power averaged over
 * one drive period is
 *
 *   P_abs(Omega) = < 2 gamma (x_1'^2 + x_2'^2) >.
 *
 * Dashed: epsilon = 0 baseline, computed analytically as the sum of the two
 * uncoupled Lorentzians,
 *
 *   P_abs_lin(Omega) = gamma A^2 Omega^2 ( |chi_1|^2 + |chi_2|^2 ),
 *   |chi_i|^2 = 1 / ( (omega_i^2 - Omega^2)^2 + 4 gamma^2 Omega^2 ).
 *
 * Solid: full nonlinear P_abs, RK4 from rest, settle, time-average over four
 * drive periods, swept Omega point-by-point with continuation. Trajectories
 * that escape (the cubic term makes V unbounded below) leave a faint gray
 * bar over the affected Omega band.
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

const W_MIN = 0.10;
const W_MAX = 3.00;

const LOG_FLOOR = -3.0;
const LOG_TOP   =  1.5;

const N_OMEGA = 300;
const N_PERIOD = 256;
const TARGET_DT = 0.01;
const N_AVG_PERIODS = 4;
const ESCAPE_LIMIT = 1e3;

const CHUNK = 2;

// --- coordinate maps ------------------------------------------------------

function omegaToX(w: number): number {
  return PLOT_CX + ((w - W_MIN) / (W_MAX - W_MIN) - 0.5) * PLOT_W;
}

function logPabsToY(logP: number): number {
  const y = Math.max(LOG_FLOOR, Math.min(LOG_TOP, logP));
  return (PLOT_CY - PLOT_H / 2) + (y - LOG_FLOOR) / (LOG_TOP - LOG_FLOOR) * PLOT_H;
}

// --- params --------------------------------------------------------------

let gamma  = 0.15;
let eps    = 0.15;
let omega1 = 1.0;
let omega2 = 1.4;
const driveAmp = 1.0;

// --- inline RK4 step (4-state) -------------------------------------------

let omegaCur = 0;

function rk4Step(
  x1: number, v1: number, x2: number, v2: number, t: number, dt: number,
): [number, number, number, number] {
  const half = 0.5 * dt;

  const drive0 = driveAmp * Math.cos(omegaCur * t);
  const k1x1 = v1;
  const k1v1 = -2 * gamma * v1 - omega1 * omega1 * x1 - 2 * eps * x1 * x2 + drive0;
  const k1x2 = v2;
  const k1v2 = -2 * gamma * v2 - omega2 * omega2 * x2 - eps * x1 * x1     + drive0;

  const x1b = x1 + half * k1x1, v1b = v1 + half * k1v1;
  const x2b = x2 + half * k1x2, v2b = v2 + half * k1v2;
  const driveH = driveAmp * Math.cos(omegaCur * (t + half));
  const k2x1 = v1b;
  const k2v1 = -2 * gamma * v1b - omega1 * omega1 * x1b - 2 * eps * x1b * x2b + driveH;
  const k2x2 = v2b;
  const k2v2 = -2 * gamma * v2b - omega2 * omega2 * x2b - eps * x1b * x1b     + driveH;

  const x1c = x1 + half * k2x1, v1c = v1 + half * k2v1;
  const x2c = x2 + half * k2x2, v2c = v2 + half * k2v2;
  const k3x1 = v1c;
  const k3v1 = -2 * gamma * v1c - omega1 * omega1 * x1c - 2 * eps * x1c * x2c + driveH;
  const k3x2 = v2c;
  const k3v2 = -2 * gamma * v2c - omega2 * omega2 * x2c - eps * x1c * x1c     + driveH;

  const x1d = x1 + dt * k3x1, v1d = v1 + dt * k3v1;
  const x2d = x2 + dt * k3x2, v2d = v2 + dt * k3v2;
  const driveF = driveAmp * Math.cos(omegaCur * (t + dt));
  const k4x1 = v1d;
  const k4v1 = -2 * gamma * v1d - omega1 * omega1 * x1d - 2 * eps * x1d * x2d + driveF;
  const k4x2 = v2d;
  const k4v2 = -2 * gamma * v2d - omega2 * omega2 * x2d - eps * x1d * x1d     + driveF;

  return [
    x1 + (dt / 6) * (k1x1 + 2 * k2x1 + 2 * k3x1 + k4x1),
    v1 + (dt / 6) * (k1v1 + 2 * k2v1 + 2 * k3v1 + k4v1),
    x2 + (dt / 6) * (k1x2 + 2 * k2x2 + 2 * k3x2 + k4x2),
    v2 + (dt / 6) * (k1v2 + 2 * k2v2 + 2 * k3v2 + k4v2),
  ];
}

// --- continuation state ---------------------------------------------------

let prevX1 = 0, prevV1 = 0, prevX2 = 0, prevV2 = 0;
let havePrevState = false;

// --- numerical P_abs at one Omega -----------------------------------------

function computeNonlinearPabs(w: number): number {
  omegaCur = w;
  const T = 2 * Math.PI / w;
  const sampleDt = T / N_PERIOD;
  const subSteps = Math.max(1, Math.ceil(sampleDt / TARGET_DT));
  const intDt = sampleDt / subSteps;
  const M = Math.max(20, Math.ceil(40 / (gamma * T)));

  let x1 = havePrevState ? prevX1 : 0;
  let v1 = havePrevState ? prevV1 : 0;
  let x2 = havePrevState ? prevX2 : 0;
  let v2 = havePrevState ? prevV2 : 0;
  let t  = 0;

  for (let i = 0; i < M * N_PERIOD; i++) {
    for (let s = 0; s < subSteps; s++) {
      [x1, v1, x2, v2] = rk4Step(x1, v1, x2, v2, t, intDt);
      t += intDt;
    }
    if (!isFinite(x1) || !isFinite(x2) ||
        Math.abs(x1) > ESCAPE_LIMIT || Math.abs(x2) > ESCAPE_LIMIT) {
      havePrevState = false;
      return NaN;
    }
  }

  // Time-average <2 gamma (v1^2 + v2^2)> over N_AVG_PERIODS periods.
  const totalSamples = N_AVG_PERIODS * N_PERIOD;
  let sum = 0;
  for (let i = 0; i < totalSamples; i++) {
    sum += v1 * v1 + v2 * v2;
    for (let s = 0; s < subSteps; s++) {
      [x1, v1, x2, v2] = rk4Step(x1, v1, x2, v2, t, intDt);
      t += intDt;
    }
    if (!isFinite(x1) || !isFinite(x2) ||
        Math.abs(x1) > ESCAPE_LIMIT || Math.abs(x2) > ESCAPE_LIMIT) {
      havePrevState = false;
      return NaN;
    }
  }

  prevX1 = x1; prevV1 = v1; prevX2 = x2; prevV2 = v2;
  havePrevState = true;

  return 2 * gamma * sum / totalSamples;
}

// --- linear (epsilon = 0) absorption, analytic ----------------------------

function pAbsLinear(w: number): number {
  const w2 = w * w;
  const D1 = (omega1 * omega1 - w2) ** 2 + 4 * gamma * gamma * w2;
  const D2 = (omega2 * omega2 - w2) ** 2 + 4 * gamma * gamma * w2;
  return driveAmp * driveAmp * gamma * w2 * (1 / D1 + 1 / D2);
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
  color: FRAME_COLOR, transparent: true, opacity: 0.30,
});

// horizontal grid lines at log P = 1, 0, -1, -2
for (const logL of [1, 0, -1, -2]) {
  if (logL < LOG_FLOOR || logL > LOG_TOP) continue;
  const y = logPabsToY(logL);
  const g = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(PLOT_CX - PLOT_W / 2, y, 0),
    new THREE.Vector3(PLOT_CX + PLOT_W / 2, y, 0),
  ]);
  app.scene.add(new THREE.Line(g, guideMat));
}

// vertical guides at Omega = omega_1, omega_2 — updated when sliders move
const peakGuideMat = new THREE.LineBasicMaterial({
  color: FRAME_COLOR, transparent: true, opacity: 0.55,
});

function makePeakGuide(): THREE.Line {
  const g = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, PLOT_CY - PLOT_H / 2, 0),
    new THREE.Vector3(0, PLOT_CY + PLOT_H / 2, 0),
  ]);
  const line = new THREE.Line(g, peakGuideMat);
  app.scene.add(line);
  return line;
}

const peakGuide1 = makePeakGuide();
const peakGuide2 = makePeakGuide();

function updatePeakGuides() {
  const place = (line: THREE.Line, w: number) => {
    if (w < W_MIN || w > W_MAX) { line.visible = false; return; }
    line.visible = true;
    const x = omegaToX(w);
    const pos = line.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, x, PLOT_CY - PLOT_H / 2, 0);
    pos.setXYZ(1, x, PLOT_CY + PLOT_H / 2, 0);
    pos.needsUpdate = true;
  };
  place(peakGuide1, omega1);
  place(peakGuide2, omega2);
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

// --- sweep state ----------------------------------------------------------

const omegaValues = new Float32Array(N_OMEGA);
for (let i = 0; i < N_OMEGA; i++) {
  omegaValues[i] = W_MIN + (W_MAX - W_MIN) * (i / (N_OMEGA - 1));
}
const nonlinearPabs = new Float32Array(N_OMEGA);

let sweepIdx = 0;

function rebuildLinear() {
  for (let i = 0; i < N_OMEGA; i++) {
    const w = omegaValues[i];
    const p = pAbsLinear(w);
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
  .osc-row .label { width: 22px; text-align: right; }
  .osc-row .value { width: 40px; color: #666; font-size: 12px; }
  .osc-controls { position: fixed; left: 50%; bottom: 38px; transform: translateX(-50%); display: grid; grid-template-columns: max-content max-content; column-gap: 30px; row-gap: 8px; pointer-events: auto; z-index: 10; }
  .equation-label { position: fixed; left: 50%; top: 32px; transform: translateX(-50%); color: #333; font: 18px/1.2 monospace; letter-spacing: 0; pointer-events: none; z-index: 10; white-space: nowrap; }
  .equation-label .title { margin-right: 18px; color: #666; font-size: 14px; }
  .equation-label .var { font-style: italic; }
  .equation-label sub { font-size: 0.75em; }
  .axis-label { position: fixed; left: 50%; bottom: 158px; transform: translateX(-50%); color: #666; font: italic 14px/1 monospace; pointer-events: none; z-index: 10; }
`;
document.head.appendChild(sliderStyle);

const equationLabel = document.createElement('div');
equationLabel.className = 'equation-label';
equationLabel.innerHTML =
  '<span class="title">absorption</span>' +
  '<span class="var">x</span>″<sub>i</sub> + ' +
  '2γ<span class="var">x</span>′<sub>i</sub> + ' +
  '∂<sub>i</sub><span class="var">V</span> = ' +
  'cos(Ω<span class="var">t</span>)';
document.body.appendChild(equationLabel);

const omegaAxisLabel = document.createElement('div');
omegaAxisLabel.className = 'axis-label';
omegaAxisLabel.textContent = 'Ω';
document.body.appendChild(omegaAxisLabel);

const sliderWrap = document.createElement('div');
sliderWrap.className = 'osc-controls';
sliderWrap.innerHTML = `
  <div class="osc-row">
    <span class="label">ω₁</span>
    <input id="osc-omega1" type="range" class="thin-slider" min="0.3" max="2.5" step="0.01" value="${omega1}" />
    <span class="value" id="osc-omega1-v">${omega1.toFixed(2)}</span>
  </div>
  <div class="osc-row">
    <span class="label">ω₂</span>
    <input id="osc-omega2" type="range" class="thin-slider" min="0.3" max="2.5" step="0.01" value="${omega2}" />
    <span class="value" id="osc-omega2-v">${omega2.toFixed(2)}</span>
  </div>
  <div class="osc-row">
    <span class="label">γ</span>
    <input id="osc-gamma" type="range" class="thin-slider" min="0.01" max="1.0" step="0.01" value="${gamma}" />
    <span class="value" id="osc-gamma-v">${gamma.toFixed(2)}</span>
  </div>
  <div class="osc-row">
    <span class="label">ε</span>
    <input id="osc-eps" type="range" class="thin-slider" min="0" max="0.5" step="0.005" value="${eps}" />
    <span class="value" id="osc-eps-v">${eps.toFixed(3)}</span>
  </div>
`;
document.body.appendChild(sliderWrap);

const omega1Slider = sliderWrap.querySelector<HTMLInputElement>('#osc-omega1')!;
const omega2Slider = sliderWrap.querySelector<HTMLInputElement>('#osc-omega2')!;
const gammaSlider  = sliderWrap.querySelector<HTMLInputElement>('#osc-gamma')!;
const epsSlider    = sliderWrap.querySelector<HTMLInputElement>('#osc-eps')!;
const omega1Read   = sliderWrap.querySelector<HTMLSpanElement>('#osc-omega1-v')!;
const omega2Read   = sliderWrap.querySelector<HTMLSpanElement>('#osc-omega2-v')!;
const gammaRead    = sliderWrap.querySelector<HTMLSpanElement>('#osc-gamma-v')!;
const epsRead      = sliderWrap.querySelector<HTMLSpanElement>('#osc-eps-v')!;

function onParamsChanged() {
  rebuildLinear();
  updatePeakGuides();
  restartSweep();
}

omega1Slider.addEventListener('input', () => {
  omega1 = parseFloat(omega1Slider.value);
  omega1Read.textContent = omega1.toFixed(2);
  onParamsChanged();
});
omega2Slider.addEventListener('input', () => {
  omega2 = parseFloat(omega2Slider.value);
  omega2Read.textContent = omega2.toFixed(2);
  onParamsChanged();
});
gammaSlider.addEventListener('input', () => {
  gamma = parseFloat(gammaSlider.value);
  gammaRead.textContent = gamma.toFixed(2);
  onParamsChanged();
});
epsSlider.addEventListener('input', () => {
  eps = parseFloat(epsSlider.value);
  epsRead.textContent = eps.toFixed(3);
  onParamsChanged();
});

// --- start ---------------------------------------------------------------

rebuildLinear();
updatePeakGuides();
refreshNonlinearLine();
restartSweep();
app.start();
