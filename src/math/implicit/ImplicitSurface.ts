/**
 * A hypersurface given implicitly, as the zero level set of `g: ℝⁿ → ℝ`.
 *
 * The three operations that make such a surface *usable* without ever
 * parameterizing it:
 *
 *   • `unitNormal(p)` — the normal direction, which is just `∇g` normalized.
 *   • `projectTangent(v, p)` — strip the normal component off an ambient
 *     vector, leaving the part that moves along the surface.
 *   • `retract(p)` — Newton along the normal, pulling a nearby ambient point
 *     back onto the surface: `p ← p − (g(p)/‖∇g‖²)·∇g`.
 *
 * Together these are the predictor–corrector idiom for constrained motion:
 * take an unconstrained step in a tangent direction (which leaves the surface,
 * because the surface is curved), then correct back onto it. The correction is
 * quadratically convergent, so at ordinary step sizes one or two iterations
 * already put you back on the surface to machine precision — which is why the
 * corrector leg is invisible in practice and has to be exaggerated to be seen.
 *
 * The retraction is the same Gauss–Newton projection that certified-solving
 * pipelines use to stay on a constraint locus while searching along it. Here
 * codimension is 1 and the "solve" is a single division; in codimension k it
 * becomes a least-squares solve against the k × n Jacobian, but the shape of
 * the idea is identical.
 *
 * Zero-dependency on the surface being *smooth everywhere*: `retract` gives up
 * gracefully at critical points of `g`, where `∇g = 0` and the level set is
 * singular.
 */

export interface ImplicitSurfaceOptions {
  /** Ambient dimension `n`. The level set itself has dimension `n − 1`. */
  dim: number;

  /** The defining function; the surface is `{ g = 0 }`. */
  value(p: number[]): number;

  /** `∇g`, as a length-`dim` `Float64Array`. */
  gradient(p: number[]): Float64Array;

  /** Newton iterations used by `retract` (default: 8). */
  retractIterations?: number;

  /** `retract` stops once `|g|` is below this (default: 1e-15). */
  retractTolerance?: number;
}

export class ImplicitSurface {
  /** Ambient dimension. */
  readonly dim: number;

  private readonly g: (p: number[]) => number;
  private readonly gradg: (p: number[]) => Float64Array;
  private readonly retractIterations: number;
  private readonly retractTolerance: number;

  constructor(options: ImplicitSurfaceOptions) {
    this.dim = options.dim;
    this.g = options.value;
    this.gradg = options.gradient;
    this.retractIterations = options.retractIterations ?? 8;
    this.retractTolerance = options.retractTolerance ?? 1e-15;
  }

  /** `g(p)` — zero exactly on the surface, and a signed measure of "off" it. */
  value(p: number[]): number {
    return this.g(p);
  }

  /** `∇g(p)` — normal to the surface, not normalized. */
  gradient(p: number[]): Float64Array {
    return this.gradg(p);
  }

  /**
   * Unit normal at `p`. Returns a zero vector at critical points of `g`, where
   * there is no well-defined normal.
   */
  unitNormal(p: number[]): Float64Array {
    const n = this.gradg(p);
    let length = 0;
    for (let i = 0; i < n.length; i++) length += n[i] * n[i];
    length = Math.sqrt(length);
    if (!(length > 0) || !Number.isFinite(length)) return new Float64Array(this.dim);
    for (let i = 0; i < n.length; i++) n[i] /= length;
    return n;
  }

  /**
   * The tangential part of an ambient vector: `v − (⟨v, n⟩/⟨n, n⟩)·n`.
   *
   * Uses the raw gradient rather than the unit normal, so no square root is
   * needed and the result is exact when `v` is already tangent.
   */
  projectTangent(v: ArrayLike<number>, p: number[]): Float64Array {
    const n = this.gradg(p);
    let vn = 0;
    let nn = 0;
    for (let i = 0; i < this.dim; i++) {
      vn += v[i] * n[i];
      nn += n[i] * n[i];
    }

    const out = new Float64Array(this.dim);
    if (!(nn > 0) || !Number.isFinite(nn)) {
      for (let i = 0; i < this.dim; i++) out[i] = v[i];
      return out;
    }

    const scale = vn / nn;
    for (let i = 0; i < this.dim; i++) out[i] = v[i] - scale * n[i];
    return out;
  }

  /**
   * Newton along the normal, pulling `p` onto the surface.
   *
   * Each iteration is the exact Newton step for the one-dimensional problem
   * "how far along `∇g` until `g` vanishes", linearized. Returns a new array;
   * `p` is not modified.
   */
  retract(p: number[]): number[] {
    const q = p.slice();

    for (let iter = 0; iter < this.retractIterations; iter++) {
      const value = this.g(q);
      if (!Number.isFinite(value)) break;
      if (Math.abs(value) <= this.retractTolerance) break;

      const n = this.gradg(q);
      let nn = 0;
      for (let i = 0; i < this.dim; i++) nn += n[i] * n[i];
      if (!(nn > 0) || !Number.isFinite(nn)) break; // singular point of the level set

      const scale = value / nn;
      for (let i = 0; i < this.dim; i++) q[i] -= scale * n[i];
    }

    return q;
  }
}

export interface ImplicitSurface3DOptions {
  value(x: number, y: number, z: number): number;
  gradient(x: number, y: number, z: number): [number, number, number];
  retractIterations?: number;
  retractTolerance?: number;
}

/**
 * `ImplicitSurface` in ℝ³, written in coordinates.
 *
 * Identical behaviour to the n-D form; it exists so that defining a surface
 * inline reads like the mathematics does:
 *
 * @example
 *   const fermat = new ImplicitSurface3D({
 *     value: (x, y, z) => x ** 3 + y ** 3 + z ** 3 - 1,
 *     gradient: (x, y, z) => [3 * x * x, 3 * y * y, 3 * z * z],
 *   });
 */
export class ImplicitSurface3D extends ImplicitSurface {
  constructor(options: ImplicitSurface3DOptions) {
    super({
      dim: 3,
      value: (p) => options.value(p[0], p[1], p[2]),
      gradient: (p) => Float64Array.from(options.gradient(p[0], p[1], p[2])),
      retractIterations: options.retractIterations,
      retractTolerance: options.retractTolerance,
    });
  }
}
