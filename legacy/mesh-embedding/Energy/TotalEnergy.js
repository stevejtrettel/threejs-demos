import Energy from "./Energy.js";

export class TotalEnergy extends Energy {
    constructor(...terms) {
        super();
        this.terms = terms;          // assumed well-formed
        this._tmp  = null;
    }

    /* never used by this subclass, but required by base API */
   // termCount() { return 0; }

    value(emb) {
        let sum = 0;
        for (const { energy, weight = 1 } of this.terms)
            sum += weight * energy.value(emb);
        return sum;
    }

    gradient(emb, grad) {
        grad.fill(0);
        if (!this._tmp || this._tmp.length !== grad.length)
            this._tmp = new Float32Array(grad.length);

        for (const { energy, weight = 1 } of this.terms) {
            energy.gradient(emb, this._tmp);          // writes into tmp
            for (let i = 0; i < grad.length; ++i)
                grad[i] += weight * this._tmp[i];
        }
    }


    stochasticGradient(emb, grad, fraction = 0.1) {
        grad.fill(0);
        if (!this._tmp || this._tmp.length !== grad.length)
            this._tmp = new Float32Array(grad.length);

        for (const { energy, weight = 1 } of this.terms) {
            this._tmp.fill(0);

            // If sub-energy has stochasticGradient, use it. Otherwise fallback to full gradient.
            if (typeof energy.stochasticGradient === "function") {
                energy.stochasticGradient(emb, this._tmp, fraction);
            } else {
                energy.gradient(emb, this._tmp);
            }

            // accumulate weighted contribution
            for (let i = 0; i < grad.length; ++i) {
                grad[i] += weight * this._tmp[i];
            }
        }
    }
}
