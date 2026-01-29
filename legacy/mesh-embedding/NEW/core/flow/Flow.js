/**
 * Flow.js - Base class for dynamics on embeddings
 *
 * A Flow evolves an embedding over time according to some rule.
 * Each step() call updates the embedding positions.
 *
 * Subclasses implement specific dynamics like gradient descent
 * or Newtonian physics.
 */

export class Flow {
    /**
     * @param {Energy} energy - the energy functional
     * @param {Embedding} emb - the embedding to evolve
     */
    constructor(energy, emb) {
        this.energy = energy;
        this.emb = emb;
        this.grad = new Float32Array(emb.pos.length);
    }

    /**
     * Perform one integration step
     */
    step(dt) {
        throw new Error("Flow.step() not implemented");
    }
}
