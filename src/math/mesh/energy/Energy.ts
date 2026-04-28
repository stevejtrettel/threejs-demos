/**
 * Energy — abstract base for energy functionals on an `Embedding`.
 *
 * An energy decomposes into a sum of terms (springs, hinges, charges, ...).
 * Subclasses implement the per-term primitives below; the base class
 * provides the derived `value` and `gradient` methods that loop over all
 * terms. This split makes it cheap to compose energies (just sum the
 * `gradient` calls) and to add features like stochastic gradients later
 * without touching the per-term math.
 *
 * The gradient `grad` array always has length `emb.positions.length`
 * (`= 3 · N`). `gradient(emb, grad)` zeroes it before accumulating.
 */

import type { Embedding } from '../Embedding';

export abstract class Energy {
  /** Number of decomposed terms. */
  abstract termCount(): number;

  /** Scalar value of term `k`. */
  abstract termValue(k: number, emb: Embedding): number;

  /**
   * Add term `k`'s gradient into `grad`. Must accumulate (`+=`), not
   * overwrite — multiple terms may touch the same vertex coordinate.
   */
  abstract termGradAccumulate(k: number, emb: Embedding, grad: Float32Array): void;

  /** Total energy: `Σ termValue(k)`. */
  value(emb: Embedding): number {
    let E = 0;
    const S = this.termCount();
    for (let k = 0; k < S; k++) E += this.termValue(k, emb);
    return E;
  }

  /**
   * Full gradient. Zeroes `grad` first, then accumulates each term.
   *
   * Pass a caller-owned scratch buffer of length `emb.positions.length` —
   * evolvers typically allocate it once and reuse it every step.
   */
  gradient(emb: Embedding, grad: Float32Array): void {
    grad.fill(0);
    const S = this.termCount();
    for (let k = 0; k < S; k++) this.termGradAccumulate(k, emb, grad);
  }
}
