/**
 * Planar Linkage — 4-rod pinned chain, interactive configuration space
 *
 * Center: a 4-rod chain pinned at (±L/2, 0), posed from (θ₁, θ₂, θ₃, θ₄)
 * produced by psi4(phi, t, L).
 *
 * Lower-left: the abstract configuration space — a unit 2-sphere
 * parameterized by (phi = latitude, t = longitude). Drag a point around
 * this sphere to set the current configuration.
 *
 * Lower-right: the projection of the configuration manifold into T³ via
 * (θ₁, θ₂, θ₃), drawn inside a wireframe fundamental cube [-π, π]³.
 *
 * Both spheres carry a red ball marking the current state; dragging the
 * abstract sphere's ball drives everything (chain + embedded ball).
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import {
  buildPlanarChain,
  setChainAngles,
  LinkageMesh,
  SurfaceMesh,
} from '@/math';
import type { Joint } from '@/math/linkages';
import type { Surface, SurfaceDomain } from '@/math/surfaces/types';

// --- Path parameterization ---

function psi4(phi: number, t: number, L: number): [number, number, number, number] {
  // Outer level: suspension from M³ to M⁴
  const alpha4 = Math.acos((L * L - 8) / (2 * L));
  const theta1 = alpha4 * Math.sin(phi);
  const c1 = Math.cos(theta1), s1 = Math.sin(theta1);
  const d = Math.sqrt(L * L - 2 * L * c1 + 1);
  const gamma4 = Math.atan2(-s1, L - c1);

  // Inner level: psi³_d(t)
  const alpha3 = Math.acos((d * d - 3) / (2 * d));
  const sub_phi1 = alpha3 * Math.cos(t);
  const sub_c1 = Math.cos(sub_phi1), sub_s1 = Math.sin(sub_phi1);
  const d_sub = Math.sqrt(d * d - 2 * d * sub_c1 + 1);
  const beta3 = Math.acos(d_sub / 2);
  const gamma3 = Math.atan2(-sub_s1, d - sub_c1);
  const sigma = Math.sin(t) >= 0 ? 1 : -1;

  const phi1 = sub_phi1;
  const phi2 = gamma3 + sigma * beta3;
  const phi3 = gamma3 - sigma * beta3;

  const theta2 = gamma4 + phi1;
  const theta3 = gamma4 + phi2;
  const theta4 = gamma4 + phi3;

  return [theta1, theta2, theta3, theta4];
}

// --- State ---

const ROD_LENGTHS = [1, 1, 1, 1];
let L = 3.0;
let phiState = 0;
let tState = 0;

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
  embeddedMesh.rebuild();
  applyConfig();
}

function applyConfig() {
  const angles = psi4(phiState, tState, L);
  setChainAngles(chain, angles);
  // Abstract ball sits on unit sphere at (phi, t)
  abstractBall.position.set(
    SPHERE_R * Math.cos(phiState) * Math.cos(tState),
    SPHERE_R * Math.cos(phiState) * Math.sin(tState),
    SPHERE_R * Math.sin(phiState),
  );
  // Embedded ball at (θ₁, θ₂, θ₃)
  embeddedBall.position.set(angles[0], angles[1], angles[2]);
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

// --- Shared presentation ---

const SCALE = 0.3;
const SPHERE_R = Math.PI;           // local radius so it matches cube half-side
const CUBE_SIDE = 2 * Math.PI;
const BALL_LOCAL_R = 0.35;

// --- Abstract sphere (lower-left) ---

const abstractGroup = new THREE.Group();
abstractGroup.position.set(-3.6, -2.5, 0);
abstractGroup.scale.setScalar(SCALE);
app.scene.add(abstractGroup);

const abstractSurface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    // u = phi, v = t
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
  uSegments: 32,
  vSegments: 64,
  color: 0x3388ff,
  roughness: 0.35,
});
abstractGroup.add(abstractMesh);

const abstractBall = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_LOCAL_R, 20, 20),
  new THREE.MeshPhysicalMaterial({ color: 0xff5522, roughness: 0.3, metalness: 0.1 }),
);
abstractGroup.add(abstractBall);

// --- Embedded sphere in T³ (lower-right) ---

const embeddedGroup = new THREE.Group();
embeddedGroup.position.set(3.6, -2.5, 0);
embeddedGroup.scale.setScalar(SCALE);
app.scene.add(embeddedGroup);

// Fundamental cube [-π, π]³
const cubeEdges = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(CUBE_SIDE, CUBE_SIDE, CUBE_SIDE)),
  new THREE.LineBasicMaterial({ color: 0xaaaaaa }),
);
embeddedGroup.add(cubeEdges);

const embeddedSurface: Surface = {
  evaluate(u: number, v: number): THREE.Vector3 {
    // u = phi, v = t — returns (θ₁, θ₂, θ₃)
    const [a, b, c] = psi4(u, v, L);
    return new THREE.Vector3(a, b, c);
  },
  getDomain(): SurfaceDomain {
    return { uMin: -Math.PI / 2, uMax: Math.PI / 2, vMin: 0, vMax: 2 * Math.PI };
  },
};

const embeddedMesh = new SurfaceMesh(embeddedSurface, {
  uSegments: 48,
  vSegments: 96,
  color: 0x3388ff,
  roughness: 0.35,
});
embeddedGroup.add(embeddedMesh);

const embeddedBall = new THREE.Mesh(
  new THREE.SphereGeometry(BALL_LOCAL_R, 20, 20),
  new THREE.MeshPhysicalMaterial({ color: 0xff5522, roughness: 0.3, metalness: 0.1 }),
);
embeddedGroup.add(embeddedBall);

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
  <input id="linkage-L" type="range" min="2" max="4" step="0.01" value="${L}" />
`;
document.body.appendChild(panel);

const slider = panel.querySelector<HTMLInputElement>('#linkage-L')!;
const readout = panel.querySelector<HTMLSpanElement>('#linkage-L-value')!;
slider.addEventListener('input', () => {
  const v = parseFloat(slider.value);
  readout.textContent = v.toFixed(2);
  setL(v);
});

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

function pickAbstractHit(hit: THREE.Vector3) {
  // Convert a world-space point near the sphere to (phi, t) and apply.
  const local = abstractGroup.worldToLocal(hit.clone());
  local.normalize();
  phiState = Math.asin(THREE.MathUtils.clamp(local.z, -1, 1));
  tState = Math.atan2(local.y, local.x);
  applyConfig();
}

canvas.addEventListener('pointerdown', (e) => {
  updateNdcFromPointer(e);
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(abstractMesh, false);
  if (hits.length > 0) {
    dragging = true;
    app.controls.controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
    pickAbstractHit(hits[0].point);
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  updateNdcFromPointer(e);
  raycaster.setFromCamera(ndc, app.camera);
  const hits = raycaster.intersectObject(abstractMesh, false);
  if (hits.length > 0) {
    pickAbstractHit(hits[0].point);
    return;
  }
  // Fallback: closest point on the sphere to the ray, so the ball stays
  // on the surface when the cursor slips past the silhouette.
  const ray = raycaster.ray;
  const center = new THREE.Vector3();
  abstractGroup.getWorldPosition(center);
  const radius = SPHERE_R * SCALE;
  const oc = new THREE.Vector3().subVectors(center, ray.origin);
  const along = oc.dot(ray.direction);
  const closestOnRay = ray.origin.clone().addScaledVector(ray.direction, along);
  const offset = new THREE.Vector3().subVectors(closestOnRay, center);
  if (offset.lengthSq() < 1e-12) return;
  offset.normalize();
  const surfacePoint = center.clone().addScaledVector(offset, radius);
  pickAbstractHit(surfacePoint);
});

function endDrag(e: PointerEvent) {
  if (!dragging) return;
  dragging = false;
  app.controls.controls.enabled = true;
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// --- Kickoff ---

applyConfig();
app.start();

(window as any).chain = chain;
(window as any).psi4 = psi4;
