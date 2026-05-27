/**
 * oscillator-duffing-steady-state — the steady-state response of the
 * driven damped Duffing oscillator
 *
 *   ẍ + 2γẋ + x + εx³ = cos(ω t).
 *
 * Integrates from rest with RK4 long enough for transients to vanish below
 * numerical noise (γMT ≥ 40 ⇒ e^{-γMT} < 10⁻¹⁷), then plots x(t) on a
 * fixed time window. Sliding ω changes the visible period density; sliding
 * ε distorts the waveform; sliding γ changes the amplitude (most strongly
 * near ω = 1).
 *
 * Adaptive sub-stepping: between recorded samples the RK4 step is held
 * below TARGET_DT regardless of ω, so the integrator's noise floor stays
 * tight even at slow drives where T = 2π/ω is large.
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

const PLOT_W  = 8.0;
const PLOT_H  = 3.5;
const PLOT_CX = 0;
const PLOT_CY = 0;

const Y_MAX = 3.0;          // x_ss in ±3
const T_MIN = 0;
const T_MAX = 80;           // plot window in time units

const N_PLOT = 800;         // sample count for the curve
const TARGET_DT = 0.01;     // upper bound on RK4 step (sub-stepped between samples)

// --- coordinate maps ------------------------------------------------------

function timeToX(t: number): number {
  return PLOT_CX + ((t - T_MIN) / (T_MAX - T_MIN) - 0.5) * PLOT_W;
}

function valueToY(x: number): number {
  return PLOT_CY + (x / Y_MAX) * (PLOT_H / 2);
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

// --- frame + zero axis ----------------------------------------------------

const frameMat = new THREE.LineBasicMaterial({ color: FRAME_COLOR });

const frameGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(PLOT_CX - PLOT_W / 2, PLOT_CY - PLOT_H / 2, 0),
  new THREE.Vector3(PLOT_CX + PLOT_W / 2, PLOT_CY - PLOT_H / 2, 0),
  new THREE.Vector3(PLOT_CX + PLOT_W / 2, PLOT_CY + PLOT_H / 2, 0),
  new THREE.Vector3(PLOT_CX - PLOT_W / 2, PLOT_CY + PLOT_H / 2, 0),
]);
app.scene.add(new THREE.LineLoop(frameGeo, frameMat));

const zeroAxisGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(PLOT_CX - PLOT_W / 2, PLOT_CY, 0),
  new THREE.Vector3(PLOT_CX + PLOT_W / 2, PLOT_CY, 0),
]);
app.scene.add(new THREE.Line(zeroAxisGeo, frameMat));

// --- x_ss(t) line --------------------------------------------------------

const lineMat = new LineMaterial({
  color: MAROON, linewidth: 2.5, worldUnits: false, depthTest: false,
});
function updateLineResolution() {
  lineMat.resolution.set(window.innerWidth, window.innerHeight);
}
updateLineResolution();
window.addEventListener('resize', updateLineResolution);

const positions = new Float32Array(N_PLOT * 3);
const lineGeometry = new LineGeometry();
const line = new Line2(lineGeometry, lineMat);
line.renderOrder = 3;
app.scene.add(line);

// --- params --------------------------------------------------------------

let gamma = 0.3;
let omega = 0.5;
let eps   = 0.1;

// --- recompute -----------------------------------------------------------

function recomputeAndDraw() {
  const T = 2 * Math.PI / omega;
  // Integrate enough drive periods that transient e^{-γMT} < 10⁻¹⁷.
  const M = Math.max(20, Math.ceil(40 / (gamma * T)));

  // Sub-stepping between plot samples so dt_int stays ≤ TARGET_DT.
  const sampleDt = (T_MAX - T_MIN) / N_PLOT;
  const subSteps = Math.max(1, Math.ceil(sampleDt / TARGET_DT));
  const intDt = sampleDt / subSteps;

  // Transient phase. We don't need exact alignment with M*T — any starting
  // point in the steady state is equivalent, since x_ss is T-periodic.
  const transientSteps = Math.ceil(M * T / intDt);

  let x = 0, v = 0, t = 0;
  for (let i = 0; i < transientSteps; i++) {
    [x, v] = rk4Step(x, v, t, intDt);
    t += intDt;
  }

  // Record N_PLOT samples while continuing to integrate.
  for (let i = 0; i < N_PLOT; i++) {
    positions[i * 3 + 0] = timeToX(i * sampleDt);
    positions[i * 3 + 1] = valueToY(x);
    positions[i * 3 + 2] = 0;
    for (let s = 0; s < subSteps; s++) {
      [x, v] = rk4Step(x, v, t, intDt);
      t += intDt;
    }
  }

  lineGeometry.setPositions(positions);
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
