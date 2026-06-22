/**
 * Flat-torus geodesics vs. the true geodesics of a torus of revolution.
 *
 * The flat fundamental square stands beside a stack of two tori (as the cover
 * strip stood beside the cylinder in `cyl-geodesics`). All share one family of
 * initial conditions:
 *
 *   • SIDE — the flat torus ℝ²/ℤ². A family of evenly-spaced parallel geodesics
 *     are straight lines in the fundamental square (wrapping at the edges).
 *
 *   • UPPER torus — those *same* flat geodesics rolled onto a torus of revolution
 *     by (φ, ψ) ↦ ((R + r cosψ)cosφ, (R + r cosψ)sinφ, r sinψ). They stay straight
 *     in (φ, ψ), so they are NOT geodesics of the embedded surface — just the
 *     ℝ²/ℤ² lines wrapped onto the donut.
 *
 *   • LOWER torus — the genuinely correct geodesics of the same torus of
 *     revolution in ℝ³, integrated in its induced metric g = diag((R+r cosψ)², r²),
 *     launched from the *same* points with the *same* initial directions.
 *
 * Launched off the outer equator at a shallow-enough angle, the true geodesics
 * obey the Clairaut relation (R + r cosψ)·cos∠ = const: they oscillate between
 * turning latitudes and never reach the inner equator, while the rolled flat
 * lines sweep the whole donut. A single parameter traces all three out in
 * lockstep from the shared start, so you watch the correct curve peel away.
 *
 * Colours follow the relativity demos (off-white stage, matte surfaces, yellow
 * curves). Built on the n-D `geodesicDeriv` + `integrate`.
 */

import * as THREE from 'three';
import { App } from '@/app/App';
import { geodesicDeriv } from '@/math';
import { integrate } from '@/math/ode';
import { Matrix } from '@/math/linear-algebra';
import type { Manifold } from '@/math/manifolds';
import { applyStage, PALETTE, SURFACE_GREY, mixHex, matte, BACKGROUND, LIGHTRAY } from '../_shared/theme';

// --- The torus of revolution -------------------------------------------------

const R = 3;   // major radius (centre of tube to axis)
const r = 1;   // minor radius (tube)
const TWO_PI = Math.PI * 2;

// Embedding (axis = local z, matching THREE.TorusGeometry's convention).
const torusPoint = (phi: number, psi: number): THREE.Vector3 => {
  const rho = R + r * Math.cos(psi);
  return new THREE.Vector3(rho * Math.cos(phi), rho * Math.sin(phi), r * Math.sin(psi));
};

// Induced metric in (φ, ψ): E = ρ², G = r², F = 0.
const torusManifold: Manifold = {
  dim: 2,
  getDomainBounds: () => ({ min: [-1e4, -1e4], max: [1e4, 1e4] }),
  computeMetric: (p: number[]) => {
    const rho = R + r * Math.cos(p[1]);
    return Matrix.fromRows([[rho * rho, 0], [0, r * r]]);
  },
};
const deriv = geodesicDeriv(torusManifold);

// --- Shared family of initial conditions ------------------------------------

const N = 5;            // number of parallel geodesics
const ALPHA = 0.7;      // launch angle from the toroidal direction (≈40°)
const PSI0 = 0;         // start on the outer equator (ρ maximal → trapped)

// Unit-speed launch: |v|²_g = 1 with the metric at the start point.
const rho0 = R + r * Math.cos(PSI0);
const VPHI = Math.cos(ALPHA) / rho0;
const VPSI = Math.sin(ALPHA) / r;

// Integration: fine steps, then subsample to a drawable resolution.
const DT = 0.05;
const STRIDE = 4;
const M = 220;                 // drawn samples per geodesic
const STEPS = M * STRIDE;      // fine integration steps (total length = STEPS·DT)

// For each geodesic: the flat (φ,ψ) straight line and the true integrated path.
interface Sampled { phi: number; psi: number }
interface GeoData { flat: Sampled[]; trueG: Sampled[] }

const geoData: GeoData[] = [];
for (let g = 0; g < N; g++) {
  const phi0 = (TWO_PI * g) / N;

  const flat: Sampled[] = [];
  for (let k = 0; k <= STEPS; k += STRIDE) {
    const t = k * DT;
    flat.push({ phi: phi0 + VPHI * t, psi: PSI0 + VPSI * t });
  }

  const traj = integrate({ deriv, initial: [phi0, PSI0, VPHI, VPSI], dt: DT, steps: STEPS });
  const trueG: Sampled[] = [];
  for (let k = 0; k <= STEPS; k += STRIDE) {
    const s = traj.states[k];
    trueG.push({ phi: s[0], psi: s[1] });
  }

  geoData.push({ flat, trueG });
}

// --- Scene ------------------------------------------------------------------

const app = new App({ antialias: true, debug: false });
applyStage(app);

app.camera.fov = 42;
app.camera.position.set(8, 5, 26);
app.controls.target.set(4, 0, 0);
app.controls.update();
app.camera.updateProjectionMatrix();

// Two tori stacked vertically at the origin (where the cylinder sat); the flat
// square stands beside them, offset along +x (like the cylinder demo's cover).
const Y_ROLLED = 2.5;  // rolled (ℝ²/ℤ²) torus, upper
const Y_TRUE = -2.5;   // true ℝ³ torus, lower
const PS = 6;          // side of the flat fundamental square
const XP = 6;          // left edge of the plane (tori reach x = ±(R+r) = ±4)

// --- Shared materials & helpers ---------------------------------------------

const gridColor = mixHex(PALETTE.slate, BACKGROUND, 0.35);
const gridMat = matte(gridColor, { roughness: 0.9 });
const surfMat = matte(SURFACE_GREY, { roughness: 0.95, side: THREE.DoubleSide });
const rayMat = matte(LIGHTRAY, { roughness: 0.55 });
const markerMat = matte(mixHex(LIGHTRAY, PALETTE.ink, 0.15), { roughness: 0.5 });
const RAY_R = 0.055;

function tube(points: THREE.Vector3[], radius: number, mat: THREE.Material, closed = false): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points, closed);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(points.length, 2), radius, 6, closed), mat);
}

// A torus laid flat (donut axis → world y), placed at a given height.
function torusGroup(yLevel: number): THREE.Group {
  const group = new THREE.Group();
  group.rotation.x = -Math.PI / 2;
  group.position.y = yLevel;

  group.add(new THREE.Mesh(new THREE.TorusGeometry(R, r, 32, 96), surfMat));

  // Faint coordinate grid: poloidal circles (φ = const) + toroidal circles (ψ = const).
  const N_TOR = 12, N_POL = 8;
  for (let i = 0; i < N_TOR; i++) {
    const phi = (TWO_PI * i) / N_TOR;
    const pts = Array.from({ length: 49 }, (_, j) => torusPoint(phi, (TWO_PI * j) / 48));
    group.add(tube(pts, 0.018, gridMat, true));
  }
  for (let j = 0; j < N_POL; j++) {
    const psi = (TWO_PI * j) / N_POL;
    const pts = Array.from({ length: 97 }, (_, i) => torusPoint((TWO_PI * i) / 96, psi));
    group.add(tube(pts, 0.018, gridMat, true));
  }
  app.scene.add(group);
  return group;
}

const rolledGroup = torusGroup(Y_ROLLED);
const trueGroup = torusGroup(Y_TRUE);

// The flat fundamental square with its lattice grid — a vertical billboard
// standing beside the tori (u → world x, v → world y).
{
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(PS, PS), surfMat);
  plane.position.set(XP + PS / 2, 0, -0.02);
  app.scene.add(plane);

  const DIV = 6;
  for (let k = 0; k <= DIV; k++) {
    const a = (PS * k) / DIV; // 0 … PS along each edge
    // vertical lines (u = const): fixed x, spanning y
    app.scene.add(tube([new THREE.Vector3(XP + a, -PS / 2, 0), new THREE.Vector3(XP + a, PS / 2, 0)], 0.018, gridMat));
    // horizontal lines (v = const): fixed y, spanning x
    app.scene.add(tube([new THREE.Vector3(XP, -PS / 2 + a, 0), new THREE.Vector3(XP + PS, -PS / 2 + a, 0)], 0.018, gridMat));
  }
}

// --- Curve meshes (rebuilt up to the reveal head each frame) ----------------

// Plane: position in the fundamental square (wrapped into [0,1)²) → world,
// laid out as a vertical billboard (u → x, v → y) beside the tori.
const planePoint = (phi: number, psi: number): THREE.Vector3 => {
  const u = ((phi / TWO_PI) % 1 + 1) % 1;
  const v = ((psi / TWO_PI) % 1 + 1) % 1;
  return new THREE.Vector3(XP + u * PS, -PS / 2 + v * PS, 0);
};

interface Curve {
  planePts: THREE.Vector3[];   // wrapped, world coords (split on seam crossings)
  rolledPts: THREE.Vector3[];  // local torus coords (continuous)
  truePts: THREE.Vector3[];    // local torus coords (continuous)
  rolledMesh: THREE.Mesh;
  trueMesh: THREE.Mesh;
  planeMark: THREE.Mesh;
  rolledMark: THREE.Mesh;
  trueMark: THREE.Mesh;
}

const planeGroup = new THREE.Group(); // holds the (split) plane segments
app.scene.add(planeGroup);

const curves: Curve[] = [];
for (const gd of geoData) {
  const planePts = gd.flat.map((s) => planePoint(s.phi, s.psi));
  const rolledPts = gd.flat.map((s) => torusPoint(s.phi, s.psi));
  const truePts = gd.trueG.map((s) => torusPoint(s.phi, s.psi));

  const rolledMesh = new THREE.Mesh(new THREE.BufferGeometry(), rayMat);
  const trueMesh = new THREE.Mesh(new THREE.BufferGeometry(), rayMat);
  rolledGroup.add(rolledMesh);
  trueGroup.add(trueMesh);

  const mark = () => new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), markerMat);
  const planeMark = mark(); planeMark.position.copy(planePts[0]); app.scene.add(planeMark);
  const rolledMark = mark(); rolledGroup.add(rolledMark);
  const trueMark = mark(); trueGroup.add(trueMark);

  curves.push({ planePts, rolledPts, truePts, rolledMesh, trueMesh, planeMark, rolledMark, trueMark });
}

// --- Reveal animation -------------------------------------------------------

const REVEAL = 6.0;
const HOLD = 1.5;
const CYCLE = REVEAL + HOLD;

function revealTube(mesh: THREE.Mesh, pts: THREE.Vector3[], head: number): void {
  mesh.geometry.dispose();
  if (head >= 1) {
    const c = new THREE.CatmullRomCurve3(pts.slice(0, head + 1));
    mesh.geometry = new THREE.TubeGeometry(c, head, RAY_R, 8, false);
  } else {
    mesh.geometry = new THREE.BufferGeometry();
  }
}

function rebuildPlane(head: number): void {
  for (const child of planeGroup.children) (child as THREE.Mesh).geometry.dispose();
  planeGroup.clear();
  for (const c of curves) {
    let run: THREE.Vector3[] = [c.planePts[0]];
    for (let j = 1; j <= head; j++) {
      const a = c.planePts[j - 1], b = c.planePts[j];
      if (Math.abs(a.x - b.x) > PS / 2 || Math.abs(a.y - b.y) > PS / 2) {
        if (run.length >= 2) planeGroup.add(tube(run, RAY_R, rayMat));
        run = [];
      }
      run.push(c.planePts[j]);
    }
    if (run.length >= 2) planeGroup.add(tube(run, RAY_R, rayMat));
  }
}

app.addAnimateCallback((elapsed) => {
  const phase = elapsed % CYCLE;
  const head = Math.round(Math.min(phase / REVEAL, 1) * M);
  for (const c of curves) {
    revealTube(c.rolledMesh, c.rolledPts, head);
    revealTube(c.trueMesh, c.truePts, head);
    c.planeMark.position.copy(c.planePts[head]);
    c.rolledMark.position.copy(c.rolledPts[head]);
    c.trueMark.position.copy(c.truePts[head]);
  }
  rebuildPlane(head);
});

app.start();
