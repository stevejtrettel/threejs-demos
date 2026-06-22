/**
 * A single Majumdar–Papapetrou light cone (c), conformal ↔ actual-metric blend.
 *
 * The future light cone of an event at the saddle between two extremal holes.
 * Null directions are flowed as optical-metric geodesics; each ray is truncated
 * at a common spatial reach σ and lifted by `(1 − blend)·σ + blend·t`:
 *
 *   • `blend = 0` — conformal/ultrastatic cone (the legacy picture), ~45°.
 *   • `blend = 1` — actual metric: coordinate time races ahead near each hole
 *     (`dt/dσ = 1/N → ∞`), so the cone spikes up along the hole worldlines.
 *
 * Built on `traceOpticalCone` + `opticalConeRays`.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { MajumdarPapapetrou, traceOpticalCone, opticalConeRays, lightConeGeometry } from '@/math/relativity';
import { applyStage, PALETTE, mixHex, LIGHTRAY, matte } from '../_shared/theme';

// --- Spacetime --------------------------------------------------------------

const TIME_SCALE = 0.5;
const mp = new MajumdarPapapetrou({
  holes: [
    { mass: 1, x: -2.2, y: 0 },
    { mass: 1, x: 2.2, y: 0 },
  ],
  extent: 16,
});
const optical = mp.chart('optical');
const data = mp.staticData();

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(17, 14, 20);
app.controls.target.set(0, 6, 0);
app.controls.update();
applyStage(app);

// --- Trace the cone's rays once ---------------------------------------------

const EVENT: [number, number] = [0, 0]; // saddle between the two holes
const STEPS = 700;
const DT = 0.04;

function nearHole(xy: number[]): boolean {
  for (const h of mp.holes) if (Math.hypot(xy[0] - h.x, xy[1] - h.y) < 0.02) return true;
  return false;
}

const coneRays = traceOpticalCone(optical, EVENT, {
  rays: 200,
  steps: STEPS,
  dt: DT,
  lapseSq: (xy) => data.lapseSq(xy),
  stop: (xy) => nearHole(xy) || Math.hypot(xy[0], xy[1]) > 15,
});

// --- Cone surface -----------------------------------------------------------

const coneMat = matte(LIGHTRAY, { roughness: 0.85, side: THREE.DoubleSide });
const coneMesh = new THREE.Mesh(new THREE.BufferGeometry(), coneMat);
app.scene.add(coneMesh);

const rimMat = matte(mixHex(PALETTE.orange, PALETTE.red, 0.5), { roughness: 0.6 });
const rimMesh = new THREE.Mesh(new THREE.BufferGeometry(), rimMat);
app.scene.add(rimMesh);

let coneSize = 9;
let blend = 1;

function drawCone(): void {
  const rays = opticalConeRays(coneRays, { size: coneSize, blend, timeScale: TIME_SCALE, samples: 240 });
  coneMesh.geometry.dispose();
  coneMesh.geometry = lightConeGeometry(rays);

  const rim = rays.map((r) => {
    const p = r.points[r.points.length - 1];
    return new THREE.Vector3(p[0], p[1], p[2]);
  });
  rimMesh.geometry.dispose();
  rimMesh.geometry = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(rim, true), rim.length, 0.08, 8, true,
  );
}
drawCone();

// --- Hole worldlines + grid + event marker ----------------------------------

const T_TOP = STEPS * DT * TIME_SCALE;
for (const h of mp.holes) {
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, T_TOP * 2, 24, 1, false),
    matte(PALETTE.ink, { roughness: 0.7 }),
  );
  tube.position.set(h.x, 0, h.y);
  app.scene.add(tube);
}

{
  const grid = new THREE.GridHelper(40, 20, PALETTE.slate, mixHex(PALETTE.slate, PALETTE.surface, 0.5));
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.5;
  app.scene.add(grid);
}

app.scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(0.14, 16, 16),
  new THREE.MeshBasicMaterial({ color: PALETTE.ink }),
)).position.set(EVENT[0], 0, EVENT[1]);

// --- Controls ---------------------------------------------------------------

app.overlay.addSlider({
  label: 'cone size',
  min: 1, max: 16, step: 0.1, value: coneSize,
  format: (v) => `cone size = ${v.toFixed(1)}`,
  onChange: (v) => { coneSize = v; drawCone(); },
});

app.overlay.addSlider({
  label: 'metric',
  min: 0, max: 1, step: 0.01, value: blend,
  format: (v) => `metric = ${v.toFixed(2)} (0 conformal · 1 actual)`,
  onChange: (v) => { blend = v; drawCone(); },
});

app.start();
