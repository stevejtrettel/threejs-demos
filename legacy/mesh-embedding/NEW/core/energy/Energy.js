/**
 * Energy.js - Base class for energy functionals
 *
 * An Energy computes a scalar value and gradient for an embedding.
 * The gradient points in the direction of increasing energy.
 *
 * Energies decompose into terms for efficient gradient computation.
 * Subclasses implement termValue, termGradAccumulate, and termVertices.
 */

export class Energy {
    /**
     * Number of terms (for energies that decompose into sums)
     */
    termCount() {
        throw new Error("Energy.termCount() not implemented");
    }

    /**
     * Value of term k
     */
    termValue(k, emb) {
        throw new Error("Energy.termValue() not implemented");
    }

    /**
     * Accumulate gradient of term k into grad array
     */
    termGradAccumulate(k, emb, grad) {
        throw new Error("Energy.termGradAccumulate() not implemented");
    }

    /**
     * Which vertices does term k involve?
     * @returns {number[]} vertex indices
     */
    termVertices(k) {
        throw new Error("Energy.termVertices() not implemented");
    }

    /**
     * Build mapping from vertex → terms that involve it (cached)
     */
    _buildVertexTermMap() {
        if (this._termsForVertex) return;
        this._termsForVertex = new Map();

        const S = this.termCount();
        for (let k = 0; k < S; k++) {
            for (const v of this.termVertices(k)) {
                if (!this._termsForVertex.has(v))
                    this._termsForVertex.set(v, []);
                this._termsForVertex.get(v).push(k);
            }
        }
    }

    /**
     * Sum of all terms involving vertex v
     * Used for efficient local energy changes (e.g., simulated annealing)
     */
    localValue(emb, v) {
        this._buildVertexTermMap();
        const terms = this._termsForVertex.get(v) || [];
        let sum = 0;
        for (const k of terms) {
            sum += this.termValue(k, emb);
        }
        return sum;
    }

    /**
     * Total energy value
     */
    value(emb) {
        let E = 0;
        const S = this.termCount();
        for (let k = 0; k < S; k++) {
            E += this.termValue(k, emb);
        }
        return E;
    }

    /**
     * Full gradient (writes into grad array)
     */
    gradient(emb, grad) {
        grad.fill(0);
        const S = this.termCount();
        for (let k = 0; k < S; k++) {
            this.termGradAccumulate(k, emb, grad);
        }
    }

    /**
     * Stochastic gradient using random subset of terms
     */
    stochasticGradient(emb, grad, fraction = 0.1) {
        grad.fill(0);
        const S = this.termCount();
        if (S === 0) return;

        const sampleCount = fraction < 1
            ? Math.max(1, Math.floor(fraction * S))
            : Math.min(S, Math.floor(fraction));

        // Random sampling
        for (let n = 0; n < sampleCount; n++) {
            const k = n + Math.floor(Math.random() * (S - n));
            this.termGradAccumulate(k, emb, grad);
        }

        // Scale to estimate full gradient
        const scale = S / sampleCount;
        for (let i = 0; i < grad.length; i++) {
            grad[i] *= scale;
        }
    }
}
