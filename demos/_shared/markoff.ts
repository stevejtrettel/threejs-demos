// The Markoff cubic and the Vieta trace recurrence for the once-punctured torus.
//
// A hyperbolic structure is a trace triple x = tr A, y = tr B, z = tr AB on the
// Markoff cubic x² + y² + z² = xyz (the cusp condition tr[A,B] = −2). Every
// unoriented simple closed curve is a primitive slope (p, q); Farey-neighbour
// slopes obey the Vieta step
//
//     t(u + v) = t(u)·t(v) − t(u − v),
//
// which propagates traces from the three generators to all curves. The
// hyperbolic length follows from the trace, ℓ = 2·arccosh(|t| / 2); for a
// simple class this length is its stable norm.
//
// Pure, dependency-free: no THREE.js, no renderer. The example-specific engine
// that the stable-norm functional is built on.

/** A primitive integer slope (p, q): the homology class of a simple curve. */
export class Slope {
  readonly p: number;
  readonly q: number;

  constructor(p: number, q: number) {
    this.p = p;
    this.q = q;
  }

  add(other: Slope): Slope {
    return new Slope(this.p + other.p, this.q + other.q);
  }

  get normSq(): number {
    return this.p * this.p + this.q * this.q;
  }
}

export interface TraceTriple {
  x: number;
  y: number;
  z: number;
}

/** A simple closed curve, labelled with its trace and hyperbolic length. */
export interface Curve {
  slope: Slope;
  trace: number;
  length: number;
}

/**
 * The modular (hexagonal) torus: the most symmetric structure, the minimum of
 * the stable-norm ball volume, and the systole maximizer.
 */
export const modularTorus: TraceTriple = { x: 3, y: 3, z: 3 };

/** Hyperbolic length of a class from its trace: ℓ = 2·arccosh(|t| / 2). */
export function traceToLength(trace: number): number {
  return 2 * Math.acosh(Math.abs(trace) / 2);
}

/**
 * The algebraic chart on the Markoff cubic surface. Solving
 * x² + y² + z² = xyz for z given (x, y):
 *
 *     z = (xy ± √((xy)² − 4(x² + y²))) / 2.
 *
 * We take the minus branch — the sheet through the modular torus (3, 3, 3) —
 * and return null when the discriminant is negative, i.e. when (x, y) lies
 * outside Teichmüller space and there is no real structure. Convenient for
 * sweeping a grid: skip the nulls.
 */
export function tripleFromTraces(x: number, y: number): TraceTriple | null {
  const disc = (x * y) ** 2 - 4 * (x * x + y * y);
  if (disc < 0) return null;
  return { x, y, z: (x * y - Math.sqrt(disc)) / 2 };
}

/** Whether (x, y) admits a real hyperbolic structure (the chart is non-null). */
export function inTeichmuller(x: number, y: number): boolean {
  return (x * y) ** 2 - 4 * (x * x + y * y) >= 0;
}

interface Node {
  slope: Slope;
  trace: number;
}

/**
 * Every simple closed curve of slope (p, q) with p² + q² ≤ radius², each
 * labelled with its trace and hyperbolic length. We walk the two Farey sectors
 * of the upper semicircle θ ∈ [0, π); central symmetry of the norm covers the
 * rest.
 */
export function generateCurves(triple: TraceTriple, radius: number): Curve[] {
  const { x, y, z } = triple;
  const rSq = radius * radius;
  const curves: Curve[] = [];

  const emit = (n: Node): void => {
    curves.push({ slope: n.slope, trace: n.trace, length: traceToLength(n.trace) });
  };

  // The new vertex left + right takes its trace from the Vieta step against the
  // opposite vertex of the Farey triangle; recurse into the two halves.
  const walk = (left: Node, right: Node, opposite: Node): void => {
    const slope = left.slope.add(right.slope);
    if (slope.normSq > rSq) return;
    const middle: Node = { slope, trace: left.trace * right.trace - opposite.trace };
    emit(middle);
    walk(left, middle, right);
    walk(middle, right, left);
  };

  const a: Node = { slope: new Slope(1, 0), trace: x }; // generator a
  const b: Node = { slope: new Slope(0, 1), trace: y }; // generator b
  if (a.slope.normSq <= rSq) emit(a);
  if (b.slope.normSq <= rSq) emit(b);

  // sector 1: between a and b; opposite vertex (−1, 1) has trace xy − z.
  walk(a, b, { slope: new Slope(-1, 1), trace: x * y - z });
  // sector 2: between b and a⁻¹ = (−1, 0); opposite vertex (1, 1) has trace z.
  walk(b, { slope: new Slope(-1, 0), trace: x }, { slope: new Slope(1, 1), trace: z });

  return curves;
}
