/**
 * Blog: Parameterizing Sphere Linkages — Animation 4
 *
 * Abstract S² ↔ 4-rod planar chain.
 *  - Left:  abstract sphere (cream surface, soft maroon lat/lon grid) with a
 *           draggable blue ball at parameter (φ, t).
 *  - Right: 4-rod chain pinned at (±L/2, 0), posed via psi4Position(φ, t, L).
 * Drag the ball on the sphere; the chain flexes accordingly. Front of the
 * domain sphere maps to the corresponding configuration via a φ-flip
 * (matches the convention used in Animation 3).
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SurfaceMesh } from '@/math';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

// --- Palette ---

const BG          = 0xF0EDE8;
const BURGUNDY    = 0x7A1F2C;    // dragged ball + chain joints/pins
const CREAM       = 0xE2D8C0;    // sphere
const CREAM_DEEP  = 0xBFB294;    // grid lines — darker cream, quietly sits under sphere tone
const SILVER      = 0xBCB6AC;    // chain rods

// --- psi^4_L position-coordinate form (post §5) ---
//
// Returns the three interior hinges of a 4-rod chain pinned at 0 and L on
// the real axis. The φ flip mirrors Animation 3's "front of domain ↔ front
// of codomain" convention so a click on either demo's near hemisphere
// produces the same configuration.

function psi4PositionDisplay(phi: number, t: number, L: number) {
  return psi4Position(-phi, t, L);
}

function psi4Position(phi: number, t: number, L: number): {
  p1: [number, number]; p2: [number, number]; p3: [number, number];
} {
  // Outer level
  const alpha = Math.acos((L * L - 8) / (2 * L));
  const theta = alpha * Math.sin(phi);

  // p3 = L - e^{i theta}
  const p3_re = L - Math.cos(theta);
  const p3_im =   - Math.sin(theta);
  const d     = Math.hypot(p3_re, p3_im);
  const p3_hat_re = p3_re / d;
  const p3_hat_im = p3_im / d;

  // Inner level (helpers depend on d)
  const c        = Math.cos(t);
  const alpha_in = Math.acos((d * d - 3) / (2 * d));
  const theta_in = alpha_in * Math.sin(t);

  // ν_in: smooth signed amplitude (apparent 0/0 at cos t = 0 is removable)
  const num   = 2 * d * (Math.cos(theta_in) - (d * d - 3) / (2 * d));
  const nu_in = Math.abs(c) < 1e-6
              ? Math.sign(c || 1) * Math.sqrt(d * alpha_in * Math.sin(alpha_in))
              : c * Math.sqrt(num / (c * c));

  // p2 = p3 - p3_hat * e^{i theta_in}
  const e_re   = Math.cos(theta_in);
  const e_im   = Math.sin(theta_in);
  const rot_re = p3_hat_re * e_re - p3_hat_im * e_im;
  const rot_im = p3_hat_re * e_im + p3_hat_im * e_re;
  const p2_re  = p3_re - rot_re;
  const p2_im  = p3_im - rot_im;
  const p2_abs = Math.hypot(p2_re, p2_im);

  // p1 = p2/2 + (i ν_in / (2 |p2|)) * p2
  const k     = nu_in / (2 * p2_abs);
  const p1_re = p2_re / 2 - k * p2_im;
  const p1_im = p2_im / 2 + k * p2_re;

  return {
    p1: [p1_re, p1_im],
    p2: [p2_re, p2_im],
    p3: [p3_re, p3_im],
  };
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
app.camera.position.set(0, 0, 5.8);
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

// --- Layout ---

const SPHERE_PANEL_SCALE = 0.40;
const SPHERE_R = Math.PI;     // sphere radius at panel-local scale

// === LEFT PANEL: abstract S² ===

const sphereGroup = new THREE.Group();
sphereGroup.position.set(-2.9, 0, 0);
sphereGroup.scale.setScalar(SPHERE_PANEL_SCALE);
app.scene.add(sphereGroup);

const abstractSurface: Surface = {
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

// --- Sphere grid: same lat/lon family as Animation 3 ---

const N_LAT_MAJOR = 5;
const N_LON_MAJOR = 8;
const N_LAT_TOTAL = 2 * N_LAT_MAJOR + 1;
const N_LON_TOTAL = 2 * N_LON_MAJOR;
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

function buildLineTube(samples: THREE.Vector3[], closed: boolean, radius: number): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(samples, closed, 'catmullrom', 0.5);
  const geom = new THREE.TubeGeometry(curve, samples.length, radius, 8, closed);
  return new THREE.Mesh(geom, lineMat);
}

function buildSphereGrid(): THREE.Group {
  const group = new THREE.Group();
  const ev = (u: number, v: number) => abstractSurface.evaluate(u, v);

  for (let i = 1; i <= N_LAT_TOTAL; i++) {
    const phi = -Math.PI / 2 + (i * Math.PI) / (N_LAT_TOTAL + 1);
    const radius = i % 2 === 0 ? MAJOR_RADIUS : MINOR_RADIUS;
    const samples: THREE.Vector3[] = new Array(SAMPLES_PER_LINE);
    for (let j = 0; j < SAMPLES_PER_LINE; j++) {
      samples[j] = ev(phi, (2 * Math.PI * j) / SAMPLES_PER_LINE);
    }
    group.add(buildLineTube(samples, true, radius));
  }
  for (let k = 0; k < N_LON_TOTAL; k++) {
    const v = (2 * Math.PI * k) / N_LON_TOTAL;
    const radius = k % 2 === 0 ? MAJOR_RADIUS : MINOR_RADIUS;
    const samples: THREE.Vector3[] = new Array(SAMPLES_PER_LINE);
    for (let j = 0; j < SAMPLES_PER_LINE; j++) {
      const phi = -Math.PI / 2 + (Math.PI * j) / (SAMPLES_PER_LINE - 1);
      samples[j] = ev(phi, v);
    }
    group.add(buildLineTube(samples, false, radius));
  }
  return group;
}

sphereGroup.add(buildSphereGrid());

// === RIGHT PANEL: 4-rod chain ===

const CHAIN_SCALE = 1.55;

const chainGroup = new THREE.Group();
chainGroup.position.set(1.7, 0, 0);
chainGroup.scale.setScalar(CHAIN_SCALE);
app.scene.add(chainGroup);

const ROD_RADIUS    = 0.05;
const JOINT_RADIUS  = 0.10;
const PINNED_RADIUS = 0.13;

const rodMat = new THREE.MeshPhysicalMaterial({
  color: SILVER,
  roughness: 0.32,
  metalness: 0.85,
  clearcoat: 0.4,
  clearcoatRoughness: 0.25,
});

const ballMat = new THREE.MeshPhysicalMaterial({
  color: BURGUNDY,
  roughness: 0.22,
  metalness: 0.05,
  clearcoat: 0.8,
  clearcoatRoughness: 0.18,
});

const rodGeo = new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, 1, 16, 1);
const rod1 = new THREE.Mesh(rodGeo, rodMat);
const rod2 = new THREE.Mesh(rodGeo, rodMat);
const rod3 = new THREE.Mesh(rodGeo, rodMat);
const rod4 = new THREE.Mesh(rodGeo, rodMat);
chainGroup.add(rod1, rod2, rod3, rod4);

const pinSphereGeo   = new THREE.SphereGeometry(PINNED_RADIUS, 24, 24);
const jointSphereGeo = new THREE.SphereGeometry(JOINT_RADIUS, 24, 24);

const pinA   = new THREE.Mesh(pinSphereGeo, ballMat);
const pinB   = new THREE.Mesh(pinSphereGeo, ballMat);
const joint1 = new THREE.Mesh(jointSphereGeo, ballMat);
const joint2 = new THREE.Mesh(jointSphereGeo, ballMat);
const joint3 = new THREE.Mesh(jointSphereGeo, ballMat);
chainGroup.add(pinA, pinB, joint1, joint2, joint3);

const _yAxis = new THREE.Vector3(0, 1, 0);
function placeRod(rod: THREE.Mesh, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  rod.position.set((ax + bx) / 2, (ay + by) / 2, 0);
  rod.scale.set(1, len, 1);
  rod.quaternion.setFromUnitVectors(_yAxis, new THREE.Vector3(dx / len, dy / len, 0));
}

// --- Update ---

function update() {
  // Abstract ball on the sphere — uses raw φ (this is what the user clicked).
  abstractBall.position.set(
    SPHERE_R * Math.cos(phiState) * Math.cos(tState),
    SPHERE_R * Math.cos(phiState) * Math.sin(tState),
    SPHERE_R * Math.sin(phiState),
  );

  // Chain — uses the φ-flipped variant for visual consistency with Anim 3.
  const { p1, p2, p3 } = psi4PositionDisplay(phiState, tState, L);
  const dx = -L / 2;
  const ax = 0 + dx,     ay = 0;
  const px = p1[0] + dx, py = p1[1];
  const qx = p2[0] + dx, qy = p2[1];
  const rx = p3[0] + dx, ry = p3[1];
  const bx = L + dx,     by = 0;

  pinA.position.set(ax, ay, 0);
  pinB.position.set(bx, by, 0);
  joint1.position.set(px, py, 0);
  joint2.position.set(qx, qy, 0);
  joint3.position.set(rx, ry, 0);

  placeRod(rod1, ax, ay, px, py);
  placeRod(rod2, px, py, qx, qy);
  placeRod(rod3, qx, qy, rx, ry);
  placeRod(rod4, rx, ry, bx, by);
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
  // Fallback: nearest point on the sphere to the cursor's ray, so the ball
  // tracks smoothly when the cursor slips past the silhouette.
  const ray = raycaster.ray;
  const center = new THREE.Vector3();
  sphereGroup.getWorldPosition(center);
  const radius = SPHERE_R * SPHERE_PANEL_SCALE;
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
  update();
});

// --- Auto-animate (incommensurate (φ, t) so the ball roams the sphere) ---

const PERIOD_T   = 9;     // longitude full loop, seconds
const PERIOD_PHI = 23;    // latitude full oscillation, seconds
const OMEGA_T   = (2 * Math.PI) / PERIOD_T;
const OMEGA_PHI = (2 * Math.PI) / PERIOD_PHI;

let autoTime = 0;

app.addAnimateCallback((_t, dt) => {
  // Phase keeps advancing during pause so the resume position is "fresh".
  autoTime += dt;
  if (!autoAnimate) return;
  tState = (autoTime * OMEGA_T) % (2 * Math.PI) - Math.PI;
  phiState = 0.95 * (Math.PI / 2) * Math.sin(autoTime * OMEGA_PHI);
  update();
});

// --- Kickoff ---

update();
app.start();
