/**
 * SGDFlow.js - Stochastic Gradient Descent
 *
 * Instead of computing the full gradient (expensive for large meshes),
 * samples a random subset of energy terms each step.
 *
 * Good for:
 *   - Large meshes where full gradient is slow
 *   - Escaping shallow local minima (noise helps exploration)
 *   - Charge energy with O(n²) terms
 */

import { Flow } from './Flow.js';

export class SGDFlow extends Flow {
    /**
     * @param {Energy} energy
     * @param {Embedding} emb
     * @param {Object} options
     * @param {number} options.sampleFraction - fraction of terms to sample (0-1)
     */
    constructor(energy, emb, { sampleFraction = 0.1 } = {}) {
        super(energy, emb);
        this.sampleFraction = sampleFraction;
    }

    step(dt = 0.01) {
        // Compute stochastic gradient (samples random subset, scales to estimate full)
        this.energy.stochasticGradient(this.emb, this.grad, this.sampleFraction);

        // Move against gradient: x -= dt * grad
        this.emb.addScaledVector(this.grad, -dt);

        // Reproject if needed
        this.emb.reproject();
    }
}
