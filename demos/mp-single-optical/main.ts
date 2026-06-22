/**
 * Single Majumdar–Papapetrou hole — optical metric, flat or on the funnel.
 *
 * One extremal charged black hole is rotationally symmetric, so (unlike a
 * multi-hole cluster) its optical metric U⁴·δ embeds as a surface of
 * revolution — an infinitely deep throat (the extremal horizon sits at
 * infinite optical distance), of which we draw a finite portion.
 *
 * The slider switches between **flat plane** and **surface of revolution**, as
 * in the Schwarzschild demo. Light rays integrate against `chart('optical')`.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SurfaceMesh, GeodesicIntegrator } from '@/math';
import { MajumdarPapapetrou, FunnelSurface } from '@/math/relativity';
import { applyStage, LIGHTRAY, SURFACE_GREY, funnelGrid, matte } from '../_shared/theme';

// --- Spacetime + optical geometry ------------------------------------------

const RIM = 9;
const R_INNER = 0.6; // funnel throat cutoff (the true throat is infinitely deep)

const mp = new MajumdarPapapetrou({ holes: [{ mass: 1, x: 0, y: 0 }], extent: RIM + 4 });
const optical = mp.chart('optical');
const funnel = FunnelSurface.fromOpticalChart(optical, { rMax: RIM, rMinTarget: R_INNER, samples: 800 });
const rThroat = funnel.profile.rMinEmbed;

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 14, 22);
app.controls.target.set(0, -8, 0);
app.controls.update();
applyStage(app);

// --- Funnel surface ---------------------------------------------------------

const funnelMesh = new SurfaceMesh(funnel, {
  uSegments: 160,
  vSegments: 240,
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
const grid = funnelGrid(funnel, { parallels: 12, meridians: 24 });
app.scene.add(grid);

// --- Trace rays once --------------------------------------------------------

const integrator = new GeodesicIntegrator(optical, { stepSize: 0.015 });
const MAX_STEPS = 9000;
const START_X = -(RIM - 1);

function traceRay(b: number): [number, number][] {
  const g = optical.computeMetric([START_X, b]).data;
  const speed = 1 / Math.sqrt(g[0]);
  let state = {
    position: [START_X, b] as [number, number],
    velocity: [speed, 0] as [number, number],
  };
  const track: [number, number][] = [[START_X, b]];
  for (let k = 0; k < MAX_STEPS; k++) {
    state = integrator.integrate(state);
    const [x, y] = state.position;
    const r = Math.hypot(x, y);
    if (!Number.isFinite(r) || r > RIM + 0.5) break;
    track.push([x, y]);
    if (r <= rThroat * 1.02) break; // reached the drawn throat
  }
  return track;
}

const N_RAYS = 35;
const B_MAX = 7;
const tracks: [number, number][][] = [];
for (let i = 0; i < N_RAYS; i++) {
  const b = -B_MAX + (2 * B_MAX * i) / (N_RAYS - 1);
  if (Math.abs(b) < 1e-6) continue;
  const t = traceRay(b);
  if (t.length >= 2) tracks.push(t);
}

// --- Render -----------------------------------------------------------------

const rayMat = matte(LIGHTRAY, { roughness: 0.7 });

const rayGroup = new THREE.Group();
app.scene.add(rayGroup);

type Mode = 'flat' | 'funnel';
let mode: Mode = 'funnel';

const liftPoint = (x: number, y: number): THREE.Vector3 =>
  mode === 'funnel' ? funnel.lift(x, y) : new THREE.Vector3(x, 0, y);

function rebuildRays(): void {
  for (const child of rayGroup.children) (child as THREE.Mesh).geometry.dispose();
  rayGroup.clear();
  for (const track of tracks) {
    const pts = track.map(([x, y]) => liftPoint(x, y));
    const curve = new THREE.CatmullRomCurve3(pts);
    const geom = new THREE.TubeGeometry(curve, Math.min(pts.length, 1800), 0.05, 8, false);
    rayGroup.add(new THREE.Mesh(geom, rayMat));
  }
}

function setMode(next: Mode): void {
  mode = next;
  funnelMesh.visible = next === 'funnel';
  grid.visible = next === 'funnel';
  rebuildRays();
}
setMode('funnel');

app.overlay.addSlider({
  label: 'view',
  min: 0, max: 1, step: 1, value: 1,
  format: (v) => (v > 0.5 ? 'surface of revolution' : 'flat plane'),
  onChange: (v) => setMode(v > 0.5 ? 'funnel' : 'flat'),
});

app.start();
