/**
 * 3D optical geometry of a single MP black hole — a spray of genuinely
 * different geodesics, each lying in its own slice.
 *
 * Fifteen light rays are fired from assorted directions and impact parameters
 * (start points spread over a sphere, each aimed past the hole with a different
 * tilt). They are integrated in the true 3D optical metric U⁴(|r⃗|)·I, so each
 * bends in three dimensions; the lowest impact parameters plunge in, the rest
 * deflect.
 *
 * Because the metric is spherically symmetric, every geodesic lies in a plane
 * through the centre (conserved L = r⃗ × v⃗). The **highlight** slider picks a
 * single solution, dims the others, and draws the plane it lives in — so you can
 * see each ray is confined to a slice, and (since all slices are equivalent
 * under rotation) that studying one slice is enough.
 *
 * Built on the n-D `geodesicDeriv`; the 3D optical metric is defined inline.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { geodesicDeriv } from '@/math';
import { integrate } from '@/math/ode';
import { Matrix } from '@/math/linear-algebra';
import type { Manifold } from '@/math/manifolds';
import { applyStage, PALETTE, mixHex, LIGHTRAY, matte } from '../_shared/theme';

// --- 3D optical metric of a single MP hole at the origin --------------------

const MASS = 1;
const optical3d: Manifold = {
  dim: 3,
  getDomainBounds: () => ({ min: [-30, -30, -30], max: [30, 30, 30] }),
  computeMetric: (p: number[]) => {
    const r = Math.hypot(p[0], p[1], p[2]);
    const U = 1 + MASS / r;
    return Matrix.identity(3).scale(U * U * U * U);
  },
};
const deriv = geodesicDeriv(optical3d);

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(14, 11, 17);
app.controls.target.set(0, 0, 0);
app.controls.update();
applyStage(app);

// Everything that should spin together lives in this group (lights stay fixed).
const world = new THREE.Group();
app.scene.add(world);

world.add(new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 32, 24),
  matte(PALETTE.ink, { roughness: 0.6 }),
));

// --- Build 15 assorted initial conditions -----------------------------------

const N = 15;
const R0 = 11;
const GOLDEN = Math.PI * (1 + Math.sqrt(5));

const cross = (a: number[], b: number[]): number[] =>
  [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm3 = (a: number[]): number[] => {
  const n = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / n, a[1] / n, a[2] / n];
};

interface Geo { points: THREE.Vector3[]; normal: number[]; maxR: number }
const geos: Geo[] = [];

for (let i = 0; i < N; i++) {
  // Launch direction u over a Fibonacci sphere → start point p0 = R0·u.
  const z = 1 - 2 * (i + 0.5) / N;
  const rho = Math.sqrt(1 - z * z);
  const az = GOLDEN * (i + 0.5);
  const u = [rho * Math.cos(az), rho * Math.sin(az), z];
  const p0 = [R0 * u[0], R0 * u[1], R0 * u[2]];

  // Tilt direction perpendicular to u, rotated per-ray so orbital planes vary.
  const ref = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const w1 = norm3(cross(u, ref));
  const w2 = cross(u, w1);
  const gamma = GOLDEN * i;
  const w = [
    Math.cos(gamma) * w1[0] + Math.sin(gamma) * w2[0],
    Math.cos(gamma) * w1[1] + Math.sin(gamma) * w2[1],
    Math.cos(gamma) * w1[2] + Math.sin(gamma) * w2[2],
  ];

  // α sets the impact parameter. The range straddles the capture threshold
  // (critical α ≈ 0.32), so the first few rays plunge in and the rest deflect.
  const alpha = 0.18 + 0.68 * (i / (N - 1));
  const dir = norm3([-u[0] + alpha * w[0], -u[1] + alpha * w[1], -u[2] + alpha * w[2]]);

  // Unit optical speed: |v|²_g = U⁴|v|² = 1 → |v| = 1/U².
  const Ustart = 1 + MASS / R0;
  const speed = 1 / (Ustart * Ustart);
  const v0 = [dir[0] * speed, dir[1] * speed, dir[2] * speed];

  let s = [...p0, ...v0];
  const points: THREE.Vector3[] = [new THREE.Vector3(p0[0], p0[1], p0[2])];
  let maxR = R0;
  for (let k = 0; k < 1600; k++) {
    const traj = integrate({ deriv, initial: s, dt: 0.03, steps: 1 });
    s = traj.states[traj.states.length - 1];
    const r = Math.hypot(s[0], s[1], s[2]);
    if (!Number.isFinite(r) || r < 0.18 || r > 13) break;
    points.push(new THREE.Vector3(s[0], s[1], s[2]));
    maxR = Math.max(maxR, r);
  }

  geos.push({ points, normal: norm3(cross(p0, v0)), maxR });
}

// --- Draw geodesics (all one warm colour) + their slice planes --------------

const baseMat = matte(LIGHTRAY, { roughness: 0.55 });
const hiMat = matte(LIGHTRAY, { roughness: 0.45, emissive: LIGHTRAY, emissiveIntensity: 0.6 });
const dimMat = matte(mixHex(PALETTE.slate, 0xffffff, 0.5), {
  roughness: 0.97, transparent: true, opacity: 0.12,
});

const rayMeshes: THREE.Mesh[] = [];
const planeDisks: THREE.Mesh[] = [];

for (const geo of geos) {
  if (geo.points.length < 2) { rayMeshes.push(new THREE.Mesh()); planeDisks.push(new THREE.Mesh()); continue; }

  const curve = new THREE.CatmullRomCurve3(geo.points);
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.min(geo.points.length, 1000), 0.05, 8, false), baseMat,
  );
  rayMeshes.push(mesh);
  world.add(mesh);

  // The slice this geodesic lives in: a translucent disk through the origin,
  // perpendicular to its conserved angular momentum.
  const disk = new THREE.Mesh(
    new THREE.CircleGeometry(geo.maxR * 1.02, 64),
    new THREE.MeshStandardMaterial({
      color: LIGHTRAY, roughness: 0.95, metalness: 0,
      transparent: true, opacity: 0.22, side: THREE.DoubleSide,
    }),
  );
  disk.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(geo.normal[0], geo.normal[1], geo.normal[2]),
  );
  disk.visible = false;
  planeDisks.push(disk);
  world.add(disk);
}

// --- Highlight control ------------------------------------------------------

function setHighlight(h: number): void {
  // h = 0 → all solutions (no plane); h = i (1..N) → glow solution i-1, fade the rest.
  const sel = h - 1;
  rayMeshes.forEach((m, j) => {
    if (!m.material) return;
    m.material = h === 0 ? baseMat : (j === sel ? hiMat : dimMat);
  });
  planeDisks.forEach((d, j) => { d.visible = j === sel; });
}
setHighlight(0);

// --- Control: one small checkbox, top-right (talk-friendly) ------------------

let cycling = false;

// Hide the default overlay panel; a single checkbox is all the recording needs.
app.overlay.container.style.display = 'none';

const row = document.createElement('label');
row.style.cssText =
  'position:fixed;top:12px;right:14px;display:flex;align-items:center;gap:6px;' +
  'font:12px/1 ui-sans-serif,system-ui,sans-serif;color:#2c2c2c;' +
  'background:rgba(247,245,240,0.72);padding:5px 9px;border-radius:6px;' +
  'cursor:pointer;user-select:none;';
const checkbox = document.createElement('input');
checkbox.type = 'checkbox';
const caption = document.createElement('span');
caption.textContent = 'cycle planes';
row.append(checkbox, caption);
document.body.appendChild(row);

// --- Animation: slow spin + (optional) plane cycling ------------------------

const SPIN = 0.16;      // rad/sec
const PERIOD = 2.6;     // seconds per plane while cycling
let cycleTime = 0;
let cycleIdx = -1;

checkbox.addEventListener('change', () => {
  cycling = checkbox.checked;
  cycleTime = 0;
  cycleIdx = -1;
  if (!cycling) setHighlight(0);
});

app.addAnimateCallback((_elapsed, delta) => {
  world.rotation.y += SPIN * delta;
  if (cycling) {
    cycleTime += delta;
    const idx = (Math.floor(cycleTime / PERIOD) % N) + 1;
    if (idx !== cycleIdx) { cycleIdx = idx; setHighlight(idx); }
  }
});

app.start();
