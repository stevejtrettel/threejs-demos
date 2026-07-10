// The Markoff/Vieta trace recurrence on the once-punctured torus.
//
// A point of Teichmüller space is the trace triple x = tr A, y = tr B,
// z = tr AB, lying on the Markoff cubic x² + y² + z² = xyz. Every unoriented
// simple closed curve is a primitive slope (p, q); Farey-neighbour slopes obey
//
//     t(u + v) = t(u)·t(v) − t(u − v),
//
// which propagates traces from the three generators to all curves. The
// hyperbolic length follows from the trace, ℓ = 2·arccosh(|t| / 2), and it is
// the stable norm of the class (p, q).

// A primitive integer slope (p, q): the homology class of a simple curve.
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

// The modular (hexagonal) torus: most symmetric point, and the minimum of the
// stable-norm ball volume.
export const modularTorus: TraceTriple = { x: 3, y: 3, z: 3 };

export interface Curve {
  slope: Slope;
  trace: number;
  length: number;
}

export function traceToLength(trace: number): number {
  return 2 * Math.acosh(Math.abs(trace) / 2);
}

interface Node {
  slope: Slope;
  trace: number;
}

// Every simple closed curve of slope (p, q) with p² + q² ≤ R², each labelled
// with its trace and hyperbolic length. We walk the two Farey sectors of the
// upper semicircle θ ∈ [0, π); central symmetry of the norm covers the rest.
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

  // sector 1: between a and b; opposite vertex (−1,1) has trace xy − z.
  walk(a, b, { slope: new Slope(-1, 1), trace: x * y - z });
  // sector 2: between b and a⁻¹ = (−1,0); opposite vertex (1,1) has trace z.
  walk(b, { slope: new Slope(-1, 0), trace: x }, { slope: new Slope(1, 1), trace: z });

  return curves;
}
