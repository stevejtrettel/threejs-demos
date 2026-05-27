/**
 * oscillator-quadratic-potential — visualizing the asymmetric anharmonic
 * potential
 *
 *   V(x) = ½ x² + (ε/3) x³.
 *
 * At ε = 0 the well is a symmetric parabola. For ε > 0, the cubic term
 * pulls the left side downward — the well shallows on the left, develops
 * a local maximum at x = -1/ε (the escape barrier), and continues to
 * fall toward V = -∞.
 *
 * The slider adjusts ε ∈ [0, 0.3]. Same parameter range used in the
 * forced/damped demos that ride this potential.
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
const PLOT_H  = 4.0;
const PLOT_CX = 0;
const PLOT_CY = 0;

const X_MIN = -5;
const X_MAX =  5;
const V_MIN = -3;
const V_MAX = 22;

const N_SAMPLES = 600;

// --- coordinate maps ------------------------------------------------------

function xToWorld(x: number): number {
  return PLOT_CX + ((x - X_MIN) / (X_MAX - X_MIN) - 0.5) * PLOT_W;
}

function vToWorld(v: number): number {
  return PLOT_CY + ((v - V_MIN) / (V_MAX - V_MIN) - 0.5) * PLOT_H;
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

const frameGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(PLOT_CX - PLOT_W / 2, PLOT_CY - PLOT_H / 2, 0),
  new THREE.Vector3(PLOT_CX + PLOT_W / 2, PLOT_CY - PLOT_H / 2, 0),
  new THREE.Vector3(PLOT_CX + PLOT_W / 2, PLOT_CY + PLOT_H / 2, 0),
  new THREE.Vector3(PLOT_CX - PLOT_W / 2, PLOT_CY + PLOT_H / 2, 0),
]);
app.scene.add(new THREE.LineLoop(frameGeo, frameMat));

// V = 0 axis (horizontal)
{
  const y = vToWorld(0);
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(PLOT_CX - PLOT_W / 2, y, 0),
    new THREE.Vector3(PLOT_CX + PLOT_W / 2, y, 0),
  ]);
  app.scene.add(new THREE.Line(geo, frameMat));
}

// x = 0 axis (vertical)
{
  const x = xToWorld(0);
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(x, PLOT_CY - PLOT_H / 2, 0),
    new THREE.Vector3(x, PLOT_CY + PLOT_H / 2, 0),
  ]);
  app.scene.add(new THREE.Line(geo, frameMat));
}

// --- V(x) curve -----------------------------------------------------------

const lineMat = new LineMaterial({
  color: MAROON, linewidth: 2.5, worldUnits: false, depthTest: false,
});
function updateLineResolution() {
  lineMat.resolution.set(window.innerWidth, window.innerHeight);
}
updateLineResolution();
window.addEventListener('resize', updateLineResolution);

const positions = new Float32Array(N_SAMPLES * 3);
const lineGeometry = new LineGeometry();
const line = new Line2(lineGeometry, lineMat);
line.renderOrder = 3;
app.scene.add(line);

// --- params --------------------------------------------------------------

let eps = 0.1;

function redraw() {
  for (let i = 0; i < N_SAMPLES; i++) {
    const x = X_MIN + (X_MAX - X_MIN) * (i / (N_SAMPLES - 1));
    const v = 0.5 * x * x + (eps / 3) * x * x * x;
    if (v >= V_MIN && v <= V_MAX) {
      positions[i * 3 + 0] = xToWorld(x);
      positions[i * 3 + 1] = vToWorld(v);
      positions[i * 3 + 2] = 0;
    } else {
      // Out of frame: NaN cuts the line so it doesn't draw a clipped horizontal at the edge.
      positions[i * 3 + 0] = NaN;
      positions[i * 3 + 1] = NaN;
      positions[i * 3 + 2] = NaN;
    }
  }
  lineGeometry.setPositions(positions);
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
  .equation-label { position: fixed; left: 50%; top: 32px; transform: translateX(-50%); color: #333; font: 18px/1.2 monospace; letter-spacing: 0; pointer-events: none; z-index: 10; white-space: nowrap; }
  .equation-label .title { margin-right: 18px; color: #666; font-size: 14px; }
  .equation-label .var { font-style: italic; }
`;
document.head.appendChild(sliderStyle);

const equationLabel = document.createElement('div');
equationLabel.className = 'equation-label';
equationLabel.innerHTML =
  '<span class="title">potential</span>' +
  '<span class="var">V</span>(<span class="var">x</span>) = ' +
  '1/2 <span class="var">x</span>\u00b2 + (\u03b5/3)<span class="var">x</span>\u00b3';
document.body.appendChild(equationLabel);

const sliderWrap = document.createElement('div');
sliderWrap.style.cssText =
  'position:fixed;bottom:20px;right:20px;display:flex;flex-direction:column;gap:8px;' +
  'pointer-events:auto;z-index:10;';
sliderWrap.innerHTML = `
  <div class="osc-row">
    <span class="label">ε</span>
    <input id="osc-eps" type="range" class="thin-slider" min="0" max="0.5" step="0.005" value="${eps}" />
    <span class="value" id="osc-eps-v">${eps.toFixed(2)}</span>
  </div>
`;
document.body.appendChild(sliderWrap);

const epsSlider   = sliderWrap.querySelector<HTMLInputElement>('#osc-eps')!;
const epsReadout  = sliderWrap.querySelector<HTMLSpanElement>('#osc-eps-v')!;

epsSlider.addEventListener('input', () => {
  eps = parseFloat(epsSlider.value);
  epsReadout.textContent = eps.toFixed(2);
  redraw();
});

// --- start ---------------------------------------------------------------

redraw();
app.start();
