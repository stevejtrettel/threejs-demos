/**
 * oscillator-linear-absorption — the linear absorption spectrum P_abs(ω) reshapes
 * dramatically with γ, but its total integrated absorption is invariant.
 *
 *   P_abs(ω) = γω² / [(1−ω²)² + 4γ²ω²]
 *   ∫_0^∞ P_abs dω = π/4 ≈ 0.785      (Thomas–Reiche–Kuhn, classical limit)
 *
 * Left: the rust spectrum, peak at ω = 1, narrowing and growing tall as γ
 * shrinks. Right: a bar in the same shaded rust whose height is the total
 * integrated absorption — fixed at π/4 regardless of γ. The shaded area
 * under the curve and the column of the bar visually "are the same area."
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

const PLOT_W = 7.0;
const PLOT_H = 4.5;
const PLOT_CX = -1.0;
const PLOT_CY = 0;

const BAR_CX = 3.5;
const BAR_W  = 0.35;

const W_MIN = 0.0;
const W_MAX = 4.0;
const Y_MIN = 0;
const Y_MAX = 1.5;

const N = 600;

const PI4 = Math.PI / 4;

// --- coordinate maps ------------------------------------------------------

function omegaToX(w: number): number {
  return PLOT_CX + ((w - W_MIN) / (W_MAX - W_MIN) - 0.5) * PLOT_W;
}

function valueToY(v: number): number {
  return PLOT_CY - PLOT_H / 2 + ((v - Y_MIN) / (Y_MAX - Y_MIN)) * PLOT_H;
}

function clip(v: number): number {
  return Math.min(Math.max(v, Y_MIN), Y_MAX);
}

// --- absorption ----------------------------------------------------------

function pAbs(gamma: number, w: number): number {
  const D = (1 - w * w) ** 2 + 4 * gamma * gamma * w * w;
  return gamma * w * w / D;
}

// --- scene ----------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 12);
app.camera.fov = 30;
app.camera.updateProjectionMatrix();
app.controls.target.set(0, 0, 0);
app.controls.controls.enabled = false;
app.backgrounds.setColor(BG);

// --- frame + axes ---------------------------------------------------------

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

app.scene.add(rectFrame(PLOT_CX, PLOT_CY, PLOT_W, PLOT_H));
app.scene.add(rectFrame(BAR_CX, PLOT_CY, BAR_W, PLOT_H));

// --- shared LineMaterial resolution updater ------------------------------

const allLineMats: LineMaterial[] = [];
function updateLineResolutions() {
  for (const m of allLineMats) m.resolution.set(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', updateLineResolutions);

// --- spectrum: rust outline + filled shading -----------------------------

const fillVertices = new Float32Array(2 * N * 3);
const fillIndices = new Uint16Array(6 * (N - 1));
for (let i = 0; i < N - 1; i++) {
  fillIndices[6 * i + 0] = 2 * i;
  fillIndices[6 * i + 1] = 2 * i + 2;
  fillIndices[6 * i + 2] = 2 * i + 1;
  fillIndices[6 * i + 3] = 2 * i + 2;
  fillIndices[6 * i + 4] = 2 * i + 3;
  fillIndices[6 * i + 5] = 2 * i + 1;
}
const fillGeo = new THREE.BufferGeometry();
fillGeo.setAttribute('position', new THREE.BufferAttribute(fillVertices, 3).setUsage(THREE.DynamicDrawUsage));
fillGeo.setIndex(new THREE.BufferAttribute(fillIndices, 1));
const fillMat = new THREE.MeshBasicMaterial({
  color: RUST, transparent: true, opacity: 0.40,
  side: THREE.DoubleSide, depthTest: false, depthWrite: false,
});
const fillMesh = new THREE.Mesh(fillGeo, fillMat);
fillMesh.renderOrder = 1;
app.scene.add(fillMesh);

const rateMat = new LineMaterial({
  color: RUST, linewidth: 2.2, worldUnits: false, depthTest: false,
});
allLineMats.push(rateMat);

const ratePositions = new Float32Array(N * 3);
const rateGeometry = new LineGeometry();
const rateLine = new Line2(rateGeometry, rateMat);
rateLine.renderOrder = 3;
app.scene.add(rateLine);

// --- integral bar: shaded rust column at height π/4 ---------------------

const barGeo = new THREE.PlaneGeometry(BAR_W, 1);
barGeo.translate(0, 0.5, 0);  // bottom edge at local y = 0
const barMat = new THREE.MeshBasicMaterial({
  color: RUST, transparent: true, opacity: 0.40,
  depthTest: false, depthWrite: false,
});
const bar = new THREE.Mesh(barGeo, barMat);
bar.position.set(BAR_CX, PLOT_CY - PLOT_H / 2, 0);
bar.scale.y = (PI4 / Y_MAX) * PLOT_H;
bar.renderOrder = 2;
app.scene.add(bar);

// --- params --------------------------------------------------------------

let gamma = 0.2;

// --- redraw --------------------------------------------------------------

function redrawAll() {
  const yAxis = PLOT_CY - PLOT_H / 2;
  for (let i = 0; i < N; i++) {
    const w = W_MIN + (W_MAX - W_MIN) * (i / (N - 1));
    const p = pAbs(gamma, w);

    const x = omegaToX(w);
    const yp = valueToY(clip(p));

    ratePositions[i * 3 + 0] = x;
    ratePositions[i * 3 + 1] = yp;
    ratePositions[i * 3 + 2] = 0;

    fillVertices[(2 * i)     * 3 + 0] = x;
    fillVertices[(2 * i)     * 3 + 1] = yAxis;
    fillVertices[(2 * i)     * 3 + 2] = 0;
    fillVertices[(2 * i + 1) * 3 + 0] = x;
    fillVertices[(2 * i + 1) * 3 + 1] = yp;
    fillVertices[(2 * i + 1) * 3 + 2] = 0;
  }
  rateGeometry.setPositions(ratePositions);
  fillGeo.attributes.position.needsUpdate = true;
}

// --- DOM slider ----------------------------------------------------------

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
`;
document.body.appendChild(sliderWrap);

const gammaSlider  = sliderWrap.querySelector<HTMLInputElement>('#osc-gamma')!;
const gammaReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-gamma-v')!;

gammaSlider.addEventListener('input', () => {
  autoplayingGamma = false;
  gamma = parseFloat(gammaSlider.value);
  gammaReadout.textContent = gamma.toFixed(2);
  redrawAll();
});

// --- γ autoplay: slow sweep across [γ_lo, γ_hi] until the user grabs it --

let autoplayingGamma = true;
let autoplayStart: number | null = null;
const GAMMA_LO = 0.08;
const GAMMA_HI = 0.5;
const GAMMA_AUTOPLAY_PERIOD = 20;

app.addAnimateCallback((time) => {
  if (!autoplayingGamma) return;
  if (autoplayStart === null) autoplayStart = time;
  const tau = time - autoplayStart;
  const phase = (2 * Math.PI / GAMMA_AUTOPLAY_PERIOD) * tau;
  gamma = GAMMA_LO + (GAMMA_HI - GAMMA_LO) * (1 - Math.cos(phase)) / 2;
  gammaSlider.value = gamma.toFixed(2);
  gammaReadout.textContent = gamma.toFixed(2);
  redrawAll();
});

// --- start ---------------------------------------------------------------

updateLineResolutions();
redrawAll();
app.start();
