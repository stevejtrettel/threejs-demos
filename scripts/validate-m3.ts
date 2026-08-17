/**
 * The kinetic-energy metric on M³_L.
 *
 *   node --import ./scripts/reg-alias.mjs scripts/validate-m3.ts
 *
 * Claim: with unit point masses at the two moving joints, the KE metric is
 *
 *     h(t) = (dθ₁/dt)² + (dθ₃/dt)²
 *
 * i.e. exactly the metric M³_L inherits from the FLAT torus of rod angles
 * (θ₁, θ₃). The reason is that each moving joint is pinned at unit distance
 * from a fixed point — p₁ = e^{iθ₁} about the origin, p₂ = L − e^{iθ₃} about
 * (L, 0) — so each joint's speed is just its rod's angular rate. The middle
 * rod angle θ₂ never enters.
 *
 * Consequence: the geodesic flow is traversal of that curve at constant speed
 * in the flat (θ₁, θ₃) plane, and h ṫ² is a first integral.
 */

import { MetricCircle } from '@/math/manifolds';

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '  ok ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
};

// --- ψ³ in rod-angle form, from demos/m3-parametric-torus -------------------
// Preferred over the position form below: it never divides by the amplitude ν,
// so it stays clean through the straightened configurations at cos t = 0.

function psi3Angles(t: number, L: number): [number, number, number] {
  const alpha = Math.acos((L * L - 3) / (2 * L));
  const theta = alpha * Math.sin(t);
  const sigma = Math.cos(t) >= 0 ? 1 : -1;
  const d = Math.sqrt(L * L - 2 * L * Math.cos(theta) + 1);
  const R = Math.atan2(-Math.sin(theta), L - Math.cos(theta));
  const beta = Math.acos(Math.min(1, d / 2));
  return [R + sigma * beta, R - sigma * beta, theta];
}

/** Joint positions implied by the rod angles. */
function joints(t: number, L: number): { p1: [number, number]; p2: [number, number] } {
  const [th1, , th3] = psi3Angles(t, L);
  return {
    p1: [Math.cos(th1), Math.sin(th1)],
    p2: [L - Math.cos(th3), -Math.sin(th3)],
  };
}

/** ψ³ in position form, from demos/m3-parametric-linkage. */
function psi3Position(t: number, L: number): { p1: [number, number]; p2: [number, number] } {
  const alpha = Math.acos((L * L - 3) / (2 * L));
  const theta = alpha * Math.sin(t);
  const c = Math.cos(t);
  const p_re = L - Math.cos(theta);
  const p_im = -Math.sin(theta);
  const p_abs = Math.hypot(p_re, p_im);
  const num = 2 * L * (Math.cos(theta) - (L * L - 3) / (2 * L));
  const nu = Math.abs(c) < 1e-6
    ? Math.sign(c || 1) * Math.sqrt(L * alpha * Math.sin(alpha))
    : c * Math.sqrt(num / (c * c));
  const k = nu / (2 * p_abs);
  return { p1: [p_re / 2 - k * p_im, p_im / 2 + k * p_re], p2: [p_re, p_im] };
}

const Ls = [1.2, 1.7, 2.4, 2.9];
// Deliberately offset off the grid so no sample lands exactly on cos t = 0.
const ts = Array.from({ length: 25 }, (_, i) => -Math.PI + 0.037 + (i * 2 * Math.PI) / 25);

// --- The linkage closes ------------------------------------------------------

{
  let worst = 0;
  for (const L of Ls) {
    for (const t of ts) {
      const { p1, p2 } = joints(t, L);
      worst = Math.max(
        worst,
        Math.abs(Math.hypot(p1[0], p1[1]) - 1),
        Math.abs(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) - 1),
        Math.abs(Math.hypot(L - p2[0], p2[1]) - 1),
      );
    }
  }
  check('all three rods have unit length', worst < 1e-9, `max err ${worst.toExponential(2)}`);
}

// --- The two published forms of ψ³ agree ------------------------------------

{
  let worst = 0;
  for (const L of Ls) {
    for (const t of ts) {
      const a = joints(t, L);
      const b = psi3Position(t, L);
      worst = Math.max(worst, Math.hypot(a.p1[0] - b.p1[0], a.p1[1] - b.p1[1]));
    }
  }
  check('angle form agrees with position form', worst < 1e-9, `max err ${worst.toExponential(2)}`);
}

// The position form's ν fallback returns the limit of √(num/c²) rather than of
// ν = c·√(num/c²), so it is off by the factor c and lands on a nonzero value
// where ν actually vanishes. Only reachable within 1e-6 of cos t = 0.
{
  const L = 1.2;
  const bad = psi3Position(Math.PI / 2, L);
  const good = joints(Math.PI / 2, L);
  const err = Math.hypot(bad.p1[0] - good.p1[0], bad.p1[1] - good.p1[1]);
  check('KNOWN BUG: position form breaks at cos t = 0', err > 0.1,
    `|p₁| = ${Math.hypot(bad.p1[0], bad.p1[1]).toFixed(3)} instead of 1 (off by ${err.toFixed(3)})`);
}

// --- The metric --------------------------------------------------------------

const unwrap = (x: number) => ((x + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;

/** Kinetic energy metric by central differences of the joint positions. */
function metricByPositions(t: number, L: number, e = 1e-6): number {
  const a = joints(t - e, L);
  const b = joints(t + e, L);
  const d1x = (b.p1[0] - a.p1[0]) / (2 * e);
  const d1y = (b.p1[1] - a.p1[1]) / (2 * e);
  const d2x = (b.p2[0] - a.p2[0]) / (2 * e);
  const d2y = (b.p2[1] - a.p2[1]) / (2 * e);
  return d1x * d1x + d1y * d1y + d2x * d2x + d2y * d2y;
}

/** The same thing as the flat metric of the (θ₁, θ₃) torus, by differences. */
function metricByAngles(t: number, L: number, e = 1e-6): number {
  const a = psi3Angles(t - e, L);
  const b = psi3Angles(t + e, L);
  const d1 = unwrap(b[0] - a[0]) / (2 * e);
  const d3 = unwrap(b[2] - a[2]) / (2 * e);
  return d1 * d1 + d3 * d3;
}

/** sin(x)/x, continued to 1 at the origin. */
const sinc = (x: number) => (Math.abs(x) < 1e-8 ? 1 : Math.sin(x) / x);

/**
 * Closed form: h = θ₃′² + θ₁′².
 *
 * The delicate part is w = σθ₃′/ν, which is 0/0 at both straightened
 * configurations cos t = 0. Written naively as α|cos t|/√(2L cos θ − L² + 3)
 * the denominator is an O(1e-12) difference of O(1) terms there and loses all
 * its significant digits. Using 2L(cos θ − cos α) = 4L sin A sin B with
 * A = (α+θ)/2, B = (α−θ)/2, and cos²t = (α² − θ²)/α², everything cancels
 * analytically and leaves
 *
 *     w² = (A / sin A)(B / sin B) / L
 *
 * which is exact, branch-free, and stable at both ends.
 */
function metricClosedForm(t: number, L: number): number {
  const alpha = Math.acos((L * L - 3) / (2 * L));
  const theta = alpha * Math.sin(t);            // θ₃
  const dtheta = alpha * Math.cos(t);           // θ₃′
  const ctheta = Math.cos(theta);
  const stheta = Math.sin(theta);
  const r = Math.sqrt(L * L - 2 * L * ctheta + 1);   // |p₂|

  const A = (alpha + theta) / 2;
  const B = (alpha - theta) / 2;
  const w = Math.sqrt(1 / (L * sinc(A) * sinc(B)));

  const dpsi = ((1 - L * ctheta) / (r * r)) * dtheta;   // ψ′
  const dbeta = -(L * stheta / r) * w;                  // (σβ)′
  const dth1 = dpsi + dbeta;
  return dtheta * dtheta + dth1 * dth1;
}

{
  let worstAngles = 0;
  let worstClosed = 0;
  for (const L of Ls) {
    for (const t of ts) {
      const ref = metricByPositions(t, L);
      worstAngles = Math.max(worstAngles, Math.abs(metricByAngles(t, L) - ref) / ref);
      worstClosed = Math.max(worstClosed, Math.abs(metricClosedForm(t, L) - ref) / ref);
    }
  }
  check('h = θ₁′² + θ₃′² equals ∑|ṗ_k|²', worstAngles < 1e-6, `max rel err ${worstAngles.toExponential(2)}`);
  check('closed form equals ∑|ṗ_k|²', worstClosed < 1e-6, `max rel err ${worstClosed.toExponential(2)}`);
}

// The closed form must also survive the straightened configuration itself.
{
  let worst = 0;
  for (const L of Ls) {
    for (const s of [-1, 1]) {
      const ref = metricByAngles(s * Math.PI / 2, L, 1e-5);
      const got = metricClosedForm(s * Math.PI / 2, L);
      worst = Math.max(worst, Math.abs(got - ref) / ref);
    }
  }
  check('closed form is right at cos t = 0 too', worst < 1e-4, `max rel err ${worst.toExponential(2)}`);
}

// --- h > 0, so the motion never stalls --------------------------------------

{
  let min = Infinity;
  let argmin = [0, 0];
  for (const L of Ls) {
    for (let i = 0; i < 4000; i++) {
      const t = -Math.PI + (i * 2 * Math.PI) / 4000;
      const h = metricClosedForm(t, L);
      if (h < min) { min = h; argmin = [L, t]; }
    }
  }
  check('h > 0 everywhere', min > 1e-6, `min h = ${min.toFixed(4)} at L=${argmin[0]}, t=${argmin[1].toFixed(3)}`);
}

// --- The first integral: h ṫ² is conserved by the geodesic flow -------------
// Stepping ṫ = v/√h must agree with integrating ẗ = −(h′/2h) ṫ².

{
  const L = 1.7;
  const v = 1.0;
  const dtau = 1e-4;
  let tA = 0.3;                       // closed-form flow
  let tB = 0.3, tdotB = v / Math.sqrt(metricClosedForm(0.3, L));  // geodesic ODE

  for (let i = 0; i < 20000; i++) {
    tA += (v / Math.sqrt(metricClosedForm(tA, L))) * dtau;

    const e = 1e-6;
    const h = metricClosedForm(tB, L);
    const hp = (metricClosedForm(tB + e, L) - metricClosedForm(tB - e, L)) / (2 * e);
    const tddot = -(hp / (2 * h)) * tdotB * tdotB;
    tB += tdotB * dtau + 0.5 * tddot * dtau * dtau;
    tdotB += tddot * dtau;
  }
  check('closed-form flow matches the geodesic ODE', Math.abs(tA - tB) < 1e-4,
    `after 2 time units: t = ${tA.toFixed(6)} vs ${tB.toFixed(6)}`);
}

// --- How much the physical speed varies over a lap --------------------------

{
  console.log('\n  one lap of the configuration circle:');
  for (const L of Ls) {
    let lo = Infinity, hi = 0, arc = 0;
    const N = 8000;
    for (let i = 0; i < N; i++) {
      const t = -Math.PI + (i * 2 * Math.PI) / N;
      const s = Math.sqrt(metricClosedForm(t, L));
      lo = Math.min(lo, s); hi = Math.max(hi, s);
      arc += s * (2 * Math.PI / N);
    }
    console.log(`    L=${L}: length ${arc.toFixed(3)}, √h ∈ [${lo.toFixed(3)}, ${hi.toFixed(3)}], speed varies ${(hi / lo).toFixed(1)}×`);
  }
}

// --- MetricCircle ------------------------------------------------------------

{
  const L = 1.5;
  const circle = new MetricCircle({ metric: (t) => metricClosedForm(t, L) });

  // Circumference against a fine trapezoid sum.
  let ref = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) ref += Math.sqrt(metricClosedForm((i + 0.5) * 2 * Math.PI / N, L)) * (2 * Math.PI / N);
  check('circumference matches direct quadrature', Math.abs(circle.circumference - ref) / ref < 1e-9,
    `${circle.circumference.toFixed(9)} vs ${ref.toFixed(9)}`);

  // parameterAt inverts arclengthAt.
  let worst = 0;
  for (let i = 0; i < 500; i++) {
    const t = (i / 500) * 2 * Math.PI;
    const back = circle.parameterAt(circle.arclengthAt(t));
    worst = Math.max(worst, Math.abs(unwrap(back - t)));
  }
  check('parameterAt inverts arclengthAt', worst < 1e-9, `max err ${worst.toExponential(2)}`);

  // Equally spaced points really are equally spaced in arclength.
  {
    const n = 24;
    const ts2 = circle.equallySpaced(n);
    const gaps = ts2.map((t, i) => {
      let g = circle.arclengthAt(ts2[(i + 1) % n]) - circle.arclengthAt(t);
      if (g <= 0) g += circle.circumference;
      return g;
    });
    const want = circle.circumference / n;
    const err = Math.max(...gaps.map((g) => Math.abs(g - want))) / want;
    check('equallySpaced is equally spaced in arclength', err < 1e-9, `max rel err ${err.toExponential(2)}`);
  }

  // The flow conserves speed exactly and closes up after one circumference.
  {
    const v = 1.3;
    const g = circle.geodesic(0.4, v);
    for (let i = 0; i < 5000; i++) g.advance(1e-3);
    const expected = circle.parameterAt(circle.arclengthAt(0.4) + v * 5.0);
    check('geodesic is drift-free over 5000 steps', Math.abs(unwrap(g.t - expected)) < 1e-12,
      `t = ${g.t.toFixed(12)} vs ${expected.toFixed(12)}`);

    const lap = circle.geodesic(0.4, v);
    lap.advance(circle.circumference / v);
    check('one circumference returns to start', Math.abs(unwrap(lap.t - 0.4)) < 1e-9,
      `t = ${lap.t.toFixed(9)}`);

    // The physical content: dt/dτ varies, but the metric speed never does.
    const probe = circle.geodesic(0, v);
    let lo = Infinity, hi = 0, worstSpeed = 0;
    for (let i = 0; i < 4000; i++) {
      probe.advance(2e-3);
      lo = Math.min(lo, Math.abs(probe.parameterRate));
      hi = Math.max(hi, Math.abs(probe.parameterRate));
      worstSpeed = Math.max(worstSpeed, Math.abs(circle.speedOf(probe.t, probe.parameterRate) - v));
    }
    check('metric speed constant while dt/dτ varies', worstSpeed < 1e-12 && hi / lo > 2,
      `|v| error ${worstSpeed.toExponential(2)}, dt/dτ varies ${(hi / lo).toFixed(1)}×`);
  }

  // Christoffel symbol against a Richardson-extrapolated derivative. The class
  // uses a plain central difference at a deliberately loose step, so it is good
  // to a few parts in 10⁵ — not to machine precision, and the tolerance says so.
  {
    let worstChr = 0;
    for (let i = 0; i < 100; i++) {
      const t = (i / 100) * 2 * Math.PI;
      const h = metricClosedForm(t, L);
      const d = (e: number) => (metricClosedForm(t + e, L) - metricClosedForm(t - e, L)) / (2 * e);
      const dh = (4 * d(5e-4) - d(1e-3)) / 3;
      const want = dh / (2 * h);
      worstChr = Math.max(worstChr, Math.abs(circle.computeChristoffel([t])[0] - want) / (1 + Math.abs(want)));
    }
    check('Γ¹₁₁ = h′/2h', worstChr < 1e-4, `max rel err ${worstChr.toExponential(2)}`);
  }
}

console.log(failures ? `\n${failures} FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
