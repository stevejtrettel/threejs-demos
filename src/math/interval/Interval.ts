/**
 * Interval arithmetic using tuples for performance.
 *
 * An interval `[lo, hi]` stands for the set of all reals between its endpoints,
 * and every operation returns an interval containing every result the operation
 * could produce on members of its inputs. Evaluate an expression this way and
 * you get an *enclosure*: a set guaranteed to contain the true value at every
 * point of the input box. That is the property the whole method rests on — it
 * turns "I sampled and it looked fine" into "it cannot be otherwise".
 *
 * Enclosures are generally not tight. `X − X` is `[-w, w]`, not `0`, because
 * the two occurrences are treated as independent — the *dependency problem*.
 * Rewriting an expression changes how much it overestimates, which is why
 * `isqr` exists separately from `imul(a, a)`: squaring knows the two factors
 * are the same number and returns `[0, ...]` rather than something straddling
 * zero.
 *
 * **On rounding.** A certificate meant for publication rounds each operation
 * outward, so the enclosure survives floating-point error too. JavaScript
 * cannot set the rounding mode, and these routines do not emulate it — they use
 * ordinary float arithmetic, which can be wrong in the last bit or so. That is
 * deliberate: this module exists to *draw* the interval method, and a
 * last-bit-tight enclosure is invisible on screen. Do not use it as the
 * arithmetic behind a published proof.
 */

/** A closed interval `[lo, hi]`. */
export type Interval = [number, number];

// ── Construction ─────────────────────────────────────────

/** The degenerate interval `[x, x]`, holding one exact number. */
export function ipoint(x: number): Interval {
  return [x, x];
}

/** The interval of radius `r` about `c`. */
export function iball(c: number, r: number): Interval {
  return [c - r, c + r];
}

// ── Basic arithmetic ─────────────────────────────────────

export function iadd(a: Interval, b: Interval): Interval {
  return [a[0] + b[0], a[1] + b[1]];
}

export function isub(a: Interval, b: Interval): Interval {
  return [a[0] - b[1], a[1] - b[0]];
}

/**
 * Product. The extremes of `xy` over a box of `x` and `y` are attained at
 * corners, so it suffices to take the min and max of the four corner products.
 */
export function imul(a: Interval, b: Interval): Interval {
  const p1 = a[0] * b[0];
  const p2 = a[0] * b[1];
  const p3 = a[1] * b[0];
  const p4 = a[1] * b[1];
  return [Math.min(p1, p2, p3, p4), Math.max(p1, p2, p3, p4)];
}

/** Multiply by an exact scalar, flipping the endpoints when it is negative. */
export function iscale(s: number, a: Interval): Interval {
  return s >= 0 ? [s * a[0], s * a[1]] : [s * a[1], s * a[0]];
}

export function ineg(a: Interval): Interval {
  return [-a[1], -a[0]];
}

/**
 * Square — not `imul(a, a)`.
 *
 * `x²` over `[-1, 2]` is `[0, 4]`, but `imul` treats the factors as independent
 * and returns `[-2, 4]`, since it allows the impossible `(-1)·2`. Knowing the
 * two factors are the *same* number is what removes the spurious negatives.
 */
export function isqr(a: Interval): Interval {
  if (a[0] >= 0) return [a[0] * a[0], a[1] * a[1]];
  if (a[1] <= 0) return [a[1] * a[1], a[0] * a[0]];
  return [0, Math.max(a[0] * a[0], a[1] * a[1])];
}

/** Cube. Monotone on all of ℝ, so the endpoints map to the endpoints. */
export function icube(a: Interval): Interval {
  return [a[0] * a[0] * a[0], a[1] * a[1] * a[1]];
}

// ── Measurements ─────────────────────────────────────────

/** Midpoint. */
export function imid(a: Interval): number {
  return 0.5 * (a[0] + a[1]);
}

/** Half-width. */
export function irad(a: Interval): number {
  return 0.5 * (a[1] - a[0]);
}

/** Width. */
export function iwidth(a: Interval): number {
  return a[1] - a[0];
}

/** Magnitude — the largest `|x|` over the interval. */
export function imag(a: Interval): number {
  return Math.max(Math.abs(a[0]), Math.abs(a[1]));
}

// ── Containment ──────────────────────────────────────────

/** Whether `x` lies in `a`. */
export function icontains(a: Interval, x: number): boolean {
  return x >= a[0] && x <= a[1];
}

/**
 * Whether `a` lies in the *interior* of `b`.
 *
 * Strictness is not a technicality here: the Krawczyk conclusion needs the
 * image strictly inside the box, since touching the boundary is exactly the
 * case where the fixed point could escape.
 */
export function iinterior(a: Interval, b: Interval): boolean {
  return a[0] > b[0] && a[1] < b[1];
}

// ── Boxes ────────────────────────────────────────────────

/** A box in ℝⁿ: one interval per coordinate. */
export type IntervalBox = Interval[];

/** The box of radius `r` about a point. */
export function box(center: number[], r: number): IntervalBox {
  return center.map((c) => iball(c, r));
}

/** Whether every coordinate of `a` lies in the interior of the matching one of `b`. */
export function boxInterior(a: IntervalBox, b: IntervalBox): boolean {
  return a.every((interval, i) => iinterior(interval, b[i]));
}

/** Whether the point `p` lies in the box. */
export function boxContains(a: IntervalBox, p: number[]): boolean {
  return a.every((interval, i) => icontains(interval, p[i]));
}
