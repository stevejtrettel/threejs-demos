/**
 * oscillator-linear-dissipation — visualizing absorption as the time-averaged
 * dissipation rate of the linear damped driven oscillator
 *
 *   ẍ + 2γẋ + x = cos(ω t).
 *
 * Two stacked time plots and a vertical bar:
 *   • top plot: x_ss(t) (response, maroon)
 *   • bottom plot: 2γẋ_ss(t)² (instantaneous dissipation rate, rust shaded)
 *     with a dashed horizontal line at the period-average P_abs(ω)
 *   • bar: same height as the dashed line — i.e., P_abs(ω) at this ω.
 *
 * Sweeping ω (autoplay) traces out the absorption spectrum one ω at a time.
 * Frame Y-scales are fixed; at small γ the dissipation curve and bar exceed
 * the frame top — this is the resonance amplitude swelling visibly.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';

// --- palette ---------------------------------------------------------------

const BG          = 0xF0EDE8;
const MAROON      = 0x7A1F2C;
const RUST        = 0xA8521F;
const FRAME_COLOR = 0x8FA3B5;

// --- layout ---------------------------------------------------------------

const TIME_W = 7.0;
const TOP_H  = 2.4;
const BOT_H  = 2.4;
const TOP_CX = -1.0;
const TOP_CY =  1.5;
const BOT_CX = -1.0;
const BOT_CY = -1.5;

const Y_TOP_RANGE = 1.5;       // top plot: x_ss ∈ ±1.5
const Y_DISS_MAX  = 3.0;       // bottom plot & bar: dissipation ∈ [0, 3]

const BAR_CX = 3.5;
const BAR_W  = 0.6;

const N_TIME = 600;
const PERIODS_SHOWN = 3;

// --- closed-form pieces ---------------------------------------------------

function chiOf(gamma: number, omega: number): { re: number; im: number } {
  const D = (1 - omega * omega) ** 2 + 4 * gamma * gamma * omega * omega;
  return { re: (1 - omega * omega) / D, im: -2 * gamma * omega / D };
}

function pAbs(gamma: number, omega: number): number {
  const D = (1 - omega * omega) ** 2 + 4 * gamma * gamma * omega * omega;
  return gamma * omega * omega / D;
}

// --- coordinate maps ------------------------------------------------------

function timeToX(t: number, tMax: number): number {
  return TOP_CX + (t / tMax - 0.5) * TIME_W;
}

function topValueToY(x: number): number {
  return TOP_CY + (x / Y_TOP_RANGE) * (TOP_H / 2);
}

function botValueToY(v: number): number {
  return (BOT_CY - BOT_H / 2) + (v / Y_DISS_MAX) * BOT_H;
}

function clipDiss(v: number): number {
  return Math.min(Math.max(v, 0), Y_DISS_MAX);
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

app.scene.add(rectFrame(TOP_CX, TOP_CY, TIME_W, TOP_H));
app.scene.add(rectFrame(BOT_CX, BOT_CY, TIME_W, BOT_H));
app.scene.add(rectFrame(BAR_CX, BOT_CY, BAR_W, BOT_H));

// Top plot zero axis
const topZeroGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(TOP_CX - TIME_W / 2, TOP_CY, 0),
  new THREE.Vector3(TOP_CX + TIME_W / 2, TOP_CY, 0),
]);
app.scene.add(new THREE.Line(topZeroGeo, frameMat));

// --- shared LineMaterial resolution updater ------------------------------

const allLineMats: LineMaterial[] = [];
function updateLineResolutions() {
  for (const m of allLineMats) m.resolution.set(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', updateLineResolutions);

// --- top plot: x_ss(t) (maroon) ------------------------------------------

const topMat = new LineMaterial({
  color: MAROON, linewidth: 2.5, worldUnits: false, depthTest: false,
});
allLineMats.push(topMat);

const topPositions = new Float32Array(N_TIME * 3);
const topGeometry = new LineGeometry();
const topLine = new Line2(topGeometry, topMat);
topLine.renderOrder = 3;
app.scene.add(topLine);

// --- bottom plot: 2γẋ²(t) shaded fill + outline (rust) -------------------

const fillVertices = new Float32Array(2 * N_TIME * 3);
const fillIndices = new Uint16Array(6 * (N_TIME - 1));
for (let i = 0; i < N_TIME - 1; i++) {
  // For segment i: triangle (axis_i, axis_{i+1}, curve_i)
  fillIndices[6 * i + 0] = 2 * i;       // axis_i
  fillIndices[6 * i + 1] = 2 * i + 2;   // axis_{i+1}
  fillIndices[6 * i + 2] = 2 * i + 1;   // curve_i
  // and triangle (axis_{i+1}, curve_{i+1}, curve_i)
  fillIndices[6 * i + 3] = 2 * i + 2;   // axis_{i+1}
  fillIndices[6 * i + 4] = 2 * i + 3;   // curve_{i+1}
  fillIndices[6 * i + 5] = 2 * i + 1;   // curve_i
}
const fillGeo = new THREE.BufferGeometry();
fillGeo.setAttribute('position', new THREE.BufferAttribute(fillVertices, 3).setUsage(THREE.DynamicDrawUsage));
fillGeo.setIndex(new THREE.BufferAttribute(fillIndices, 1));
const fillMat = new THREE.MeshBasicMaterial({
  color: RUST, transparent: true, opacity: 0.40,
  side: THREE.DoubleSide, depthTest: false, depthWrite: false,
});
const fillMesh = new THREE.Mesh(fillGeo, fillMat);
fillMesh.renderOrder = 2;
app.scene.add(fillMesh);

const botMat = new LineMaterial({
  color: RUST, linewidth: 2.0, worldUnits: false, depthTest: false,
});
allLineMats.push(botMat);

const botPositions = new Float32Array(N_TIME * 3);
const botGeometry = new LineGeometry();
const botLine = new Line2(botGeometry, botMat);
botLine.renderOrder = 4;
app.scene.add(botLine);

// --- dashed period-average line in bottom plot ---------------------------

const dashedMat = new THREE.LineDashedMaterial({
  color: RUST, dashSize: 0.12, gapSize: 0.08, depthTest: false,
});
const dashedGeo = new THREE.BufferGeometry();
const dashedPos = new Float32Array(6);
dashedGeo.setAttribute('position', new THREE.BufferAttribute(dashedPos, 3).setUsage(THREE.DynamicDrawUsage));
const dashedLine = new THREE.Line(dashedGeo, dashedMat);
dashedLine.renderOrder = 5;
app.scene.add(dashedLine);

// --- absorption bar (rust filled rectangle, grows upward from base) ------

const barGeo = new THREE.PlaneGeometry(BAR_W, 1);
barGeo.translate(0, 0.5, 0);  // bottom edge at local y = 0
const barMat = new THREE.MeshBasicMaterial({ color: RUST, depthTest: false });
const bar = new THREE.Mesh(barGeo, barMat);
bar.position.set(BAR_CX, BOT_CY - BOT_H / 2, 0);
bar.renderOrder = 3;
app.scene.add(bar);

// --- params --------------------------------------------------------------

let gamma = 0.2;
let omega = 0.6;

// --- redraw helpers -------------------------------------------------------

function fillTopCurve() {
  const tMax = PERIODS_SHOWN * 2 * Math.PI / omega;
  const c = chiOf(gamma, omega);
  for (let i = 0; i < N_TIME; i++) {
    const t = (i / (N_TIME - 1)) * tMax;
    const x = c.re * Math.cos(omega * t) - c.im * Math.sin(omega * t);
    topPositions[i * 3 + 0] = timeToX(t, tMax);
    topPositions[i * 3 + 1] = topValueToY(x);
    topPositions[i * 3 + 2] = 0;
  }
  topGeometry.setPositions(topPositions);
}

function fillBotCurveAndShade() {
  const tMax = PERIODS_SHOWN * 2 * Math.PI / omega;
  const c = chiOf(gamma, omega);
  const yAxis = BOT_CY - BOT_H / 2;
  for (let i = 0; i < N_TIME; i++) {
    const t = (i / (N_TIME - 1)) * tMax;
    const S = c.re * Math.sin(omega * t) + c.im * Math.cos(omega * t);
    const v = clipDiss(2 * gamma * omega * omega * S * S);
    const x = timeToX(t, tMax);
    const y = botValueToY(v);
    botPositions[i * 3 + 0] = x;
    botPositions[i * 3 + 1] = y;
    botPositions[i * 3 + 2] = 0;
    fillVertices[(2 * i)     * 3 + 0] = x;
    fillVertices[(2 * i)     * 3 + 1] = yAxis;
    fillVertices[(2 * i)     * 3 + 2] = 0;
    fillVertices[(2 * i + 1) * 3 + 0] = x;
    fillVertices[(2 * i + 1) * 3 + 1] = y;
    fillVertices[(2 * i + 1) * 3 + 2] = 0;
  }
  botGeometry.setPositions(botPositions);
  fillGeo.attributes.position.needsUpdate = true;
}

function fillDashed() {
  const P = clipDiss(pAbs(gamma, omega));
  const y = botValueToY(P);
  const arr = (dashedGeo.attributes.position.array as Float32Array);
  arr[0] = BOT_CX - TIME_W / 2; arr[1] = y; arr[2] = 0;
  arr[3] = BOT_CX + TIME_W / 2; arr[4] = y; arr[5] = 0;
  dashedGeo.attributes.position.needsUpdate = true;
  dashedLine.computeLineDistances();
}

function fillBar() {
  const P = clipDiss(pAbs(gamma, omega));
  bar.scale.y = (P / Y_DISS_MAX) * BOT_H;
}

function redrawAll() {
  fillTopCurve();
  fillBotCurveAndShade();
  fillDashed();
  fillBar();
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

// --- ω autoplay ----------------------------------------------------------

let autoplayingOmega = true;
let autoplayStart: number | null = null;
const OMEGA_LO = 0.2;
const OMEGA_HI = 2.5;
const OMEGA_AUTOPLAY_PERIOD = 16;

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

const barLabel = document.createElement('div');
barLabel.style.cssText =
  'position:fixed;color:#555;font:italic 16px/1 "Latin Modern Math", "Computer Modern", serif;' +
  'pointer-events:none;z-index:5;transform:translate(-50%, -100%);';
barLabel.textContent = 'P_abs';
document.body.appendChild(barLabel);

function updateBarLabel() {
  const v = new THREE.Vector3(BAR_CX, BOT_CY + BOT_H / 2, 0);
  v.project(app.camera);
  const x = (v.x + 1) / 2 * window.innerWidth;
  const y = (1 - v.y) / 2 * window.innerHeight;
  barLabel.style.left = `${x}px`;
  barLabel.style.top = `${y - 8}px`;
}
window.addEventListener('resize', updateBarLabel);

// --- start ---------------------------------------------------------------

updateLineResolutions();
redrawAll();
app.start();
requestAnimationFrame(updateBarLabel);
