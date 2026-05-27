/**
 * oscillator-linear-driven-motion — watch the damped driven linear oscillator
 * move against its quadratic potential backdrop.
 *
 *   V(x) = 1/2 x^2
 *   x'' + 2 gamma x' + x = A cos(omega t).
 *
 * The upper panel draws the harmonic potential; the lower motion
 * rail shows the maroon ball moving horizontally from one fixed initial
 * condition under the linear damped-driven dynamics.
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

// --- layout ---------------------------------------------------------------

const RIGHT_W  = 8.2;
const RIGHT_CX = 0;

const POTENTIAL_H  = 2.15;
const POTENTIAL_CY = 0.62;

const MOTION_CY = -0.92;
const MOTION_PICK_RADIUS = 0.22;

const X_MIN = -5;
const X_MAX =  5;
const V_MIN = -1.5;
const V_MAX = 8;

const POTENTIAL_SAMPLES = 640;
const DT = 0.02;
const T_MAX = 80;
const N_STEPS = Math.round(T_MAX / DT) + 1;
const PLAYBACK_SPEED = 1.6;
const DRIVER_VISUAL_AMPLITUDE = 0.9;
const DRIVER_BALL_SPACING = 0.32;
const DRIVER_BASE_MIN = X_MIN - DRIVER_VISUAL_AMPLITUDE;
const DRIVER_BASE_MAX = X_MAX + DRIVER_VISUAL_AMPLITUDE;
const DRIVER_BALL_COUNT = Math.ceil((DRIVER_BASE_MAX - DRIVER_BASE_MIN) / DRIVER_BALL_SPACING) + 1;

// --- coordinate maps ------------------------------------------------------

function xToWorld(x: number): number {
  return RIGHT_CX + ((x - X_MIN) / (X_MAX - X_MIN) - 0.5) * RIGHT_W;
}

function worldToX(wx: number): number {
  return X_MIN + ((wx - RIGHT_CX) / RIGHT_W + 0.5) * (X_MAX - X_MIN);
}

function potentialToWorld(value: number): number {
  return POTENTIAL_CY + ((value - V_MIN) / (V_MAX - V_MIN) - 0.5) * POTENTIAL_H;
}

function potential(x: number): number {
  return 0.5 * x * x;
}

// --- integration ----------------------------------------------------------

let gamma = 0.3;
let omega = 0.5;
let driveAmp = 1.0;
const INITIAL_V = 0;
let selectedInitialX = 1.6;

interface Solution {
  xs: Float32Array;
  validLength: number;
}

function acceleration(t: number, x: number, v: number): number {
  return -2 * gamma * v - x + driveAmp * Math.cos(omega * t);
}

function integrate(x0: number, v0: number): Solution {
  const xs = new Float32Array(N_STEPS);
  xs[0] = x0;

  let x = x0;
  let v = v0;
  let t = 0;
  let validLength = 1;
  const halfDt = 0.5 * DT;

  for (let i = 1; i < N_STEPS; i++) {
    const k1x = v;
    const k1v = acceleration(t, x, v);

    const x2 = x + halfDt * k1x;
    const v2 = v + halfDt * k1v;
    const k2x = v2;
    const k2v = acceleration(t + halfDt, x2, v2);

    const x3 = x + halfDt * k2x;
    const v3 = v + halfDt * k2v;
    const k3x = v3;
    const k3v = acceleration(t + halfDt, x3, v3);

    const x4 = x + DT * k3x;
    const v4 = v + DT * k3v;
    const k4x = v4;
    const k4v = acceleration(t + DT, x4, v4);

    x += (DT / 6) * (k1x + 2 * k2x + 2 * k3x + k4x);
    v += (DT / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
    t += DT;

    if (!Number.isFinite(x) || Math.abs(x) > 20) break;
    xs[i] = x;
    validLength = i + 1;
  }

  return { xs, validLength };
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

function segment(p1: [number, number], p2: [number, number]): THREE.Line {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(p1[0], p1[1], 0),
    new THREE.Vector3(p2[0], p2[1], 0),
  ]);
  return new THREE.Line(geo, frameMat);
}

app.scene.add(rectFrame(RIGHT_CX, POTENTIAL_CY, RIGHT_W, POTENTIAL_H));
app.scene.add(segment([xToWorld(X_MIN), potentialToWorld(0)], [xToWorld(X_MAX), potentialToWorld(0)]));
app.scene.add(segment([xToWorld(0), POTENTIAL_CY - POTENTIAL_H / 2], [xToWorld(0), POTENTIAL_CY + POTENTIAL_H / 2]));
app.scene.add(segment([xToWorld(X_MIN), MOTION_CY], [xToWorld(X_MAX), MOTION_CY]));

// --- potential curve ------------------------------------------------------

const potentialMat = new LineMaterial({
  color: MAROON,
  linewidth: 2.5,
  worldUnits: false,
  depthTest: false,
});

function updateLineResolution() {
  potentialMat.resolution.set(window.innerWidth, window.innerHeight);
}
updateLineResolution();
window.addEventListener('resize', updateLineResolution);

const potentialPositions = new Float32Array(POTENTIAL_SAMPLES * 3);
const potentialGeometry = new LineGeometry();
const potentialLine = new Line2(potentialGeometry, potentialMat);
potentialLine.renderOrder = 3;
app.scene.add(potentialLine);

function redrawPotential() {
  for (let i = 0; i < POTENTIAL_SAMPLES; i++) {
    const x = X_MIN + (X_MAX - X_MIN) * (i / (POTENTIAL_SAMPLES - 1));
    const value = potential(x);
    if (value >= V_MIN && value <= V_MAX) {
      potentialPositions[i * 3 + 0] = xToWorld(x);
      potentialPositions[i * 3 + 1] = potentialToWorld(value);
      potentialPositions[i * 3 + 2] = 0;
    } else {
      potentialPositions[i * 3 + 0] = NaN;
      potentialPositions[i * 3 + 1] = NaN;
      potentialPositions[i * 3 + 2] = NaN;
    }
  }
  potentialGeometry.setPositions(potentialPositions);
}

// --- selected initial condition and moving ball ---------------------------

const ballMat = new THREE.MeshBasicMaterial({ color: MAROON, depthTest: false });
const driverMat = new THREE.MeshBasicMaterial({ color: DRIVER_BLUE, depthTest: false });

const driverBallGeo = new THREE.CircleGeometry(0.045, 20);
const driverBalls: THREE.Mesh[] = [];
for (let i = 0; i < DRIVER_BALL_COUNT; i++) {
  const driverBall = new THREE.Mesh(driverBallGeo, driverMat);
  driverBall.renderOrder = 4;
  driverBalls.push(driverBall);
  app.scene.add(driverBall);
}

const ball = new THREE.Mesh(new THREE.CircleGeometry(0.105, 32), ballMat);
ball.renderOrder = 6;
app.scene.add(ball);

let solution = integrate(selectedInitialX, INITIAL_V);
let animationStart: number | null = null;

function setBallFromX(x: number) {
  ball.visible = x >= X_MIN && x <= X_MAX;
  if (ball.visible) ball.position.set(xToWorld(x), MOTION_CY, 0);
}

function setDriverFromTime(t: number) {
  const shift = DRIVER_VISUAL_AMPLITUDE * driveAmp * Math.cos(omega * t);
  for (let i = 0; i < DRIVER_BALL_COUNT; i++) {
    const x = DRIVER_BASE_MIN + i * DRIVER_BALL_SPACING + shift;
    driverBalls[i].visible = x >= X_MIN && x <= X_MAX;
    if (driverBalls[i].visible) driverBalls[i].position.set(xToWorld(x), MOTION_CY, 0);
  }
}

function rebuildSolution(restart: boolean) {
  solution = integrate(selectedInitialX, INITIAL_V);
  setBallFromX(selectedInitialX);
  redrawPotential();
  if (restart) animationStart = null;
}

// --- rail interaction -----------------------------------------------------

const renderer = app.renderManager.renderer;
const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pickPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

function pointerToRailX(e: PointerEvent): number | null {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(ndc, app.camera);

  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(pickPlane, hit)) return null;
  if (Math.abs(hit.y - MOTION_CY) > MOTION_PICK_RADIUS) return null;
  if (hit.x < xToWorld(X_MIN) || hit.x > xToWorld(X_MAX)) return null;
  return worldToX(hit.x);
}

canvas.addEventListener('pointerdown', (e) => {
  const x = pointerToRailX(e);
  if (x === null) return;
  selectedInitialX = x;
  rebuildSolution(true);
});

// --- DOM slider -----------------------------------------------------------

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
  .osc-controls { position: fixed; left: 50%; bottom: 38px; transform: translateX(-50%); display: grid; grid-template-columns: max-content max-content; column-gap: 30px; row-gap: 10px; pointer-events: auto; z-index: 10; }
  .equation-label { position: fixed; left: 50%; top: 32px; transform: translateX(-50%); color: #333; font: 18px/1.2 monospace; letter-spacing: 0; pointer-events: none; z-index: 10; white-space: nowrap; }
  .equation-label .var { font-style: italic; }
`;
document.head.appendChild(sliderStyle);

const equationLabel = document.createElement('div');
equationLabel.className = 'equation-label';
equationLabel.innerHTML =
  '<span class="var">x</span>\u2033 + 2\u03b3<span class="var">x</span>\u2032 + ' +
  '<span class="var">x</span> = ' +
  '<span class="var">A</span> cos(\u03c9<span class="var">t</span>)';
document.body.appendChild(equationLabel);

const sliderWrap = document.createElement('div');
sliderWrap.className = 'osc-controls';
sliderWrap.innerHTML = `
  <div class="osc-row">
    <span class="label">γ</span>
    <input id="osc-gamma" type="range" class="thin-slider" min="0.05" max="1.5" step="0.01" value="${gamma}" />
    <span class="value" id="osc-gamma-v">${gamma.toFixed(2)}</span>
  </div>
  <div class="osc-row">
    <span class="label">A</span>
    <input id="osc-drive" type="range" class="thin-slider" min="0" max="2" step="0.01" value="${driveAmp}" />
    <span class="value" id="osc-drive-v">${driveAmp.toFixed(2)}</span>
  </div>
  <div></div>
  <div class="osc-row">
    <span class="label">ω</span>
    <input id="osc-omega" type="range" class="thin-slider" min="0.1" max="3" step="0.01" value="${omega}" />
    <span class="value" id="osc-omega-v">${omega.toFixed(2)}</span>
  </div>
`;
document.body.appendChild(sliderWrap);

const gammaSlider = sliderWrap.querySelector<HTMLInputElement>('#osc-gamma')!;
const omegaSlider = sliderWrap.querySelector<HTMLInputElement>('#osc-omega')!;
const driveSlider = sliderWrap.querySelector<HTMLInputElement>('#osc-drive')!;
const gammaReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-gamma-v')!;
const omegaReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-omega-v')!;
const driveReadout = sliderWrap.querySelector<HTMLSpanElement>('#osc-drive-v')!;

gammaSlider.addEventListener('input', () => {
  gamma = parseFloat(gammaSlider.value);
  gammaReadout.textContent = gamma.toFixed(2);
  rebuildSolution(true);
});

omegaSlider.addEventListener('input', () => {
  omega = parseFloat(omegaSlider.value);
  omegaReadout.textContent = omega.toFixed(2);
  rebuildSolution(true);
});

driveSlider.addEventListener('input', () => {
  driveAmp = parseFloat(driveSlider.value);
  driveReadout.textContent = driveAmp.toFixed(2);
  rebuildSolution(true);
});

// --- animation ------------------------------------------------------------

app.addAnimateCallback((time) => {
  if (animationStart === null) animationStart = time;

  const elapsed = (time - animationStart) * PLAYBACK_SPEED;
  setDriverFromTime(elapsed);

  if (solution.validLength === 0) return;
  const sample = Math.floor((elapsed / DT) % solution.validLength);
  setBallFromX(solution.xs[sample]);
});

// --- start ---------------------------------------------------------------

redrawPotential();
rebuildSolution(true);
setDriverFromTime(0);
app.start();
