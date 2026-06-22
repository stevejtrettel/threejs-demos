/**
 * Majumdar–Papapetrou optical metric — light bending around extremal holes.
 *
 * The direct port of the legacy charged-black-hole picture, now on the proper
 * optical (Fermat) metric. For an MP cluster the optical metric is the
 * conformally-flat U⁴·δ with U = 1 + Σ mᵢ/ρᵢ; its geodesics are the spatial
 * light-ray paths. A fan of parallel rays comes in from the left and bends,
 * wraps, and refocuses around the holes — the lensing signature of the
 * multi-hole field.
 *
 * Drawn flat in the plane (top-down). Holes are point sources of U; rays that
 * fall into one are stopped there.
 *
 * Flows through `MajumdarPapapetrou.chart('optical')`.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { GeodesicIntegrator } from '@/math';
import { MajumdarPapapetrou } from '@/math/relativity';
import { applyStage, PALETTE, LIGHTRAY, matte } from '../_shared/theme';

// --- Spacetime --------------------------------------------------------------

const EXTENT = 12;
const mp = new MajumdarPapapetrou({
  holes: [
    { mass: 1, x: -2.2, y: 0 },
    { mass: 1, x: 2.2, y: 0 },
  ],
  extent: EXTENT,
});
const optical = mp.chart('optical');

// --- Scene (top-down view of the spatial plane) -----------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 26, 0.001);
app.controls.target.set(0, 0, 0);
app.controls.update();
applyStage(app);

// --- Holes ------------------------------------------------------------------

for (const h of mp.holes) {
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.2 + 0.18 * h.mass, 32, 32),
    matte(PALETTE.ink, { roughness: 0.6 }),
  );
  sphere.position.set(h.x, 0, h.y);
  app.scene.add(sphere);
}

// --- Rays as optical-metric geodesics ---------------------------------------

const integrator = new GeodesicIntegrator(optical, { stepSize: 0.015 });
const MAX_STEPS = 8000;
const START_X = -(EXTENT - 1);
const CAPTURE_R = 0.35; // stop when this close to a hole

const rayMat = matte(LIGHTRAY, { roughness: 0.7 });

function nearHole(x: number, y: number): boolean {
  for (const h of mp.holes) {
    if (Math.hypot(x - h.x, y - h.y) < CAPTURE_R) return true;
  }
  return false;
}

function traceRay(b: number): THREE.Vector3[] {
  const g = optical.computeMetric([START_X, b]).data;
  const speed = 1 / Math.sqrt(g[0]);
  let state = {
    position: [START_X, b] as [number, number],
    velocity: [speed, 0] as [number, number],
  };

  const pts: THREE.Vector3[] = [new THREE.Vector3(START_X, 0, b)];
  for (let k = 0; k < MAX_STEPS; k++) {
    state = integrator.integrate(state);
    const [x, y] = state.position;
    if (!Number.isFinite(x) || Math.hypot(x, y) > EXTENT + 1) break;
    pts.push(new THREE.Vector3(x, 0, y));
    if (nearHole(x, y)) break;
  }
  return pts;
}

const N_RAYS = 49;
const B_MAX = 7;
for (let i = 0; i < N_RAYS; i++) {
  const b = -B_MAX + (2 * B_MAX * i) / (N_RAYS - 1);
  const pts = traceRay(b);
  if (pts.length < 2) continue;
  const curve = new THREE.CatmullRomCurve3(pts);
  const geom = new THREE.TubeGeometry(curve, Math.min(pts.length, 2200), 0.035, 6, false);
  app.scene.add(new THREE.Mesh(geom, rayMat));
}

app.start();
