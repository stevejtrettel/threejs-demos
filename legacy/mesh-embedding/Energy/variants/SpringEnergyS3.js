// SpringEnergyS3.js

import Energy from "../Energy";

export class SpringEnergyS3 extends Energy {
    /**
     * @param {Spring[]} springs
     */
    constructor(springs) {
        super();
        this.springs = springs;

        // scratch arrays for 4D computations
        this._p4 = new Float32Array(4);
        this._q4 = new Float32Array(4);
        this._u4 = new Float32Array(4);
        this._v4 = new Float32Array(4);
    }

    /* ------------ (1) number of terms ------------------------------ */
    termCount() {
        return this.springs.length;
    }

    /* ------------ (2) value of term k ------------------------------ */
    termValue(k, emb) {
        const spring = this.springs[k];
        const L = emb.distance(spring.i, spring.j);      // spherical distance = arccos(dot)
        const dL = L - spring.rest;
        return 0.5 * spring.k * dL * dL;
    }

    /* ------------ (3) gradient contribution of term k -------------- */
    termGradAccumulate(k, emb, grad) {
        const spring    = this.springs[k];
        const rest = spring.rest;
        const K    = spring.k;

        // 1) load 4D unit endpoints into scratch
        const p = emb.position(spring.i, this._p4);  // p ∈ S³ ⊂ ℝ⁴
        const q = emb.position(spring.j, this._q4);  // q ∈ S³ ⊂ ℝ⁴

        //2)trigonometry
        // c = ⟨p,q⟩ = cos(theta), θ = arccos(dot), s = sin(theta)
        let  c = p[0]*q[0] + p[1]*q[1] + p[2]*q[2] + p[3]*q[3];
        const theta = Math.acos(c);
        const s = Math.sin(theta);

        //3) front coefficient
        const coef= -K*(theta-rest)/s;


        // 4) the gradient of c=<p,q> on S3
        //gradient in the p variables: store to this._u4
        //gradient in the q variables: store to this._v4
        for (let d = 0; d < 4; d++) {
            this._u4[d] = q[d] - c * p[d];
            this._v4[d] = p[d] - c * q[d];
        }

        // 5) accumulate into grad[4*i … 4*i+3] and grad[4*j … 4*j+3]
        const ai = 4 * spring.i, aj = 4 * spring.j;
        for (let d = 0; d < 4; d++) {
            grad[ai + d] += coef * this._u4[d];
            grad[aj + d] += coef * this._v4[d];
        }

    }
}
