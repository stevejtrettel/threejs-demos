/**
 * The certification half of the toy: interval enclosures and the Krawczyk test.
 *
 *   node --import ./scripts/reg-alias.mjs scripts/validate-krawczyk.ts
 *
 * The claims that matter, in order of how much the picture depends on them:
 *
 *  1. **The enclosure property.** For every point sampled inside a box, the
 *     true `G` and `DG` land inside the interval evaluation over that box. This
 *     is the one thing that makes the boxes on screen a *proof* rather than a
 *     decoration — everything else is bookkeeping on top of it.
 *  2. `isqr` beats `imul(a, a)`, which is why it exists.
 *  3. A certified box really does contain the true root — the claim the test
 *     makes, checked against roots found independently by Newton.
 *  4. The certified radii form a band with two edges that mean different
 *     things: the upper one belongs to the system, the lower one to the centre,
 *     and polishing the centre walks the lower edge down while leaving the
 *     upper one alone.
 *  5. The test is sound where it is silent: it never certifies a box around a
 *     point with no root nearby.
 *
 * The printed numbers are where the demo's slider ranges come from.
 *
 * Rounding: these routines use ordinary float arithmetic rather than outward
 * rounding, so the enclosures can be off in the last bit or so. The sampling
 * test below allows exactly that much slack and no more.
 */

import { krawczyk, certifiedRadiusWindow, certifiesPoint } from '@/math/certify';
import { box as makeBox, imul, isqr, imag, type Interval } from '@/math/interval';
import { newton } from '@/math/rootfind';
import { intervalSystem, squareSystem, SOLUTIONS } from '../demos/_shared/fermatSystem';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '  ok ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
};

let seed = 20260816;
const rand = () => ((seed = (1103515245 * seed + 12345) % 2147483648) / 2147483648);

// ── 1. The enclosure property ───────────────────────────────────────────────

console.log('\n1. interval evaluation encloses the function over the box');
{
  // Slack for the last-bit error of non-outward-rounded arithmetic, scaled to
  // the size of the numbers involved.
  const SLACK = 1e-12;

  let worstValue = 0;
  let worstJacobian = 0;
  let escapes = 0;
  let samples = 0;

  for (let trial = 0; trial < 4000; trial++) {
    const center = [3 * rand() - 1.5, 3 * rand() - 1.5, 3 * rand() - 1.5];
    const radius = 10 ** (-6 + 6 * rand()); // radii from 1e-6 up to 1
    const X = makeBox(center, radius);

    const V = intervalSystem.intervalValue(X);
    const J = intervalSystem.intervalJacobian(X);

    for (let s = 0; s < 6; s++) {
      const p = center.map((c) => c + radius * (2 * rand() - 1));
      samples++;

      const v = intervalSystem.value(p);
      for (let i = 0; i < 3; i++) {
        const tol = SLACK * Math.max(1, imag(V[i]));
        const over = Math.max(V[i][0] - v[i], v[i] - V[i][1]);
        if (over > tol) escapes++;
        worstValue = Math.max(worstValue, over / Math.max(1, imag(V[i])));
      }

      const j = intervalSystem.jacobian(p);
      for (let i = 0; i < 3; i++) {
        for (let k = 0; k < 3; k++) {
          const entry = J[i][k];
          const value = j.get(i, k);
          const tol = SLACK * Math.max(1, imag(entry));
          const over = Math.max(entry[0] - value, value - entry[1]);
          if (over > tol) escapes++;
          worstJacobian = Math.max(worstJacobian, over / Math.max(1, imag(entry)));
        }
      }
    }
  }

  check(
    `no sampled point escaped its enclosure (${samples} samples)`,
    escapes === 0,
    `${escapes} escapes`,
  );
  console.log(
    `     deepest interior margin — value ${(-worstValue).toExponential(1)},` +
      ` jacobian ${(-worstJacobian).toExponential(1)} (negative = strictly inside)`,
  );
}

// ── 2. isqr is tighter than imul(a, a) ──────────────────────────────────────

console.log('\n2. squaring knows its factors are equal');
{
  const a: Interval = [-1, 2];
  const viaMul = imul(a, a);
  const viaSqr = isqr(a);
  console.log(`     x² over [-1, 2]:  imul → [${viaMul[0]}, ${viaMul[1]}]   isqr → [${viaSqr[0]}, ${viaSqr[1]}]`);
  check('isqr excludes the impossible negatives', viaSqr[0] === 0 && viaMul[0] < 0);

  // Both must still be enclosures.
  let ok = true;
  for (let i = 0; i <= 200; i++) {
    const x = -1 + (3 * i) / 200;
    if (x * x < viaSqr[0] || x * x > viaSqr[1]) ok = false;
  }
  check('and is still an enclosure', ok);
}

// ── 3. A certified box contains the root ────────────────────────────────────

console.log('\n3. certified boxes contain the true root');
{
  for (const root of SOLUTIONS) {
    const polished = newton(squareSystem, root).point;
    let checked = 0;
    let contained = 0;
    for (let e = -14; e <= -1; e++) {
      const result = krawczyk(intervalSystem, polished, 10 ** e);
      if (!result.certified) continue;
      checked++;
      if (certifiesPoint(result, polished)) contained++;
    }
    check(
      `root (${root.map((c) => c.toFixed(3)).join(', ')}): every certified box holds it`,
      checked > 0 && checked === contained,
      `${contained}/${checked} boxes`,
    );
  }

  // A box certified about an off-centre point must contain the root too — the
  // interesting case, since the centre is not the root.
  const off = SOLUTIONS[0].map((c, i) => c + [1.2e-3, -0.8e-3, 0.5e-3][i]);
  const result = krawczyk(intervalSystem, off, 0.02);
  check(
    'a box about an off-centre point still contains the root',
    result.certified && certifiesPoint(result, newton(squareSystem, SOLUTIONS[0]).point),
    `verdict ${result.verdict}`,
  );
}

// ── 4. The window, and what moves each edge ─────────────────────────────────

console.log('\n4. the certified radius window');
{
  const polished = newton(squareSystem, SOLUTIONS[0]).point;
  const window = certifiedRadiusWindow(intervalSystem, polished);
  console.log(
    `     polished centre: r ∈ [${window.min!.toExponential(2)}, ${window.max!.toExponential(2)}]`,
  );
  check('a polished centre certifies over many decades', window.min! < 1e-12 && window.max! > 1e-2);

  // Walk the centre away from the root and watch the lower edge climb while the
  // upper edge stays put.
  console.log('     centre residual → window:');
  const edges: { residual: number; min: number; max: number }[] = [];
  for (const offset of [0, 1e-6, 1e-4, 1e-2]) {
    const center = polished.map((c) => c + offset);
    const w = certifiedRadiusWindow(intervalSystem, center);
    if (w.min === null) {
      console.log(`       offset ${offset.toExponential(0)}: nothing certifies`);
      continue;
    }
    const residual = imag([0, Math.max(...Array.from(squareSystem.value(center)).map(Math.abs))]);
    edges.push({ residual, min: w.min, max: w.max! });
    console.log(
      `       ‖G‖ ${residual.toExponential(1)} → [${w.min.toExponential(2)}, ${w.max!.toExponential(2)}]`,
    );
  }
  check(
    'a worse centre raises the lower edge',
    edges.every((e, i) => i === 0 || e.min > edges[i - 1].min),
  );
  check(
    'and leaves the upper edge alone',
    edges.every((e) => Math.abs(Math.log10(e.max / edges[0].max)) < 0.5),
  );

  // The two failure modes are distinguished correctly.
  const tooBig = krawczyk(intervalSystem, polished, 10 * window.max!);
  const tooSmall = krawczyk(intervalSystem, SOLUTIONS[0].map((c) => c + 0.01), 1e-8);
  check('a too-large box fails for lack of contraction', tooBig.verdict === 'no-contraction',
    `contraction ${tooBig.contraction.toExponential(2)}`);
  check('a too-small box fails because the centre is off', tooSmall.verdict === 'center-off',
    `contraction ${tooSmall.contraction.toExponential(2)}`);
}

// ── 5. Soundness where there is nothing to find ─────────────────────────────

console.log('\n5. nothing is certified where no root is');
{
  let falsePositives = 0;
  let tested = 0;
  for (let trial = 0; trial < 3000; trial++) {
    const center = [4 * rand() - 2, 4 * rand() - 2, 4 * rand() - 2];
    // Only look at points far from both roots.
    if (SOLUTIONS.some((s) => Math.hypot(s[0] - center[0], s[1] - center[1], s[2] - center[2]) < 0.3)) {
      continue;
    }
    for (const r of [1e-8, 1e-4, 1e-2]) {
      const result = krawczyk(intervalSystem, center, r);
      tested++;
      if (!result.certified) continue;
      // If it certified, a root must genuinely be in there — check by Newton.
      const found = newton(squareSystem, center, { maxIterations: 80 });
      if (!found.converged || !certifiesPoint(result, found.point)) falsePositives++;
    }
  }
  check(`no box certified without a root in it (${tested} boxes)`, falsePositives === 0,
    `${falsePositives} false positives`);
}

console.log(failures === 0 ? '\nall checks passed\n' : `\n${failures} FAILED\n`);
process.exit(failures === 0 ? 0 : 1);
