/**
 * SpringEnergy — sum of harmonic-spring potentials.
 *
 * Each spring contributes `½ · k · (|x_i − x_j| − rest)²`.
 *
 * The vertex-i gradient is `k · (1 − rest/L) · (x_i − x_j)` where
 * `L = |x_i − x_j|`. The vertex-j gradient is the negation. When `L = 0`
 * the spring direction is undefined and the term contributes zero force —
 * we skip it rather than divide by zero.
 */

import { Energy } from './Energy';
import type { Embedding } from '../Embedding';
import type { Spring } from './types';

export class SpringEnergy extends Energy {
  readonly springs: Spring[];
  private readonly _scratch = new Float32Array(3);

  constructor(springs: Spring[]) {
    super();
    this.springs = springs;
  }

  termCount(): number {
    return this.springs.length;
  }

  termValue(idx: number, emb: Embedding): number {
    const s = this.springs[idx];
    const L = emb.distance(s.i, s.j);
    const dL = L - s.rest;
    return 0.5 * s.k * dL * dL;
  }

  termGradAccumulate(idx: number, emb: Embedding, grad: Float32Array): void {
    const s = this.springs[idx];
    // `difference(j, i)` returns x_i − x_j (legacy convention).
    const diff = emb.difference(s.j, s.i, this._scratch);
    const L2 = diff[0] * diff[0] + diff[1] * diff[1] + diff[2] * diff[2];
    if (L2 === 0) return;

    const L = Math.sqrt(L2);
    const coef = s.k * (1 - s.rest / L);  // = k · (L − rest) / L

    const a = 3 * s.i;
    const b = 3 * s.j;

    grad[a]     += coef * diff[0];
    grad[a + 1] += coef * diff[1];
    grad[a + 2] += coef * diff[2];

    grad[b]     -= coef * diff[0];
    grad[b + 1] -= coef * diff[1];
    grad[b + 2] -= coef * diff[2];
  }
}
