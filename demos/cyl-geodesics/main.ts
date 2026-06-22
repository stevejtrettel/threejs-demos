/**
 * Geodesics on a cylinder and their straight-line lifts to the universal cover.
 *
 * A family of evenly-spaced, parallel geodesics is drawn twice in one scene:
 *   • on the **cylinder** (left) they are helices of a common pitch, wrapping
 *     the tube;
 *   • on the **universal cover** (right) — the cylinder cut along one generator
 *     and laid flat into the strip [0, 2π]×[−H/2, H/2] — they are straight
 *     lines. A helix that crosses the cut reappears at the opposite edge, so it
 *     shows up as parallel segments; the two emphasised vertical edges are the
 *     glued seam (the deck translation θ ↦ θ + 2π).
 *
 * The cover map (θ, h) ↦ (R cos θ, h, R sin θ) is an isometry, so the strip's
 * width is the true circumference 2πR. A single parameter sweeps both pictures
 * in lockstep: each geodesic is traced out simultaneously as a helix and as its
 * straight lift, then the reveal loops.
 *
 * Colours follow the relativity demos (warm off-white stage, matte surfaces,
 * yellow curves).
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { applyStage, PALETTE, SURFACE_GREY, mixHex, matte, BACKGROUND, LIGHTRAY } from '../_shared/theme';

// --- Geometry of the two pictures -------------------------------------------

const R = 2;              // cylinder radius
const H = 10;             // cylinder height (h ∈ [−H/2, H/2])
const WRAPS = 1.25;       // turns each geodesic makes from bottom to top
const N = 6;              // number of parallel geodesics
const M = 240;            // samples per geodesic
const W = 2 * Math.PI * R; // unrolled strip width (= circumference)
const XL = 5;             // left edge of the cover strip, in world x

const TWO_PI = Math.PI * 2;
const DTHETA = WRAPS * TWO_PI; // total Δθ along one geodesic

// (θ, h) → point on the cylinder (centred at the origin, axis = y).
const onCylinder = (theta: number, h: number): THREE.Vector3 =>
  new THREE.Vector3(R * Math.cos(theta), h, R * Math.sin(theta));

// (θ, h) → point on the flat cover strip (θ reduced into one fundamental domain).
const onCover = (theta: number, h: number): THREE.Vector3 => {
  const local = ((theta % TWO_PI) + TWO_PI) % TWO_PI;
  return new THREE.Vector3(XL + R * local, h, 0);
};

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
applyStage(app);

app.camera.fov = 40;
app.camera.position.set(12, 9, 26);
app.controls.target.set(7, 0.5, 0);
app.controls.update();
app.camera.updateProjectionMatrix();

// --- The cylinder + the cover strip, with matching faint grids --------------

const gridColor = mixHex(PALETTE.slate, BACKGROUND, 0.35);
const gridMat = matte(gridColor, { roughness: 0.9 });
const seamMat = matte(PALETTE.slate, { roughness: 0.85 });
const surfMat = matte(SURFACE_GREY, { roughness: 0.95, side: THREE.DoubleSide });

const N_MER = 12;         // meridians / vertical grid lines
const N_LAT = 10;         // latitude rings / horizontal grid lines
const hAt = (i: number) => -H / 2 + (H * i) / N_LAT;

function tube(points: THREE.Vector3[], radius: number, mat: THREE.Material, closed = false): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(points.length, 2), radius, 6, closed), mat);
}

// Cylinder surface.
{
  const surf = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 96, 1, true), surfMat);
  app.scene.add(surf);
}

// Cover surface (flat rectangle just behind the grid).
{
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), surfMat);
  plane.position.set(XL + W / 2, 0, -0.02);
  app.scene.add(plane);
}

// Cylinder grid: meridians + rings.
for (let k = 0; k < N_MER; k++) {
  const theta = (TWO_PI * k) / N_MER;
  app.scene.add(tube([onCylinder(theta, -H / 2), onCylinder(theta, H / 2)], 0.02, gridMat));
}
for (let i = 0; i <= N_LAT; i++) {
  const ring = Array.from({ length: 65 }, (_, j) => onCylinder((TWO_PI * j) / 64, hAt(i)));
  app.scene.add(tube(ring, 0.02, gridMat, true));
}

// Cover grid: matching vertical + horizontal lines; the two end edges are the seam.
for (let k = 0; k <= N_MER; k++) {
  const theta = (TWO_PI * k) / N_MER;
  const isSeam = k === 0 || k === N_MER;
  const x = XL + R * theta;
  app.scene.add(tube(
    [new THREE.Vector3(x, -H / 2, 0), new THREE.Vector3(x, H / 2, 0)],
    isSeam ? 0.035 : 0.02,
    isSeam ? seamMat : gridMat,
  ));
}
for (let i = 0; i <= N_LAT; i++) {
  app.scene.add(tube(
    [new THREE.Vector3(XL, hAt(i), 0), new THREE.Vector3(XL + W, hAt(i), 0)],
    0.02, gridMat,
  ));
}

// --- The geodesics: sampled once, revealed progressively each frame ---------

interface Geodesic {
  cyl: THREE.Vector3[];     // helix points
  cover: THREE.Vector3[];   // straight-lift points (θ reduced mod 2π)
  cylMesh: THREE.Mesh;      // rebuilt up to the reveal head each frame
  cylMarker: THREE.Mesh;    // tip marker on the cylinder
  coverMarker: THREE.Mesh;  // tip marker on the cover
}

const rayMat = matte(LIGHTRAY, { roughness: 0.55 });
const markerMat = matte(mixHex(LIGHTRAY, PALETTE.ink, 0.15), { roughness: 0.5 });
const RAY_R = 0.06;
const coverGroup = new THREE.Group(); // holds the (split) cover segments
app.scene.add(coverGroup);

const geos: Geodesic[] = [];
for (let g = 0; g < N; g++) {
  const theta0 = (TWO_PI * g) / N;
  const cyl: THREE.Vector3[] = [];
  const cover: THREE.Vector3[] = [];
  for (let j = 0; j <= M; j++) {
    const tau = j / M;
    const theta = theta0 + DTHETA * tau;
    const h = -H / 2 + H * tau;
    cyl.push(onCylinder(theta, h));
    cover.push(onCover(theta, h));
  }
  const cylMesh = new THREE.Mesh(new THREE.BufferGeometry(), rayMat);
  app.scene.add(cylMesh);
  const cylMarker = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), markerMat);
  const coverMarker = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), markerMat);
  app.scene.add(cylMarker, coverMarker);
  geos.push({ cyl, cover, cylMesh, cylMarker, coverMarker });
}

// --- Reveal animation -------------------------------------------------------

const REVEAL = 5.0; // seconds to trace the geodesics out
const HOLD = 1.2;   // seconds to hold the finished picture before looping
const CYCLE = REVEAL + HOLD;

function rebuild(geo: Geodesic, head: number): void {
  // Cylinder: one continuous tube up to the head.
  geo.cylMesh.geometry.dispose();
  if (head >= 1) {
    const c = new THREE.CatmullRomCurve3(geo.cyl.slice(0, head + 1));
    geo.cylMesh.geometry = new THREE.TubeGeometry(c, head, RAY_R, 8, false);
  } else {
    geo.cylMesh.geometry = new THREE.BufferGeometry();
  }
  geo.cylMarker.position.copy(geo.cyl[head]);
  geo.coverMarker.position.copy(geo.cover[head]);
}

function rebuildCover(head: number): void {
  // Clear last frame's cover segments.
  for (const child of coverGroup.children) (child as THREE.Mesh).geometry.dispose();
  coverGroup.clear();

  // Split each revealed lift wherever its drawn x teleports across the seam, so
  // segments hit the edges instead of streaking across the strip. (Splitting on
  // the actual x-jump rather than the domain index is robust to a sample landing
  // exactly on θ = 2π, where floor(θ/2π) and θ mod 2π can disagree by one step.)
  for (const geo of geos) {
    let run: THREE.Vector3[] = [geo.cover[0]];
    for (let j = 1; j <= head; j++) {
      if (Math.abs(geo.cover[j].x - geo.cover[j - 1].x) > W / 2) {
        if (run.length >= 2) coverGroup.add(tube(run, RAY_R, rayMat));
        run = [];
      }
      run.push(geo.cover[j]);
    }
    if (run.length >= 2) coverGroup.add(tube(run, RAY_R, rayMat));
  }
}

app.addAnimateCallback((elapsed) => {
  const phase = elapsed % CYCLE;
  const s = Math.min(phase / REVEAL, 1);
  const head = Math.round(s * M);
  for (const geo of geos) rebuild(geo, head);
  rebuildCover(head);
});

app.start();
