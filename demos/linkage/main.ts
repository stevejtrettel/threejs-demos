/**
 * Planar Linkage — 3-rod pinned chain, psi3 path
 *
 * Main view: the chain moving in the plane, centered at the origin.
 * Lower-left of the scene: the same path drawn in configuration space
 * as a curve in T³, with a ball tracking the current (θ₁, θ₂, θ₃).
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import {
  buildPlanarChain,
  setChainAngles,
  LinkageMesh,
  NumericalCurve,
  CurveTube,
} from '@/math';
import type { Joint } from '@/math/linkages';

// --- Path ---

function psi3(t: number, L: number): [number, number, number] {
  const alpha = Math.acos((L * L - 3) / (2 * L));
  const theta1 = alpha * Math.cos(t);
  const sigma = Math.sin(t) >= 0 ? 1 : -1;

  const c1 = Math.cos(theta1);
  const s1 = Math.sin(theta1);

  const d = Math.sqrt(L * L - 2 * L * c1 + 1);
  const beta = Math.acos(d / 2);
  const gamma = Math.atan2(-s1, L - c1);

  const theta2 = gamma + sigma * beta;
  const theta3 = gamma - sigma * beta;

  return [theta1, theta2, theta3];
}

// --- Main-view chain setup ---

const ROD_LENGTHS = [1, 1, 1];
let L = 2.4;

const chain = buildPlanarChain({
  lengths: ROD_LENGTHS,
  pinA: [-L / 2, 0],
  pinB: [L / 2, 0],
});

function setL(newL: number) {
  L = newL;
  const newJoints: Joint[] = chain.joints.map((j) => {
    if (j.id === 0) return { id: 0, pinned: [-L / 2, 0] };
    if (j.id === chain.joints.length - 1) return { id: j.id, pinned: [L / 2, 0] };
    return { id: j.id };
  });
  chain.params.set('joints', newJoints);
  rebuildConfigCurve();
  rebuildProjCurve();
}

// --- Scene ---

const app = new App({ antialias: true, debug: true });
app.camera.position.set(0, 0, 9);
app.controls.target.set(0, 0, 0);
app.backgrounds.setColor(0xf4f4f4);

app.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const key = new THREE.DirectionalLight(0xffffff, 1.2);
key.position.set(2, 3, 5);
app.scene.add(key);

// --- Chain mesh ---

const chainMesh = new LinkageMesh(chain, {
  rodRadius: 0.045,
  jointRadius: 0.085,
  rodColor: 0x222222,
  freeJointColor: 0x3388ff,
  pinnedJointColor: 0xff5522,
});
app.scene.add(chainMesh);

setChainAngles(chain, psi3(0, L));

// --- Configuration-space view (lower-left, same scene, same camera) ---
//
// The path lies in T³, visualized via its fundamental cube [-π, π]³.
// We group everything in a THREE.Group, scale it down, and translate
// so it sits beside the chain without overlapping.

const configGroup = new THREE.Group();
const CONFIG_SCALE = 0.3;           // make the cube ~1.9 units wide
const CONFIG_ORIGIN: [number, number, number] = [-3.6, -2.2, 0];
configGroup.position.set(...CONFIG_ORIGIN);
configGroup.scale.setScalar(CONFIG_SCALE);
app.scene.add(configGroup);

// Fundamental cube outline
const cubeEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * Math.PI, 2 * Math.PI, 2 * Math.PI)),
  new THREE.LineBasicMaterial({ color: 0xaaaaaa })
);
configGroup.add(cubeEdges);

// Path (NumericalCurve through samples of psi3, closed)
const CURVE_SAMPLES = 400;
function sampleConfigCurve(Lval: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = new Array(CURVE_SAMPLES);
  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const t = (2 * Math.PI * i) / CURVE_SAMPLES;
    const [a, b, c] = psi3(t, Lval);
    pts[i] = new THREE.Vector3(a, b, c);
  }
  return pts;
}

const configCurve = new NumericalCurve({
  points: sampleConfigCurve(L),
  closed: true,
  curveType: 'catmullrom',
  tension: 0.5,
});

const configTube = new CurveTube({
  curve: configCurve,
  radius: 0.15,
  tubularSegments: CURVE_SAMPLES,
  radialSegments: 10,
  showEndpoints: false,
  color: 0x3388ff,
  roughness: 0.35,
});
configGroup.add(configTube);

function rebuildConfigCurve() {
  configCurve.updatePoints(sampleConfigCurve(L));
}

// Current-configuration ball
const ball = new THREE.Mesh(
  new THREE.SphereGeometry(0.35, 20, 20),
  new THREE.MeshPhysicalMaterial({ color: 0xff5522, roughness: 0.3, metalness: 0.1 })
);
configGroup.add(ball);

// --- (θ₁, θ₂) projection view (lower-right) ---

const projGroup = new THREE.Group();
projGroup.position.set(3.6, -2.2, 0);
projGroup.scale.setScalar(CONFIG_SCALE);
app.scene.add(projGroup);

// Square outline [-π, π]²
const squareGeo = new THREE.BufferGeometry().setFromPoints([
  new THREE.Vector3(-Math.PI, -Math.PI, 0),
  new THREE.Vector3(Math.PI, -Math.PI, 0),
  new THREE.Vector3(Math.PI, Math.PI, 0),
  new THREE.Vector3(-Math.PI, Math.PI, 0),
]);
const squareEdges = new THREE.LineLoop(
  squareGeo,
  new THREE.LineBasicMaterial({ color: 0xaaaaaa })
);
projGroup.add(squareEdges);

// (θ₁, θ₂) curve — same samples as the 3D curve, just drop the third coord
function sampleProjCurve(Lval: number): THREE.Vector3[] {
  const pts: THREE.Vector3[] = new Array(CURVE_SAMPLES);
  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const t = (2 * Math.PI * i) / CURVE_SAMPLES;
    const [a, b] = psi3(t, Lval);
    pts[i] = new THREE.Vector3(a, b, 0);
  }
  return pts;
}

const projCurve = new NumericalCurve({
  points: sampleProjCurve(L),
  closed: true,
  curveType: 'catmullrom',
  tension: 0.5,
});

const projTube = new CurveTube({
  curve: projCurve,
  radius: 0.15,
  tubularSegments: CURVE_SAMPLES,
  radialSegments: 10,
  showEndpoints: false,
  color: 0x3388ff,
  roughness: 0.35,
});
projGroup.add(projTube);

function rebuildProjCurve() {
  projCurve.updatePoints(sampleProjCurve(L));
}

const projBall = new THREE.Mesh(
  new THREE.SphereGeometry(0.35, 20, 20),
  new THREE.MeshPhysicalMaterial({ color: 0xff5522, roughness: 0.3, metalness: 0.1 })
);
projGroup.add(projBall);

// --- UI: L slider ---

const panel = document.createElement('div');
panel.style.cssText =
  'position:fixed;top:16px;left:16px;color:#333;font:14px/1.4 monospace;' +
  'background:rgba(255,255,255,0.9);padding:10px 14px;border-radius:6px;' +
  'display:flex;flex-direction:column;gap:6px;min-width:220px;z-index:10;';
panel.innerHTML = `
  <label style="display:flex;justify-content:space-between;align-items:center;">
    <span>L</span>
    <span id="linkage-L-value">${L.toFixed(2)}</span>
  </label>
  <input id="linkage-L" type="range" min="2" max="3" step="0.01" value="${L}" />
`;
document.body.appendChild(panel);

const slider = panel.querySelector<HTMLInputElement>('#linkage-L')!;
const readout = panel.querySelector<HTMLSpanElement>('#linkage-L-value')!;
slider.addEventListener('input', () => {
  const v = parseFloat(slider.value);
  readout.textContent = v.toFixed(2);
  setL(v);
});

// --- Animate ---

const PERIOD = 6;

app.addAnimateCallback((elapsed) => {
  const t = (2 * Math.PI * elapsed) / PERIOD;
  const angles = psi3(t, L);
  setChainAngles(chain, angles);
  ball.position.set(angles[0], angles[1], angles[2]);
  projBall.position.set(angles[0], angles[1], 0);
});

app.start();

(window as any).chain = chain;
(window as any).psi3 = psi3;
