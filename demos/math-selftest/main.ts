/**
 * Math self-test — intrinsic-geometry helpers
 *
 * Runs in the browser. Open this demo (point index.html at it) and all checks
 * should be green. Use after any change to `src/math/surfaces/christoffel.ts`
 * or other intrinsic math, and as a first pass when debugging weird geodesic
 * behavior.
 *
 * Three suites:
 *   1. Christoffel — compares the shipped expanded formula against an
 *      uncontroversial tensor-loop reference on four metrics, F=0 and F≠0,
 *      at multiple sample points.
 *   2. Gaussian curvature — Brioschi output vs closed-form K on known-K
 *      surfaces (flat, unit sphere, hyperbolic half-plane, torus).
 *   3. Energy conservation — geodesic on a non-orthogonal metric preserves
 *      |v|²_g to tolerance over many RK4 steps.
 *
 * NOT a real test framework — just a one-page verification.
 */

import {
  christoffelFromMetric,
  gaussianCurvatureFromMetric,
  MetricSurface,
  GeodesicIntegrator,
} from '@/math';
import type { Manifold } from '@/math/manifolds';
import type { SurfaceDomain } from '@/math/surfaces/types';
import { Matrix } from '@/math/linear-algebra';

// --- Reference implementations -------------------------------------------

/**
 * Tensor-loop reference for Christoffel symbols. Direct transcription of
 *   Γ^k_ij = ½ g^kl (∂_i g_jl + ∂_j g_il − ∂_l g_ij)
 * Uses central differences on `patch.computeMetric`. Read the math off the code.
 * Returns a flat Float64Array (length 8): `Γ[k*4 + i*2 + j]`.
 */
function christoffelTensorLoop(
  patch: Manifold,
  u: number,
  v: number,
  h: number = 1e-4,
): Float64Array {
  // g at center, extracted as a nested matrix for index-notation readability.
  const g0 = patch.computeMetric([u, v]).data;
  const G = [[g0[0], g0[1]], [g0[2], g0[3]]];

  const det = G[0][0] * G[1][1] - G[0][1] * G[1][0];
  const Ginv = [
    [ G[1][1] / det, -G[0][1] / det],
    [-G[1][0] / det,  G[0][0] / det],
  ];

  // dG[a][i][j] = ∂_a g_ij
  const dG: number[][][] = [[[0, 0], [0, 0]], [[0, 0], [0, 0]]];
  const samplePlus = [patch.computeMetric([u + h, v]).data, patch.computeMetric([u, v + h]).data];
  const sampleMinus = [patch.computeMetric([u - h, v]).data, patch.computeMetric([u, v - h]).data];
  for (let a = 0; a < 2; a++) {
    const gp = samplePlus[a];
    const gm = sampleMinus[a];
    const inv2h = 1 / (2 * h);
    dG[a][0][0] = (gp[0] - gm[0]) * inv2h;
    dG[a][0][1] = (gp[1] - gm[1]) * inv2h;
    dG[a][1][0] = dG[a][0][1];
    dG[a][1][1] = (gp[3] - gm[3]) * inv2h;
  }

  const out = new Float64Array(8);
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        let s = 0;
        for (let l = 0; l < 2; l++) {
          s += Ginv[k][l] * (dG[i][j][l] + dG[j][i][l] - dG[l][i][j]);
        }
        out[k * 4 + i * 2 + j] = 0.5 * s;
      }
    }
  }

  return out;
}

// --- Test metrics ---------------------------------------------------------

const DOMAIN: SurfaceDomain = { uMin: -10, uMax: 10, vMin: -10, vMax: 10 };

/** Pack `(E, F, G)` into a 2×2 `Matrix`. */
function mat2(E: number, F: number, G: number): Matrix {
  const m = new Matrix(2, 2);
  m.data[0] = E; m.data[1] = F;
  m.data[2] = F; m.data[3] = G;
  return m;
}

function patchFromMetric(
  metric: (u: number, v: number) => Matrix,
  domain: SurfaceDomain = DOMAIN,
): MetricSurface {
  return new MetricSurface({ domain, metric });
}

// Flat plane: g = du² + dv². All Christoffels zero, K = 0.
const flatPlane = patchFromMetric(() => mat2(1, 0, 1));

// Unit 2-sphere chart (θ, φ): g = dθ² + sin²θ dφ². F = 0, K = 1.
const unitSphere = patchFromMetric(
  (theta, _phi) => mat2(1, 0, Math.sin(theta) ** 2),
  { uMin: 0.1, uMax: Math.PI - 0.1, vMin: 0, vMax: 2 * Math.PI },
);

// Saddle z = u² − v²: induced metric in R³. F ≠ 0 in general.
const saddle = patchFromMetric((u, v) => mat2(1 + 4 * u * u, -4 * u * v, 1 + 4 * v * v));

// Hyperbolic upper half-plane (Poincaré): g = (du² + dv²)/v². K = -1.
const hyperbolic = patchFromMetric(
  (_u: number, v: number) => {
    const inv = 1 / (v * v);
    return mat2(inv, 0, inv);
  },
  { uMin: -10, uMax: 10, vMin: 0.5, vMax: 5 },
);

// Torus of revolution in R³. E = (R + r cos v)², F = 0, G = r².
const R = 2, r = 1;
const torus = patchFromMetric(
  (_u: number, v: number) => {
    const b = R + r * Math.cos(v);
    return mat2(b * b, 0, r * r);
  },
  { uMin: 0, uMax: 2 * Math.PI, vMin: 0, vMax: 2 * Math.PI },
);

// --- Test harness ---------------------------------------------------------

type Result = { name: string; pass: boolean; detail?: string };
const results: Result[] = [];

function approxEqual(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

function christoffelClose(
  a: Float64Array,
  b: Float64Array,
  tol: number,
): { ok: boolean; worst: number } {
  // Compare the 6 distinct entries (symmetric in i, j): [k=0, (i,j) ∈ {00, 01, 11}],
  // [k=1, (i,j) ∈ {00, 01, 11}]. Indices into flat Γ[k*4 + i*2 + j]:
  const indices = [0, 1, 3, 4, 5, 7];
  let worst = 0;
  for (const idx of indices) {
    const diff = Math.abs(a[idx] - b[idx]);
    if (diff > worst) worst = diff;
  }
  return { ok: worst <= tol, worst };
}

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
}

// --- Suite 1: Christoffel vs tensor-loop -----------------------------------

const christoffelTol = 1e-6;

function testChristoffel(name: string, patch: Manifold, samples: [number, number][]) {
  for (const [u, v] of samples) {
    const a = christoffelFromMetric((p) => patch.computeMetric(p), [u, v]);
    const b = christoffelTensorLoop(patch, u, v);
    const { ok, worst } = christoffelClose(a, b, christoffelTol);
    record(
      `Christoffel: ${name} at (${u.toFixed(3)}, ${v.toFixed(3)})`,
      ok,
      ok ? `max diff ${worst.toExponential(2)}` : `FAIL max diff ${worst.toExponential(2)}`,
    );
  }
}

testChristoffel('flat plane', flatPlane, [[0, 0], [1, -2], [3, 4]]);
testChristoffel('unit sphere', unitSphere, [[1.0, 0.5], [0.5, 2.0], [2.5, 3.0]]);
testChristoffel('saddle z = u²−v²', saddle, [[1, 1], [0.5, -1.5], [-2, 3]]);
testChristoffel('hyperbolic half-plane', hyperbolic, [[0, 1], [2, 2], [-1, 3]]);
testChristoffel('torus', torus, [[1, 0.5], [0.3, 2.1], [4, 5]]);

// --- Suite 2: Gaussian curvature vs ground truth --------------------------

const curvatureTol = 1e-4;

function testCurvature(
  name: string,
  patch: Manifold,
  samples: [number, number][],
  expected: (u: number, v: number) => number,
) {
  for (const [u, v] of samples) {
    const got = gaussianCurvatureFromMetric(patch, u, v);
    const want = expected(u, v);
    const ok = approxEqual(got, want, curvatureTol);
    record(
      `Curvature: ${name} at (${u.toFixed(3)}, ${v.toFixed(3)})`,
      ok,
      ok ? `got ${got.toFixed(6)}, want ${want.toFixed(6)}` : `FAIL got ${got.toFixed(6)}, want ${want.toFixed(6)}`,
    );
  }
}

testCurvature('flat plane K=0', flatPlane, [[0, 0], [1, -2]], () => 0);
testCurvature('unit sphere K=1', unitSphere, [[1.0, 0.5], [1.5, 2.0]], () => 1);
testCurvature('hyperbolic K=-1', hyperbolic, [[0, 1], [2, 2], [-1, 3]], () => -1);
testCurvature('torus K=cos v / (r·(R+r cos v))', torus, [[1, 0.5], [0.3, 2.1]],
  (_u, v) => Math.cos(v) / (r * (R + r * Math.cos(v))));

// --- Suite 3: Geodesic energy conservation --------------------------------

/**
 * Integrate a geodesic for N steps on a patch and check that |v|²_g stays
 * constant. This is the integration-level symptom of any Christoffel bug:
 * with the bugged Γ¹₂₂, speed would drift visibly within a few hundred steps
 * on any F≠0 metric.
 */
function testEnergyConservation(
  name: string,
  patch: Manifold,
  start: [number, number],
  initialVelocity: [number, number],
  steps: number,
  tol: number,
) {
  // Normalize to unit speed in the metric.
  const g0 = patch.computeMetric([start[0], start[1]]).data;
  const E0 = g0[0], F0 = g0[1], G0 = g0[3];
  const v2_start =
    E0 * initialVelocity[0] * initialVelocity[0] +
    2 * F0 * initialVelocity[0] * initialVelocity[1] +
    G0 * initialVelocity[1] * initialVelocity[1];
  const s = 1 / Math.sqrt(v2_start);
  const vel: [number, number] = [initialVelocity[0] * s, initialVelocity[1] * s];

  const integrator = new GeodesicIntegrator(patch, { stepSize: 0.01 });
  let state = { position: start, velocity: vel };

  let worstDrift = 0;
  for (let i = 0; i < steps; i++) {
    state = integrator.integrate(state);
    const g = patch.computeMetric([state.position[0], state.position[1]]).data;
    const E = g[0], F = g[1], G = g[3];
    const v2 =
      E * state.velocity[0] * state.velocity[0] +
      2 * F * state.velocity[0] * state.velocity[1] +
      G * state.velocity[1] * state.velocity[1];
    const drift = Math.abs(v2 - 1);
    if (drift > worstDrift) worstDrift = drift;
  }

  const ok = worstDrift <= tol;
  record(
    `Energy conservation: ${name} over ${steps} steps`,
    ok,
    ok ? `worst |v|² drift ${worstDrift.toExponential(2)}` : `FAIL worst drift ${worstDrift.toExponential(2)}`,
  );
}

// Saddle (F ≠ 0) — the case that exposes Christoffel bugs
testEnergyConservation('saddle z=u²−v²', saddle, [0.5, 0.3], [1, 0.5], 2000, 1e-3);
// Torus (F = 0) — baseline
testEnergyConservation('torus', torus, [1.0, 0.5], [0.7, 1.0], 2000, 1e-4);
// Sphere (F = 0, curved) — baseline
testEnergyConservation('unit sphere', unitSphere, [1.2, 0.4], [0.3, 1.0], 2000, 1e-4);
// Hyperbolic (F = 0, negative curvature) — baseline
testEnergyConservation('hyperbolic', hyperbolic, [0, 2], [1, 0.5], 2000, 1e-3);

// --- Report ---------------------------------------------------------------

const total = results.length;
const passed = results.filter((r) => r.pass).length;
const failed = total - passed;

console.log(`\n=== Math self-test: ${passed}/${total} passed ===\n`);
for (const r of results) {
  const icon = r.pass ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
}

// DOM output
const root = document.createElement('div');
root.style.cssText =
  'font:14px/1.5 monospace;padding:24px;background:#111;color:#ddd;min-height:100vh;';
document.body.appendChild(root);

const header = document.createElement('h1');
header.textContent = `Math self-test: ${passed}/${total} passed`;
header.style.cssText = `font:600 18px/1.3 monospace;margin:0 0 16px 0;color:${failed === 0 ? '#6f6' : '#f66'};`;
root.appendChild(header);

for (const r of results) {
  const row = document.createElement('div');
  row.style.cssText = `color:${r.pass ? '#8c8' : '#f88'};padding:2px 0;`;
  row.textContent = `[${r.pass ? 'PASS' : 'FAIL'}] ${r.name}${r.detail ? ' — ' + r.detail : ''}`;
  root.appendChild(row);
}
