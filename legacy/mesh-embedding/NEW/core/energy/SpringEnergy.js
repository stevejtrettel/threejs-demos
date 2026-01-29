/**
 * SpringEnergy.js - Harmonic spring potential energy
 *
 * Energy: E = (1/2) k (|x_i - x_j| - rest)^2
 *
 * Springs try to maintain their rest length. Stretched or compressed
 * springs store potential energy and exert restorative forces.
 */

import { Energy } from './Energy.js';

// ============================================================================
// Spring: data holder
// ============================================================================

export class Spring {
    /**
     * @param {number} i - first vertex index
     * @param {number} j - second vertex index
     * @param {number} k - stiffness
     * @param {number} rest - rest length
     */
    constructor(i, j, k, rest) {
        this.i = i;
        this.j = j;
        this.k = k;
        this.rest = rest;
    }
}

// ============================================================================
// SpringEnergy: sum of spring potential energies
// ============================================================================

export class SpringEnergy extends Energy {
    /**
     * @param {Spring[]} springs - array of springs
     */
    constructor(springs) {
        super();
        this.springs = springs;
        this._scratch = new Float32Array(3);
    }

    termCount() {
        return this.springs.length;
    }

    termValue(k, emb) {
        const s = this.springs[k];
        const L = emb.distance(s.i, s.j);
        const dL = L - s.rest;
        return 0.5 * s.k * dL * dL;
    }

    termVertices(k) {
        const s = this.springs[k];
        return [s.i, s.j];
    }

    termGradAccumulate(k, emb, grad) {
        const s = this.springs[k];
        const diff = emb.difference(s.j, s.i, this._scratch);  // x_i - x_j

        const L2 = diff[0] ** 2 + diff[1] ** 2 + diff[2] ** 2;
        if (L2 === 0) return;

        const L = Math.sqrt(L2);
        const coef = s.k * (1 - s.rest / L);  // k(L - L0)/L

        const a = 3 * s.i, b = 3 * s.j;

        grad[a] += coef * diff[0];
        grad[a + 1] += coef * diff[1];
        grad[a + 2] += coef * diff[2];

        grad[b] -= coef * diff[0];
        grad[b + 1] -= coef * diff[1];
        grad[b + 2] -= coef * diff[2];
    }
}
