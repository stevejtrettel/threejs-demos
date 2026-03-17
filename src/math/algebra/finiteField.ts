/**
 * Arithmetic over the finite field Z/pZ.
 *
 * Elements use the centered representation: [-(p-1)/2, ..., (p-1)/2].
 */

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
}
