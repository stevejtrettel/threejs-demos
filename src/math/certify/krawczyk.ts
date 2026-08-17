/**
 * The Krawczyk test: turning an approximate root into a theorem.
 *
 * Given a square system `G: ℝⁿ → ℝⁿ`, an approximate root `x̂`, and a box `X`
 * around it, the Krawczyk operator is
 *
 *     K(X) = x̂ − Y·G(x̂) + (I − Y·DG(X))·(X − x̂),
 *
 * where `Y` is any fixed real matrix — in practice `DG(x̂)⁻¹`, computed in
 * ordinary floating point — and `DG(X)` is the Jacobian evaluated in *interval*
 * arithmetic over the whole box, so it encloses the Jacobian at every point of
 * `X` at once.
 *
 * **If `K(X) ⊆ int X`, then `G` has exactly one zero in `X`.**
 *
 * Existence comes from Brouwer — `K` maps the box into itself, so it has a
 * fixed point — and uniqueness from `‖I − Y·DG(X)‖ < 1`, which containment
 * forces and which makes `K` a contraction. Nothing about `Y` has to be
 * verified: a bad `Y` makes the test fail, never makes it lie. That is the
 * trick that lets a proof be driven by floating-point guesswork.
 *
 * Read the two terms as: *where Newton says the root is*, plus *a rigorous
 * bound on everything Newton's linearization threw away*. The test passes when
 * the admission of ignorance still fits inside the box you started with.
 *
 * The test is one-sided. A box that fails is not a box without a root; it is a
 * box the test could not settle — hence `reason`, which distinguishes the two
 * ways it fails, since they mean opposite things about what to do next.
 */

import { Matrix, luDecompose, luSolve } from '@/math/linear-algebra';
import {
  boxContains,
  boxInterior,
  iadd,
  imag,
  imul,
  ipoint,
  iscale,
  isub,
  box as makeBox,
  type Interval,
  type IntervalBox,
} from '@/math/interval';

/**
 * A square system that can be evaluated at points *and* over boxes.
 *
 * The interval methods must be genuine enclosures: for every `p` in `b`,
 * `value(p)` must lie in `intervalValue(b)`, and likewise for the Jacobian.
 * `scripts/validate-krawczyk.ts` checks exactly that by sampling.
 */
export interface IntervalSystem {
  readonly dim: number;

  value(p: number[]): Float64Array;
  jacobian(p: number[]): Matrix;

  intervalValue(b: IntervalBox): Interval[];
  intervalJacobian(b: IntervalBox): Interval[][];
}

/** Why a box failed, or that it did not. */
export type KrawczykVerdict =
  /** `K(X) ⊆ int X` — one root in the box, and no others. */
  | 'certified'
  /**
   * `‖I − Y·DG(X)‖ ≥ 1`: the box is too big for the Jacobian to be near
   * constant on it, so `K` is not a contraction and `K(X)` bursts out in every
   * direction. Shrink the box.
   */
  | 'no-contraction'
  /**
   * `K` contracts, but its image slides out of one side: the root is not where
   * the box is, or not by enough of a margin. Polish the centre, or grow the
   * box.
   */
  | 'center-off'
  /** `DG(x̂)` is numerically singular, so there is no `Y` to precondition with. */
  | 'singular';

export interface KrawczykResult {
  /** The centre the test was run about. */
  center: number[];

  /** Half-width of the box, in every coordinate. */
  radius: number;

  /** The box `X`. */
  box: IntervalBox;

  /** The image `K(X)`. Empty when the test could not run. */
  image: IntervalBox;

  /** Whether the test proved a unique root in the box. */
  certified: boolean;

  verdict: KrawczykVerdict;

  /** `‖I − Y·DG(X)‖∞`. Below 1 the operator contracts. */
  contraction: number;

  /** `‖G(x̂)‖∞` — how good the centre is. */
  residual: number;

  /**
   * Coordinates where `K(X)` is not strictly inside `X`. Empty when certified;
   * what the demo highlights when not.
   */
  escaping: number[];
}

/** Row-sum (`∞`) norm of an interval matrix, taking each entry's magnitude. */
function intervalNormInf(m: Interval[][]): number {
  let worst = 0;
  for (const row of m) {
    let sum = 0;
    for (const entry of row) sum += imag(entry);
    worst = Math.max(worst, sum);
  }
  return worst;
}

/** Inverse of a real square matrix by LU, or `null` if singular. */
function inverse(a: Matrix): number[][] | null {
  try {
    const lu = luDecompose(a);
    const n = a.rows;
    const columns: number[][] = [];
    for (let j = 0; j < n; j++) {
      const e = new Array(n).fill(0);
      e[j] = 1;
      columns.push(luSolve(lu, e));
    }
    // columns[j][i] is entry (i, j).
    const out: number[][] = [];
    for (let i = 0; i < n; i++) out.push(columns.map((column) => column[i]));
    return out.every((row) => row.every(Number.isFinite)) ? out : null;
  } catch {
    return null;
  }
}

/**
 * Run the Krawczyk test on the box of the given radius about `center`.
 *
 * @example
 *   const result = krawczyk(system, root, 1e-6);
 *   result.certified;    // true — exactly one root in the box
 *   result.contraction;  // 9.3e-6 — far inside the contraction condition
 */
export function krawczyk(
  system: IntervalSystem,
  center: number[],
  radius: number,
): KrawczykResult {
  const n = system.dim;
  const X = makeBox(center, radius);

  const Gx = system.value(center);
  let residual = 0;
  for (let i = 0; i < n; i++) residual = Math.max(residual, Math.abs(Gx[i]));

  const Y = inverse(system.jacobian(center));
  if (Y === null) {
    return {
      center, radius, box: X, image: [],
      certified: false, verdict: 'singular',
      contraction: Infinity, residual, escaping: [],
    };
  }

  // M = I − Y·DG(X), an interval matrix: how far the preconditioned Jacobian
  // can stray from the identity anywhere in the box.
  const A = system.intervalJacobian(X);
  const M: Interval[][] = [];
  for (let i = 0; i < n; i++) {
    const row: Interval[] = [];
    for (let j = 0; j < n; j++) {
      let entry: Interval = ipoint(i === j ? 1 : 0);
      for (let k = 0; k < n; k++) entry = isub(entry, iscale(Y[i][k], A[k][j]));
      row.push(entry);
    }
    M.push(row);
  }
  const contraction = intervalNormInf(M);

  // K = x̂ − Y·G(x̂) + M·(X − x̂). The offset X − x̂ is [-r, r] in every
  // coordinate, exactly.
  const offset: Interval[] = new Array(n).fill(null).map(() => [-radius, radius] as Interval);
  const image: IntervalBox = [];
  for (let i = 0; i < n; i++) {
    let acc: Interval = ipoint(center[i]);
    for (let k = 0; k < n; k++) acc = isub(acc, ipoint(Y[i][k] * Gx[k]));
    for (let k = 0; k < n; k++) acc = iadd(acc, imul(M[i][k], offset[k]));
    image.push(acc);
  }

  const escaping: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!(image[i][0] > X[i][0] && image[i][1] < X[i][1])) escaping.push(i);
  }

  const certified = escaping.length === 0;
  const verdict: KrawczykVerdict = certified
    ? 'certified'
    : contraction >= 1
      ? 'no-contraction'
      : 'center-off';

  return { center, radius, box: X, image, certified, verdict, contraction, residual, escaping };
}

export interface RadiusWindowOptions {
  /** Smallest radius considered (default: 1e-16). */
  minRadius?: number;

  /** Largest radius considered (default: 1e2). */
  maxRadius?: number;

  /** Bisection steps on each edge (default: 60). */
  refinement?: number;
}

export interface RadiusWindow {
  /** Smallest radius that certifies, or `null` if none does. */
  min: number | null;

  /** Largest radius that certifies, or `null` if none does. */
  max: number | null;
}

/**
 * The band of radii that certify, found by bisecting each edge.
 *
 * Both edges are real and mean different things. The upper one is a property of
 * the *system*: past it the Jacobian varies too much across the box for any
 * centre to help. The lower one is a property of the *centre*: the box has to
 * be wide enough to contain the true root, so polishing `x̂` walks this edge
 * down and nothing else does.
 *
 * Assumes the certifying radii form one interval, which is the usual picture
 * and is what the scan step checks by sampling before bisecting.
 */
export function certifiedRadiusWindow(
  system: IntervalSystem,
  center: number[],
  options: RadiusWindowOptions = {},
): RadiusWindow {
  const { minRadius = 1e-16, maxRadius = 1e2, refinement = 60 } = options;

  // Scan in log space for any radius that certifies, then bisect outward from
  // it toward each end.
  const SAMPLES = 200;
  const logMin = Math.log10(minRadius);
  const logMax = Math.log10(maxRadius);

  let anchor: number | null = null;
  for (let i = 0; i <= SAMPLES; i++) {
    const r = 10 ** (logMin + ((logMax - logMin) * i) / SAMPLES);
    if (krawczyk(system, center, r).certified) {
      anchor = r;
      break;
    }
  }
  if (anchor === null) return { min: null, max: null };

  /** Bisect between a radius that certifies and one that does not. */
  const edge = (pass: number, fail: number): number => {
    let good = pass;
    let bad = fail;
    for (let i = 0; i < refinement; i++) {
      const mid = Math.sqrt(good * bad); // geometric midpoint — the scale is logarithmic
      if (krawczyk(system, center, mid).certified) good = mid;
      else bad = mid;
    }
    return good;
  };

  const lower = krawczyk(system, center, minRadius).certified ? minRadius : edge(anchor, minRadius);
  const upper = krawczyk(system, center, maxRadius).certified ? maxRadius : edge(anchor, maxRadius);

  return { min: lower, max: upper };
}

/**
 * Whether a point is inside a certified box — the claim a certificate makes.
 *
 * Used by the validation script: if `krawczyk` certifies a box, the true root
 * had better be in it.
 */
export function certifiesPoint(result: KrawczykResult, p: number[]): boolean {
  return result.certified && boxContains(result.box, p);
}

/** Whether `K(X)` is strictly inside `X` — the test's conclusion, restated. */
export function imageInsideBox(result: KrawczykResult): boolean {
  return result.image.length > 0 && boxInterior(result.image, result.box);
}
