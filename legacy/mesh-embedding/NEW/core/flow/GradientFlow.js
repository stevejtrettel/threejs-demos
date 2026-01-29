/**
 * GradientFlow.js - Pure gradient descent
 *
 * The simplest optimization: move in the direction of decreasing energy.
 * x -= learningRate * gradient
 *
 * The dt parameter acts as the learning rate.
 */

import { Flow } from './Flow.js';

export class GradientFlow extends Flow {
    /**
     * @param {Energy} energy
     * @param {Embedding} emb
     */
    constructor(energy, emb) {
        super(energy, emb);
    }

    step(dt = 0.01) {
        // Compute full gradient
        this.energy.gradient(this.emb, this.grad);

        // Move against gradient: x -= dt * grad
        this.emb.addScaledVector(this.grad, -dt);

        // Reproject if needed (for constrained embeddings like S³)
        this.emb.reproject();
    }
}
