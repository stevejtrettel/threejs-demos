/**
 * Sp(6,Z) — limit-set super-demo.
 *
 * A unified viewer for all six BDN examples (A-1, A-15, C-2, C-32, C-47, C-55)
 * sharing the same BFS / projection / render pipeline. The full example set is
 * defined in examples.ts; adding a new example is appending one ExampleGroup
 * object with its polynomial coefficient lists and a γ word.
 *
 * Behaviors:
 *   - depth slider:    re-runs BFS but preserves camera + projection (so
 *                      tweaking N doesn't lose your view).
 *   - example dropdown: re-runs BFS, resets depth to 12, keeps current
 *                      projection *type* (refits if PCA), re-autofits camera.
 *   - chart/subset:    rebuilds with new chart, re-autofits camera.
 *   - chart PCA / auto-chart: refits on current orbit, re-autofits.
 *   - reset:           default chart, depth → 12, re-autofits.
 */

import * as THREE from 'three';
import { App } from '@/app/App';

import {
  EXAMPLES, exampleById, type ExampleGroup,
} from './examples';
import {
  makeGroupAction, computeProximalBasepoint, generateOrbit,
  type GroupAction, type Orbit,
} from './orbit';
import {
  type Projection,
  fitPCAProjection, fitAutoChartProjection, buildInstanceArrays,
} from './projection';
import {
  createMaterial, setProjectionUniforms, makeInstancedMesh, autofitCamera,
} from './render';
import { validateAllExamples } from './validate';

validateAllExamples();

const app = new App({ antialias: true });
app.scene.background = new THREE.Color(0xf2f2f2);

const { material, uniforms } = createMaterial();

const DEFAULT_EXAMPLE_ID = 'A15';
const DEFAULT_DEPTH = 12;

// ─── State ──────────────────────────────────────────────────────────────────

let currentExample!:   ExampleGroup;
let currentAction!:    GroupAction;
let currentBasepoint!: Float64Array;
let currentOrbit!:     Orbit;
let currentProj!:      Projection;
let currentMesh: THREE.Mesh | null = null;
let depth = DEFAULT_DEPTH;
let colorDepth = 0;
let stats = { kept: 0, totalWords: 0 };

function loadExample(id: string): void {
  currentExample = exampleById(id);
  currentAction = makeGroupAction(currentExample);
  const r = computeProximalBasepoint(currentExample, currentAction);
  currentBasepoint = r.basepoint;
  console.log(
    `[sp6-${currentExample.id}] loaded: |λ_max(${currentExample.gammaName})| ≈ ${r.lambdaMax.toFixed(3)}` +
    `, drift = ${r.drift.toFixed(4)}`,
  );
}

function regenerateOrbit(N: number): void {
  const t0 = performance.now();
  currentOrbit = generateOrbit(currentAction, currentBasepoint, N);
  const t1 = performance.now();
  console.log(
    `[sp6-${currentExample.id}] BFS depth=${N}  words=${currentOrbit.count}  (${(t1 - t0).toFixed(0)}ms)`,
  );
}

function rebuildMesh(autofit: boolean): void {
  const { aV0, aV1, aColor, kept } = buildInstanceArrays(currentOrbit, currentProj.denom, colorDepth);

  const mesh = makeInstancedMesh(material, aV0, aV1, aColor);
  if (currentMesh) {
    app.scene.remove(currentMesh);
    currentMesh.geometry.dispose();
  }
  app.scene.add(mesh);
  currentMesh = mesh;

  setProjectionUniforms(uniforms, currentProj);
  if (autofit) autofitCamera(app, aV0, aV1, currentProj);

  stats = { kept, totalWords: currentOrbit.count };
}

// ─── Initial load ───────────────────────────────────────────────────────────

loadExample(DEFAULT_EXAMPLE_ID);
regenerateOrbit(depth);
currentProj = fitPCAProjection(currentOrbit, 0);  // v₁ chart with PCA axes
rebuildMesh(true);

// ─── HUD ────────────────────────────────────────────────────────────────────

const css = document.createElement('style');
css.textContent = `
  #sp6-panel {
    position: fixed; top: 12px; left: 12px;
    background: rgba(20,22,26,0.85); color: #e8e8e8;
    padding: 10px 12px; border-radius: 6px;
    font: 12px/1.4 system-ui, sans-serif;
    user-select: none; z-index: 10;
    width: 260px;
    backdrop-filter: blur(6px);
  }
  #sp6-panel label { display: flex; justify-content: space-between; margin-top: 6px; }
  #sp6-panel input[type=range] { width: 100%; margin: 2px 0 4px; }
  #sp6-panel select {
    width: 100%; margin: 2px 0 4px;
    background: rgba(255,255,255,0.06); color: #e8e8e8;
    border: 1px solid rgba(255,255,255,0.15); border-radius: 3px;
    padding: 3px 4px; font: inherit;
  }
  #sp6-panel .stats { color: #aaa; margin-top: 8px; font-size: 11px; }
  #sp6-panel .mode  { color: #cce; margin-top: 4px; font-size: 11px; font-style: italic; }
  #sp6-panel .meta  { color: #999; margin-top: 4px; font-size: 11px; line-height: 1.45; }
  #sp6-panel .btnrow { display: flex; gap: 4px; margin-top: 4px; }
  #sp6-panel button {
    flex: 1; margin-top: 8px;
    background: rgba(255,255,255,0.08); color: #e8e8e8;
    border: none; padding: 6px 8px; border-radius: 4px;
    cursor: pointer; font: inherit;
  }
  #sp6-panel button:hover { background: rgba(255,255,255,0.18); }
  #sp6-panel .btnrow button { margin-top: 0; }
  #sp6-panel hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 8px 0; }
`;
document.head.appendChild(css);

const exampleOptions = EXAMPLES
  .map((e) => `<option value="${e.id}">${e.label} (${e.nature})</option>`)
  .join('');

const panel = document.createElement('div');
panel.id = 'sp6-panel';
panel.innerHTML = `
  <div style="font-weight:600;margin-bottom:4px;">Sp(6,Z) — limit sets</div>

  <label>example</label>
  <select id="selExample">${exampleOptions}</select>
  <div class="meta" id="exMeta"></div>

  <hr>

  <label>depth N <span id="lblN">${depth}</span></label>
  <input id="slN" type="range" min="4" max="13" step="1" value="${depth}">

  <label>ball radius <span id="lblR">0.025</span></label>
  <input id="slR" type="range" min="0.001" max="0.06" step="0.0005" value="0.025">

  <hr>

  <label>chart</label>
  <select id="selChart">
    <option value="0">v₁ chart (PCA axes)</option>
    <option value="1">v₂ chart (PCA axes)</option>
    <option value="2">v₃ chart (PCA axes)</option>
    <option value="3">v₄ chart (PCA axes)</option>
    <option value="4">v₅ chart (PCA axes)</option>
    <option value="5">v₆ chart (PCA axes)</option>
    <option value="auto">auto-chart (overall PCA)</option>
  </select>

  <label>color by</label>
  <select id="selColorDepth">
    <option value="0">grayscale</option>
    <option value="1">last letter (g_n)</option>
    <option value="2">2nd-to-last letter (g_{n−1})</option>
    <option value="3">3rd-to-last letter (g_{n−2})</option>
    <option value="4">4th-to-last letter (g_{n−3})</option>
    <option value="5">5th-to-last letter (g_{n−4})</option>
  </select>

  <button id="btnReset">reset</button>

  <div class="mode" id="mode"></div>
  <div class="stats" id="stats"></div>

  <button id="btnShot">screenshot</button>
`;
document.body.appendChild(panel);

const $ = <T extends HTMLElement>(sel: string) => panel.querySelector(sel) as T;
const lblN       = $<HTMLSpanElement>('#lblN');
const lblR       = $<HTMLSpanElement>('#lblR');
const statsEl    = $<HTMLDivElement>('#stats');
const modeEl     = $<HTMLDivElement>('#mode');
const exMetaEl   = $<HTMLDivElement>('#exMeta');
const selExample = $<HTMLSelectElement>('#selExample');
const selChart   = $<HTMLSelectElement>('#selChart');
const slN        = $<HTMLInputElement>('#slN');

selExample.value = DEFAULT_EXAMPLE_ID;

function shotTimestamp(): string {
  return new Date().toISOString().replace(/[-:]|\..*/g, '').replace('T', '-');
}

function updateUI(): void {
  statsEl.textContent =
    `${stats.totalWords.toLocaleString()} words, ` +
    `${stats.kept.toLocaleString()} drawn`;
  modeEl.textContent = `view: ${currentProj.pretty}`;
  exMetaEl.innerHTML =
    `α = ${currentExample.alpha}<br>` +
    `β = ${currentExample.beta}<br>` +
    `γ = ${currentExample.gammaName}`;
}

/**
 * Apply the chart selector's current value: a numeric "0".."5" picks
 * v_k as the chart denominator with PCA axes; "auto" runs the overall PCA.
 */
function applyChartSelection(): void {
  if (selChart.value === 'auto') {
    currentProj = fitAutoChartProjection(currentOrbit);
  } else {
    const k = parseInt(selChart.value, 10);
    currentProj = fitPCAProjection(currentOrbit, k);
  }
}

updateUI();

// ─── Event handlers ─────────────────────────────────────────────────────────

selExample.addEventListener('change', () => {
  loadExample(selExample.value);
  depth = DEFAULT_DEPTH;
  slN.value = String(depth);
  lblN.textContent = String(depth);
  regenerateOrbit(depth);
  // Refit the projection on the new orbit (both modes need this).
  applyChartSelection();
  rebuildMesh(true);
  updateUI();
});

selChart.addEventListener('change', () => {
  applyChartSelection();
  rebuildMesh(true);
  updateUI();
});

$<HTMLButtonElement>('#btnReset').addEventListener('click', () => {
  depth = DEFAULT_DEPTH;
  slN.value = String(depth);
  lblN.textContent = String(depth);
  regenerateOrbit(depth);
  selChart.value = '0';
  applyChartSelection();
  rebuildMesh(true);
  updateUI();
});

slN.addEventListener('change', () => {
  const v = parseInt(slN.value, 10);
  depth = v;
  lblN.textContent = `${v}`;
  regenerateOrbit(v);
  // Preserve camera + projection across depth changes (no autofit, no refit).
  rebuildMesh(false);
  updateUI();
});

$<HTMLInputElement>('#slR').addEventListener('input', (e) => {
  const v = parseFloat((e.target as HTMLInputElement).value);
  uniforms.uRadius.value = v;
  lblR.textContent = v.toFixed(3);
});

$<HTMLSelectElement>('#selColorDepth').addEventListener('change', (e) => {
  colorDepth = parseInt((e.target as HTMLSelectElement).value, 10);
  rebuildMesh(false);
  updateUI();
});

$<HTMLButtonElement>('#btnShot').addEventListener('click', () => {
  app.screenshot(
    `sp6-${currentExample.id}_${currentProj.label}_${stats.kept}pts_${shotTimestamp()}.png`,
  );
});

app.start();
