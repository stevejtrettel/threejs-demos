/**
 * The optical geometry of a single MP black hole in 3D — and the fact that
 * geodesics lie in slices.
 *
 * A parallel beam of light comes in from −x at a range of impact parameters and
 * bends around the hole. In 3D the optical metric is U⁴(|r⃗|)·I, which is
 * spherically symmetric, so every geodesic lies in a plane through the centre
 * (conserved L = r⃗ × v⃗ — verified to 1e-7). The whole 3D bundle is therefore
 * one 2D **slice** rotated about the beam axis.
 *
 * We trace the slice once (a fan of rays in the x–y plane) and rotate it into N
 * azimuthal copies. The `slices` slider sweeps from the full 3D bundle (many
 * slices) down to a single slice — showing that studying one slice suffices.
 *
 * Built on `traceOpticalRay` with the single-hole optical chart.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { App } from '@/app/App';
import { MajumdarPapapetrou, traceOpticalRay } from '@/math/relativity';
import { applyStage, PALETTE, LIGHTRAY, SURFACE_GREY, matte } from '../_shared/theme';

// --- Spacetime --------------------------------------------------------------

const mp = new MajumdarPapapetrou({ holes: [{ mass: 1, x: 0, y: 0 }], extent: 30 });
const optical = mp.chart('optical');
const data = mp.staticData();

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(9, 8, 16);
app.controls.target.set(-1, 0, 0);
app.controls.update();
applyStage(app);

// Black hole at the origin.
app.scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(0.32, 32, 24),
  matte(PALETTE.ink, { roughness: 0.6 }),
));

// --- Trace the slice fan (parallel rays in the x–y plane) -------------------

const START_X = -12;
const B_MAX = 8;
const N_RAYS = 17;
const fan: { x: number[]; y: number[] }[] = [];
for (let i = 0; i < N_RAYS; i++) {
  const b = -B_MAX + (2 * B_MAX * i) / (N_RAYS - 1);
  if (Math.abs(b) < 1e-6) continue; // the head-on ray plunges straight in (degenerate axis)
  const r = traceOpticalRay(optical, [START_X, b], [1, 0], {
    steps: 1600,
    dt: 0.03,
    lapseSq: (xy) => data.lapseSq(xy),
    stop: (xy) => { const rr = Math.hypot(xy[0], xy[1]); return rr < 0.12 || rr > 13; },
  });
  if (r.x.length >= 2) fan.push({ x: r.x, y: r.y });
}

// --- Build N azimuthal slices by rotating the fan about the x-axis ----------

const N_MAX = 18;
const rayMat = matte(LIGHTRAY, { roughness: 0.6 });

const sliceMeshes: THREE.Mesh[] = [];
for (let j = 0; j < N_MAX; j++) {
  const psi = (Math.PI * j) / N_MAX; // [0, π): the fan's ±b already covers both sides
  const c = Math.cos(psi);
  const s = Math.sin(psi);

  const geoms: THREE.BufferGeometry[] = [];
  for (const ray of fan) {
    const pts = ray.x.map((x, k) => new THREE.Vector3(x, ray.y[k] * c, ray.y[k] * s));
    const g = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts), Math.min(pts.length, 400), 0.04, 5, false,
    );
    geoms.push(g);
  }
  const merged = mergeGeometries(geoms, false);
  geoms.forEach((g) => g.dispose());
  const mesh = new THREE.Mesh(merged, rayMat);
  sliceMeshes.push(mesh);
  app.scene.add(mesh);
}

// Translucent plane marking the base slice — the world x–y plane (z = 0),
// which is PlaneGeometry's default orientation, so no rotation is needed.
const slicePlane = new THREE.Mesh(
  new THREE.PlaneGeometry(B_MAX * 3, B_MAX * 2),
  new THREE.MeshStandardMaterial({
    color: SURFACE_GREY, roughness: 0.95, metalness: 0,
    transparent: true, opacity: 0.35, side: THREE.DoubleSide,
  }),
);
app.scene.add(slicePlane);

// --- Control ----------------------------------------------------------------

let nSlices = N_MAX;
function setSlices(n: number): void {
  nSlices = n;
  sliceMeshes.forEach((m, j) => { m.visible = j < n; });
  // Emphasise the lone slice (and its plane) only when it stands alone.
  slicePlane.visible = n <= 2;
}
setSlices(nSlices);

app.overlay.addSlider({
  label: 'slices',
  min: 1, max: N_MAX, step: 1, value: N_MAX,
  format: (v) => (v <= 1 ? 'one slice' : `${v} slices`),
  onChange: (v) => setSlices(Math.round(v)),
});

app.start();
