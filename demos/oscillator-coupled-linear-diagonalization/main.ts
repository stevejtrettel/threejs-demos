/**
 * oscillator-coupled-linear-diagonalization — the conservative system
 * x'' + H x = 0 rendered simultaneously in two bases:
 *
 *   left panel  — lab frame x_i(t), four HORIZONTAL rails, dotted couplings
 *   right panel — modal frame y(t) = Oᵀ x(t), four VERTICAL rails (rotated
 *                 90° to emphasize this is a different basis); ω_i labels
 *                 under each rail
 *
 * Click-drag *any* ball — red on the lab panel, blue on the modal panel —
 * to move it. The simulation pauses while dragging, others freeze in their
 * basis (left ball drag holds the other x_j; right ball drag holds the
 * other y_j), and on release motion resumes with all velocities zero. The
 * four "mode" buttons under the matrix set x(0) = scale · O · e_i — a
 * single normal-mode excitation that lights up exactly one vertical rail.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { setupMatrixPanel, type HState } from '@/coupled-linear/MatrixPanel';

// --- palette ---------------------------------------------------------------

const BG          = 0xF0EDE8;
const MAROON      = 0x7A1F2C;
const SLATE_BLUE  = 0x4A6B8A;
const FRAME_COLOR = 0x8FA3B5;
const COUPLING    = 0xB5B0A4;

// --- physical scales ------------------------------------------------------

const N = 4;
const X_MIN = -2.5;
const X_MAX =  2.5;

const PICK_RADIUS = 0.30;
const BALL_RADIUS = 0.13;

// --- per-panel geometry (recomputed on resize) ----------------------------

// L-panel (x-basis, horizontal rails). W = motion extent (horizontal),
// H = vertical span across the four stacked rails.
let PANEL_L_CX = -2.0;
let PANEL_L_CY = 0;
let PANEL_L_W  = 3.0;
let PANEL_L_H  = 2.9;

// R-panel (modal y-basis, vertical rails). W = horizontal span across the
// four side-by-side rails; H = motion extent (vertical).
let PANEL_R_CX = 2.0;
let PANEL_R_CY = 0;
let PANEL_R_W  = 2.9;
let PANEL_R_H  = 3.0;

const NARROW_BREAKPOINT_PX = 700;

// --- coordinate maps ------------------------------------------------------

function xToWorldL(xv: number): number {
  return PANEL_L_CX + ((xv - X_MIN) / (X_MAX - X_MIN) - 0.5) * PANEL_L_W;
}
function worldToXL(wx: number): number {
  return X_MIN + ((wx - PANEL_L_CX) / PANEL_L_W + 0.5) * (X_MAX - X_MIN);
}
function railYL(i: number): number {
  return PANEL_L_CY + PANEL_L_H / 2 - (i / (N - 1)) * PANEL_L_H;
}

function railXR(i: number): number {
  return PANEL_R_CX - PANEL_R_W / 2 + (i / (N - 1)) * PANEL_R_W;
}
function yToWorldR(yv: number): number {
  return PANEL_R_CY + ((yv - X_MIN) / (X_MAX - X_MIN) - 0.5) * PANEL_R_H;
}
function worldToYR(wy: number): number {
  return X_MIN + ((wy - PANEL_R_CY) / PANEL_R_H + 0.5) * (X_MAX - X_MIN);
}

function clampX(xv: number): number {
  return Math.max(X_MIN, Math.min(X_MAX, xv));
}

// --- physics state --------------------------------------------------------

const x = new Float64Array(N);
const v = new Float64Array(N);
const y = new Float64Array(N);

let H: number[][] = [];
let O: number[][] = [];
let omega: number[] = [];
let posDef = true;

const ESCAPE_LIMIT = 1e3;
const SUBSTEP = 0.008;
const IC_AMP = 1.5;

// --- RK4 ------------------------------------------------------------------

const tmpA = new Float64Array(N);
const tmpX = new Float64Array(N);
const tmpV = new Float64Array(N);
const k1x  = new Float64Array(N), k1v = new Float64Array(N);
const k2x  = new Float64Array(N), k2v = new Float64Array(N);
const k3x  = new Float64Array(N), k3v = new Float64Array(N);
const k4x  = new Float64Array(N), k4v = new Float64Array(N);

function accel(out: Float64Array, xv: Float64Array) {
  for (let i = 0; i < N; i++) {
    let a = 0;
    const Hi = H[i];
    for (let j = 0; j < N; j++) a -= Hi[j] * xv[j];
    out[i] = a;
  }
}

function rk4Step(dt: number) {
  accel(tmpA, x);
  for (let i = 0; i < N; i++) { k1x[i] = v[i]; k1v[i] = tmpA[i]; }

  for (let i = 0; i < N; i++) { tmpX[i] = x[i] + 0.5 * dt * k1x[i]; tmpV[i] = v[i] + 0.5 * dt * k1v[i]; }
  accel(tmpA, tmpX);
  for (let i = 0; i < N; i++) { k2x[i] = tmpV[i]; k2v[i] = tmpA[i]; }

  for (let i = 0; i < N; i++) { tmpX[i] = x[i] + 0.5 * dt * k2x[i]; tmpV[i] = v[i] + 0.5 * dt * k2v[i]; }
  accel(tmpA, tmpX);
  for (let i = 0; i < N; i++) { k3x[i] = tmpV[i]; k3v[i] = tmpA[i]; }

  for (let i = 0; i < N; i++) { tmpX[i] = x[i] + dt * k3x[i]; tmpV[i] = v[i] + dt * k3v[i]; }
  accel(tmpA, tmpX);
  for (let i = 0; i < N; i++) { k4x[i] = tmpV[i]; k4v[i] = tmpA[i]; }

  for (let i = 0; i < N; i++) {
    x[i] += (dt / 6) * (k1x[i] + 2 * k2x[i] + 2 * k3x[i] + k4x[i]);
    v[i] += (dt / 6) * (k1v[i] + 2 * k2v[i] + 2 * k3v[i] + k4v[i]);
  }
}

function advance(dtReal: number) {
  let remaining = dtReal;
  while (remaining > 1e-9) {
    const step = Math.min(SUBSTEP, remaining);
    rk4Step(step);
    remaining -= step;
    for (let i = 0; i < N; i++) {
      if (!Number.isFinite(x[i]) || Math.abs(x[i]) > ESCAPE_LIMIT) {
        for (let j = 0; j < N; j++) { x[j] = 0; v[j] = 0; }
        return;
      }
    }
  }
}

function updateY() {
  for (let i = 0; i < N; i++) {
    let yi = 0;
    for (let k = 0; k < N; k++) yi += O[k][i] * x[k];
    y[i] = yi;
  }
}

function updateXFromY() {
  for (let k = 0; k < N; k++) {
    let xk = 0;
    for (let i = 0; i < N; i++) xk += O[k][i] * y[i];
    x[k] = xk;
  }
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

interface RailGfx { rail: THREE.Line; tick: THREE.Line; }
const railsL: RailGfx[] = [];
const railsR: RailGfx[] = [];

function makeLine(): THREE.Line {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  return new THREE.Line(geo, frameMat);
}
for (let i = 0; i < N; i++) {
  const rL = { rail: makeLine(), tick: makeLine() };
  const rR = { rail: makeLine(), tick: makeLine() };
  railsL.push(rL); railsR.push(rR);
  app.scene.add(rL.rail); app.scene.add(rL.tick);
  app.scene.add(rR.rail); app.scene.add(rR.tick);
}

const TICK_HALF = 0.05;
function setSegment(line: THREE.Line, p1x: number, p1y: number, p2x: number, p2y: number) {
  const pos = line.geometry.attributes.position as THREE.BufferAttribute;
  pos.setXYZ(0, p1x, p1y, 0);
  pos.setXYZ(1, p2x, p2y, 0);
  pos.needsUpdate = true;
}

function redrawRails() {
  for (let i = 0; i < N; i++) {
    // L-panel: horizontal rail at y = railYL(i)
    const yL = railYL(i);
    setSegment(railsL[i].rail, xToWorldL(X_MIN), yL, xToWorldL(X_MAX), yL);
    setSegment(railsL[i].tick, xToWorldL(0), yL - TICK_HALF, xToWorldL(0), yL + TICK_HALF);

    // R-panel: vertical rail at x = railXR(i)
    const xR = railXR(i);
    const yRTop = PANEL_R_CY + PANEL_R_H / 2;
    const yRBot = PANEL_R_CY - PANEL_R_H / 2;
    setSegment(railsR[i].rail, xR, yRBot, xR, yRTop);
    setSegment(railsR[i].tick, xR - TICK_HALF, PANEL_R_CY, xR + TICK_HALF, PANEL_R_CY);
  }
}

// --- coupling lines (left panel only) ------------------------------------

interface CouplingLine {
  i: number; j: number;
  line: Line2; geom: LineGeometry; mat: LineMaterial;
  positions: Float32Array;
}
const couplingLines: CouplingLine[] = [];
for (let i = 0; i < N - 1; i++) {
  for (let j = i + 1; j < N; j++) {
    const mat = new LineMaterial({
      color: COUPLING,
      linewidth: 1.5,
      worldUnits: false,
      depthTest: false,
      transparent: true,
      opacity: 0.5,
      dashed: true,
      dashSize: 0.10,
      gapSize: 0.07,
    });
    const positions = new Float32Array(6);
    const geom = new LineGeometry();
    geom.setPositions(positions);
    const line = new Line2(geom, mat);
    line.renderOrder = 2;
    line.computeLineDistances();
    app.scene.add(line);
    couplingLines.push({ i, j, line, geom, mat, positions });
  }
}

function updateLineResolution() {
  for (const cl of couplingLines) cl.mat.resolution.set(window.innerWidth, window.innerHeight);
}

const COUPLING_LW_MIN = 1.5;
const COUPLING_LW_MAX = 4.0;
const COUPLING_OP_MIN = 0.5;
const COUPLING_OP_MAX = 0.95;
const COUPLING_FIXED_MAX = 1.5;

function rebuildCouplingStyles() {
  for (const cl of couplingLines) {
    const w = Math.abs(H[cl.i][cl.j]);
    if (w < 1e-3) {
      cl.line.visible = false;
    } else {
      cl.line.visible = true;
      const t = Math.min(1, w / COUPLING_FIXED_MAX);
      cl.mat.linewidth = COUPLING_LW_MIN + (COUPLING_LW_MAX - COUPLING_LW_MIN) * t;
      cl.mat.opacity   = COUPLING_OP_MIN + (COUPLING_OP_MAX - COUPLING_OP_MIN) * t;
    }
  }
}

function updateCouplingPositions() {
  for (const cl of couplingLines) {
    if (!cl.line.visible) continue;
    cl.positions[0] = xToWorldL(clampX(x[cl.i]));
    cl.positions[1] = railYL(cl.i);
    cl.positions[2] = 0;
    cl.positions[3] = xToWorldL(clampX(x[cl.j]));
    cl.positions[4] = railYL(cl.j);
    cl.positions[5] = 0;
    cl.geom.setPositions(cl.positions);
    cl.line.computeLineDistances();
  }
}

// --- balls ----------------------------------------------------------------

const ballMatL = new THREE.MeshBasicMaterial({ color: MAROON,     depthTest: false });
const ballMatR = new THREE.MeshBasicMaterial({ color: SLATE_BLUE, depthTest: false });
const ballGeo  = new THREE.CircleGeometry(BALL_RADIUS, 36);
const ballsL: THREE.Mesh[] = [];
const ballsR: THREE.Mesh[] = [];
for (let i = 0; i < N; i++) {
  const mL = new THREE.Mesh(ballGeo, ballMatL);
  const mR = new THREE.Mesh(ballGeo, ballMatR);
  mL.renderOrder = 6; mR.renderOrder = 6;
  ballsL.push(mL); ballsR.push(mR);
  app.scene.add(mL); app.scene.add(mR);
}

function placeBalls() {
  for (let i = 0; i < N; i++) {
    ballsL[i].position.set(xToWorldL(clampX(x[i])), railYL(i), 0);
    ballsR[i].position.set(railXR(i), yToWorldR(clampX(y[i])), 0);
  }
}

// --- pointer interaction (both panels) ----------------------------------

const renderer = app.renderManager.renderer;
const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pickPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

type DragPanel = 'L' | 'R';
let dragPanel: DragPanel | null = null;
let dragIdx: number = 0;

function pointerWorld(e: PointerEvent): { wx: number; wy: number } | null {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, app.camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(pickPlane, hit)) return null;
  return { wx: hit.x, wy: hit.y };
}

function pickRailL(wx: number, wy: number): number | null {
  if (wx < xToWorldL(X_MIN) - 0.3 || wx > xToWorldL(X_MAX) + 0.3) return null;
  let bestIdx = -1, bestDy = Infinity;
  for (let i = 0; i < N; i++) {
    const dy = Math.abs(wy - railYL(i));
    if (dy < bestDy) { bestDy = dy; bestIdx = i; }
  }
  if (bestDy > PICK_RADIUS) return null;
  return bestIdx;
}

function pickRailR(wx: number, wy: number): number | null {
  // pick a vertical rail by horizontal distance to railXR(i); cursor must
  // also lie within the rail's vertical motion extent
  const yTop = PANEL_R_CY + PANEL_R_H / 2;
  const yBot = PANEL_R_CY - PANEL_R_H / 2;
  if (wy < yBot - 0.3 || wy > yTop + 0.3) return null;
  let bestIdx = -1, bestDx = Infinity;
  for (let i = 0; i < N; i++) {
    const dx = Math.abs(wx - railXR(i));
    if (dx < bestDx) { bestDx = dx; bestIdx = i; }
  }
  if (bestDx > PICK_RADIUS) return null;
  return bestIdx;
}

canvas.addEventListener('pointerdown', (e) => {
  const p = pointerWorld(e);
  if (!p) return;
  const idxL = pickRailL(p.wx, p.wy);
  if (idxL !== null) {
    dragPanel = 'L'; dragIdx = idxL;
    for (let i = 0; i < N; i++) v[i] = 0;
    x[idxL] = clampX(worldToXL(p.wx));
    updateY();
  } else {
    const idxR = pickRailR(p.wx, p.wy);
    if (idxR === null) return;
    dragPanel = 'R'; dragIdx = idxR;
    for (let i = 0; i < N; i++) v[i] = 0;
    y[idxR] = clampX(worldToYR(p.wy));
    updateXFromY();
  }
  placeBalls();
  updateCouplingPositions();
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (dragPanel === null) return;
  const p = pointerWorld(e);
  if (!p) return;
  if (dragPanel === 'L') {
    x[dragIdx] = clampX(worldToXL(p.wx));
    updateY();
  } else {
    y[dragIdx] = clampX(worldToYR(p.wy));
    updateXFromY();
  }
  placeBalls();
  updateCouplingPositions();
});

function endDrag(e: PointerEvent) {
  if (dragPanel === null) return;
  dragPanel = null;
  for (let i = 0; i < N; i++) v[i] = 0;
  canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// --- mode preset buttons ------------------------------------------------

function setMode(modeIdx: number) {
  let mx = 0;
  for (let k = 0; k < N; k++) mx = Math.max(mx, Math.abs(O[k][modeIdx]));
  const scale = mx > 0 ? IC_AMP / mx : 0;
  for (let k = 0; k < N; k++) {
    x[k] = O[k][modeIdx] * scale;
    v[k] = 0;
  }
  updateY();
  placeBalls();
  updateCouplingPositions();
}

// --- omega labels (under each vertical rail) ----------------------------

const omegaLabels: HTMLDivElement[] = [];
for (let i = 0; i < N; i++) {
  const lbl = document.createElement('div');
  lbl.className = 'omega-label';
  document.body.appendChild(lbl);
  omegaLabels.push(lbl);
}

const projVec = new THREE.Vector3();

function updateOmegaLabels() {
  const yWorldBelow = PANEL_R_CY - PANEL_R_H / 2 - 0.22;
  for (let i = 0; i < N; i++) {
    projVec.set(railXR(i), yWorldBelow, 0);
    projVec.project(app.camera);
    const sx = (projVec.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-projVec.y * 0.5 + 0.5) * window.innerHeight;
    const lbl = omegaLabels[i];
    lbl.style.left = sx + 'px';
    lbl.style.top  = sy + 'px';
    lbl.style.transform = 'translate(-50%, 0)';
    const w = omega[i];
    lbl.textContent = Number.isFinite(w) ? `ω = ${w.toFixed(2)}` : 'ω = —';
  }
}

// --- demo-local styles --------------------------------------------------

const localStyle = document.createElement('style');
localStyle.textContent = `
  .equation-label {
    position: fixed;
    left: 50%;
    top: 26px;
    transform: translateX(-50%);
    color: #333;
    font: 18px/1.2 monospace;
    pointer-events: none;
    z-index: 10;
    white-space: nowrap;
  }
  .equation-label .var { font-style: italic; }
  .omega-label {
    position: fixed;
    font: italic 11px/1 monospace;
    color: #555;
    pointer-events: none;
    z-index: 5;
    white-space: nowrap;
  }
  .mode-presets {
    display: flex;
    gap: 6px;
    margin-top: 12px;
    justify-content: center;
    flex-wrap: wrap;
  }
  .mode-button {
    padding: 4px 10px;
    font: 11px/1 monospace;
    background: rgba(255, 255, 255, 0.5);
    border: 1px solid #c0bdb6;
    border-radius: 3px;
    color: #444;
    cursor: pointer;
  }
  .mode-button:hover { background: rgba(255, 255, 255, 0.85); }
  @media (max-width: 700px) {
    .equation-label { font-size: 13px; top: 10px; }
    .omega-label { font-size: 9px; }
    .mode-presets { margin-top: 4px; gap: 4px; }
    .mode-button { padding: 2px 6px; font-size: 9px; }
  }
`;
document.head.appendChild(localStyle);

const eqLabel = document.createElement('div');
eqLabel.className = 'equation-label';
eqLabel.innerHTML = '<span class="var">x</span>″ + <span class="var">H</span><span class="var">x</span> = 0';
document.body.appendChild(eqLabel);

// --- matrix panel + mode buttons ----------------------------------------

const panel = setupMatrixPanel();
const panelNode = panel.node;

const presetWrap = document.createElement('div');
presetWrap.className = 'mode-presets';
for (let m = 0; m < N; m++) {
  const btn = document.createElement('button');
  btn.className = 'mode-button';
  btn.textContent = `mode ${m + 1}`;
  btn.addEventListener('click', () => setMode(m));
  presetWrap.appendChild(btn);
}
panel.appendBelow(presetWrap);

function applyHState(s: HState) {
  H = s.H;
  O = s.eigenvectors;
  omega = s.omega;
  posDef = s.isPosDef;
  for (let i = 0; i < N; i++) v[i] = 0;
  rebuildCouplingStyles();
  updateY();
  updateOmegaLabels();
}
applyHState(panel.state);
panel.onChange(applyHState);

// --- responsive layout --------------------------------------------------

function recomputeLayout() {
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  const aspect = ww / wh;
  const worldYHalf = 12 * Math.tan((30 * Math.PI / 180) / 2);
  const worldXHalf = worldYHalf * aspect;
  const pxPerWorld = wh / (worldYHalf * 2);

  const narrow = ww < NARROW_BREAKPOINT_PX;
  if (narrow) {
    // STACKED: x-panel (horizontal rails) on top, y-panel (vertical rails,
    // tightly spaced) below, both centered; matrix at bottom strip via CSS.
    const sideMargin = 0.35;
    const fullW = Math.max(2.4, worldXHalf * 2 - sideMargin * 2);

    PANEL_L_CX = 0;
    PANEL_L_W  = fullW;
    PANEL_L_H  = 1.45;
    PANEL_L_CY = 2.05;       // upper portion

    PANEL_R_CX = 0;
    PANEL_R_W  = Math.min(1.4, fullW * 0.55);
    PANEL_R_H  = 1.35;
    PANEL_R_CY = 0.45;       // middle, leaves bottom 1/3 of canvas for matrix DOM

    panelNode.style.left = '';
    panelNode.style.right = '';
    panelNode.style.top = '';
    panelNode.style.transform = '';
  } else {
    // SIDE-BY-SIDE: x-panel | y-panel | matrix, the trio centered together.
    // The y-panel is intentionally narrow: 4 vertical rails, tightly spaced.
    const panelPx = Math.max(160, panelNode.getBoundingClientRect().width || 254);
    const panelWorld = panelPx / pxPerWorld;
    const GAP_TO_MATRIX  = 0.45;
    const VIEWPORT_MARGIN = 0.4;
    const INTER_PANEL_GAP = 0.55;

    PANEL_R_W  = 1.4;
    PANEL_R_H  = 3.0;
    PANEL_R_CY = 0;

    const remaining =
      worldXHalf * 2 - panelWorld - GAP_TO_MATRIX - INTER_PANEL_GAP - VIEWPORT_MARGIN - PANEL_R_W;
    PANEL_L_W = Math.max(2.2, Math.min(3.6, remaining));
    PANEL_L_H = 2.9;
    PANEL_L_CY = 0;

    const compositeW = PANEL_L_W + INTER_PANEL_GAP + PANEL_R_W + GAP_TO_MATRIX + panelWorld;
    const startX = -compositeW / 2;
    PANEL_L_CX = startX + PANEL_L_W / 2;
    PANEL_R_CX = startX + PANEL_L_W + INTER_PANEL_GAP + PANEL_R_W / 2;

    const matrixLeftWorld = startX + PANEL_L_W + INTER_PANEL_GAP + PANEL_R_W + GAP_TO_MATRIX;
    const matrixLeftPx = ww / 2 + matrixLeftWorld * pxPerWorld;
    panelNode.style.left = matrixLeftPx + 'px';
    panelNode.style.right = 'auto';
    panelNode.style.top = '50%';
    panelNode.style.transform = 'translateY(-50%)';
  }

  redrawRails();
  placeBalls();
  updateCouplingPositions();
  updateLineResolution();
  updateOmegaLabels();
}

window.addEventListener('resize', recomputeLayout);

// --- animation -----------------------------------------------------------

let lastTime: number | null = null;

app.addAnimateCallback((time) => {
  if (lastTime === null) lastTime = time;
  const dtReal = Math.min(0.05, time - lastTime);
  lastTime = time;

  if (dragPanel === null && posDef) {
    advance(dtReal);
  }
  updateY();
  placeBalls();
  updateCouplingPositions();
});

// --- start ---------------------------------------------------------------

recomputeLayout();
setMode(0);   // start in mode 1 — one ball bobbing on the right panel
app.start();
requestAnimationFrame(recomputeLayout);
