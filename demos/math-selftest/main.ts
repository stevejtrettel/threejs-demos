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
import type {
  MetricPatch,
  FirstFundamentalForm,
  ChristoffelSymbols,
  SurfaceDomain,
} from '@/math/surfaces/types';

// --- Reference implementations -------------------------------------------

/**
 * Tensor-loop reference for Christoffel symbols. Direct transcription of
 *   Γ^k_ij = ½ g^kl (∂_i g_jl + ∂_j g_il − ∂_l g_ij)
 * Uses central differences on `patch.computeMetric`. Read the math off the code.
 */
function christoffelTensorLoop(
  patch: MetricPatch,
  u: number,
  v: number,
  h: number = 1e-4,
): ChristoffelSymbols {
  // g at center
  const g0 = patch.computeMetric(u, v);
  const G = [[g0.E, g0.F], [g0.F, g0.G]];

  // Inverse
  const det = G[0][0] * G[1][1] - G[0][1] * G[1][0];
  const Ginv = [
    [ G[1][1] / det, -G[0][1] / det],
    [-G[1][0] / det,  G[0][0] / det],
  ];

  // dG[a][i][j] = ∂_a g_ij, computed by central differences along axis a
  const dG: number[][][] = [[[0, 0], [0, 0]], [[0, 0], [0, 0]]];
  const samplePlus = [patch.computeMetric(u + h, v), patch.computeMetric(u, v + h)];
  const sampleMinus = [patch.computeMetric(u - h, v), patch.computeMetric(u, v - h)];
  for (let a = 0; a < 2; a++) {
    const gp = samplePlus[a];
    const gm = sampleMinus[a];
    const inv2h = 1 / (2 * h);
    dG[a][0][0] = (gp.E - gm.E) * inv2h;
    dG[a][0][1] = (gp.F - gm.F) * inv2h;
    dG[a][1][0] = dG[a][0][1];
    dG[a][1][1] = (gp.G - gm.G) * inv2h;
  }

  const Gamma: number[][][] = [[[0, 0], [0, 0]], [[0, 0], [0, 0]]];
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        let s = 0;
        for (let l = 0; l < 2; l++) {
          s += Ginv[k][l] * (dG[i][j][l] + dG[j][i][l] - dG[l][i][j]);
        }
        Gamma[k][i][j] = 0.5 * s;
      }
    }
  }

  return {
    gamma_1_11: Gamma[0][0][0],
    gamma_1_12: Gamma[0][0][1],
    gamma_1_22: Gamma[0][1][1],
    gamma_2_11: Gamma[1][0][0],
    gamma_2_12: Gamma[1][0][1],
    gamma_2_22: Gamma[1][1][1],
  };
}

// --- Test metrics ---------------------------------------------------------

const DOMAIN: SurfaceDomain = { uMin: -10, uMax: 10, vMin: -10, vMax: 10 };

function patchFromMetric(
  metric: (u: number, v: number) => FirstFundamentalForm,
  domain: SurfaceDomain = DOMAIN,
): MetricSurface {
  return new MetricSurface({ domain, metric });
}

// Flat plane: g = du² + dv². All Christoffels zero, K = 0.
const flatPlane = patchFromMetric(() => ({ E: 1, F: 0, G: 1 }));

// Unit 2-sphere chart (θ, φ): g = dθ² + sin²θ dφ². F = 0, K = 1.
const unitSphere = patchFromMetric((theta, _phi) => ({
  E: 1,
  F: 0,
  G: Math.sin(theta) ** 2,
}), { uMin: 0.1, uMax: Math.PI - 0.1, vMin: 0, vMax: 2 * Math.PI });

// Saddle z = u² − v²: induced metric in R³. F ≠ 0 in general.
const saddle = patchFromMetric((u, v) => ({
  E: 1 + 4 * u * u,
  F: -4 * u * v,
  G: 1 + 4 * v * v,
}));

// Hyperbolic upper half-plane (Poincaré): g = (du² + dv²)/v². K = -1 everywhere.
// Restrict domain to v > 0 region comfortably.
const hyperbolic = patchFromMetric((_u: number, v: number) => {
  const inv = 1 / (v * v);
  return { E: inv, F: 0, G: inv };
}, { uMin: -10, uMax: 10, vMin: 0.5, vMax: 5 });

// Torus of revolution in R³: (u, v) → ((R + r cos v) cos u, (R + r cos v) sin u, r sin v).
// E = (R + r cos v)², F = 0, G = r². K = cos(v) / (r·(R + r cos v)).
const R = 2, r = 1;
const torus = patchFromMetric((_u: number, v: number) => {
  const b = R + r * Math.cos(v);
  return { E: b * b, F: 0, G: r * r };
}, { uMin: 0, uMax: 2 * Math.PI, vMin: 0, vMax: 2 * Math.PI });

// --- Test harness ---------------------------------------------------------

type Result = { name: string; pass: boolean; detail?: string };
const results: Result[] = [];

function approxEqual(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

function christoffelClose(
  a: ChristoffelSymbols,
  b: ChristoffelSymbols,
  tol: number,
): { ok: boolean; worst: number } {
  const keys: (keyof ChristoffelSymbols)[] = [
    'gamma_1_11', 'gamma_1_12', 'gamma_1_22',
    'gamma_2_11', 'gamma_2_12', 'gamma_2_22',
  ];
  let worst = 0;
  for (const k of keys) {
    const diff = Math.abs(a[k] - b[k]);
    if (diff > worst) worst = diff;
  }
  return { ok: worst <= tol, worst };
}

function record(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
}

// --- Suite 1: Christoffel vs tensor-loop -----------------------------------

const christoffelTol = 1e-6;

function testChristoffel(name: string, patch: MetricPatch, samples: [number, number][]) {
  for (const [u, v] of samples) {
    const a = christoffelFromMetric(patch, u, v);
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
  patch: MetricPatch,
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
  patch: MetricPatch,
  start: [number, number],
  initialVelocity: [number, number],
  steps: number,
  tol: number,
) {
  // Normalize to unit speed in the metric
  const g0 = patch.computeMetric(start[0], start[1]);
  const v2_start =
    g0.E * initialVelocity[0] * initialVelocity[0] +
    2 * g0.F * initialVelocity[0] * initialVelocity[1] +
    g0.G * initialVelocity[1] * initialVelocity[1];
  const s = 1 / Math.sqrt(v2_start);
  const vel: [number, number] = [initialVelocity[0] * s, initialVelocity[1] * s];

  const integrator = new GeodesicIntegrator(patch, { stepSize: 0.01 });
  let state = { position: start, velocity: vel };

  let worstDrift = 0;
  for (let i = 0; i < steps; i++) {
    state = integrator.integrate(state);
    const g = patch.computeMetric(state.position[0], state.position[1]);
    const v2 =
      g.E * state.velocity[0] * state.velocity[0] +
      2 * g.F * state.velocity[0] * state.velocity[1] +
      g.G * state.velocity[1] * state.velocity[1];
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
