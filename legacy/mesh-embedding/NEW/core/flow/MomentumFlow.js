/**
 * MomentumFlow.js - Gradient descent with momentum
 *
 * Accumulates velocity to accelerate convergence:
 *   v = momentum * v - learningRate * grad
 *   x += v
 *
 * Good for:
 *   - Faster convergence in long narrow valleys
 *   - Smoothing out noisy gradients
 *   - Overshooting small local minima
 *
 * Typical momentum values: 0.9 to 0.99
 */

import { Flow } from './Flow.js';

export class MomentumFlow extends Flow {
    /**
     * @param {Energy} energy
     * @param {Embedding} emb
     * @param {Object} options
     * @param {number} options.momentum - velocity retention (0-1, typically 0.9)
     */
    constructor(energy, emb, { momentum = 0.9 } = {}) {
        super(energy, emb);
        this.momentum = momentum;
        this.velocity = new Float32Array(emb.pos.length);
    }

    step(dt = 0.01) {
        // Compute full gradient
        this.energy.gradient(this.emb, this.grad);

        // Update velocity: v = momentum * v - dt * grad
        for (let i = 0; i < this.velocity.length; i++) {
            this.velocity[i] = this.momentum * this.velocity[i] - dt * this.grad[i];
        }

        // Update positions: x += v
        this.emb.addScaledVector(this.velocity, 1);

        // Reproject if needed
        this.emb.reproject();
    }
}
