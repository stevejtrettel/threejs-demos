/**
 * A flat, top-down family of light geodesics wandering around a single
 * Majumdar–Papapetrou black hole.
 *
 * Fourteen light rays are launched from points all around a large circle and
 * integrated in the MP optical metric, so each bends toward the central mass.
 * Their launch positions and aim directions **wander smoothly** over time (each
 * driven by a few low-frequency sinusoids randomised at load), and every ray is
 * re-traced from scratch each frame. The result is an organic drift: rays swing
 * in from all sides, some grazing past, some plunging into the hole, the whole
 * family milling about the plane.
 *
 * Everything lives in one flat plane, drawn as a disk with a light polar grid
 * and viewed at an angle so the planarity is obvious. The hole is the black dot
 * at the origin.
 *
 * Built on `MajumdarPapapetrou` + `traceOpticalRay`, the same primitives as the
 * other MP demos; only the picture is flattened and the initial conditions are
 * animated.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { MajumdarPapapetrou, traceOpticalRay } from '@/math/relativity';
import { applyStage, PALETTE, LIGHTRAY, SURFACE_GREY, mixHex, matte, BACKGROUND } from '../_shared/theme';

// --- Spacetime --------------------------------------------------------------

const mp = new MajumdarPapapetrou({ holes: [{ mass: 1, x: 0, y: 0 }], extent: 30 });
const optical = mp.chart('optical');
const data = mp.staticData();

const R0 = 14;          // launch circle radius
const TRACE_STEPS = 1400;
const TRACE_DT = 0.03;
const CAPTURE_R = 0.45; // ray ends when it reaches the hole
const ESCAPE_R = 16;    // ...or when it leaves the frame
const PLANE_R = 16;     // radius of the polar-grid disk the rays live on
const RAY_Y = 0.12;     // rays sit just above the plane so they read on top

function trace(px: number, py: number, dx: number, dy: number): THREE.Vector3[] {
  const ray = traceOpticalRay(optical, [px, py], [dx, dy], {
    steps: TRACE_STEPS,
    dt: TRACE_DT,
    lapseSq: (xy) => data.lapseSq(xy),
    stop: (xy) => {
      const r = Math.hypot(xy[0], xy[1]);
      return r < CAPTURE_R || r > ESCAPE_R;
    },
  });
  const pts: THREE.Vector3[] = [];
  // Subsample to keep the per-frame curve/tube rebuild cheap.
  const stride = Math.max(1, Math.floor(ray.x.length / 120));
  // Lift the spatial (x, y) path onto the horizontal plane y = RAY_Y.
  for (let k = 0; k < ray.x.length; k += stride) pts.push(new THREE.Vector3(ray.x[k], RAY_Y, ray.y[k]));
  const last = ray.x.length - 1;
  if (last % stride !== 0) pts.push(new THREE.Vector3(ray.x[last], RAY_Y, ray.y[last]));
  return pts;
}

// --- Scene: a flat plane viewed at an angle ---------------------------------

const app = new App({ antialias: true, debug: false });
applyStage(app);

// Tilted view so the disk reads clearly as a plane (orbit left on to explore).
app.camera.fov = 40;
app.camera.position.set(0, 26, 30);
app.controls.target.set(0, 0, 0);
app.controls.update();
app.camera.updateProjectionMatrix();

// --- The plane the rays live on: a disk with a light polar grid -------------

// Flat disk (the spatial plane). Lies in the horizontal y = 0 plane.
{
  const disk = new THREE.Mesh(new THREE.CircleGeometry(PLANE_R, 96), matte(SURFACE_GREY, { roughness: 0.95 }));
  disk.rotation.x = -Math.PI / 2;
  app.scene.add(disk);
}

// Light polar coordinates: concentric circles + radial spokes, thin matte tubes.
{
  const gridColor = mixHex(PALETTE.slate, BACKGROUND, 0.35);
  const gridMat = matte(gridColor, { roughness: 0.9 });
  const grid = new THREE.Group();
  const GRID_Y = 0.02; // just above the disk to avoid z-fighting
  const SAMPLES = 128;

  // Concentric circles every 2 units.
  for (let r = 2; r <= PLANE_R; r += 2) {
    const pts = Array.from({ length: SAMPLES + 1 }, (_, j) => {
      const a = (2 * Math.PI * j) / SAMPLES;
      return new THREE.Vector3(r * Math.cos(a), GRID_Y, r * Math.sin(a));
    });
    const geom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), SAMPLES, 0.025, 6, true);
    grid.add(new THREE.Mesh(geom, gridMat));
  }
  // Radial spokes.
  const SPOKES = 16;
  for (let k = 0; k < SPOKES; k++) {
    const a = (2 * Math.PI * k) / SPOKES;
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const pts = [dir.clone().multiplyScalar(0.001).setY(GRID_Y), dir.clone().multiplyScalar(PLANE_R).setY(GRID_Y)];
    const geom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 1, 0.025, 6, false);
    grid.add(new THREE.Mesh(geom, gridMat));
  }
  app.scene.add(grid);
}

// The black hole: a flat black disk sitting in the plane.
{
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.55, 48), matte(PALETTE.ink, { roughness: 0.6 }));
  hole.rotation.x = -Math.PI / 2;
  hole.position.y = 0.04;
  app.scene.add(hole);
}

// --- Wandering initial conditions -------------------------------------------
//
// Each ray's launch angle φ and impact offset β are smooth functions of time:
// a sum of a few sinusoids with random frequency / phase / amplitude. φ(t)
// drifts the launch point around its sector; β(t) swings the aim from a
// head-on dive (β≈0) out to wide misses (|β|≳1), so each ray sweeps through
// capture and deflection on its own.

interface SineComp { amp: number; freq: number; phase: number }
type Wander = SineComp[];

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function makeWander(baseAmp: number, comps = 3): Wander {
  return Array.from({ length: comps }, () => ({
    amp: baseAmp * rand(0.4, 1) / comps,
    freq: rand(0.08, 0.32),
    phase: rand(0, Math.PI * 2),
  }));
}

function sample(w: Wander, t: number): number {
  let s = 0;
  for (const c of w) s += c.amp * Math.sin(c.freq * t + c.phase);
  return s;
}

interface Ray {
  phi0: number;     // base launch angle
  phiW: Wander;     // launch-angle drift
  betaBias: number; // constant offset so rays favour one side
  betaW: Wander;    // impact-offset drift
  mesh: THREE.Mesh;
}

const N = 14;
const rayMat = matte(LIGHTRAY, { roughness: 0.55 });
const rays: Ray[] = [];

for (let i = 0; i < N; i++) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), rayMat);
  app.scene.add(mesh);
  rays.push({
    phi0: (2 * Math.PI * i) / N,
    phiW: makeWander(0.7),
    betaBias: rand(-0.5, 0.5),
    betaW: makeWander(1.1),
    mesh,
  });
}

// --- Per-frame retrace -------------------------------------------------------

function updateRay(ray: Ray, t: number): void {
  const phi = ray.phi0 + sample(ray.phiW, t);
  const beta = ray.betaBias + sample(ray.betaW, t);

  // Launch point on the circle, aim = inward radial + β · tangent.
  const cx = Math.cos(phi), sy = Math.sin(phi);
  const px = R0 * cx, py = R0 * sy;
  const dx = -cx - beta * sy;
  const dy = -sy + beta * cx;

  const pts = trace(px, py, dx, dy);

  ray.mesh.geometry.dispose();
  if (pts.length < 2) { ray.mesh.geometry = new THREE.BufferGeometry(); return; }
  const curve = new THREE.CatmullRomCurve3(pts);
  ray.mesh.geometry = new THREE.TubeGeometry(curve, pts.length, 0.07, 8, false);
}

app.addAnimateCallback((elapsed) => {
  for (const ray of rays) updateRay(ray, elapsed);
});

app.start();
