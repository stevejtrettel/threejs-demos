/**
 * The Schwarzschild optical funnel in Euclidean space, with a single light
 * geodesic sweeping through the regimes.
 *
 * The rotationally-symmetric optical metric of a Schwarzschild hole embeds as a
 * surface of revolution (see `schwarzschild-optical-funnel.md`): it necks down
 * at the photon sphere r = 3M and is drawn over the embeddable range
 * r ∈ [9M/4, r_max]. One geodesic of the optical metric is drawn on it, and its
 * impact parameter slowly oscillates around the critical value b = 3√3·M, so
 * the curve continuously morphs:
 *
 *   plunge down the throat  →  spiral around the neck  →  swing out and escape
 *
 * …and back. Styled after the homogeneous-spaces talk: warm cream background,
 * matte light-grey surface with a coordinate grid, IBL rig.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { SurfaceMesh } from '@/math';
import { Schwarzschild, FunnelSurface, traceOpticalRay } from '@/math/relativity';
import { applyStage, PALETTE, SURFACE_GREY, funnelGrid, matte } from '../_shared/theme';

// --- Optical funnel ---------------------------------------------------------

const MASS = 1;
const RIM = 12;
const B_CRIT = 3 * Math.sqrt(3) * MASS; // ≈ 5.196: critical impact parameter

const bh = new Schwarzschild({ mass: MASS, extent: RIM + 4 });
const optical = bh.chart('optical');
const data = bh.staticData();
const funnel = FunnelSurface.fromOpticalChart(optical, { rMax: RIM, samples: 800 });
const rThroat = funnel.profile.rMinEmbed;

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
app.camera.position.set(0, 15, 25);
app.controls.target.set(0, -5, 0);
app.controls.update();
applyStage(app);

// Everything spins together (the surface itself is symmetric, so this just
// turns the grid and the geodesic for a sense of depth).
const world = new THREE.Group();
app.scene.add(world);

// Funnel surface + coordinate grid (homogeneous-spaces styling).
const funnelMesh = new SurfaceMesh(funnel, {
  uSegments: 160, vSegments: 220, color: SURFACE_GREY, roughness: 0.92, metalness: 0.0,
});
{
  const m = funnelMesh.material as THREE.MeshPhysicalMaterial;
  m.side = THREE.DoubleSide;
  m.clearcoat = 0;
  m.transparent = true;
  m.opacity = 0.9;
  m.polygonOffset = true;
  m.polygonOffsetFactor = 1;
  m.polygonOffsetUnits = 1;
}
world.add(funnelMesh);
world.add(funnelGrid(funnel, { parallels: 11, meridians: 24 }));

// Photon-sphere neck ring (r = 3M).
{
  const pts = Array.from({ length: 257 }, (_, i) => {
    const a = (2 * Math.PI * i) / 256;
    return funnel.lift(3 * MASS * Math.cos(a), 3 * MASS * Math.sin(a));
  });
  world.add(new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 256, 0.04, 8, true),
    new THREE.MeshBasicMaterial({ color: PALETTE.ink }),
  ));
}

// --- The morphing geodesic --------------------------------------------------

// A little spray: a central geodesic plus neighbours, thinning outward.
const SPRAY = [-2, -1, 0, 1, 2];   // impact-parameter offsets (in units of DB)
const DB = 0.32;                   // spacing between spray members
const BASE_RADIUS = 0.13;
const FALLOFF = 0.6;               // tube radius shrinks by this per step from the centre

const sprayMeshes = SPRAY.map(() =>
  new THREE.Mesh(new THREE.BufferGeometry(), matte(PALETTE.red, { roughness: 0.5 })));
sprayMeshes.forEach((m) => world.add(m));
const sprayRadii = SPRAY.map((k) => BASE_RADIUS * Math.pow(FALLOFF, Math.abs(k)));

// A dot riding the central launch point as it moves around the rim.
const entryDot = new THREE.Mesh(
  new THREE.SphereGeometry(0.22, 20, 20),
  matte(PALETTE.red, { roughness: 0.5 }),
);
world.add(entryDot);

/** Trace the optical geodesic for impact parameter b and lift it onto the funnel. */
function geodesicFor(b: number): THREE.Vector3[] {
  const x0 = -Math.sqrt(Math.max(RIM * RIM - b * b, 0)); // enter on the rim circle
  const ray = traceOpticalRay(optical, [x0, b], [1, 0], {
    steps: 2400,
    dt: 0.02,
    lapseSq: (xy) => data.lapseSq(xy),
    stop: (xy) => {
      const r = Math.hypot(xy[0], xy[1]);
      return r < rThroat * 1.01 || r > RIM + 0.2; // hit the throat, or back out past the rim
    },
  });
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k < ray.x.length; k++) pts.push(funnel.lift(ray.x[k], ray.y[k]));
  return pts;
}

function drawSpray(bCenter: number): void {
  for (let i = 0; i < SPRAY.length; i++) {
    const b = Math.min(Math.max(bCenter + SPRAY[i] * DB, 2.2), 8);
    const pts = geodesicFor(b);
    sprayMeshes[i].geometry.dispose();
    if (pts.length < 2) { sprayMeshes[i].geometry = new THREE.BufferGeometry(); continue; }
    sprayMeshes[i].geometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(pts), Math.min(pts.length, 600), sprayRadii[i], 8, false,
    );
    if (SPRAY[i] === 0) entryDot.position.copy(pts[0]);
  }
}

// --- Animation: sweep b around critical, lingering on the spiral ------------

const PERIOD = 30;         // sec for a full there-and-back sweep
const AMP = 2.6;           // central b ranges over B_CRIT ± AMP
const omega = (2 * Math.PI) / PERIOD;

let lastB = -1;
app.addAnimateCallback((elapsed) => {
  // sin³ dwells near the turning points *and* near critical (where sin≈0),
  // so the spiral gets screen time on every pass.
  const s = Math.sin(omega * elapsed);
  const b = B_CRIT + AMP * s * s * s;
  if (Math.abs(b - lastB) > 0.004) { drawSpray(b); lastB = b; }
});

app.start();
