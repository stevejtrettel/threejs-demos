/**
 * Arithmetic over the finite field Z/pZ.
 *
 * Elements use the centered representation: [-(p-1)/2, ..., (p-1)/2].
 */

/** Homogeneous coordinates [X:Y:Z] in canonical form. */
export type ProjectivePoint = [number, number, number];

export class FiniteField {
  readonly p: number;

  constructor(p: number) {
    this.p = p;
  }

  /** Reduce x to the centered range [-(p-1)/2, (p-1)/2]. */
  mod(x: number): number {
    const half = (this.p - 1) / 2;
    let r = ((x % this.p) + this.p) % this.p;
    if (r > half) r -= this.p;
    return r;
  }

  add(a: number, b: number): number {
    return this.mod(a + b);
  }

  sub(a: number, b: number): number {
    return this.mod(a - b);
  }

  mul(a: number, b: number): number {
    return this.mod(a * b);
  }

  /** Fast modular exponentiation. */
  pow(base: number, exp: number): number {
    let result = 1;
    let b = ((base % this.p) + this.p) % this.p;
    let e = ((exp % (this.p - 1)) + (this.p - 1)) % (this.p - 1);
    while (e > 0) {
      if (e & 1) result = (result * b) % this.p;
      b = (b * b) % this.p;
      e >>= 1;
    }
    return this.mod(result);
  }

  /** Multiplicative inverse via Fermat's little theorem: a^(p-2) mod p. */
  inv(a: number): number {
    return this.pow(a, this.p - 2);
  }

  div(a: number, b: number): number {
    return this.mul(a, this.inv(b));
  }

  /** All field elements in centered order. */
  elements(): number[] {
    const half = (this.p - 1) / 2;
    const els: number[] = [];
    for (let i = -half; i <= half; i++) els.push(i);
    return els;
  }

  /**
   * All F_p points on the line through p1 and p2.
   * Returns { affine, vertical } where vertical is true when x1 = x2
   * (the line also passes through the point at infinity [1:m:0] or [0:1:0]).
   */
  line(p1: [number, number], p2: [number, number]): { affine: [number, number][]; vertical: boolean } {
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    const affine: [number, number][] = [];

    if (this.mod(x1 - x2) === 0) {
      // Vertical line x = x1: all (x1, y) for y in F_p
      for (const y of this.elements()) {
        affine.push([this.mod(x1), y]);
      }
      return { affine, vertical: true };
    }

    // Non-vertical: y = mx + c in F_p
    const m = this.div(this.sub(y2, y1), this.sub(x2, x1));
    const c = this.sub(y1, this.mul(m, x1));
    for (const x of this.elements()) {
      affine.push([x, this.add(this.mul(m, x), c)]);
    }
    return { affine, vertical: false };
  }

  /**
   * Find all [x, y] in F_p × F_p where f(x, y) ≡ 0 (mod p).
   * The callback uses normal JS arithmetic; the result is reduced mod p.
   */
  solve(f: (x: number, y: number) => number): [number, number][] {
    const results: [number, number][] = [];
    const els = this.elements();
    for (const x of els) {
      for (const y of els) {
        if (this.mod(f(x, y)) === 0) {
          results.push([x, y]);
        }
      }
    }
    return results;
  }

  // ── Projective geometry ─────────────────────────────────

  /**
   * Canonicalize [X:Y:Z] to a unique representative.
   * Priority: Z≠0 → [x,y,1]; else X≠0 → [1,m,0]; else [0,1,0].
   */
  normalize(pt: [number, number, number]): ProjectivePoint {
    const [X, Y, Z] = pt;
    const z = this.mod(Z);
    if (z !== 0) {
      return [this.div(X, Z), this.div(Y, Z), 1];
    }
    const x = this.mod(X);
    if (x !== 0) {
      return [1, this.div(Y, X), 0];
    }
    return [0, 1, 0];
  }

  /** All p²+p+1 points of P²(F_p) in canonical form. */
  projectivePoints(): ProjectivePoint[] {
    const pts: ProjectivePoint[] = [];
    const els = this.elements();
    // p² affine points [x:y:1]
    for (const x of els) {
      for (const y of els) {
        pts.push([x, y, 1]);
      }
    }
    // p finite-slope infinity points [1:m:0]
    for (const m of els) {
      pts.push([1, m, 0]);
    }
    // vertical infinity [0:1:0]
    pts.push([0, 1, 0]);
    return pts;
  }

  /**
   * Find all [X:Y:Z] in P²(F_p) where F(X,Y,Z) ≡ 0 (mod p).
   * F must be homogeneous (caller's responsibility).
   */
  solveProjective(F: (X: number, Y: number, Z: number) => number): ProjectivePoint[] {
    const results: ProjectivePoint[] = [];
    for (const pt of this.projectivePoints()) {
      if (this.mod(F(pt[0], pt[1], pt[2])) === 0) {
        results.push(pt);
      }
    }
    return results;
  }

  /**
   * All p+1 points on the projective line through two distinct points in P²(F_p).
   * Parametrizes s·p1 + t·p2 for [s:t] ∈ P¹(F_p).
   */
  /**
   * Extract the affine line equation from two projective points.
   * Returns { vertical: false, m, c } for y = mx + c, or
   *         { vertical: true, x0 } for x = x0.
   * The infinity point of the line is also returned.
   */
  lineEquation(
    p1: ProjectivePoint,
    p2: ProjectivePoint,
  ): { vertical: false; m: number; c: number; inf: ProjectivePoint }
    | { vertical: true; x0: number; inf: ProjectivePoint } {
    // Find two distinct affine points on the line, or use the infinity info
    const pts = this.projectiveLine(p1, p2);
    const affine = pts.filter(p => p[2] !== 0);
    const inf = pts.find(p => p[2] === 0)!;

    if (inf[0] === 0) {
      // [0:1:0] — vertical line
      return { vertical: true, x0: affine[0][0], inf };
    }

    // [1:m:0] — slope m
    const m = inf[1];
    // c = y - mx from any affine point
    const c = this.sub(affine[0][1], this.mul(m, affine[0][0]));
    return { vertical: false, m, c, inf };
  }

  /**
   * All p+1 points on the projective line through two distinct points in P²(F_p).
   * Parametrizes s·p1 + t·p2 for [s:t] ∈ P¹(F_p).
   */
  projectiveLine(p1: ProjectivePoint, p2: ProjectivePoint): ProjectivePoint[] {
    const seen = new Set<string>();
    const results: ProjectivePoint[] = [];
    const els = this.elements();

    // [s:t] ranges over P¹(F_p): [s:1] for all s, plus [1:0]
    const stPairs: [number, number][] = els.map(s => [s, 1] as [number, number]);
    stPairs.push([1, 0]);

    for (const [s, t] of stPairs) {
      const raw: [number, number, number] = [
        this.add(this.mul(s, p1[0]), this.mul(t, p2[0])),
        this.add(this.mul(s, p1[1]), this.mul(t, p2[1])),
        this.add(this.mul(s, p1[2]), this.mul(t, p2[2])),
      ];
      const norm = this.normalize(raw);
      const key = `${norm[0]},${norm[1]},${norm[2]}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push(norm);
      }
    }
    return results;
  }
}
