/**
 * Schwarzschild optical metric — light rays, flat or on the funnel.
 *
 *   (a) Light rays are geodesics of the optical (Fermat) metric h/N². A fan of
 *       parallel rays comes in from the left at a range of impact parameters
 *       and bends around the hole. Rays under the critical impact parameter
 *       b = 3√3·M ≈ 5.196 are captured; above it they escape.
 *   (b) The rotationally-symmetric optical metric embeds (over the portion that
 *       can) as a funnel that necks down at the photon sphere r = 3M. The same
 *       rays are drawn lifted onto it.
 *
 * The slider switches between the two: **flat plane** (a) and **surface of
 * revolution** (b). Geodesics integrate once against `chart('optical')` and are
 * cached; flipping the view only re-lifts and re-meshes them.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SurfaceMesh, GeodesicIntegrator } from '@/math';
import { Schwarzschild, FunnelSurface } from '@/math/relativity';
import { applyStage, PALETTE, LIGHTRAY, SURFACE_GREY, funnelGrid, matte } from '../_shared/theme';

// --- Spacetime + optical geometry ------------------------------------------

const MASS = 1;
const RIM = 14;

const bh = new Schwarzschild({ mass: MASS, extent: RIM + 4 });
const optical = bh.chart('optical');
const funnel = FunnelSurface.fromOpticalChart(optical, { rMax: RIM, samples: 800 });
const rH = bh.horizonRadius();

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 16, 26);
app.controls.target.set(0, -6, 0);
app.controls.update();
applyStage(app);

// --- Funnel surface (shown only in surface-of-revolution mode) --------------

const funnelMesh = new SurfaceMesh(funnel, {
  uSegments: 160,
  vSegments: 220,
  color: SURFACE_GREY,
  roughness: 0.92,
  metalness: 0.0,
});
{
  const m = funnelMesh.material as THREE.MeshPhysicalMaterial;
  m.side = THREE.DoubleSide;
  m.clearcoat = 0; // matte
  m.transparent = true;
  m.opacity = 0.9;
  m.polygonOffset = true;
  m.polygonOffsetFactor = 1;
  m.polygonOffsetUnits = 1;
}
app.scene.add(funnelMesh);

// Coordinate grid lifted onto the funnel.
const grid = funnelGrid(funnel, { parallels: 11, meridians: 24 });
app.scene.add(grid);

// Photon-sphere neck ring (r = 3M).
const ring = new THREE.Mesh(
  new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(
      Array.from({ length: 257 }, (_, i) => {
        const a = (2 * Math.PI * i) / 256;
        return funnel.lift(3 * MASS * Math.cos(a), 3 * MASS * Math.sin(a));
      }),
      true,
    ),
    256, 0.04, 8, true,
  ),
  new THREE.MeshBasicMaterial({ color: PALETTE.ink }),
);
app.scene.add(ring);

// --- Trace rays once, cache their optical-plane tracks ----------------------

const integrator = new GeodesicIntegrator(optical, { stepSize: 0.02 });
const MAX_STEPS = 7000;
const START_X = -(RIM - 1);

/** Integrate one ray (impact parameter b), return its (x, y) track. */
function traceRay(b: number): [number, number][] {
  const g = optical.computeMetric([START_X, b]).data;
  const speed = 1 / Math.sqrt(g[0]); // unit optical speed in +x
  let state = {
    position: [START_X, b] as [number, number],
    velocity: [speed, 0] as [number, number],
  };

  const track: [number, number][] = [[START_X, b]];
  for (let k = 0; k < MAX_STEPS; k++) {
    state = integrator.integrate(state);
    const [x, y] = state.position;
    const r = Math.hypot(x, y);
    if (!Number.isFinite(r) || r > RIM + 0.5) break;        // escaped past the rim
    track.push([x, y]);
    if (r <= rH * 1.04) break;                              // reached the horizon
  }
  return track;
}

const N_RAYS = 35;
const B_MAX = 9;
const tracks: [number, number][][] = [];
for (let i = 0; i < N_RAYS; i++) {
  const b = -B_MAX + (2 * B_MAX * i) / (N_RAYS - 1);
  if (Math.abs(b) < 1e-6) continue; // skip the head-on ray (degenerate axis)
  const t = traceRay(b);
  if (t.length >= 2) tracks.push(t);
}

// --- Render rays in the current mode ----------------------------------------

const rayMat = matte(LIGHTRAY, { roughness: 0.7 });

const rayGroup = new THREE.Group();
app.scene.add(rayGroup);

type Mode = 'flat' | 'funnel';
let mode: Mode = 'funnel';

const liftPoint = (x: number, y: number): THREE.Vector3 =>
  mode === 'funnel' ? funnel.lift(x, y) : new THREE.Vector3(x, 0, y);

function rebuildRays(): void {
  for (const child of rayGroup.children) {
    (child as THREE.Mesh).geometry.dispose();
  }
  rayGroup.clear();

  for (const track of tracks) {
    const pts = track.map(([x, y]) => liftPoint(x, y));
    const curve = new THREE.CatmullRomCurve3(pts);
    const geom = new THREE.TubeGeometry(curve, Math.min(pts.length, 1600), 0.05, 8, false);
    rayGroup.add(new THREE.Mesh(geom, rayMat));
  }
}

function setMode(next: Mode): void {
  mode = next;
  funnelMesh.visible = next === 'funnel';
  grid.visible = next === 'funnel';
  ring.visible = next === 'funnel';
  rebuildRays();
}
setMode('funnel');

// --- Control ----------------------------------------------------------------

app.overlay.addSlider({
  label: 'view',
  min: 0, max: 1, step: 1, value: 1,
  format: (v) => (v > 0.5 ? 'surface of revolution' : 'flat plane'),
  onChange: (v) => setMode(v > 0.5 ? 'funnel' : 'flat'),
});

app.start();
