/**
 * Hopf Wiggle — interactive curve on S² with live Hopf torus
 *
 * A curve on S² wiggles in real time and the corresponding Hopf torus
 * updates every frame. Press 1-4 to switch presets.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { HopfTorus, fromSpherical } from '@/math/hopf';
import { fromSphericalCoords } from '@/math/hopf/hopfUtils';

const TWO_PI = 2 * Math.PI;

// --- Geometry resolution ---
const U_SEGS = 128;
const V_SEGS = 128;
const CURVE_SAMPLES = 256;

// --- Presets ---

interface Preset {
  name: string;
  freq: number;
  ampBase: number;
  ampWiggle: number;
  speed: number;
  phi0: number;
}

const presets: Preset[] = [
  { name: 'Gentle (n=3)',   freq: 3,  ampBase: 0.3,  ampWiggle: 0.25, speed: 0.4, phi0: Math.PI / 2 },
  { name: 'Figure-8 (n=2)', freq: 2,  ampBase: 0.5,  ampWiggle: 0.3,  speed: 0.3, phi0: Math.PI / 2 },
  { name: 'Ripple (n=7)',   freq: 7,  ampBase: 0.12, ampWiggle: 0.1,  speed: 0.6, phi0: Math.PI / 2 },
  { name: 'Deep (n=3)',     freq: 3,  ampBase: 0.7,  ampWiggle: 0.25, speed: 0.2, phi0: Math.PI / 2 },
];

let preset = presets[0];
let amp = preset.ampBase;
let freq = preset.freq;
let phi0 = preset.phi0;

// --- Curve functions (read from mutable state) ---

function sphericalCurve(t: number): { phi: number; theta: number } {
  return {
    phi: phi0 + amp * Math.cos(freq * t),
    theta: t + 0.3 * amp * Math.sin(2 * freq * t),
  };
}

function cartesianCurve(t: number): THREE.Vector3 {
  return fromSphericalCoords(sphericalCurve(t));
}

// --- App setup ---

const app = new App({ antialias: true });
app.camera.fov = 24;
app.camera.updateProjectionMatrix();
app.camera.position.set(5, 15, 35);
app.controls.target.set(0, 0, 0);
app.controls.update();

app.backgrounds.loadHDR('/assets/hdri/studio.hdr', {
  asEnvironment: true,
  asBackground: false,
  intensity: 1.5,
});
app.backgrounds.setColor(0xf0f0f0);

// --- Hopf torus (using the class for correctness) ---

const hopf = new HopfTorus({ curve: cartesianCurve, resolution: 512 });

// Build torus geometry with mutable position buffer
const torusGeom = new THREE.BufferGeometry();
const vertCount = (U_SEGS + 1) * (V_SEGS + 1);
const positions = new Float32Array(vertCount * 3);
const uvs = new Float32Array(vertCount * 2);
const indices: number[] = [];

// Static: UVs and triangle indices
for (let i = 0; i <= V_SEGS; i++) {
  for (let j = 0; j <= U_SEGS; j++) {
    const k = i * (U_SEGS + 1) + j;
    uvs[k * 2] = j / U_SEGS;
    uvs[k * 2 + 1] = i / V_SEGS;
  }
}
for (let i = 0; i < V_SEGS; i++) {
  for (let j = 0; j < U_SEGS; j++) {
    const v0 = i * (U_SEGS + 1) + j;
    const v1 = (i + 1) * (U_SEGS + 1) + j;
    const v2 = i * (U_SEGS + 1) + (j + 1);
    const v3 = (i + 1) * (U_SEGS + 1) + (j + 1);
    indices.push(v0, v2, v1, v1, v2, v3);
  }
}

torusGeom.setIndex(indices);
torusGeom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
torusGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

function updateTorusPositions() {
  const pos = torusGeom.getAttribute('position') as THREE.Float32BufferAttribute;
  for (let i = 0; i <= V_SEGS; i++) {
    const v = i / V_SEGS;
    for (let j = 0; j <= U_SEGS; j++) {
      const u = j / U_SEGS;
      const pt = hopf.evaluate(u, v);
      const k = i * (U_SEGS + 1) + j;
      pos.setXYZ(k, pt.x, pt.y, pt.z);
    }
  }
  pos.needsUpdate = true;
  torusGeom.computeVertexNormals();
}

updateTorusPositions();

const torusMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  roughness: 0.15,
  metalness: 0.05,
  clearcoat: 1.0,
  clearcoatRoughness: 0.05,
  side: THREE.DoubleSide,
});
const torusMesh = new THREE.Mesh(torusGeom, torusMat);
app.scene.add(torusMesh);

// --- Reference sphere with curve ---

const SPHERE_R = 2.5;
const SPHERE_POS = new THREE.Vector3(-12, -6, -5);

const sphereGeom = new THREE.SphereGeometry(SPHERE_R, 32, 24);
const sphereMat = new THREE.MeshPhysicalMaterial({
  color: 0xeeeeee,
  transmission: 0.92,
  roughness: 0.1,
  thickness: 0.3,
  side: THREE.DoubleSide,
});
const sphereMesh = new THREE.Mesh(sphereGeom, sphereMat);
sphereMesh.position.copy(SPHERE_POS);
sphereMesh.rotation.x = -Math.PI / 2;
app.scene.add(sphereMesh);

// Curve drawn on the sphere as a LineLoop
const curvePositions = new Float32Array(CURVE_SAMPLES * 3);
const curveGeom = new THREE.BufferGeometry();
curveGeom.setAttribute('position', new THREE.Float32BufferAttribute(curvePositions, 3));
const curveLine = new THREE.LineLoop(
  curveGeom,
  new THREE.LineBasicMaterial({ color: 0xe03030, linewidth: 2 }),
);
curveLine.position.copy(SPHERE_POS);
curveLine.rotation.x = -Math.PI / 2;
app.scene.add(curveLine);

function updateCurveOnSphere() {
  const pos = curveGeom.getAttribute('position') as THREE.Float32BufferAttribute;
  for (let i = 0; i < CURVE_SAMPLES; i++) {
    const t = TWO_PI * i / CURVE_SAMPLES;
    const pt = cartesianCurve(t).multiplyScalar(SPHERE_R * 1.005);
    pos.setXYZ(i, pt.x, pt.y, pt.z);
  }
  pos.needsUpdate = true;
}

updateCurveOnSphere();

// --- Label ---

const label = document.createElement('div');
label.style.cssText =
  'position:fixed;top:16px;left:16px;color:#333;font:14px/1.4 monospace;' +
  'background:rgba(255,255,255,0.85);padding:6px 10px;border-radius:4px;pointer-events:none;';
document.body.appendChild(label);

function updateLabel() {
  label.textContent = `${preset.name}  [1-${presets.length} to switch]`;
}
updateLabel();

// --- Keyboard ---

window.addEventListener('keydown', (e) => {
  const num = parseInt(e.key);
  if (num >= 1 && num <= presets.length) {
    preset = presets[num - 1];
    updateLabel();
  }
});

// --- Animation ---

app.addAnimateCallback((elapsed) => {
  // Wiggle the amplitude
  amp = preset.ampBase * Math.sin(elapsed * preset.speed * TWO_PI);
  freq = preset.freq;
  phi0 = preset.phi0;

  // Rebuild tables (cheap at resolution=512)
  hopf.rebuild();

  // Update torus vertex positions
  updateTorusPositions();

  // Update S² curve
  updateCurveOnSphere();
});

app.start();
