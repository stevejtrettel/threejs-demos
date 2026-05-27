/**
 * oscillator-coupled-driven-motion — two harmonic oscillators with an
 * anharmonic coupling, uniform damping gamma, and a common drive A cos(Omega t)
 * applied to each.
 *
 *   V(x1, x2) = 1/2 omega_1^2 x_1^2 + 1/2 omega_2^2 x_2^2 + epsilon x_1^2 x_2
 *
 *   x1'' + 2 gamma x1' + omega_1^2 x_1 + 2 epsilon x_1 x_2 = A cos(Omega t)
 *   x2'' + 2 gamma x2' + omega_2^2 x_2 + epsilon x_1^2     = A cos(Omega t)
 *
 * Two horizontal rails with maroon balls and a gray coupling line whose
 * linewidth scales with |epsilon|. A row of slate-blue driver balls flows
 * along each rail, shifted by A cos(Omega t). Click a ball, drag along its
 * rail, release: the integrated dynamics pause during drag (driver balls
 * keep flowing) and restart from the chosen positions with zero velocity.
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
const DRIVER_BLUE = 0x8FA3B5;
const COUPLING    = 0x8A8A8A;

// --- layout ---------------------------------------------------------------

const RAIL_W   = 8.2;
const RAIL_CX  = 0;
const RAIL_TOP_Y    = 1.05;
const RAIL_BOTTOM_Y = -1.05;

const X_MIN = -3;
const X_MAX =  3;

const PICK_RADIUS = 0.28;
const BALL_RADIUS = 0.135;

const DRIVER_VISUAL_AMPLITUDE = 0.55;
const DRIVER_BALL_SPACING     = 0.30;
const DRIVER_BASE_MIN = X_MIN - DRIVER_VISUAL_AMPLITUDE * 2;
const DRIVER_BASE_MAX = X_MAX + DRIVER_VISUAL_AMPLITUDE * 2;
const DRIVER_BALL_COUNT = Math.ceil((DRIVER_BASE_MAX - DRIVER_BASE_MIN) / DRIVER_BALL_SPACING) + 1;

// --- coordinate maps ------------------------------------------------------

function xToWorld(x: number): number {
  return RAIL_CX + ((x - X_MIN) / (X_MAX - X_MIN) - 0.5) * RAIL_W;
}

function worldToX(wx: number): number {
  return X_MIN + ((wx - RAIL_CX) / RAIL_W + 0.5) * (X_MAX - X_MIN);
}

function clampX(x: number): number {
  return Math.max(X_MIN, Math.min(X_MAX, x));
}

// --- physics --------------------------------------------------------------

let omega1   = 1.0;
let omega2   = 1.4;
let epsilon  = 0.15;
let gamma    = 0.15;
let driveAmp = 1.0;
let Omega    = 1.2;

let x1 = 0, v1 = 0;
let x2 = 0, v2 = 0;
let t  = 0;

function accel(x1v: number, v1v: number, x2v: number, v2v: number, tv: number): [number, number] {
  const drive = driveAmp * Math.cos(Omega * tv);
  const a1 = -2 * gamma * v1v - omega1 * omega1 * x1v - 2 * epsilon * x1v * x2v + drive;
  const a2 = -2 * gamma * v2v - omega2 * omega2 * x2v - epsilon * x1v * x1v     + drive;
  return [a1, a2];
}

const SUBSTEP = 0.008;
const ESCAPE_LIMIT = 8;

function rk4Step(dt: number) {
  const [a1, a2] = accel(x1, v1, x2, v2, t);
  const k1x1 = v1, k1x2 = v2, k1v1 = a1, k1v2 = a2;

  const x1b = x1 + 0.5 * dt * k1x1;
  const x2b = x2 + 0.5 * dt * k1x2;
  const v1b = v1 + 0.5 * dt * k1v1;
  const v2b = v2 + 0.5 * dt * k1v2;
  const [a1b, a2b] = accel(x1b, v1b, x2b, v2b, t + 0.5 * dt);
  const k2x1 = v1b, k2x2 = v2b, k2v1 = a1b, k2v2 = a2b;

  const x1c = x1 + 0.5 * dt * k2x1;
  const x2c = x2 + 0.5 * dt * k2x2;
  const v1c = v1 + 0.5 * dt * k2v1;
  const v2c = v2 + 0.5 * dt * k2v2;
  const [a1c, a2c] = accel(x1c, v1c, x2c, v2c, t + 0.5 * dt);
  const k3x1 = v1c, k3x2 = v2c, k3v1 = a1c, k3v2 = a2c;

  const x1d = x1 + dt * k3x1;
  const x2d = x2 + dt * k3x2;
  const v1d = v1 + dt * k3v1;
  const v2d = v2 + dt * k3v2;
  const [a1d, a2d] = accel(x1d, v1d, x2d, v2d, t + dt);
  const k4x1 = v1d, k4x2 = v2d, k4v1 = a1d, k4v2 = a2d;

  x1 += (dt / 6) * (k1x1 + 2 * k2x1 + 2 * k3x1 + k4x1);
  x2 += (dt / 6) * (k1x2 + 2 * k2x2 + 2 * k3x2 + k4x2);
  v1 += (dt / 6) * (k1v1 + 2 * k2v1 + 2 * k3v1 + k4v1);
  v2 += (dt / 6) * (k1v2 + 2 * k2v2 + 2 * k3v2 + k4v2);
  t  += dt;
}

function advanceDynamics(dtReal: number) {
  let remaining = dtReal;
  while (remaining > 1e-9) {
    const step = Math.min(SUBSTEP, remaining);
    rk4Step(step);
    remaining -= step;
    if (Math.abs(x1) > ESCAPE_LIMIT || Math.abs(x2) > ESCAPE_LIMIT) {
      x1 = 0; v1 = 0; x2 = 0; v2 = 0;
      return;
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

function segment(p1: [number, number], p2: [number, number]): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(p1[0], p1[1], 0),
    new THREE.Vector3(p2[0], p2[1], 0),
  ]);
  return new THREE.Line(geo, frameMat);
}

app.scene.add(segment([xToWorld(X_MIN), RAIL_TOP_Y],    [xToWorld(X_MAX), RAIL_TOP_Y]));
app.scene.add(segment([xToWorld(X_MIN), RAIL_BOTTOM_Y], [xToWorld(X_MAX), RAIL_BOTTOM_Y]));

const TICK = 0.06;
app.scene.add(segment([xToWorld(0), RAIL_TOP_Y - TICK], [xToWorld(0), RAIL_TOP_Y + TICK]));
app.scene.add(segment([xToWorld(0), RAIL_BOTTOM_Y - TICK], [xToWorld(0), RAIL_BOTTOM_Y + TICK]));

// --- coupling line --------------------------------------------------------

const couplingMat = new LineMaterial({
  color: COUPLING,
  linewidth: 1,
  worldUnits: false,
  depthTest: false,
  transparent: true,
  opacity: 0.85,
});

function updateLineResolution() {
  couplingMat.resolution.set(window.innerWidth, window.innerHeight);
}
updateLineResolution();
window.addEventListener('resize', updateLineResolution);

const couplingPositions = new Float32Array(2 * 3);
const couplingGeometry = new LineGeometry();
couplingGeometry.setPositions(couplingPositions);
const couplingLine = new Line2(couplingGeometry, couplingMat);
couplingLine.renderOrder = 2;
app.scene.add(couplingLine);

const COUPLING_LW_MIN = 0.6;
const COUPLING_LW_MAX = 5.5;
const EPS_VIS_MAX = 0.5;

function updateCouplingLine() {
  const w1 = xToWorld(clampX(x1)), w2 = xToWorld(clampX(x2));
  couplingPositions[0] = w1; couplingPositions[1] = RAIL_TOP_Y;    couplingPositions[2] = 0;
  couplingPositions[3] = w2; couplingPositions[4] = RAIL_BOTTOM_Y; couplingPositions[5] = 0;
  couplingGeometry.setPositions(couplingPositions);

  const eps = Math.min(Math.abs(epsilon) / EPS_VIS_MAX, 1);
  if (eps < 1e-3) {
    couplingLine.visible = false;
  } else {
    couplingLine.visible = true;
    couplingMat.linewidth = COUPLING_LW_MIN + (COUPLING_LW_MAX - COUPLING_LW_MIN) * eps;
    couplingMat.opacity = 0.45 + 0.45 * eps;
  }
}

// --- driver ball rows -----------------------------------------------------

const driverMat = new THREE.MeshBasicMaterial({ color: DRIVER_BLUE, depthTest: false });
const driverGeo = new THREE.CircleGeometry(0.045, 20);

function makeDriverRow(railY: number): THREE.Mesh[] {
  const balls: THREE.Mesh[] = [];
  for (let i = 0; i < DRIVER_BALL_COUNT; i++) {
    const m = new THREE.Mesh(driverGeo, driverMat);
    m.renderOrder = 4;
    m.position.y = railY;
    balls.push(m);
    app.scene.add(m);
  }
  return balls;
}

const driversTop    = makeDriverRow(RAIL_TOP_Y);
const driversBottom = makeDriverRow(RAIL_BOTTOM_Y);

function updateDriverRow(balls: THREE.Mesh[], shift: number) {
  for (let i = 0; i < DRIVER_BALL_COUNT; i++) {
    const x = DRIVER_BASE_MIN + i * DRIVER_BALL_SPACING + shift;
    const visible = x >= X_MIN && x <= X_MAX;
    balls[i].visible = visible;
    if (visible) balls[i].position.x = xToWorld(x);
  }
}

function updateDrivers() {
  const shift = DRIVER_VISUAL_AMPLITUDE * driveAmp * Math.cos(Omega * t);
  updateDriverRow(driversTop, shift);
  updateDriverRow(driversBottom, shift);
}

// --- balls ----------------------------------------------------------------

const ballMat = new THREE.MeshBasicMaterial({ color: MAROON, depthTest: false });
const ballGeo = new THREE.CircleGeometry(BALL_RADIUS, 36);

const ball1 = new THREE.Mesh(ballGeo, ballMat);
ball1.renderOrder = 6;
app.scene.add(ball1);

const ball2 = new THREE.Mesh(ballGeo, ballMat);
ball2.renderOrder = 6;
app.scene.add(ball2);

function placeBalls() {
  ball1.position.set(xToWorld(clampX(x1)), RAIL_TOP_Y, 0);
  ball2.position.set(xToWorld(clampX(x2)), RAIL_BOTTOM_Y, 0);
}

// --- pointer / drag interaction ------------------------------------------

const renderer = app.renderManager.renderer;
const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pickPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

type DragTarget = 1 | 2 | null;
let dragging: DragTarget = null;

function pointerWorld(e: PointerEvent): { wx: number; wy: number } | null {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, app.camera);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(pickPlane, hit)) return null;
  return { wx: hit.x, wy: hit.y };
}

function pickBall(wx: number, wy: number): DragTarget {
  const dxTop    = wx - xToWorld(clampX(x1));
  const dyTop    = wy - RAIL_TOP_Y;
  const dxBottom = wx - xToWorld(clampX(x2));
  const dyBottom = wy - RAIL_BOTTOM_Y;
  const dTop    = Math.hypot(dxTop, dyTop);
  const dBottom = Math.hypot(dxBottom, dyBottom);
  if (dTop < PICK_RADIUS && dTop <= dBottom) return 1;
  if (dBottom < PICK_RADIUS) return 2;
  if (Math.abs(wy - RAIL_TOP_Y) < PICK_RADIUS) return 1;
  if (Math.abs(wy - RAIL_BOTTOM_Y) < PICK_RADIUS) return 2;
  return null;
}

canvas.addEventListener('pointerdown', (e) => {
  const p = pointerWorld(e);
  if (!p) return;
  const which = pickBall(p.wx, p.wy);
  if (which === null) return;
  dragging = which;
  v1 = 0; v2 = 0;
  if (dragging === 1) x1 = clampX(worldToX(p.wx));
  else                x2 = clampX(worldToX(p.wx));
  placeBalls();
  updateCouplingLine();
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (dragging === null) return;
  const p = pointerWorld(e);
  if (!p) return;
  if (dragging === 1) x1 = clampX(worldToX(p.wx));
  else                x2 = clampX(worldToX(p.wx));
  placeBalls();
  updateCouplingLine();
});

function endDrag(e: PointerEvent) {
  if (dragging === null) return;
  dragging = null;
  v1 = 0; v2 = 0;
  canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// --- DOM controls ---------------------------------------------------------

const sliderStyle = document.createElement('style');
sliderStyle.textContent = `
  .thin-slider { -webkit-appearance: none; appearance: none; width: 120px; height: 5px; margin: 0; background: transparent; outline: none; cursor: pointer; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.25)); }
  .thin-slider::-webkit-slider-runnable-track { height: 5px; background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.45); border-radius: 999px; box-sizing: border-box; }
  .thin-slider::-moz-range-track { height: 5px; background: rgba(255,255,255,0.95); border: 1px solid rgba(0,0,0,0.45); border-radius: 999px; box-sizing: border-box; }
  .thin-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; margin-top: -5px; background: #fff; border: 1.5px solid rgba(0,0,0,0.8); border-radius: 50%; box-sizing: border-box; cursor: pointer; }
  .thin-slider::-moz-range-thumb { width: 14px; height: 14px; background: #fff; border: 1.5px solid rgba(0,0,0,0.8); border-radius: 50%; box-sizing: border-box; cursor: pointer; }
  .thin-slider:focus { outline: none; }
  .osc-row { display: flex; align-items: center; gap: 10px; color: #333; font: 14px/1 monospace; }
  .osc-row .label { width: 22px; text-align: right; }
  .osc-row .value { width: 40px; color: #666; font-size: 12px; }
  .osc-controls { position: fixed; left: 50%; bottom: 38px; transform: translateX(-50%); display: grid; grid-template-columns: max-content max-content max-content; column-gap: 18px; row-gap: 10px; pointer-events: auto; z-index: 10; }
  .equation-label { position: fixed; left: 50%; top: 32px; transform: translateX(-50%); color: #333; font: 18px/1.2 monospace; letter-spacing: 0; pointer-events: none; z-index: 10; white-space: nowrap; }
  .equation-label .var { font-style: italic; }
  .equation-label sub { font-size: 0.75em; }
`;
document.head.appendChild(sliderStyle);

const equationLabel = document.createElement('div');
equationLabel.className = 'equation-label';
equationLabel.innerHTML =
  '<span class="var">x</span>″<sub>i</sub> + ' +
  '2γ<span class="var">x</span>′<sub>i</sub> + ' +
  '∂<sub>i</sub><span class="var">V</span> = ' +
  '<span class="var">A</span> cos(Ω<span class="var">t</span>)';
document.body.appendChild(equationLabel);

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
    <span class="label">ε</span>
    <input id="osc-epsilon" type="range" class="thin-slider" min="0" max="0.5" step="0.005" value="${epsilon}" />
    <span class="value" id="osc-epsilon-v">${epsilon.toFixed(3)}</span>
  </div>
  <div class="osc-row">
    <span class="label">γ</span>
    <input id="osc-gamma" type="range" class="thin-slider" min="0" max="1.0" step="0.01" value="${gamma}" />
    <span class="value" id="osc-gamma-v">${gamma.toFixed(2)}</span>
  </div>
  <div class="osc-row">
    <span class="label">A</span>
    <input id="osc-drive" type="range" class="thin-slider" min="0" max="2" step="0.01" value="${driveAmp}" />
    <span class="value" id="osc-drive-v">${driveAmp.toFixed(2)}</span>
  </div>
  <div class="osc-row">
    <span class="label">Ω</span>
    <input id="osc-Omega" type="range" class="thin-slider" min="0.1" max="3" step="0.01" value="${Omega}" />
    <span class="value" id="osc-Omega-v">${Omega.toFixed(2)}</span>
  </div>
`;
document.body.appendChild(sliderWrap);

const omega1Slider  = sliderWrap.querySelector<HTMLInputElement>('#osc-omega1')!;
const omega2Slider  = sliderWrap.querySelector<HTMLInputElement>('#osc-omega2')!;
const epsilonSlider = sliderWrap.querySelector<HTMLInputElement>('#osc-epsilon')!;
const gammaSlider   = sliderWrap.querySelector<HTMLInputElement>('#osc-gamma')!;
const driveSlider   = sliderWrap.querySelector<HTMLInputElement>('#osc-drive')!;
const OmegaSlider   = sliderWrap.querySelector<HTMLInputElement>('#osc-Omega')!;
const omega1Read    = sliderWrap.querySelector<HTMLSpanElement>('#osc-omega1-v')!;
const omega2Read    = sliderWrap.querySelector<HTMLSpanElement>('#osc-omega2-v')!;
const epsilonRead   = sliderWrap.querySelector<HTMLSpanElement>('#osc-epsilon-v')!;
const gammaRead     = sliderWrap.querySelector<HTMLSpanElement>('#osc-gamma-v')!;
const driveRead     = sliderWrap.querySelector<HTMLSpanElement>('#osc-drive-v')!;
const OmegaRead     = sliderWrap.querySelector<HTMLSpanElement>('#osc-Omega-v')!;

omega1Slider.addEventListener('input',  () => { omega1   = parseFloat(omega1Slider.value);  omega1Read.textContent  = omega1.toFixed(2); });
omega2Slider.addEventListener('input',  () => { omega2   = parseFloat(omega2Slider.value);  omega2Read.textContent  = omega2.toFixed(2); });
epsilonSlider.addEventListener('input', () => { epsilon  = parseFloat(epsilonSlider.value); epsilonRead.textContent = epsilon.toFixed(3); updateCouplingLine(); });
gammaSlider.addEventListener('input',   () => { gamma    = parseFloat(gammaSlider.value);   gammaRead.textContent   = gamma.toFixed(2); });
driveSlider.addEventListener('input',   () => { driveAmp = parseFloat(driveSlider.value);   driveRead.textContent   = driveAmp.toFixed(2); });
OmegaSlider.addEventListener('input',   () => { Omega    = parseFloat(OmegaSlider.value);   OmegaRead.textContent   = Omega.toFixed(2); });

// --- animation -----------------------------------------------------------

const PLAYBACK_SPEED = 1.0;
let lastTime: number | null = null;

app.addAnimateCallback((time) => {
  if (lastTime === null) lastTime = time;
  const dtReal = Math.min(0.05, (time - lastTime) * PLAYBACK_SPEED);
  lastTime = time;

  if (dragging === null) {
    advanceDynamics(dtReal);
  } else {
    t += dtReal;
  }
  placeBalls();
  updateCouplingLine();
  updateDrivers();
});

// --- start ---------------------------------------------------------------

placeBalls();
updateCouplingLine();
updateDrivers();
app.start();
