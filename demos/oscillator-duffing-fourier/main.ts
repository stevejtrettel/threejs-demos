/**
 * oscillator-duffing-fourier — the steady state x_ss(t) of the Duffing
 * oscillator and its Fourier-series content on a log scale.
 *
 *   ẍ + 2γẋ + x + εx³ = cos(ω t).
 *
 * Top panel: x_ss(t) over 2 drive periods (maroon).
 * Bottom panel: |c_k| stems for k = 0..10 on log scale, where
 *
 *   x_ss(t) = Σ_k c_k e^{ikωt}.
 *
 * The system is integrated from rest with RK4 long enough for transients
 * to die (~5/γ time units), then exactly one drive period is sampled at
 * N = 256 uniform points and a direct DFT computes c_k. Sampling exactly
 * one period gives zero spectral leakage — even-k stems sit at numerical
 * noise (≈10⁻¹²) by symmetry.
 *
 * Sliding ε grows the odd-harmonic cascade (k=1 → k=1,3 → k=1,3,5 → …);
 * sliding ω near 1/k resonantly amplifies the kth harmonic.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

// --- palette ---------------------------------------------------------------

const BG          = 0xF0EDE8;
const MAROON      = 0x7A1F2C;
const FRAME_COLOR = 0x8FA3B5;

// --- layout ---------------------------------------------------------------

const TOP_W = 7.0;
const TOP_H = 2.4;
const TOP_CX = 0;
const TOP_CY = 1.5;

const BOT_W = 7.0;
const BOT_H = 2.4;
const BOT_CX = 0;
const BOT_CY = -1.5;

const Y_TOP = 3.0;          // top panel: x_ss in ±3
const LOG_FLOOR = -8.0;     // bottom panel: log10|c_k| ∈ [-8, 1]
const LOG_TOP   =  1.0;

const K_MAX = 10;           // highest harmonic plotted
const STEM_LEFT  = -3.0;    // stem k=0 lives at world x = STEM_LEFT
const STEM_RIGHT =  3.0;    // stem k=K_MAX lives at world x = STEM_RIGHT

const N_PERIOD = 1024;      // samples per drive period (DFT bin count, panel resolution)
const N_TIME   = 2 * N_PERIOD;  // sampled over 2 periods for the time panel
const TARGET_DT = 0.01;     // upper bound on the RK4 step; sub-step between samples to enforce

// --- coordinate maps ------------------------------------------------------

function timeToX(t: number, T: number): number {
  return TOP_CX + (t / (2 * T) - 0.5) * TOP_W;
}

function topValueToY(x: number): number {
  return TOP_CY + (x / Y_TOP) * (TOP_H / 2);
}

function stemKToX(k: number): number {
  return STEM_LEFT + (STEM_RIGHT - STEM_LEFT) * (k / K_MAX);
}

function logMagToY(logMag: number): number {
  const yLogClamped = Math.max(LOG_FLOOR, Math.min(LOG_TOP, logMag));
  return (BOT_CY - BOT_H / 2) + (yLogClamped - LOG_FLOOR) / (LOG_TOP - LOG_FLOOR) * BOT_H;
}

// --- inline RK4 step ------------------------------------------------------

function rk4Step(x: number, v: number, t: number, dt: number): [number, number] {
  const half = 0.5 * dt;
  const k1x = v;
  const k1v = -2 * gamma * v - x - eps * x * x * x + Math.cos(omega * t);
  const x2 = x + half * k1x, v2 = v + half * k1v;
  const k2x = v2;
  const k2v = -2 * gamma * v2 - x2 - eps * x2 * x2 * x2 + Math.cos(omega * (t + half));
  const x3 = x + half * k2x, v3 = v + half * k2v;
  const k3x = v3;
  const k3v = -2 * gamma * v3 - x3 - eps * x3 * x3 * x3 + Math.cos(omega * (t + half));
  const x4 = x + dt * k3x, v4 = v + dt * k3v;
  const k4x = v4;
  const k4v = -2 * gamma * v4 - x4 - eps * x4 * x4 * x4 + Math.cos(omega * (t + dt));
  return [
    x + (dt / 6) * (k1x + 2 * k2x + 2 * k3x + k4x),
    v + (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v),
  ];
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

app.scene.add(rectFrame(TOP_CX, TOP_CY, TOP_W, TOP_H));
app.scene.add(rectFrame(BOT_CX, BOT_CY, BOT_W, BOT_H));

// Top panel zero axis (x_ss = 0)
const topZeroGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(TOP_CX - TOP_W / 2, TOP_CY, 0),
  new THREE.Vector3(TOP_CX + TOP_W / 2, TOP_CY, 0),
]);
app.scene.add(new THREE.Line(topZeroGeo, frameMat));

// Bottom panel: faint horizontal guides at log = 0, -2, -4, -6 for legibility.
for (const logL of [0, -2, -4, -6]) {
  const y = logMagToY(logL);
  const guideMat = new THREE.LineBasicMaterial({
    color: FRAME_COLOR, transparent: true, opacity: 0.35,
  });
  const guideGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(BOT_CX - BOT_W / 2, y, 0),
    new THREE.Vector3(BOT_CX + BOT_W / 2, y, 0),
  ]);
  app.scene.add(new THREE.Line(guideGeo, guideMat));
}

// --- top panel: x_ss(t) line ---------------------------------------------

const topMat = new LineMaterial({
  color: MAROON, linewidth: 2.5, worldUnits: false, depthTest: false,
});
function updateLineResolutions() {
  topMat.resolution.set(window.innerWidth, window.innerHeight);
}
updateLineResolutions();
window.addEventListener('resize', updateLineResolutions);

const topPositions = new Float32Array(N_TIME * 3);
const topGeometry = new LineGeometry();
const topLine = new Line2(topGeometry, topMat);
topLine.renderOrder = 3;
app.scene.add(topLine);

// --- bottom panel: stems + dots ------------------------------------------
//
// Stems are LineSegments: 2 endpoints per stem, K_MAX+1 stems.
// Dots are Points at each stem tip.

const stemPositions = new Float32Array((K_MAX + 1) * 2 * 3);
const stemGeometry = new THREE.BufferGeometry();
stemGeometry.setAttribute('position',
  new THREE.BufferAttribute(stemPositions, 3).setUsage(THREE.DynamicDrawUsage));
const stemLines = new THREE.LineSegments(
  stemGeometry,
  new THREE.LineBasicMaterial({ color: MAROON, depthTest: false }),
);
stemLines.renderOrder = 4;
app.scene.add(stemLines);

const dotPositions = new Float32Array((K_MAX + 1) * 3);
const dotGeometry = new THREE.BufferGeometry();
dotGeometry.setAttribute('position',
  new THREE.BufferAttribute(dotPositions, 3).setUsage(THREE.DynamicDrawUsage));
const dotPoints = new THREE.Points(
  dotGeometry,
  new THREE.PointsMaterial({
    color: MAROON, size: 7, sizeAttenuation: false, depthTest: false,
  }),
);
dotPoints.renderOrder = 5;
app.scene.add(dotPoints);

// --- params --------------------------------------------------------------

let gamma = 0.3;
let omega = 0.5;
let eps   = 0.1;

// --- compute steady state, fill panels ------------------------------------

const sampleBuffer = new Float32Array(N_TIME);

function recomputeAndDraw() {
  const T = 2 * Math.PI / omega;
  const sampleDt = T / N_PERIOD;
  // Sub-step between recorded samples so the actual RK4 step never exceeds
  // TARGET_DT (otherwise low ω gives a coarse step that pollutes the noise
  // floor with O(dt⁴) integration error).
  const subSteps = Math.max(1, Math.ceil(sampleDt / TARGET_DT));
  const intDt = sampleDt / subSteps;
  // Number of full drive periods to integrate before sampling. The transient
  // amplitude is e^{-γMT}; we need this well below the log floor (10⁻⁸) so
  // it doesn't leak into the even-k coefficients (which are zero by symmetry
  // only in the *strict* steady state). γMT ≥ 40 gives e^{-40} ≈ 4×10⁻¹⁸.
  const M = Math.max(20, Math.ceil(40 / (gamma * T)));

  let x = 0, v = 0, t = 0;
  // Transient: M periods × N_PERIOD samples × subSteps RK4 sub-steps each.
  for (let i = 0; i < M * N_PERIOD; i++) {
    for (let s = 0; s < subSteps; s++) {
      [x, v] = rk4Step(x, v, t, intDt);
      t += intDt;
    }
  }
  // Record next 2 periods, sampling at sampleDt cadence.
  for (let i = 0; i < N_TIME; i++) {
    sampleBuffer[i] = x;
    for (let s = 0; s < subSteps; s++) {
      [x, v] = rk4Step(x, v, t, intDt);
      t += intDt;
    }
  }

  // --- time panel ----------------------------------------------------------
  for (let i = 0; i < N_TIME; i++) {
    const tt = i * sampleDt;
    topPositions[i * 3 + 0] = timeToX(tt, T);
    topPositions[i * 3 + 1] = topValueToY(sampleBuffer[i]);
    topPositions[i * 3 + 2] = 0;
  }
  topGeometry.setPositions(topPositions);

  // --- DFT over the first period (samples 0..N_PERIOD-1) ------------------
  const yFloor = BOT_CY - BOT_H / 2;
  for (let k = 0; k <= K_MAX; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N_PERIOD; n++) {
      const angle = -2 * Math.PI * k * n / N_PERIOD;
      re += sampleBuffer[n] * Math.cos(angle);
      im += sampleBuffer[n] * Math.sin(angle);
    }
    re /= N_PERIOD; im /= N_PERIOD;
    const mag = Math.sqrt(re * re + im * im);
    const logMag = mag > 0 ? Math.log10(mag) : LOG_FLOOR;
    const sx = stemKToX(k);
    const sy = logMagToY(logMag);
    // stem from (sx, yFloor) to (sx, sy)
    stemPositions[k * 6 + 0] = sx; stemPositions[k * 6 + 1] = yFloor; stemPositions[k * 6 + 2] = 0;
    stemPositions[k * 6 + 3] = sx; stemPositions[k * 6 + 4] = sy;     stemPositions[k * 6 + 5] = 0;
    // dot at the tip
    dotPositions[k * 3 + 0] = sx;
    dotPositions[k * 3 + 1] = sy;
    dotPositions[k * 3 + 2] = 0;
  }
  stemGeometry.attributes.position.needsUpdate = true;
  dotGeometry.attributes.position.needsUpdate = true;
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
    <input id="osc-omega" type="range" class="thin-slider" min="0.05" max="3" step="0.005" value="${omega}" />
    <span class="value" id="osc-omega-v">${omega.toFixed(2)}</span>
  </div>
  <div class="osc-row">
    <span class="label">ε</span>
    <input id="osc-eps" type="range" class="thin-slider" min="0" max="1" step="0.01" value="${eps}" />
    <span class="value" id="osc-eps-v">${eps.toFixed(2)}</span>
  </div>
`;
document.body.appendChild(sliderWrap);

const gammaSlider = sliderWrap.querySelector<HTMLInputElement>('#osc-gamma')!;
const omegaSlider = sliderWrap.querySelector<HTMLInputElement>('#osc-omega')!;
const epsSlider   = sliderWrap.querySelector<HTMLInputElement>('#osc-eps')!;
const gammaReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-gamma-v')!;
const omegaReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-omega-v')!;
const epsReadout   = sliderWrap.querySelector<HTMLSpanElement>('#osc-eps-v')!;

gammaSlider.addEventListener('input', () => {
  gamma = parseFloat(gammaSlider.value);
  gammaReadout.textContent = gamma.toFixed(2);
  recomputeAndDraw();
});

omegaSlider.addEventListener('input', () => {
  omega = parseFloat(omegaSlider.value);
  omegaReadout.textContent = omega.toFixed(2);
  recomputeAndDraw();
});

epsSlider.addEventListener('input', () => {
  eps = parseFloat(epsSlider.value);
  epsReadout.textContent = eps.toFixed(2);
  recomputeAndDraw();
});

// --- start ---------------------------------------------------------------

recomputeAndDraw();
app.start();
