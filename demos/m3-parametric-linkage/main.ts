/**
 * Blog: Parameterizing Sphere Linkages — Animation 2
 *
 * Abstract S^1 ↔ 3-rod planar chain.
 *  - Left:  circle (sepia ring) with a draggable burgundy ball at parameter t.
 *  - Right: 3-rod chain pinned at (0,0) and (L,0) — when L is centered for
 *           presentation, at (±L/2, 0) — posed via psi3Position(t, L).
 * Drag the ball on the circle; the chain flexes accordingly.
 * L slider deforms the chain.
 */

import * as THREE from 'three';
import { App } from '@/app/App';

// --- Palette ---

const BG       = 0xF0EDE8;
const BURGUNDY = 0x7A1F2C;

// --- psi^3_L (position-coordinate form, post §3) ---
//
// Returns the two interior hinges of a 3-rod chain pinned at 0 and L on the
// real axis. Position coordinates avoid the σ sign-jump near the suspension
// poles — the smooth signed amplitude ν(t) handles it transparently.

function psi3Position(t: number, L: number): { p1: [number, number]; p2: [number, number] } {
  const alpha = Math.acos((L * L - 3) / (2 * L));
  const theta = alpha * Math.sin(t);
  const c     = Math.cos(t);

  // p2 = L - e^{i theta}
  const p_re  = L - Math.cos(theta);
  const p_im  =   - Math.sin(theta);
  const p_abs = Math.hypot(p_re, p_im);

  // ν(t): smooth signed amplitude. Numerator and cos²t both vanish
  // quadratically at cos t = 0; the ratio extends to L·α·sin α.
  const num = 2 * L * (Math.cos(theta) - (L * L - 3) / (2 * L));
  const nu  = Math.abs(c) < 1e-6
            ? Math.sign(c || 1) * Math.sqrt(L * alpha * Math.sin(alpha))
            : c * Math.sqrt(num / (c * c));

  // p1 = p2/2 + (i ν / (2|p2|)) * p2
  const k = nu / (2 * p_abs);
  return {
    p1: [p_re / 2 - k * p_im, p_im / 2 + k * p_re],
    p2: [p_re, p_im],
  };
}

// --- State ---

let L = 2.4;
let tParam = 0;
let autoAnimate = true;
let resumeTimer: number | null = null;
const RESUME_DELAY_MS = 1000;

// --- Scene ---

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 0, 5);
app.controls.target.set(0, 0, 0);
app.controls.controls.enabled = false; // 2D scene — no orbiting
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

// === LEFT PANEL: abstract S^1 ===

const circleGroup = new THREE.Group();
circleGroup.position.set(-3.2, 0, 0);
app.scene.add(circleGroup);

const CIRCLE_R = 1.4;

// Silver ring — matches the rod material so the two panels read as a unit.
const ring = new THREE.Mesh(
  new THREE.TorusGeometry(CIRCLE_R, 0.045, 12, 128),
  new THREE.MeshPhysicalMaterial({
    color: 0xBCB6AC,
    roughness: 0.32,
    metalness: 0.85,
    clearcoat: 0.4,
    clearcoatRoughness: 0.25,
  }),
);
circleGroup.add(ring);

const circleBall = new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 24, 24),
  new THREE.MeshPhysicalMaterial({
    color: BURGUNDY,
    roughness: 0.22,
    metalness: 0.05,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18,
  }),
);
circleGroup.add(circleBall);

// === RIGHT PANEL: 3-rod chain ===

const CHAIN_SCALE = 1.6;

const chainGroup = new THREE.Group();
chainGroup.position.set(2.6, 0, 0);
chainGroup.scale.setScalar(CHAIN_SCALE);
app.scene.add(chainGroup);

const ROD_RADIUS    = 0.05;
const JOINT_RADIUS  = 0.10;
const PINNED_RADIUS = 0.13;

// Warm silver — picks up specular nicely against the warm bg.
const rodMat = new THREE.MeshPhysicalMaterial({
  color: 0xBCB6AC,
  roughness: 0.32,
  metalness: 0.85,
  clearcoat: 0.4,
  clearcoatRoughness: 0.25,
});

const burgundyMat = new THREE.MeshPhysicalMaterial({
  color: BURGUNDY,
  roughness: 0.22,
  metalness: 0.05,
  clearcoat: 0.8,
  clearcoatRoughness: 0.18,
});

// Pre-built unit-cylinder geometry along +Y; we'll scale Y to the rod length
// and rotate to align with each rod vector.
const rodGeo = new THREE.CylinderGeometry(ROD_RADIUS, ROD_RADIUS, 1, 16, 1);
const rod1 = new THREE.Mesh(rodGeo, rodMat);
const rod2 = new THREE.Mesh(rodGeo, rodMat);
const rod3 = new THREE.Mesh(rodGeo, rodMat);
chainGroup.add(rod1, rod2, rod3);

const pinSphereGeo  = new THREE.SphereGeometry(PINNED_RADIUS, 24, 24);
const jointSphereGeo = new THREE.SphereGeometry(JOINT_RADIUS, 24, 24);

const pinA = new THREE.Mesh(pinSphereGeo, burgundyMat);
const pinB = new THREE.Mesh(pinSphereGeo, burgundyMat);
const joint1 = new THREE.Mesh(jointSphereGeo, burgundyMat);
const joint2 = new THREE.Mesh(jointSphereGeo, burgundyMat);
chainGroup.add(pinA, pinB, joint1, joint2);

// Place a unit cylinder so its midpoint sits between a and b, oriented a→b.
const _yAxis = new THREE.Vector3(0, 1, 0);
function placeRod(rod: THREE.Mesh, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  rod.position.set((ax + bx) / 2, (ay + by) / 2, 0);
  rod.scale.set(1, len, 1);
  // Align +Y with (dx, dy, 0). Rotate y-axis to that direction.
  rod.quaternion.setFromUnitVectors(_yAxis, new THREE.Vector3(dx / len, dy / len, 0));
}

// --- Update ---

function updateChain() {
  const { p1, p2 } = psi3Position(tParam, L);
  // Center the chain horizontally for presentation: shift x by -L/2.
  const dx = -L / 2;
  const ax = 0 + dx,        ay = 0;
  const px = p1[0] + dx,    py = p1[1];
  const qx = p2[0] + dx,    qy = p2[1];
  const bx = L + dx,        by = 0;

  pinA.position.set(ax, ay, 0);
  pinB.position.set(bx, by, 0);
  joint1.position.set(px, py, 0);
  joint2.position.set(qx, qy, 0);

  placeRod(rod1, ax, ay, px, py);
  placeRod(rod2, px, py, qx, qy);
  placeRod(rod3, qx, qy, bx, by);
}

function updateCircleBall() {
  circleBall.position.set(CIRCLE_R * Math.cos(tParam), CIRCLE_R * Math.sin(tParam), 0);
}

function update() {
  updateCircleBall();
  updateChain();
}

// --- Drag interaction on the circle ---

const renderer = app.renderManager.renderer;
const canvas = renderer.domElement;
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let dragging = false;

const planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // z=0 plane in world coords

function updateNdcFromPointer(e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function setTFromWorldHit(hit: THREE.Vector3) {
  const local = circleGroup.worldToLocal(hit.clone());
  tParam = Math.atan2(local.y, local.x);
  update();
}

canvas.addEventListener('pointerdown', (e) => {
  updateNdcFromPointer(e);
  raycaster.setFromCamera(ndc, app.camera);
  // Hit-test the ring or its ball; allow grabbing either.
  const hits = raycaster.intersectObjects([ring, circleBall], false);
  if (hits.length > 0) {
    dragging = true;
    autoAnimate = false;
    if (resumeTimer !== null) {
      clearTimeout(resumeTimer);
      resumeTimer = null;
    }
    canvas.setPointerCapture(e.pointerId);
    setTFromWorldHit(hits[0].point);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  updateNdcFromPointer(e);
  raycaster.setFromCamera(ndc, app.camera);
  // Project the cursor onto the z=0 plane and use that point's angle around
  // the circle's center — keeps the ball tracking smoothly even when the
  // cursor leaves the ring's silhouette.
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(planeZ, hit) !== null) {
    setTFromWorldHit(hit);
  }
});

function endDrag(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
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
  <input id="psi3-L" type="range" class="thin-slider"
    min="1.05" max="2.95" step="0.01" value="${L}" />
`;
document.body.appendChild(sliderWrap);

const lSlider = sliderWrap.querySelector<HTMLInputElement>('#psi3-L')!;
lSlider.addEventListener('input', () => {
  L = parseFloat(lSlider.value);
  update();
});

// --- Kickoff ---

const PERIOD = 12; // seconds for one full loop
const ANG_SPEED = (2 * Math.PI) / PERIOD;

// Delta-based so resume picks up from wherever the user dropped the ball — no jump.
app.addAnimateCallback((_t, dt) => {
  if (!autoAnimate) return;
  tParam += ANG_SPEED * dt;
  if (tParam >  Math.PI) tParam -= 2 * Math.PI;
  if (tParam < -Math.PI) tParam += 2 * Math.PI;
  update();
});

update();
app.start();
