/**
 * A single light geodesic spiralling a Majumdar–Papapetrou black hole, with its
 * projection to the spatial plane — the `geodesic-spacetime-project` picture.
 *
 * One null ray is fired at a near-critical impact parameter, so it falls in,
 * orbits the photon sphere a few times, and escapes. It is drawn two ways in
 * one scene:
 *   • the **spacetime curve** — lifted by coordinate time t. Light dwells near
 *     the photon sphere, so t races ahead there and the orbit becomes a tall
 *     rising **coil** above the hole's worldline.
 *   • its **projection to R²** — the same path flattened onto the floor: the
 *     in-spiral-out light path.
 * Faint risers tie the coil to its shadow.
 *
 * Built on `traceOpticalRay`. The impact parameter b ≈ 3.337 was found by
 * bisecting to the capture threshold (≈ 2.7 loops); nudge it toward critical
 * for more loops.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { MajumdarPapapetrou, traceOpticalRay } from '@/math/relativity';
import { applyStage, PALETTE, mixHex, LIGHTRAY, matte } from '../_shared/theme';

// --- Spacetime + the spiralling ray -----------------------------------------

const mp = new MajumdarPapapetrou({ holes: [{ mass: 1, x: 0, y: 0 }], extent: 30 });
const optical = mp.chart('optical');
const data = mp.staticData();

const IMPACT = 3.337;       // near-critical: ~2.7 loops around the photon sphere
const TARGET_HEIGHT = 14;   // the coil is scaled to roughly this tall

const ray = traceOpticalRay(optical, [-10, IMPACT], [1, 0], {
  steps: 5200,
  dt: 0.02,
  lapseSq: (xy) => data.lapseSq(xy),
  stop: (xy) => { const r = Math.hypot(xy[0], xy[1]); return r < 0.04 || r > 20; },
});
const tMax = ray.t[ray.t.length - 1];
const TIME_SCALE = TARGET_HEIGHT / tMax;

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(16, 11, 19);
app.controls.target.set(1, 5.5, 0);
app.controls.update();
applyStage(app);

// --- Black hole: spatial sphere + worldline ---------------------------------

app.scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 32, 24),
  matte(PALETTE.ink, { roughness: 0.6 }),
));
{
  const worldline = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, TARGET_HEIGHT * 1.2, 16, 1, false),
    matte(PALETTE.ink, { roughness: 0.7 }),
  );
  worldline.position.y = TARGET_HEIGHT * 0.6;
  app.scene.add(worldline);
}

// Floor grid (the spatial plane the ray projects onto).
{
  const grid = new THREE.GridHelper(60, 30, PALETTE.slate, mixHex(PALETTE.slate, PALETTE.surface, 0.55));
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.55;
  app.scene.add(grid);
}

// --- The geodesic and its shadow --------------------------------------------

function tube(points: THREE.Vector3[], radius: number, mat: THREE.Material): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(points.length, 3000), radius, 10, false), mat);
}

const spacetime: THREE.Vector3[] = [];
const shadow: THREE.Vector3[] = [];
for (let k = 0; k < ray.x.length; k++) {
  spacetime.push(new THREE.Vector3(ray.x[k], ray.t[k] * TIME_SCALE, ray.y[k]));
  shadow.push(new THREE.Vector3(ray.x[k], 0.02, ray.y[k]));
}

app.scene.add(tube(spacetime, 0.08, matte(LIGHTRAY, { roughness: 0.6 })));
app.scene.add(tube(shadow, 0.06, matte(mixHex(PALETTE.slate, PALETTE.ink, 0.25), { roughness: 0.85 })));

// End caps on the spacetime curve.
const capMat = matte(mixHex(LIGHTRAY, PALETTE.ink, 0.2), { roughness: 0.5 });
for (const end of [spacetime[0], spacetime[spacetime.length - 1]]) {
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 20), capMat);
  cap.position.copy(end);
  app.scene.add(cap);
}

// Faint risers tying the coil to its shadow.
const riserMat = matte(mixHex(PALETTE.slate, PALETTE.surface, 0.3), { roughness: 0.9 });
const step = Math.max(1, Math.floor(spacetime.length / 60));
for (let k = 0; k < spacetime.length; k += step) {
  const a = spacetime[k];
  app.scene.add(tube([new THREE.Vector3(a.x, 0.02, a.z), a], 0.01, riserMat));
}

app.start();
