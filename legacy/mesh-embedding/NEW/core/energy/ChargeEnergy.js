/**
 * ChargeEnergy.js - Coulomb repulsion between point charges
 *
 * Energy: E = kC * qi * qj / r^2
 *
 * Charges repel each other, useful for preventing mesh collapse
 * and encouraging even distribution of vertices.
 */

import { Energy } from './Energy.js';

// ============================================================================
// Charge: data holder
// ============================================================================

export class Charge {
    /**
     * @param {number} i - vertex index
     * @param {number} q - charge magnitude
     */
    constructor(i, q) {
        this.i = i;
        this.q = q;
    }
}

// ============================================================================
// ChargeEnergy: pairwise Coulomb repulsion
// ============================================================================

export class ChargeEnergy extends Energy {
    /**
     * @param {Charge[]} charges - array of charges
     */
    constructor(charges) {
        super();
        this.charges = charges;
        this.kC = 1;        // Coulomb constant
        this.cutoff = 100;  // ignore charges beyond this distance

        // Precompute all pairs
        const M = charges.length;
        const nPairs = M * (M - 1) / 2;
        this.A = new Uint32Array(nPairs);
        this.B = new Uint32Array(nPairs);

        let idx = 0;
        for (let a = 0; a < M; a++) {
            for (let b = a + 1; b < M; b++) {
                this.A[idx] = a;
                this.B[idx] = b;
                idx++;
            }
        }

        this._scratch = new Float32Array(3);
    }

    termCount() {
        return this.A.length;
    }

    termValue(k, emb) {
        const cA = this.charges[this.A[k]];
        const cB = this.charges[this.B[k]];

        const r = emb.distance(cA.i, cB.i);
        if (r < 0.000001) return 0;
        if (r > this.cutoff) return 0;

        return this.kC * cA.q * cB.q / (r * r);
    }

    termVertices(k) {
        return [this.charges[this.A[k]].i, this.charges[this.B[k]].i];
    }

    termGradAccumulate(k, emb, grad) {
        const cA = this.charges[this.A[k]];
        const cB = this.charges[this.B[k]];

        const diff = emb.difference(cB.i, cA.i, this._scratch);  // x_B - x_A
        const r2 = diff[0] ** 2 + diff[1] ** 2 + diff[2] ** 2;

        if (r2 === 0) return;
        if (r2 > this.cutoff * this.cutoff) return;

        const invR3 = 1 / (r2 * Math.sqrt(r2));  // 1/r^3 (because we multiply by a vector of length r)
        const coef = this.kC * cA.q * cB.q * invR3;  // kC qi qj / r^3

        const a = 3 * cA.i, b = 3 * cB.i;

        grad[a] -= coef * diff[0];
        grad[a + 1] -= coef * diff[1];
        grad[a + 2] -= coef * diff[2];

        grad[b] += coef * diff[0];
        grad[b + 1] += coef * diff[1];
        grad[b + 2] += coef * diff[2];
    }
}
