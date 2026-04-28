/**
 * Blog: Parameterizing Sphere Linkages — Animation 1
 *
 * psi^3_L drawn in T^3 alongside its T^2 projection.
 *  - Left:  fundamental cube [-π, π]^3 with the curve psi^3_L(t) = (θ₁, θ₂, θ₃).
 *  - Right: square [-π, π]^2 with the projected curve (θ₁, θ₂).
 * A draggable t-slider highlights the corresponding point on both pictures.
 * L-slider deforms the curves continuously.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { NumericalCurve, CurveTube } from '@/math';

// --- Palette ---

const BG       = 0xF0EDE8; // background
const GRID     = 0xD9D2C6; // subtle warm tint (unused in this demo, reserved)
const SEPIA    = 0x8C7B62; // frame outlines
const BURGUNDY = 0x7A1F2C; // curves, dragged ball

void GRID;

// --- psi^3_L (rod-angle form, post §3) ---

function psi3(t: number, L: number): [number, number, number] {
  const alpha = Math.acos((L * L - 3) / (2 * L));
  const theta = alpha * Math.sin(t);
  const sigma = Math.cos(t) >= 0 ? 1 : -1;
  const d     = Math.sqrt(L * L - 2 * L * Math.cos(theta) + 1);
  const R     = Math.atan2(-Math.sin(theta), L - Math.cos(theta));
  const beta  = Math.acos(d / 2);
  return [R + sigma * beta, R - sigma * beta, theta];
}

// --- State ---

let L = 2.4;
let tParam = 0;

// --- Scene ---

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 7.5);
app.controls.target.set(0, 0, 0);
app.backgrounds.setColor(BG);

// Warm three-point rig — keeps burgundy from going muddy on the warm bg.
app.scene.add(new THREE.AmbientLight(0xfff3e0, 0.55));

const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(4, 5, 6);
app.scene.add(key);

const fill = new THREE.DirectionalLight(0xffe6c4, 0.7);
fill.position.set(-5, -2, 4);
app.scene.add(fill);

const rim = new THREE.DirectionalLight(0xfff8ec, 0.6);
rim.position.set(-2, 4, -3);
app.scene.add(rim);

// --- Layout: two side-by-side panels at the same scale ---

const PANEL_SCALE = 0.55;       // shrink the [-π, π] cube/square to fit
const PANEL_OFFSET_X = 2.5;     // half the gap between panel centers

// === LEFT PANEL: T^3 ===

const cubeGroup = new THREE.Group();
cubeGroup.position.set(-PANEL_OFFSET_X, 0, 0);
cubeGroup.scale.setScalar(PANEL_SCALE);
app.scene.add(cubeGroup);

const cubeEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * Math.PI, 2 * Math.PI, 2 * Math.PI)),
  new THREE.LineBasicMaterial({ color: SEPIA }),
);
cubeGroup.add(cubeEdges);

const CURVE_SAMPLES = 400;

function sampleCubeCurve(Lval: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = new Array(CURVE_SAMPLES);
  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const t = -Math.PI + (2 * Math.PI * i) / CURVE_SAMPLES;
    const [a, b, c] = psi3(t, Lval);
    pts[i] = new THREE.Vector3(a, b, c);
  }
  return pts;
}

const cubeCurve = new NumericalCurve({
  points: sampleCubeCurve(L),
  closed: true,
  curveType: 'catmullrom',
  tension: 0.5,
});

const cubeTube = new CurveTube({
  curve: cubeCurve,
  radius: 0.10,
  tubularSegments: CURVE_SAMPLES,
  radialSegments: 12,
  showEndpoints: false,
  color: BURGUNDY,
  roughness: 0.28,
  metalness: 0.05,
});
cubeGroup.add(cubeTube);

const cubeBall = new THREE.Mesh(
  new THREE.SphereGeometry(0.28, 24, 24),
  new THREE.MeshPhysicalMaterial({
    color: BURGUNDY,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18,
  }),
);
cubeGroup.add(cubeBall);

// === RIGHT PANEL: T^2 ===

const squareGroup = new THREE.Group();
squareGroup.position.set(PANEL_OFFSET_X, 0, 0);
squareGroup.scale.setScalar(PANEL_SCALE);
app.scene.add(squareGroup);

const squareGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-Math.PI, -Math.PI, 0),
  new THREE.Vector3( Math.PI, -Math.PI, 0),
  new THREE.Vector3( Math.PI,  Math.PI, 0),
  new THREE.Vector3(-Math.PI,  Math.PI, 0),
]);
const squareEdges = new THREE.LineLoop(
  squareGeo,
  new THREE.LineBasicMaterial({ color: SEPIA }),
);
squareGroup.add(squareEdges);

function sampleSquareCurve(Lval: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = new Array(CURVE_SAMPLES);
  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const t = -Math.PI + (2 * Math.PI * i) / CURVE_SAMPLES;
    const [a, b] = psi3(t, Lval);
    pts[i] = new THREE.Vector3(a, b, 0);
  }
  return pts;
}

const squareCurve = new NumericalCurve({
  points: sampleSquareCurve(L),
  closed: true,
  curveType: 'catmullrom',
  tension: 0.5,
});

const squareTube = new CurveTube({
  curve: squareCurve,
  radius: 0.10,
  tubularSegments: CURVE_SAMPLES,
  radialSegments: 12,
  showEndpoints: false,
  color: BURGUNDY,
  roughness: 0.28,
  metalness: 0.05,
});
squareGroup.add(squareTube);

const squareBall = new THREE.Mesh(
  new THREE.SphereGeometry(0.28, 24, 24),
  new THREE.MeshPhysicalMaterial({
    color: BURGUNDY,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18,
  }),
);
squareGroup.add(squareBall);

// --- Update ---

function updateBalls() {
  const [a, b, c] = psi3(tParam, L);
  cubeBall.position.set(a, b, c);
  squareBall.position.set(a, b, 0);
}

function rebuildCurves() {
  cubeCurve.updatePoints(sampleCubeCurve(L));
  squareCurve.updatePoints(sampleSquareCurve(L));
  updateBalls();
}

// --- UI: inline pill slider, lower-right ---

const style = document.createElement('style');
style.textContent = `
  .slider-wrapper {
    position: absolute;
    bottom: 16px;
    right: 16px;
    left: auto;
    max-width: 33%;
    min-width: 200px;
    padding: 8px 10px;
    background: transparent;
    pointer-events: auto;
    z-index: 10;
  }
  .thin-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 5px;
    margin: 0;
    background: transparent;
    outline: none;
    cursor: pointer;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
  }
  .thin-slider::-webkit-slider-runnable-track {
    height: 5px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.45);
    border-radius: 999px;
    box-sizing: border-box;
  }
  .thin-slider::-moz-range-track {
    height: 5px;
    background: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(0, 0, 0, 0.45);
    border-radius: 999px;
    box-sizing: border-box;
  }
  .thin-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    margin-top: -5px;
    background: #fff;
    border: 1.5px solid rgba(0, 0, 0, 0.8);
    border-radius: 50%;
    box-shadow: none;
    box-sizing: border-box;
    cursor: pointer;
  }
  .thin-slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    background: #fff;
    border: 1.5px solid rgba(0, 0, 0, 0.8);
    border-radius: 50%;
    box-shadow: none;
    box-sizing: border-box;
    cursor: pointer;
  }
  .thin-slider:focus { outline: none; }
`;
document.head.appendChild(style);

const sliderWrap = document.createElement('div');
sliderWrap.className = 'slider-wrapper';
sliderWrap.innerHTML = `
  <input id="psi3-L" type="range" class="thin-slider"
    min="1.05" max="2.95" step="0.01" value="${L}" />
`;
document.body.appendChild(sliderWrap);

const lSlider = sliderWrap.querySelector<HTMLInputElement>('#psi3-L')!;
lSlider.addEventListener('input', () => {
  L = parseFloat(lSlider.value);
  rebuildCurves();
});

// --- Animate t around the circle ---

const PERIOD = 8; // seconds for one full loop

app.addAnimateCallback((elapsed) => {
  tParam = ((elapsed / PERIOD) * 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  updateBalls();
});

updateBalls();
app.start();
