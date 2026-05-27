/**
 * oscillator-coupled-linear-motion — the conservative system x'' + H x = 0
 * in lab coordinates, four coupled rails.
 *
 * The user edits the symmetric 4x4 matrix H in a side panel; this demo plays
 * the resulting motion. Click and drag any ball to move it: the simulation
 * pauses while you drag (the other balls freeze in place), then on release
 * the system continues from those positions with all velocities zero. When H
 * changes, velocities reset to zero and the trajectory continues from the
 * current positions under the new matrix. If H stops being positive definite,
 * the simulation freezes until it's valid again.
 *
 * Light gray dotted lines connect ball i to ball j whenever |H_ij| > 1e-3
 * for i != j; their thickness and opacity scale with |H_ij|.
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
const FRAME_COLOR = 0x8FA3B5;
const COUPLING    = 0xB5B0A4;

// --- physical layout ------------------------------------------------------

const N = 4;
const X_MIN = -2.5;
const X_MAX =  2.5;

let RAIL_Y_TOP =  1.45;
let RAIL_Y_BOT = -1.45;
let RAIL_Y_STEP = (RAIL_Y_TOP - RAIL_Y_BOT) / (N - 1);

const PICK_RADIUS = 0.30;
const BALL_RADIUS = 0.13;

// world-space rail box (recomputed on resize)
let RAIL_W  = 6.5;
let RAIL_CX = -1.0;
const NARROW_BREAKPOINT_PX = 700;

// --- coordinate maps ------------------------------------------------------

function xToWorld(xv: number): number {
  return RAIL_CX + ((xv - X_MIN) / (X_MAX - X_MIN) - 0.5) * RAIL_W;
}
function worldToX(wx: number): number {
  return X_MIN + ((wx - RAIL_CX) / RAIL_W + 0.5) * (X_MAX - X_MIN);
}
function railY(i: number): number {
  return RAIL_Y_TOP - i * RAIL_Y_STEP;
}
function clampX(xv: number): number {
  return Math.max(X_MIN, Math.min(X_MAX, xv));
}

// --- physics state --------------------------------------------------------

const x = new Float64Array(N);
const v = new Float64Array(N);

let H: number[][] = [];
let posDef = true;

const ESCAPE_LIMIT = 1e3;
const SUBSTEP = 0.008;

// --- RK4 ------------------------------------------------------------------

const tmpA  = new Float64Array(N);
const tmpX  = new Float64Array(N);
const tmpV  = new Float64Array(N);
const k1x   = new Float64Array(N), k1v = new Float64Array(N);
const k2x   = new Float64Array(N), k2v = new Float64Array(N);
const k3x   = new Float64Array(N), k3v = new Float64Array(N);
const k4x   = new Float64Array(N), k4v = new Float64Array(N);

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

// --- scene ----------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 12);
app.camera.fov = 30;
app.camera.updateProjectionMatrix();
app.controls.target.set(0, 0, 0);
app.controls.controls.enabled = false;
app.backgrounds.setColor(BG);

const frameMat = new THREE.LineBasicMaterial({ color: FRAME_COLOR });

interface RailGfx {
  rail: THREE.Line;
  tick: THREE.Line;
}
const rails: RailGfx[] = [];

function makeLine(): THREE.Line {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  return new THREE.Line(geo, frameMat);
}

for (let i = 0; i < N; i++) {
  const rail = makeLine();
  const tick = makeLine();
  rails.push({ rail, tick });
  app.scene.add(rail);
  app.scene.add(tick);
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
    const y = railY(i);
    setSegment(rails[i].rail, xToWorld(X_MIN), y, xToWorld(X_MAX), y);
    setSegment(rails[i].tick, xToWorld(0), y - TICK_HALF, xToWorld(0), y + TICK_HALF);
  }
}

// --- coupling lines -------------------------------------------------------

interface CouplingLine {
  i: number;
  j: number;
  line: Line2;
  geom: LineGeometry;
  mat: LineMaterial;
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
const COUPLING_FIXED_MAX = 1.5;   // |H_ij| at which line saturates at max thickness

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
    cl.positions[0] = xToWorld(clampX(x[cl.i]));
    cl.positions[1] = railY(cl.i);
    cl.positions[2] = 0;
    cl.positions[3] = xToWorld(clampX(x[cl.j]));
    cl.positions[4] = railY(cl.j);
    cl.positions[5] = 0;
    cl.geom.setPositions(cl.positions);
    cl.line.computeLineDistances();
  }
}

// --- balls ----------------------------------------------------------------

const ballMat = new THREE.MeshBasicMaterial({ color: MAROON, depthTest: false });
const ballGeo = new THREE.CircleGeometry(BALL_RADIUS, 36);
const balls: THREE.Mesh[] = [];
for (let i = 0; i < N; i++) {
  const m = new THREE.Mesh(ballGeo, ballMat);
  m.renderOrder = 6;
  balls.push(m);
  app.scene.add(m);
}

function placeBalls() {
  for (let i = 0; i < N; i++) {
    balls[i].position.set(xToWorld(clampX(x[i])), railY(i), 0);
  }
}

// --- pointer interaction -------------------------------------------------

const renderer = app.renderManager.renderer;
const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pickPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

let dragIdx: number | null = null;

function pointerWorld(e: PointerEvent): { wx: number; wy: number } | null {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, app.camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(pickPlane, hit)) return null;
  return { wx: hit.x, wy: hit.y };
}

function pickRail(wx: number, wy: number): number | null {
  let bestIdx = -1, bestDy = Infinity;
  for (let i = 0; i < N; i++) {
    const dy = Math.abs(wy - railY(i));
    if (dy < bestDy) { bestDy = dy; bestIdx = i; }
  }
  if (bestDy > PICK_RADIUS) return null;
  if (wx < xToWorld(X_MIN) - 0.3 || wx > xToWorld(X_MAX) + 0.3) return null;
  return bestIdx;
}

canvas.addEventListener('pointerdown', (e) => {
  const p = pointerWorld(e);
  if (!p) return;
  const idx = pickRail(p.wx, p.wy);
  if (idx === null) return;
  dragIdx = idx;
  for (let i = 0; i < N; i++) v[i] = 0;
  x[idx] = clampX(worldToX(p.wx));
  placeBalls();
  updateCouplingPositions();
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (dragIdx === null) return;
  const p = pointerWorld(e);
  if (!p) return;
  x[dragIdx] = clampX(worldToX(p.wx));
  placeBalls();
  updateCouplingPositions();
});

function endDrag(e: PointerEvent) {
  if (dragIdx === null) return;
  dragIdx = null;
  for (let i = 0; i < N; i++) v[i] = 0;
  canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// --- equation label ------------------------------------------------------

const labelStyle = document.createElement('style');
labelStyle.textContent = `
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
  @media (max-width: 700px) {
    .equation-label { font-size: 13px; top: 10px; }
  }
`;
document.head.appendChild(labelStyle);

const eqLabel = document.createElement('div');
eqLabel.className = 'equation-label';
eqLabel.innerHTML = '<span class="var">x</span>″ + <span class="var">H</span><span class="var">x</span> = 0';
document.body.appendChild(eqLabel);

// --- matrix panel hookup -------------------------------------------------

const panel = setupMatrixPanel();
const panelNode = panel.node;

// --- responsive layout ---------------------------------------------------

function recomputeLayout() {
  const ww = window.innerWidth;
  const wh = window.innerHeight;
  const aspect = ww / wh;
  // camera fov = 30 (vertical), distance = 12: world y half = 12 * tan(15°)
  const worldYHalf = 12 * Math.tan((30 * Math.PI / 180) / 2);
  const worldXHalf = worldYHalf * aspect;
  const pxPerWorld = wh / (worldYHalf * 2);

  const narrow = ww < NARROW_BREAKPOINT_PX;
  if (narrow) {
    // panel is at the bottom; rails centered and shifted up so they clear
    // the matrix DOM strip at the bottom of the iframe
    RAIL_CX = 0;
    RAIL_W = Math.min(7.0, worldXHalf * 1.75);
    RAIL_Y_TOP =  1.95;
    RAIL_Y_BOT = -0.55;
    RAIL_Y_STEP = (RAIL_Y_TOP - RAIL_Y_BOT) / (N - 1);
    panelNode.style.left = '';
    panelNode.style.right = '';
    panelNode.style.top = '';
    panelNode.style.transform = '';
  } else {
    // measure actual rendered panel width (after CSS lays it out)
    const panelPx = Math.max(160, panelNode.getBoundingClientRect().width || 254);
    const panelWorld = panelPx / pxPerWorld;
    const GAP_WORLD = 0.45;
    const VIEWPORT_MARGIN = 0.4;

    const targetRailHalf = Math.min(3.5, worldXHalf - panelWorld - GAP_WORLD - VIEWPORT_MARGIN);
    RAIL_W = Math.max(3.0, targetRailHalf * 2);
    // center the rails+panel composite around world x = 0
    RAIL_CX = -(panelWorld + GAP_WORLD) / 2;

    // place panel left edge at rails right edge + gap
    const railsRightWorld = RAIL_CX + RAIL_W / 2;
    const panelLeftWorld = railsRightWorld + GAP_WORLD;
    const panelLeftPx = ww / 2 + panelLeftWorld * pxPerWorld;
    panelNode.style.left = panelLeftPx + 'px';
    panelNode.style.right = 'auto';
    panelNode.style.top = '50%';
    panelNode.style.transform = 'translateY(-50%)';
    RAIL_Y_TOP =  1.45;
    RAIL_Y_BOT = -1.45;
    RAIL_Y_STEP = (RAIL_Y_TOP - RAIL_Y_BOT) / (N - 1);
  }

  redrawRails();
  placeBalls();
  updateCouplingPositions();
  updateLineResolution();
}

window.addEventListener('resize', recomputeLayout);

function applyHState(s: HState) {
  H = s.H;
  posDef = s.isPosDef;
  // restart from current state with zero velocities under new H
  for (let i = 0; i < N; i++) v[i] = 0;
  rebuildCouplingStyles();
  updateCouplingPositions();
}
applyHState(panel.state);
panel.onChange(applyHState);

// --- animation -----------------------------------------------------------

let lastTime: number | null = null;

app.addAnimateCallback((time) => {
  if (lastTime === null) lastTime = time;
  const dtReal = Math.min(0.05, time - lastTime);
  lastTime = time;

  if (dragIdx === null && posDef) {
    advance(dtReal);
  }
  placeBalls();
  updateCouplingPositions();
});

// --- start ---------------------------------------------------------------

recomputeLayout();
// modest starting IC so the user sees motion right away
x[0] = 1.5;
placeBalls();
updateCouplingPositions();
app.start();
// re-run once the panel has been measured by the browser
requestAnimationFrame(recomputeLayout);
