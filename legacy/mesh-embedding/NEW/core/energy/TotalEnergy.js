/**
 * TotalEnergy.js - Weighted sum of multiple energy functionals
 *
 * Combines multiple energies with weights for multi-objective optimization.
 * Example: springs + charge repulsion with different strengths.
 */

import { Energy } from './Energy.js';

export class TotalEnergy extends Energy {
    /**
     * @param {...Object} terms - objects with { energy, weight } properties
     */
    constructor(...terms) {
        super();
        this.terms = terms;
        this._tmp = null;
    }

    value(emb) {
        let sum = 0;
        for (const { energy, weight = 1 } of this.terms) {
            sum += weight * energy.value(emb);
        }
        return sum;
    }

    /**
     * Local energy involving vertex v (for efficient annealing)
     */
    localValue(emb, v) {
        let sum = 0;
        for (const { energy, weight = 1 } of this.terms) {
            sum += weight * energy.localValue(emb, v);
        }
        return sum;
    }

    gradient(emb, grad) {
        grad.fill(0);
        if (!this._tmp || this._tmp.length !== grad.length) {
            this._tmp = new Float32Array(grad.length);
        }

        for (const { energy, weight = 1 } of this.terms) {
            energy.gradient(emb, this._tmp);
            for (let i = 0; i < grad.length; i++) {
                grad[i] += weight * this._tmp[i];
            }
        }
    }

    stochasticGradient(emb, grad, fraction = 0.1) {
        grad.fill(0);
        if (!this._tmp || this._tmp.length !== grad.length) {
            this._tmp = new Float32Array(grad.length);
        }

        for (const { energy, weight = 1 } of this.terms) {
            this._tmp.fill(0);
            if (typeof energy.stochasticGradient === "function") {
                energy.stochasticGradient(emb, this._tmp, fraction);
            } else {
                energy.gradient(emb, this._tmp);
            }
            for (let i = 0; i < grad.length; i++) {
                grad[i] += weight * this._tmp[i];
            }
        }
    }
}
