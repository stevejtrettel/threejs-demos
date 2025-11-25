


//an energy class calculating value and gradient on an embedding
//this has to be FAST: we call energy.gradient(), perhaps multiple times, during the simulation loop
export default class Energy {

    //useful methods to write for energies that decompose into sums of terms, each with small nubmer of variables
    //given these methods, one does not need to implement the general value() and gradient()
    termCount()               { throw new Error("Energy.termCount() not implemented"); }
    termValue(k, emb)         { throw new Error("Energy.termValue() not implemented"); }
    termGradAccumulate(k, emb, grad) {
        throw new Error("Energy.accumulateTermGrad() not implemented");
    }

    /* -------- default scalar value via per-term hook --------------- */
    value(emb) {
        let E = 0;
        const S = this.termCount();
        for (let k = 0; k < S; ++k){
            E += this.termValue(k, emb);
        }
        return E;
    }

    /* -------- default full gradient -------------------------------- */
    gradient(emb, grad) {
        grad.fill(0);
        const S = this.termCount();
        for (let k = 0; k < S; ++k) {
            this.termGradAccumulate(k, emb, grad);
        }
    }

    //NOTE: one can alternatively IGNORE the per-term computations and implement directly value() and gradient()
    //for energies that don't easily decompose



     // Compute a stochastic gradient using a random subset of terms.
    stochasticGradient(emb, grad, fraction = 0.1) {
        grad.fill(0);

        const S = this.termCount();
        if (S === 0) return;

        // decide number of samples
        let sampleCount = fraction < 1 ? Math.max(1, Math.floor(fraction * S))
            : Math.min(S, Math.floor(fraction));

        // random sample of indices without replacement
        //thx chatgpt :)
        for (let n = 0; n < sampleCount; ++n) {
            // pick a random index in [n, S-1], swap-sample style
            const k = n + Math.floor(Math.random() * (S - n));
            this.termGradAccumulate(k, emb, grad);
        }

        //scale by sample size
        //CHECK THIS
        const scale = S / sampleCount;
        for (let i = 0; i < grad.length; ++i) {
            grad[i] *= scale;
        }
    }

}
