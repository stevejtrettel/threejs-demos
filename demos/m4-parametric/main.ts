/**
 * Blog: Parameterizing Sphere Linkages — Animation 3
 *
 * Abstract S² ↔ image surface in T³.
 *  - Left:  abstract sphere (silver) parameterized by (φ, t); draggable
 *           burgundy ball.
 *  - Right: fundamental cube [-π, π]³ (sepia edges) with the image
 *           surface psi^4_L composed with projection to (θ₁, θ₂, θ₃).
 * Drag the ball on the abstract sphere to drive both the abstract point
 * and its image. L slider deforms the image surface.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SurfaceMesh } from '@/math';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

// --- Palette ---

const BG          = 0xF0EDE8;
const SEPIA       = 0x8C7B62;
const BURGUNDY    = 0x7A1F2C;    // dragged ball
const CREAM       = 0xE2D8C0;    // sphere/image surface
const CREAM_DEEP  = 0xBFB294;    // grid lines — darker cream, quietly sits under sphere tone

// --- psi^4_L (rod-angle form, post §5) ---
//
// `psi4Display` flips φ before feeding it into the parameterization, so that
// points on the camera-facing hemisphere of the abstract sphere map to the
// camera-facing region of the image surface in T³ — purely a visual coupling
// trick to make front-of-domain ↔ front-of-codomain read naturally.

function psi4Display(phi: number, t: number, L: number): [number, number, number, number] {
  return psi4(-phi, t, L);
}

function psi4(phi: number, t: number, L: number): [number, number, number, number] {
  // Outer level
  const alpha = Math.acos((L * L - 8) / (2 * L));
  const theta = alpha * Math.sin(phi);
  const d     = Math.sqrt(L * L - 2 * L * Math.cos(theta) + 1);
  const R     = Math.atan2(-Math.sin(theta), L - Math.cos(theta));

  // Inner Psi^3_d(t)
  const alpha_in = Math.acos((d * d - 3) / (2 * d));
  const theta_in = alpha_in * Math.sin(t);
  const sigma    = Math.cos(t) >= 0 ? 1 : -1;
  const d_in     = Math.sqrt(d * d - 2 * d * Math.cos(theta_in) + 1);
  const R_in     = Math.atan2(-Math.sin(theta_in), d - Math.cos(theta_in));
  const beta_in  = Math.acos(d_in / 2);

  return [
    R + R_in + sigma * beta_in,
    R + R_in - sigma * beta_in,
    R + theta_in,
    theta,
  ];
}

// --- State ---

let L = 3.0;
let phiState = 0;
let tState = 0;
let autoAnimate = true;
let resumeTimer: number | null = null;
const RESUME_DELAY_MS = 1000;

// --- Scene ---

const app = new App({ antialias: true, debug: false });
app.camera.position.set(1.0, 1.0, 5.8);
app.controls.target.set(0, 0, 0);
app.backgrounds.setColor(BG);

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

const PANEL_SCALE = 0.55;
const PANEL_OFFSET_X = 2.4;
const SPHERE_R = Math.PI;     // matches the cube's half-side at panel-local scale

// === LEFT PANEL: abstract S² ===

const sphereGroup = new THREE.Group();
sphereGroup.position.set(-PANEL_OFFSET_X, 0, 0);
sphereGroup.scale.setScalar(PANEL_SCALE);
app.scene.add(sphereGroup);

const abstractSurface: Surface = {
  // u = phi (latitude), v = t (longitude)
  evaluate(u: number, v: number): THREE.Vector3 {
    return new THREE.Vector3(
      SPHERE_R * Math.cos(u) * Math.cos(v),
      SPHERE_R * Math.cos(u) * Math.sin(v),
      SPHERE_R * Math.sin(u),
    );
  },
  getDomain(): SurfaceDomain {
    return { uMin: -Math.PI / 2, uMax: Math.PI / 2, vMin: 0, vMax: 2 * Math.PI };
  },
};

const abstractMesh = new SurfaceMesh(abstractSurface, {
  uSegments: 48,
  vSegments: 96,
  color: CREAM,
  roughness: 0.32,
  metalness: 0.0,
});
{
  const mat = abstractMesh.material as THREE.MeshPhysicalMaterial;
  mat.clearcoat = 0.85;
  mat.clearcoatRoughness = 0.18;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
}
sphereGroup.add(abstractMesh);

const abstractBall = new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 24, 24),
  new THREE.MeshPhysicalMaterial({
    color: BURGUNDY,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18,
  }),
);
sphereGroup.add(abstractBall);

// === RIGHT PANEL: T³ cube + image surface ===

const cubeGroup = new THREE.Group();
cubeGroup.position.set(PANEL_OFFSET_X, 0, 0);
cubeGroup.scale.setScalar(PANEL_SCALE);
app.scene.add(cubeGroup);

const cubeEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(2 * Math.PI, 2 * Math.PI, 2 * Math.PI)),
  new THREE.LineBasicMaterial({ color: SEPIA }),
);
cubeGroup.add(cubeEdges);

const imageSurface: Surface = {
  // u = phi, v = t — return (θ₁, θ₂, θ₃), the projection of psi^4_L into T³.
  // Use the front-flipped variant so the camera-facing region of this surface
  // corresponds to the camera-facing region of the abstract sphere.
  evaluate(u: number, v: number): THREE.Vector3 {
    const [a, b, c] = psi4Display(u, v, L);
    return new THREE.Vector3(a, b, c);
  },
  getDomain(): SurfaceDomain {
    return { uMin: -Math.PI / 2, uMax: Math.PI / 2, vMin: 0, vMax: 2 * Math.PI };
  },
};

const imageMesh = new SurfaceMesh(imageSurface, {
  uSegments: 64,
  vSegments: 128,
  color: CREAM,
  roughness: 0.32,
  metalness: 0.0,
});
{
  const mat = imageMesh.material as THREE.MeshPhysicalMaterial;
  mat.clearcoat = 0.85;
  mat.clearcoatRoughness = 0.18;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
}
cubeGroup.add(imageMesh);

const imageBall = new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 24, 24),
  new THREE.MeshPhysicalMaterial({
    color: BURGUNDY,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18,
  }),
);
cubeGroup.add(imageBall);

// --- Grid lines (latitude + longitude) on both panels ---
//
// Same (φ, t) parameter grid drawn twice:
//  - on the abstract sphere via the spherical evaluator,
//  - on the image surface via psi^4_L.
// Reading the two side by side shows how the parameterization deforms the
// grid into T³.

// Two grids interleaved at half-spacing: majors at every other slot, minors
// in between. Major: 5 latitudes (every 30°) + 8 longitudes (every 45°).
// Minor: the in-between half-spacings.
const N_LAT_MAJOR = 5;
const N_LON_MAJOR = 8;
const N_LAT_TOTAL = 2 * N_LAT_MAJOR + 1;     // 11 latitude lines (every 15°)
const N_LON_TOTAL = 2 * N_LON_MAJOR;         // 16 longitude lines (every 22.5°)
const SAMPLES_PER_LINE = 240;
const MAJOR_RADIUS = 0.025;
const MINOR_RADIUS = 0.011;

const lineMat = new THREE.MeshPhysicalMaterial({
  color: CREAM_DEEP,
  roughness: 0.4,
  metalness: 0.0,
  clearcoat: 0.4,
  clearcoatRoughness: 0.3,
});

type Evaluator = (u: number, v: number) => THREE.Vector3;

function buildLineTube(samples: THREE.Vector3[], closed: boolean, radius: number): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(samples, closed, 'catmullrom', 0.5);
  const geom = new THREE.TubeGeometry(curve, samples.length, radius, 8, closed);
  return new THREE.Mesh(geom, lineMat);
}

// Generate the two families of lines for a given evaluator. Returns a Group
// containing all tube meshes so we can swap/dispose collectively. Indices
// alternate major/minor so neighboring lines get different radii.
function buildGridLines(evaluator: Evaluator): THREE.Group {
  const group = new THREE.Group();

  // Latitudes: φ fixed, v sweeps a full loop (closed curve).
  for (let i = 1; i <= N_LAT_TOTAL; i++) {
    const phi = -Math.PI / 2 + (i * Math.PI) / (N_LAT_TOTAL + 1);
    const radius = i % 2 === 0 ? MAJOR_RADIUS : MINOR_RADIUS;
    const samples: THREE.Vector3[] = new Array(SAMPLES_PER_LINE);
    for (let j = 0; j < SAMPLES_PER_LINE; j++) {
      const v = (2 * Math.PI * j) / SAMPLES_PER_LINE;
      samples[j] = evaluator(phi, v);
    }
    group.add(buildLineTube(samples, true, radius));
  }

  // Longitudes: v fixed, φ sweeps pole to pole (open curve).
  for (let k = 0; k < N_LON_TOTAL; k++) {
    const v = (2 * Math.PI * k) / N_LON_TOTAL;
    const radius = k % 2 === 0 ? MAJOR_RADIUS : MINOR_RADIUS;
    const samples: THREE.Vector3[] = new Array(SAMPLES_PER_LINE);
    for (let j = 0; j < SAMPLES_PER_LINE; j++) {
      const phi = -Math.PI / 2 + (Math.PI * j) / (SAMPLES_PER_LINE - 1);
      samples[j] = evaluator(phi, v);
    }
    group.add(buildLineTube(samples, false, radius));
  }

  return group;
}

function disposeGridLines(group: THREE.Group) {
  for (const child of group.children) {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  }
}

// Abstract sphere lines — built once, never rebuilt.
const abstractLines = buildGridLines((phi, v) => abstractSurface.evaluate(phi, v));
sphereGroup.add(abstractLines);

// Image-surface lines — rebuilt whenever L changes. Uses the same flipped
// parameterization as the image surface so the grid lines lie on it.
let imageLines = buildGridLines((phi, v) => {
  const [a, b, c] = psi4Display(phi, v, L);
  return new THREE.Vector3(a, b, c);
});
cubeGroup.add(imageLines);

function rebuildImageLines() {
  cubeGroup.remove(imageLines);
  disposeGridLines(imageLines);
  imageLines = buildGridLines((phi, v) => {
    const [a, b, c] = psi4Display(phi, v, L);
    return new THREE.Vector3(a, b, c);
  });
  cubeGroup.add(imageLines);
}

// --- Update ---

function ballPositionFromPhiT(): { abs: THREE.Vector3; img: THREE.Vector3 } {
  const abs = new THREE.Vector3(
    SPHERE_R * Math.cos(phiState) * Math.cos(tState),
    SPHERE_R * Math.cos(phiState) * Math.sin(tState),
    SPHERE_R * Math.sin(phiState),
  );
  const [a, b, c] = psi4Display(phiState, tState, L);
  const img = new THREE.Vector3(a, b, c);
  return { abs, img };
}

function update() {
  const { abs, img } = ballPositionFromPhiT();
  abstractBall.position.copy(abs);
  imageBall.position.copy(img);
}

function rebuildImage() {
  imageMesh.rebuild();
  rebuildImageLines();
  update();
}

// --- Drag interaction on the abstract sphere ---

const renderer = app.renderManager.renderer;
const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let dragging = false;

function updateNdcFromPointer(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function setStateFromWorldHit(hit: THREE.Vector3) {
  const local = sphereGroup.worldToLocal(hit.clone());
  local.normalize();
  phiState = Math.asin(THREE.MathUtils.clamp(local.z, -1, 1));
  tState = Math.atan2(local.y, local.x);
  update();
}

canvas.addEventListener('pointerdown', (e) => {
  updateNdcFromPointer(e);
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObjects([abstractMesh, abstractBall], false);
  if (hits.length > 0) {
    dragging = true;
    autoAnimate = false;
    if (resumeTimer !== null) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
    app.controls.controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    setStateFromWorldHit(hits[0].point);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  updateNdcFromPointer(e);
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(abstractMesh, false);
  if (hits.length > 0) {
    setStateFromWorldHit(hits[0].point);
    return;
  }
  // Fallback: closest point on the sphere to the ray, so the ball stays
  // on the surface when the cursor slips past the silhouette.
  const ray = raycaster.ray;
  const center = new THREE.Vector3();
  sphereGroup.getWorldPosition(center);
  const radius = SPHERE_R * PANEL_SCALE;
  const oc = new THREE.Vector3().subVectors(center, ray.origin);
  const along = oc.dot(ray.direction);
  const closestOnRay = ray.origin.clone().addScaledVector(ray.direction, along);
  const offset = new THREE.Vector3().subVectors(closestOnRay, center);
  if (offset.lengthSq() < 1e-12) return;
  offset.normalize();
  const surfacePoint = center.clone().addScaledVector(offset, radius);
  setStateFromWorldHit(surfacePoint);
});

function endDrag(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  resumeTimer = window.setTimeout(() => {
    autoAnimate = true;
    resumeTimer = null;
  }, RESUME_DELAY_MS);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

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
  <input id="psi4-L" type="range" class="thin-slider"
    min="2.05" max="3.95" step="0.01" value="${L}" />
`;
document.body.appendChild(sliderWrap);

const lSlider = sliderWrap.querySelector<HTMLInputElement>('#psi4-L')!;
lSlider.addEventListener('input', () => {
  L = parseFloat(lSlider.value);
  rebuildImage();
});

// --- Auto-animate: incommensurate (φ, t) so the ball roams the sphere ---

const PERIOD_T   = 9;     // longitude full loop, seconds
const PERIOD_PHI = 23;    // latitude full oscillation, seconds (slow)
const OMEGA_T   = (2 * Math.PI) / PERIOD_T;
const OMEGA_PHI = (2 * Math.PI) / PERIOD_PHI;

let autoTime = 0;

app.addAnimateCallback((_t, dt) => {
  // Let the phase keep advancing even while the user is dragging, so when
  // auto resumes the ball appears at a "fresh" position rather than rewinding.
  autoTime += dt;
  if (!autoAnimate) return;
  tState = (autoTime * OMEGA_T) % (2 * Math.PI) - Math.PI;
  // φ oscillates between ±π/2 (slightly insetted: longitude is meaningless
  // at the poles, so don't camp there).
  phiState = 0.95 * (Math.PI / 2) * Math.sin(autoTime * OMEGA_PHI);
  update();
});

// --- Kickoff ---

update();
app.start();
