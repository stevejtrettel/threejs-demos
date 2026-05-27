/**
 * oscillator-coupled-linear-absorption — absorption spectrum of the linear
 * coupled system, computed in closed form from the diagonalization.
 *
 *   ẍ + 2γ ẋ + H x = A cos(Ωt),     A = (1, 1, 1, 1)ᵀ
 *
 * Diagonalize H = O Λ Oᵀ. In the modal basis y = Oᵀ x the system decouples
 * into four independent driven damped harmonic oscillators with effective
 * drive amplitudes Ã = Oᵀ A:
 *
 *   ÿ_i + 2γ ẏ_i + ω_i² y_i = Ã_i cos(Ωt).
 *
 * Total time-averaged absorption is then a sum of four Lorentzians,
 *
 *   P_abs(Ω) = Σ_i  γ Ã_i² Ω² / [ (ω_i² − Ω²)² + 4γ² Ω² ].
 *
 * Faint rust: the four individual mode Lorentzians.
 * Solid rust: their sum.
 * Faint gray-blue verticals: Ω = ω_i (peak positions).
 *
 * No numerical integration — the curves are evaluated directly. Recomputes
 * on every keystroke in the matrix panel and on γ-slider input.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { setupMatrixPanel, type HState } from '@/coupled-linear/MatrixPanel';

// --- palette ---------------------------------------------------------------

const BG          = 0xF0EDE8;
const RUST        = 0xA8521F;
const FRAME_COLOR = 0x8FA3B5;

// --- layout ---------------------------------------------------------------

const N = 4;

let PLOT_W  = 7.0;
let PLOT_H  = 4.0;
let PLOT_CX = -1.0;
let PLOT_CY = 0.0;

const N_OMEGA = 600;
const LOG_FLOOR = -4.0;
const LOG_TOP   =  2.0;

const NARROW_BREAKPOINT_PX = 700;

// --- params --------------------------------------------------------------

let gamma = 0.10;

let omega: number[] = [1, 1, 1, 1];
let Atilde: number[] = [0, 0, 0, 0];

// Ω axis autoscales on H change
let W_MAX_DYN = 2.4;

// --- coordinate maps ------------------------------------------------------

function omegaToX(w: number): number {
  return PLOT_CX + (w / W_MAX_DYN - 0.5) * PLOT_W;
}

function logPabsToY(logP: number): number {
  const y = Math.max(LOG_FLOOR, Math.min(LOG_TOP, logP));
  return PLOT_CY - PLOT_H / 2 + (y - LOG_FLOOR) / (LOG_TOP - LOG_FLOOR) * PLOT_H;
}

// --- closed-form absorption ----------------------------------------------

function modeAbs(i: number, Omega: number): number {
  const wi = omega[i];
  if (!Number.isFinite(wi) || wi <= 0) return NaN;
  const w2 = wi * wi;
  const O2 = Omega * Omega;
  const denom = (w2 - O2) * (w2 - O2) + 4 * gamma * gamma * O2;
  return gamma * Atilde[i] * Atilde[i] * O2 / denom;
}

// --- scene ----------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 12);
app.camera.fov = 30;
app.camera.updateProjectionMatrix();
app.controls.target.set(0, 0, 0);
app.controls.controls.enabled = false;
app.backgrounds.setColor(BG);

const frameMat = new THREE.LineBasicMaterial({ color: FRAME_COLOR });
const guideMat = new THREE.LineBasicMaterial({
  color: FRAME_COLOR, transparent: true, opacity: 0.30,
});
const peakGuideMat = new THREE.LineBasicMaterial({
  color: FRAME_COLOR, transparent: true, opacity: 0.55,
});

// --- frame, gridlines, peak guides ---------------------------------------

interface SegHandle {
  line: THREE.Line;
  pos: THREE.BufferAttribute;
}

function makeSegment(mat: THREE.LineBasicMaterial): SegHandle {
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(6);
  geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
  const line = new THREE.Line(geo, mat);
  app.scene.add(line);
  return { line, pos: geo.attributes.position as THREE.BufferAttribute };
}

function setSeg(h: SegHandle, x1: number, y1: number, x2: number, y2: number) {
  h.pos.setXYZ(0, x1, y1, 0);
  h.pos.setXYZ(1, x2, y2, 0);
  h.pos.needsUpdate = true;
}

const frameTop  = makeSegment(frameMat);
const frameBot  = makeSegment(frameMat);
const frameLeft = makeSegment(frameMat);
const frameRight= makeSegment(frameMat);

const GRID_LOGS = [-3, -2, -1, 0, 1];
const gridLines: SegHandle[] = GRID_LOGS.map(() => makeSegment(guideMat));

const peakGuides: SegHandle[] = [];
for (let i = 0; i < N; i++) peakGuides.push(makeSegment(peakGuideMat));

function redrawFrameAndGuides() {
  const xL = omegaToX(0);
  const xR = omegaToX(W_MAX_DYN);
  const yB = PLOT_CY - PLOT_H / 2;
  const yT = PLOT_CY + PLOT_H / 2;
  setSeg(frameTop,   xL, yT, xR, yT);
  setSeg(frameBot,   xL, yB, xR, yB);
  setSeg(frameLeft,  xL, yB, xL, yT);
  setSeg(frameRight, xR, yB, xR, yT);

  for (let g = 0; g < GRID_LOGS.length; g++) {
    const logL = GRID_LOGS[g];
    const visible = logL >= LOG_FLOOR && logL <= LOG_TOP;
    gridLines[g].line.visible = visible;
    if (visible) {
      const y = logPabsToY(logL);
      setSeg(gridLines[g], xL, y, xR, y);
    }
  }

  for (let i = 0; i < N; i++) {
    const w = omega[i];
    const visible = Number.isFinite(w) && w > 0 && w <= W_MAX_DYN;
    peakGuides[i].line.visible = visible;
    if (visible) {
      const xg = omegaToX(w);
      setSeg(peakGuides[i], xg, yB, xg, yT);
    }
  }
}

// --- mode and total curves ----------------------------------------------

const modeMat = new LineMaterial({
  color: RUST, linewidth: 1.4, worldUnits: false,
  transparent: true, opacity: 0.42, depthTest: false,
});
const totalMat = new LineMaterial({
  color: RUST, linewidth: 2.6, worldUnits: false, depthTest: false,
});

function updateLineResolution() {
  modeMat.resolution.set(window.innerWidth, window.innerHeight);
  totalMat.resolution.set(window.innerWidth, window.innerHeight);
}
updateLineResolution();
window.addEventListener('resize', updateLineResolution);

interface SpectrumLine {
  geom: LineGeometry;
  line: Line2;
  positions: Float32Array;
}

function makeSpectrumLine(mat: LineMaterial, renderOrder: number): SpectrumLine {
  const positions = new Float32Array(N_OMEGA * 3);
  const geom = new LineGeometry();
  geom.setPositions(positions);
  const line = new Line2(geom, mat);
  line.renderOrder = renderOrder;
  app.scene.add(line);
  return { geom, line, positions };
}

const modeLines: SpectrumLine[] = [];
for (let i = 0; i < N; i++) modeLines.push(makeSpectrumLine(modeMat, 3));
const totalLine = makeSpectrumLine(totalMat, 4);

function fillCurvePositions(positions: Float32Array, evalAt: (Omega: number) => number) {
  for (let k = 0; k < N_OMEGA; k++) {
    const Omega = (k / (N_OMEGA - 1)) * W_MAX_DYN;
    const p = evalAt(Omega);
    const logP = (p > 0 && Number.isFinite(p)) ? Math.log10(p) : LOG_FLOOR;
    positions[k * 3 + 0] = omegaToX(Omega);
    positions[k * 3 + 1] = logPabsToY(logP);
    positions[k * 3 + 2] = 0;
  }
}

function redrawSpectrum() {
  for (let i = 0; i < N; i++) {
    fillCurvePositions(modeLines[i].positions, Omega => modeAbs(i, Omega));
    modeLines[i].geom.setPositions(modeLines[i].positions);
  }
  fillCurvePositions(totalLine.positions, Omega => {
    let total = 0;
    for (let i = 0; i < N; i++) {
      const p = modeAbs(i, Omega);
      if (Number.isFinite(p)) total += p;
    }
    return total;
  });
  totalLine.geom.setPositions(totalLine.positions);
}

// --- DOM: equation label, axis label, gamma slider ----------------------

const styleEl = document.createElement('style');
styleEl.textContent = `
  .equation-label {
    position: fixed; left: 50%; top: 26px; transform: translateX(-50%);
    color: #333; font: 16px/1.2 monospace; pointer-events: none;
    z-index: 10; white-space: nowrap;
  }
  .equation-label .var { font-style: italic; }
  .equation-label sub { font-size: 0.78em; }
  .axis-label {
    position: fixed; color: #666; font: italic 14px/1 monospace;
    pointer-events: none; z-index: 10; white-space: nowrap;
  }
  .thin-slider { -webkit-appearance: none; appearance: none; width: 200px; height: 5px; margin: 0; background: transparent; outline: none; cursor: pointer; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.25)); }
  .thin-slider::-webkit-slider-runnable-track { height: 5px; background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.45); border-radius: 999px; box-sizing: border-box; }
  .thin-slider::-moz-range-track { height: 5px; background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.45); border-radius: 999px; box-sizing: border-box; }
  .thin-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; margin-top: -5px; background: #fff; border: 1.5px solid rgba(0,0,0,0.8); border-radius: 50%; box-sizing: border-box; cursor: pointer; }
  .thin-slider::-moz-range-thumb { width: 14px; height: 14px; background: #fff; border: 1.5px solid rgba(0,0,0,0.8); border-radius: 50%; box-sizing: border-box; cursor: pointer; }
  .thin-slider:focus { outline: none; }
  .osc-controls {
    position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);
    display: flex; flex-direction: column; gap: 6px;
    pointer-events: auto; z-index: 10;
  }
  .osc-row { display: flex; align-items: center; gap: 10px; color: #333; font: 14px/1 monospace; }
  .osc-row .label { width: 14px; text-align: right; }
  .osc-row .value { width: 40px; color: #666; font-size: 12px; }
  @media (max-width: 700px) {
    .osc-controls { bottom: auto; top: 38px; }
    .equation-label { font-size: 11px; top: 10px; }
    .axis-label { font-size: 11px; }
    .thin-slider { width: 140px; }
  }
`;
document.head.appendChild(styleEl);

const eqLabel = document.createElement('div');
eqLabel.className = 'equation-label';
eqLabel.innerHTML =
  '<span class="var">P</span><sub>abs</sub>(Ω) = ' +
  'Σ<sub>i</sub> ' +
  'γ Ã<sub>i</sub>² Ω² / ' +
  '[(ω<sub>i</sub>² − Ω²)² + 4γ²Ω²]';
document.body.appendChild(eqLabel);

const omegaAxisLabel = document.createElement('div');
omegaAxisLabel.className = 'axis-label';
omegaAxisLabel.textContent = 'Ω';
document.body.appendChild(omegaAxisLabel);

const sliderWrap = document.createElement('div');
sliderWrap.className = 'osc-controls';
sliderWrap.innerHTML = `
  <div class="osc-row">
    <span class="label">γ</span>
    <input id="osc-gamma" type="range" class="thin-slider" min="0.01" max="1.0" step="0.01" value="${gamma}" />
    <span class="value" id="osc-gamma-v">${gamma.toFixed(2)}</span>
  </div>
`;
document.body.appendChild(sliderWrap);

const gammaSlider  = sliderWrap.querySelector<HTMLInputElement>('#osc-gamma')!;
const gammaReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-gamma-v')!;

gammaSlider.addEventListener('input', () => {
  gamma = parseFloat(gammaSlider.value);
  gammaReadout.textContent = gamma.toFixed(2);
  redrawSpectrum();
});

// --- matrix panel hookup -------------------------------------------------

const panel = setupMatrixPanel();
const panelNode = panel.node;

function applyHState(s: HState) {
  omega = s.omega.slice();

  // Ã = Oᵀ A. With A = (1,1,1,1)ᵀ: Ã_i = Σ_k O[k][i].
  const O = s.eigenvectors;
  for (let i = 0; i < N; i++) {
    let sum = 0;
    for (let k = 0; k < N; k++) sum += O[k][i];
    Atilde[i] = sum;
  }

  // autoscale Ω axis to 1.2 × max(ω_i)
  let wmax = 0;
  for (let i = 0; i < N; i++) {
    if (Number.isFinite(omega[i]) && omega[i] > wmax) wmax = omega[i];
  }
  W_MAX_DYN = Math.max(1.0, 1.2 * (wmax || 1));

  redrawFrameAndGuides();
  redrawSpectrum();
}
applyHState(panel.state);
panel.onChange(applyHState);

// --- responsive layout ---------------------------------------------------

function placeOmegaLabel() {
  const v = new THREE.Vector3(PLOT_CX, PLOT_CY - PLOT_H / 2 - 0.32, 0);
  v.project(app.camera);
  const sx = (v.x * 0.5 + 0.5) * window.innerWidth;
  const sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
  omegaAxisLabel.style.left = sx + 'px';
  omegaAxisLabel.style.top  = sy + 'px';
  omegaAxisLabel.style.transform = 'translateX(-50%)';
}

function recomputeLayout() {
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  const aspect = ww / wh;
  const worldYHalf = 12 * Math.tan((30 * Math.PI / 180) / 2);
  const worldXHalf = worldYHalf * aspect;
  const pxPerWorld = wh / (worldYHalf * 2);

  const narrow = ww < NARROW_BREAKPOINT_PX;
  if (narrow) {
    // Plot in the upper portion; matrix at bottom strip via CSS.
    const sideMargin = 0.35;
    PLOT_W  = Math.max(3.5, worldXHalf * 2 - sideMargin * 2);
    PLOT_H  = 2.6;
    PLOT_CX = 0;
    PLOT_CY = 0.55;       // shift plot up so its bottom clears the matrix strip
    panelNode.style.left = '';
    panelNode.style.right = '';
    panelNode.style.top = '';
    panelNode.style.transform = '';
  } else {
    // Plot on the left, matrix on the right, composite centered.
    const panelPx = Math.max(160, panelNode.getBoundingClientRect().width || 254);
    const panelWorld = panelPx / pxPerWorld;
    const GAP_TO_MATRIX = 0.5;
    const VIEWPORT_MARGIN = 0.4;

    PLOT_W  = Math.max(4.5, worldXHalf * 2 - panelWorld - GAP_TO_MATRIX - VIEWPORT_MARGIN);
    PLOT_H  = 4.0;
    PLOT_CY = 0.0;
    const compositeW = PLOT_W + GAP_TO_MATRIX + panelWorld;
    const startX = -compositeW / 2;
    PLOT_CX = startX + PLOT_W / 2;

    const matrixLeftWorld = startX + PLOT_W + GAP_TO_MATRIX;
    const matrixLeftPx = ww / 2 + matrixLeftWorld * pxPerWorld;
    panelNode.style.left = matrixLeftPx + 'px';
    panelNode.style.right = 'auto';
    panelNode.style.top = '50%';
    panelNode.style.transform = 'translateY(-50%)';
  }

  redrawFrameAndGuides();
  redrawSpectrum();
  placeOmegaLabel();
}
window.addEventListener('resize', recomputeLayout);

// --- start ---------------------------------------------------------------

recomputeLayout();
app.start();
requestAnimationFrame(recomputeLayout);
