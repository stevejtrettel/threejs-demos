/**
 * The ν amplitude in ψ³/ψ⁴ and the metric that divides by it.
 *
 *   node --import ./scripts/reg-alias.mjs scripts/validate-m4-nu.ts
 *
 * ν is the signed height of the isoceles pair spanning a chord, and appears as
 *
 *     ν = c · √(num / c²),        num = 2d(cos θ − cos α),  c = cos t
 *
 * which is 0/0 at cos t = 0, where the inner pair straightens. Two things go
 * wrong there:
 *
 *   1. The guarded branch returns the limit of √(num/c²) rather than of ν, so
 *      it is short a factor of c and lands on a nonzero value where ν vanishes.
 *   2. `num` is an O(1e-12) difference of O(1) terms near that configuration,
 *      so even the unguarded expression loses its significant digits first.
 *
 * Both are fixed at once by the identity 2d(cos θ − cos α) = 4d sin A sin B,
 * A = (α+θ)/2, B = (α−θ)/2, which gives ν = 2 sign(c) √(d sin A sin B) —
 * branch-free, cancellation-free, and exactly zero where it should be.
 */

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '  ok ' : 'FAIL'} ${name}${detail ? '  — ' + detail : ''}`);
};

/** The shipped amplitude, as written in every m3/m4 demo. */
function nuOld(d: number, alpha: number, theta: number, c: number): number {
  const num = 2 * d * (Math.cos(theta) - Math.cos(alpha));
  return Math.abs(c) < 1e-6
    ? Math.sign(c || 1) * Math.sqrt(d * alpha * Math.sin(alpha))
    : c * Math.sqrt(num / (c * c));
}

/** The proposed replacement. */
function nuNew(d: number, alpha: number, theta: number, c: number): number {
  const A = (alpha + theta) / 2;
  const B = (alpha - theta) / 2;
  const s = 2 * Math.sqrt(d * Math.sin(A) * Math.sin(B));
  return c < 0 ? -s : s;
}

// --- ψ⁴, with the amplitude swappable ---------------------------------------

type NuFn = (d: number, alpha: number, theta: number, c: number) => number;

function psi4Position(phi: number, t: number, L: number, nu: NuFn) {
  const alpha = Math.acos((L * L - 8) / (2 * L));
  const theta = alpha * Math.sin(phi);

  const p3_re = L - Math.cos(theta);
  const p3_im = -Math.sin(theta);
  const d = Math.hypot(p3_re, p3_im);
  const p3_hat_re = p3_re / d;
  const p3_hat_im = p3_im / d;

  const c = Math.cos(t);
  const alpha_in = Math.acos((d * d - 3) / (2 * d));
  const theta_in = alpha_in * Math.sin(t);
  const nu_in = nu(d, alpha_in, theta_in, c);

  const e_re = Math.cos(theta_in);
  const e_im = Math.sin(theta_in);
  const rot_re = p3_hat_re * e_re - p3_hat_im * e_im;
  const rot_im = p3_hat_re * e_im + p3_hat_im * e_re;
  const p2_re = p3_re - rot_re;
  const p2_im = p3_im - rot_im;
  const p2_abs = Math.hypot(p2_re, p2_im);

  const k = nu_in / (2 * p2_abs);
  return {
    p1: [p2_re / 2 - k * p2_im, p2_im / 2 + k * p2_re] as [number, number],
    p2: [p2_re, p2_im] as [number, number],
    p3: [p3_re, p3_im] as [number, number],
  };
}

/** Every rod of the 4-bar must stay unit length. */
function closureError(phi: number, t: number, L: number, nu: NuFn): number {
  const { p1, p2, p3 } = psi4Position(phi, t, L, nu);
  return Math.max(
    Math.abs(Math.hypot(p1[0], p1[1]) - 1),
    Math.abs(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) - 1),
    Math.abs(Math.hypot(p3[0] - p2[0], p3[1] - p2[1]) - 1),
    Math.abs(Math.hypot(L - p3[0], p3[1]) - 1),
  );
}

const L = 3.0;
const phis = [-1.2, -0.4, 0, 0.5, 1.1];

// --- Away from the straightened configuration the two agree -----------------

{
  let worst = 0;
  for (const phi of phis) {
    for (let i = 0; i < 40; i++) {
      const t = -Math.PI + 0.031 + (i * 2 * Math.PI) / 40;
      const a = psi4Position(phi, t, L, nuOld);
      const b = psi4Position(phi, t, L, nuNew);
      worst = Math.max(worst, Math.hypot(a.p1[0] - b.p1[0], a.p1[1] - b.p1[1]));
    }
  }
  check('old and new agree away from cos t = 0', worst < 1e-9, `max err ${worst.toExponential(2)}`);
}

// --- At and near it, only the new one keeps the linkage together ------------

{
  let worstOld = 0;
  let worstNew = 0;
  for (const phi of phis) {
    for (const t of [Math.PI / 2, -Math.PI / 2, Math.PI / 2 + 1e-9, Math.PI / 2 - 5e-7]) {
      worstOld = Math.max(worstOld, closureError(phi, t, L, nuOld));
      worstNew = Math.max(worstNew, closureError(phi, t, L, nuNew));
    }
  }
  check('shipped ν breaks the linkage at cos t = 0', worstOld > 0.1, `max rod-length error ${worstOld.toFixed(4)}`);
  check('new ν keeps the linkage closed there', worstNew < 1e-9, `max rod-length error ${worstNew.toExponential(2)}`);
}

// --- The cancellation, separately from the branch ---------------------------
// Just outside the guard the branch does not fire, but `num` has already lost
// most of its digits, so the shipped form is inaccurate before it is wrong.

{
  const d = 2.5;
  const alpha = Math.acos((d * d - 3) / (2 * d));
  console.log('\n  relative error in ν approaching the straightened pair:');
  for (const eps of [1e-2, 1e-3, 1e-4, 1e-5, 2e-6]) {
    const t = Math.PI / 2 - eps;
    const c = Math.cos(t);
    const theta = alpha * Math.sin(t);
    const ref = nuNew(d, alpha, theta, c);
    const got = nuOld(d, alpha, theta, c);
    console.log(`    cos t = ${c.toExponential(1)}:  ν = ${got.toExponential(6)}  vs  ${ref.toExponential(6)}   rel ${(Math.abs(got - ref) / ref).toExponential(1)}`);
  }
}

// --- What this means for the metric that divides by ν -----------------------
// metric4 forms (p₂·v)/(|p₂| ν_in). Its own guarded branch is a different
// expression again — √(2d²α sin α) rather than √(dα sin α) — so check whether
// the metric stays finite and correct near the straightened pair, against
// finite differences of the corrected ψ⁴.

{
  const phi = 0.4;
  const kinetic = (t: number, e: number): number => {
    const a = psi4Position(phi, t - e, L, nuNew);
    const b = psi4Position(phi, t + e, L, nuNew);
    let sum = 0;
    for (const key of ['p1', 'p2', 'p3'] as const) {
      const dx = (b[key][0] - a[key][0]) / (2 * e);
      const dy = (b[key][1] - a[key][1]) / (2 * e);
      sum += dx * dx + dy * dy;
    }
    return sum;
  };

  console.log('\n  h_tt from the corrected ψ⁴, approaching cos t = 0:');
  for (const eps of [1e-1, 1e-2, 1e-3, 1e-4]) {
    const t = Math.PI / 2 - eps;
    console.log(`    cos t = ${Math.cos(t).toExponential(1)}:  h_tt = ${kinetic(t, 1e-7).toFixed(6)}`);
  }
  const atKink = kinetic(Math.PI / 2, 1e-7);
  console.log(`    cos t = 0:        h_tt = ${atKink.toFixed(6)}`);
  check('h_tt stays finite through the straightened pair', Number.isFinite(atKink) && atKink > 0,
    `h_tt = ${atKink.toFixed(6)}`);
}

console.log(failures ? `\n${failures} FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
