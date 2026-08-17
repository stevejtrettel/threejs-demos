/**
 * The search half of the certified-solving toy: retraction, projected gradient
 * descent, and the Newton endgame.
 *
 *   node --import ./scripts/reg-alias.mjs scripts/validate-certify.ts
 *
 * Claims checked:
 *
 *  1. `ImplicitSurface.retract` is Gauss–Newton onto `{g = 0}`: it lands a
 *     nearby ambient point on the surface to machine precision, quadratically.
 *  2. `projectTangent` really is the tangential projection — orthogonal to ∇g,
 *     and idempotent.
 *  3. The corrector leg is second order in the step size. Halving `h` should
 *     quarter the distance the retraction has to travel, which is exactly why
 *     the zigzag in the demo is invisible until the step size is cranked up.
 *  4. `x³ + y³ + z³ = 1` together with `F = (0,1)` has exactly two real
 *     solutions, both nondegenerate, and Newton converges quadratically to
 *     them.
 *  5. Projected gradient descent from anywhere on the drawn chart reaches one
 *     of those two — no spurious local minima of ‖F − c‖² on the window, which
 *     is what makes the basin picture honest.
 *  6. `chainSegments` threads a marching-squares contour back into curves.
 *
 * The numbers this prints are also where the demo's constants come from: the
 * handoff threshold, and how many steps a descent takes to get there.
 */

import { ImplicitSurface3D, projectedGradientFlow, projectedGradientStep } from '@/math/implicit';
import { newton } from '@/math/rootfind';
import { marchingSquares, chainSegments } from '@/math/geometry';
import {
  surface,
  objective,
  squareSystem,
  residual,
  systemResidual,
  lift,
  height,
  SOLUTIONS,
  CHART,
} from '../demos/_shared/fermatSystem';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '  ok ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
};

const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const norm = (v: ArrayLike<number>) => Math.hypot(...Array.from(v));

// Deterministic sampler, so a failure is always reproducible.
let seed = 20260815;
const rand = () => ((seed = (1103515245 * seed + 12345) % 2147483648) / 2147483648);

// ── 1. Retraction ───────────────────────────────────────────────────────────

console.log('\n1. retraction onto the surface');
{
  /** A point of S over the chart, pushed `delta` off the surface. */
  const perturbed = (delta: number): number[] => {
    const p = lift(CHART.xMin + 4 * rand(), CHART.yMin + 4 * rand());
    const d = [2 * rand() - 1, 2 * rand() - 1, 2 * rand() - 1];
    const len = norm(d) || 1;
    return p.map((c, i) => c + (delta * d[i]) / len);
  };

  let worst = 0;
  for (let i = 0; i < 2000; i++) {
    worst = Math.max(worst, Math.abs(surface.value(surface.retract(perturbed(0.3)))));
  }
  check(
    'points within 0.3 of S land back on {g = 0}',
    worst < 1e-14,
    `worst |g| = ${worst.toExponential(2)}`,
  );

  // The retraction is Newton, so it is only local — and that is a property of
  // the method, not a defect of this implementation. The demo never calls it
  // on anything further off than one predictor leg (capped at 0.12), well
  // inside the radius measured here.
  const misses: string[] = [];
  for (const delta of [0.3, 0.5, 1, 2, 4]) {
    let failed = 0;
    for (let i = 0; i < 400; i++) {
      if (!(Math.abs(surface.value(surface.retract(perturbed(delta)))) < 1e-14)) failed++;
    }
    misses.push(`${delta}: ${((100 * failed) / 400).toFixed(1)}%`);
  }
  console.log(`     failure rate vs distance off the surface — ${misses.join(', ')}`);

  // Quadratic convergence of the corrector, watched one iteration at a time.
  const oneStep = new ImplicitSurface3D({
    value: (x, y, z) => x ** 3 + y ** 3 + z ** 3 - 1,
    gradient: (x, y, z) => [3 * x * x, 3 * y * y, 3 * z * z],
    retractIterations: 1,
    retractTolerance: 0,
  });
  let q = [0.6, 0.9, 0.5];
  const trail: number[] = [Math.abs(surface.value(q))];
  for (let i = 0; i < 4; i++) {
    q = oneStep.retract(q);
    trail.push(Math.abs(surface.value(q)));
  }
  const quadratic = trail[3] < trail[2] ** 1.8 && trail[2] < trail[1] ** 1.8;
  check('|g| squares each iteration', quadratic, trail.map((t) => t.toExponential(1)).join(' → '));
}

// ── 2. Tangential projection ────────────────────────────────────────────────

console.log('\n2. tangential projection');
{
  let worstDot = 0;
  let worstIdem = 0;
  for (let i = 0; i < 2000; i++) {
    const p = surface.retract([4 * rand() - 2, 4 * rand() - 2, 4 * rand() - 2]);
    const v = [4 * rand() - 2, 4 * rand() - 2, 4 * rand() - 2];
    const t = surface.projectTangent(v, p);
    const n = surface.unitNormal(p);
    worstDot = Math.max(worstDot, Math.abs(t[0] * n[0] + t[1] * n[1] + t[2] * n[2]) / (norm(t) || 1));
    const tt = surface.projectTangent(t, p);
    worstIdem = Math.max(worstIdem, norm([tt[0] - t[0], tt[1] - t[1], tt[2] - t[2]]) / (norm(t) || 1));
  }
  check('projected vectors are orthogonal to ∇g', worstDot < 1e-14, `worst |⟨t,n⟩|/|t| = ${worstDot.toExponential(2)}`);
  check('projection is idempotent', worstIdem < 1e-14, `worst drift = ${worstIdem.toExponential(2)}`);
}

// ── 3. The corrector leg is O(h²) ───────────────────────────────────────────

console.log('\n3. predictor–corrector scaling');
{
  const p = surface.retract(lift(-1.1, 1.4));

  // Drive the *geometric* leg length directly: an unbounded stepSize with a
  // cap of L makes the predictor exactly L long, whatever ‖∇φ‖ happens to be
  // there. The quadratic law is about the geometry — how far a straight line
  // of length L departs from a curved surface — so testing it through the
  // gradient magnitude would only measure the polynomial's steepness.
  const legs: { L: number; corrector: number }[] = [];
  for (const L of [0.2, 0.1, 0.05, 0.025]) {
    const step = projectedGradientStep(surface, objective, p, {
      stepSize: Infinity,
      maxStepLength: L,
    });
    const predictor = dist(step.from, step.predicted);
    const corrector = dist(step.predicted, step.to);
    legs.push({ L, corrector });
    console.log(
      `     leg ${L.toFixed(3)}   predictor ${predictor.toExponential(2)}` +
        `   corrector ${corrector.toExponential(2)}` +
        `   corrector/leg² ${(corrector / (L * L)).toFixed(3)}`,
    );
  }
  // Halving the leg should quarter the correction.
  const ratios = legs.slice(1).map((leg, i) => legs[i].corrector / leg.corrector);
  check(
    'the corrector shrinks like (leg length)²',
    ratios.every((r) => r > 3.2 && r < 4.8),
    `ratios ${ratios.map((r) => r.toFixed(2)).join(', ')}`,
  );
}

// ── 4. The solutions ────────────────────────────────────────────────────────

console.log('\n4. the square system G = (g, F₁, F₂ − 1)');
{
  const found: number[][] = [];
  for (let k = 0; k < 20000; k++) {
    const start = [12 * rand() - 6, 12 * rand() - 6, 12 * rand() - 6];
    const result = newton(squareSystem, start, { maxIterations: 60, maxStepLength: 0.5 });
    if (!result.converged) continue;
    if (!found.some((f) => dist(f, result.point) < 1e-6)) found.push(result.point);
  }
  check('exactly two real solutions from multistart Newton', found.length === 2, `found ${found.length}`);

  for (const s of SOLUTIONS) {
    const near = found.find((f) => dist(f, s) < 1e-9);
    check(
      `tabulated solution (${s.map((c) => c.toFixed(4)).join(', ')}) is one of them`,
      near !== undefined,
      `‖G‖ = ${systemResidual(s).toExponential(2)}`,
    );
  }

  // Quadratic convergence from a descent-quality starting point.
  const start = SOLUTIONS[0].map((c) => c + 0.02);
  const run = newton(squareSystem, start);
  console.log(`     residuals: ${run.residuals.map((r) => r.toExponential(1)).join(' → ')}`);
  check('Newton converges from 2e-2 away', run.converged, `${run.iterates.length - 1} steps`);
  const squares = run.residuals
    .slice(1, -1)
    .every((r, i) => r < Math.max(run.residuals[i] ** 1.7, 1e-15));
  check('each residual is below the square of the last', squares);
}

// ── 5. Projected gradient descent over the drawn chart ──────────────────────

console.log('\n5. projected gradient descent on S');
{
  const STEP = { stepSize: 0.05, maxStepLength: 0.12, maxSteps: 3000, tolerance: 1e-10 };
  const HANDOFF = 0.05; // where the demo switches to Newton

  const tally = [0, 0];
  let stuck = 0;
  let worstHandoff = 0;
  const stepsToHandoff: number[] = [];

  const N = 13;
  for (let i = 0; i < N; i++) {
    let row = '';
    for (let j = 0; j < N; j++) {
      const x = CHART.xMin + ((CHART.xMax - CHART.xMin) * i) / (N - 1);
      const y = CHART.yMin + ((CHART.yMax - CHART.yMin) * j) / (N - 1);
      const flow = projectedGradientFlow(surface, objective, lift(x, y), STEP);
      const end = flow.points[flow.points.length - 1];

      const which = SOLUTIONS.findIndex((s) => dist(s, end) < 1e-3);
      if (which >= 0) tally[which]++;
      else stuck++;
      row += which >= 0 ? 'AB'[which] : '?';

      const hit = flow.points.findIndex((p) => residual(p) < HANDOFF);
      if (hit >= 0) {
        stepsToHandoff.push(hit);
        worstHandoff = Math.max(worstHandoff, hit);
      }
    }
    console.log(`     ${row}`);
  }

  check('every start on the chart reaches a solution', stuck === 0, `${tally[0]} → A, ${tally[1]} → B`);
  check('both solutions are found', tally[0] > 0 && tally[1] > 0);

  stepsToHandoff.sort((a, b) => a - b);
  const median = stepsToHandoff[stepsToHandoff.length >> 1];
  console.log(
    `     steps to ‖F − c‖ < ${HANDOFF}: median ${median}, worst ${worstHandoff}` +
      ` (at stepSize ${STEP.stepSize}, cap ${STEP.maxStepLength})`,
  );
  check('the handoff is reached in a watchable number of steps', worstHandoff < 900);
}

// ── 6. Contour chaining ─────────────────────────────────────────────────────

console.log('\n6. chainSegments');
{
  const n = 64;
  const values: number[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -2 + (4 * i) / (n - 1);
      const y = -2 + (4 * j) / (n - 1);
      values.push(x * x + y * y);
    }
  }
  const segments = marchingSquares(
    { nx: n, ny: n, values, xMin: -2, xMax: 2, yMin: -2, yMax: 2 },
    1,
  );
  const chains = chainSegments(segments);
  check('the unit circle chains into one polyline', chains.length === 1, `${segments.length} segments → ${chains.length} chain(s)`);

  const loop = chains[0];
  const closed = Math.hypot(loop[0][0] - loop[loop.length - 1][0], loop[0][1] - loop[loop.length - 1][1]) < 1e-9;
  check('and it closes', closed);
  const onCircle = loop.every((p) => Math.abs(Math.hypot(p[0], p[1]) - 1) < 0.02);
  check('every vertex lies on the circle', onCircle);

  // The contour of F₁ on the surface, as the demo traces it.
  const m = 200;
  const grid: number[] = [];
  for (let j = 0; j < m; j++) {
    for (let i = 0; i < m; i++) {
      const x = CHART.xMin + ((CHART.xMax - CHART.xMin) * i) / (m - 1);
      const y = CHART.yMin + ((CHART.yMax - CHART.yMin) * j) / (m - 1);
      const z = height(x, y);
      grid.push(x ** 3 - y * y + z);
    }
  }
  const f1 = chainSegments(
    marchingSquares({ nx: m, ny: m, values: grid, ...CHART }, 0),
  );
  console.log(`     {F₁ = 0} on the chart: ${f1.length} curve(s), ${f1.reduce((s, c) => s + c.length, 0)} vertices`);
  check('{F₁ = 0} traces as a small number of curves', f1.length > 0 && f1.length <= 4);
}

console.log(failures === 0 ? '\nall checks passed\n' : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
