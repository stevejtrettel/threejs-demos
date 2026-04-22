/**
 * Quadratic extension field F_{p²} = F_p[α] / (α² + c₁α + c₀).
 *
 * Elements are pairs [a, b] representing a + bα, using the base field's
 * centered representation.
 */

import { FiniteField } from './finiteField';

export class FiniteFieldExtension {
  readonly base: FiniteField;
  /** Coefficients [c₀, c₁] of the irreducible polynomial α² + c₁α + c₀ = 0. */
  readonly c0: number;
  readonly c1: number;

  constructor(base: FiniteField, c0: number, c1: number) {
    this.base = base;
    this.c0 = base.mod(c0);
    this.c1 = base.mod(c1);
  }

  add(a: [number, number], b: [number, number]): [number, number] {
    return [this.base.add(a[0], b[0]), this.base.add(a[1], b[1])];
  }

  sub(a: [number, number], b: [number, number]): [number, number] {
    return [this.base.sub(a[0], b[0]), this.base.sub(a[1], b[1])];
  }

  /**
   * Multiply: (a₀ + a₁α)(b₀ + b₁α), using α² = -c₁α - c₀.
   */
  mul(a: [number, number], b: [number, number]): [number, number] {
    const f = this.base;
    const a0b0 = f.mul(a[0], b[0]);
    const a0b1 = f.mul(a[0], b[1]);
    const a1b0 = f.mul(a[1], b[0]);
    const a1b1 = f.mul(a[1], b[1]);
    // real part: a0*b0 - a1*b1*c0
    // alpha part: a0*b1 + a1*b0 - a1*b1*c1
    return [
      f.sub(a0b0, f.mul(a1b1, this.c0)),
      f.sub(f.add(a0b1, a1b0), f.mul(a1b1, this.c1)),
    ];
  }

  /** Frobenius automorphism x ↦ x^p. For α² + c₁α + c₀ = 0:
   *  Frob(a + bα) = (a - b·c₁) + (-b)·α */
  frobenius(x: [number, number]): [number, number] {
    const f = this.base;
    return [
      f.sub(x[0], f.mul(x[1], this.c1)),
      f.mod(-x[1]),
    ];
  }

  /** Norm: N(x) = x · Frob(x), lands in F_p. */
  norm(x: [number, number]): number {
    const fr = this.frobenius(x);
    return this.mul(x, fr)[0]; // result has b=0
  }

  /** Multiplicative inverse via conjugate: x⁻¹ = Frob(x) / N(x). */
  inv(x: [number, number]): [number, number] {
    const f = this.base;
    const n = this.norm(x);
    const fr = this.frobenius(x);
    const nInv = f.inv(n);
    return [f.mul(fr[0], nInv), f.mul(fr[1], nInv)];
  }

  isInBaseField(x: [number, number]): boolean {
    return this.base.mod(x[1]) === 0;
  }

  /** All p² elements in the extension field. */
  elements(): [number, number][] {
    const els = this.base.elements();
    const result: [number, number][] = [];
    for (const a of els) {
      for (const b of els) {
        result.push([a, b]);
      }
    }
    return result;
  }

  /**
   * Partition all elements into Galois orbits under Frobenius.
   * Returns { baseField: [...], orbits: [[x, Frob(x)], ...] }.
   */
  galoisOrbits(): { baseField: [number, number][]; orbits: [number, number][][] } {
    const visited = new Set<string>();
    const baseField: [number, number][] = [];
    const orbits: [number, number][][] = [];

    for (const x of this.elements()) {
      const key = `${x[0]},${x[1]}`;
      if (visited.has(key)) continue;
      visited.add(key);

      if (this.isInBaseField(x)) {
        baseField.push(x);
      } else {
        const fx = this.frobenius(x);
        visited.add(`${fx[0]},${fx[1]}`);
        orbits.push([x, fx]);
      }
    }

    return { baseField, orbits };
  }
}
