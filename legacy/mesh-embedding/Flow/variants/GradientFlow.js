
import  Flow  from "../Flow.js";





export class GradientFlow extends Flow {

    constructor(energy, emb, sampleSize = 1, momentum = 0.0) {
        super(energy, emb);

        this.sampleSize = sampleSize;
        this.momentum   = momentum;

        // velocity buffer, same shape as emb coords
        this.velocity = new Float32Array(emb.pos.length);
    }

    /* one gradient descent step with momentum */
    step(dt = 0.1) {
        // 1. compute gradient
        if (this.sampleSize === 1) {
            this.energy.gradient(this.emb, this.grad);
        } else {
            this.energy.stochasticGradient(this.emb, this.grad, this.sampleSize);
        }

        // 2. update velocity: v = momentum*v - dt*grad
        for (let i = 0; i < this.grad.length; ++i) {
            this.velocity[i] = this.momentum * this.velocity[i] - dt * this.grad[i];
        }

        // 3. update positions: x = x + v
        this.emb.addScaledVector(this.velocity,1);

        //reduce the error of the embedding (on S3), projecting back onto sph
        this.emb.reproject();
    }
}
