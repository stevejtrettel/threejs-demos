/**
 * A single Schwarzschild light cone (c), with a conformal ↔ actual-metric blend.
 *
 * Spacetime diagram: space flat, time up. A ring of null directions is emitted
 * at one event and flowed as geodesics of the *optical* (Fermat) metric (the
 * spatial light paths). Each ray carries two clocks: the spatial proper length
 * σ it has travelled, and the coordinate time t it has taken. We truncate every
 * ray at the same spatial reach σ and lift it by
 *
 *   height = (1 − blend)·σ  +  blend·t.
 *
 *   • `blend = 0` — the **conformal / ultrastatic** cone (`−dt² + …`): height is
 *     spatial reach, a clean ~45° cone. This is what the legacy demos drew.
 *   • `blend = 1` — the **actual metric**: height is real coordinate time, which
 *     races ahead near the hole (`dt/dσ = 1/N → ∞`), so the cone bulges up into
 *     a vertical spike on the horizon while staying ~45° far away.
 *
 * Two sliders: how far the cone reaches in space, and the blend between the two
 * pictures. Built on `traceOpticalCone` + `opticalConeRays`.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { Schwarzschild, traceOpticalCone, opticalConeRays, lightConeGeometry } from '@/math/relativity';
import { applyStage, PALETTE, mixHex, LIGHTRAY, matte } from '../_shared/theme';

// --- Spacetime --------------------------------------------------------------

const MASS = 1;
const rH = 2 * MASS;
const TIME_SCALE = 0.5;

const bh = new Schwarzschild({ mass: MASS, extent: 40 });
const optical = bh.chart('optical');
const data = bh.staticData();

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(19, 14, 21);
app.controls.target.set(3, 6, 0);
app.controls.update();
applyStage(app);

// --- Trace the cone's rays once ---------------------------------------------

const EVENT: [number, number] = [6, 0];
const STEPS = 700;
const DT = 0.04;
const coneRays = traceOpticalCone(optical, EVENT, {
  rays: 200,
  steps: STEPS,
  dt: DT,
  lapseSq: (xy) => data.lapseSq(xy),
  stop: (xy) => Math.hypot(xy[0], xy[1]) > 34,
});

// --- Cone surface (rebuilt from the cached rays on slider change) -----------

const coneMat = matte(LIGHTRAY, { roughness: 0.85, side: THREE.DoubleSide });
const coneMesh = new THREE.Mesh(new THREE.BufferGeometry(), coneMat);
app.scene.add(coneMesh);

// A deeper-toned ring lofted around the cone's leading edge.
const rimMat = matte(mixHex(PALETTE.orange, PALETTE.red, 0.5), { roughness: 0.6 });
const rimMesh = new THREE.Mesh(new THREE.BufferGeometry(), rimMat);
app.scene.add(rimMesh);

let coneSize = 11;
let blend = 1;

function drawCone(): void {
  const rays = opticalConeRays(coneRays, { size: coneSize, blend, timeScale: TIME_SCALE, samples: 240 });
  coneMesh.geometry.dispose();
  coneMesh.geometry = lightConeGeometry(rays);

  // Rim: the last point of every ray, lofted into a closed tube.
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

// --- Horizon worldline + plane grid + event marker -------------------------

const T_TOP = STEPS * DT * TIME_SCALE; // tallest the spike can climb
const horizon = new THREE.Mesh(
  new THREE.CylinderGeometry(rH, rH, T_TOP * 2, 48, 1, true),
  matte(PALETTE.ink, { roughness: 0.7, side: THREE.DoubleSide }),
);
app.scene.add(horizon);

{
  const grid = new THREE.GridHelper(48, 24, PALETTE.slate, mixHex(PALETTE.slate, PALETTE.surface, 0.5));
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.5;
  app.scene.add(grid);
}

app.scene.add(new THREE.Mesh(
  new THREE.SphereGeometry(0.16, 16, 16),
  new THREE.MeshBasicMaterial({ color: PALETTE.ink }),
)).position.set(EVENT[0], 0, EVENT[1]);

// --- Controls ---------------------------------------------------------------

app.overlay.addSlider({
  label: 'cone size',
  min: 2, max: 26, step: 0.1, value: coneSize,
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
