import Energy from "../Energy.js";


// ------------------------------------------------------------------
//  Tiny helper: Charge data holder
// ------------------------------------------------------------------
export class Charge {
    /**
     * @param {number|Vertex} v   – vertex index or Vertex object
     * @param {number}        q   – charge magnitude
     */
    constructor(v, q) {
        this.i = typeof v === "number" ? v : v.idx;  // store vertex index
        this.q = q;                                  // scalar charge
    }
}


/* ------------------------------------------------------------------ */
/*  ChargeEnergy: kc qi qj / dis(i,j)^2  over all pairs of charges    */
/* ------------------------------------------------------------------ */
export class ChargeEnergyS3 extends Energy {
    /**
     * @param {Charge[]} charges  – array of Charge objects
     */
    constructor(charges) {
        super();
        this.charges = charges;
        this.kC      = 1;//Coulomb's constant
        this.cutoff = 0.2;

        // Build lists of unordered charge pairs: (two instead of one list of [i,j] for speed reasons)
        //         // pairA[k] and pairB[k] form one unique pair of charges as k ranges over the length of A (or B)
        //A is 0,0,0,0,0,...0,1,1,1,1....1,2,2,...2
        //B is 1,2,3,4,5....N,2,3,4,5....N,3,4,...N
        const M = charges.length;
        const nPairs = M*(M-1)/2;
        this.A = new Uint32Array(nPairs);
        this.B = new Uint32Array(nPairs);

        let idx =0;
        for (let a = 0; a < M; ++a) {
            for (let b = a + 1; b < M; ++b) {
                this.A[idx] = a;
                this.B[idx] = b;
                idx++;
            }
        }


        // scratch arrays for 4D computations
        this._p4 = new Float32Array(4);
        this._q4 = new Float32Array(4);
        this._u4 = new Float32Array(4);
        this._v4 = new Float32Array(4);

        //this._scratch = new Float32Array(3);   // tmp vector
    }

    /* -------- term by term calculations ---------------------- */

    termCount() { return this.A.length; }

    termValue(k, emb) {
        const cA = this.charges[this.A[k]];
        const cB = this.charges[this.B[k]];

        const r  = emb.distance(cA.i, cB.i);
        if (r < 0.000001) return 0;                // ignore self-coincident
        return this.kC * cA.q * cB.q / Math.tan(r);     //correct physics
    }

    termGradAccumulate(k, emb, grad) {
        const cA = this.charges[this.A[k]];
        const cB = this.charges[this.B[k]];

        // 1) load 4D unit endpoints into scratch
        const p = emb.position(cA.i, this._p4);  // p ∈ S³ ⊂ ℝ⁴
        const q = emb.position(cB.i, this._q4);  // q ∈ S³ ⊂ ℝ⁴

        //trigonometry
        // c = ⟨p,q⟩ = cos(theta), θ = arccos(dot), s = sin(theta)
        let  c = p[0]*q[0] + p[1]*q[1] + p[2]*q[2] + p[3]*q[3];
        const theta = Math.acos(c);
        const s = Math.sin(theta);

        //3) front coefficient
        //antipodal points have s=0: need to worry about this!
        let coef;
        if(Math.abs(s)<0.01){
            coef=0;
        }
        else if(theta>this.cutoff){
            coef=0;
        }
        else {
            coef = this.kC * cA.q * cB.q / (s * s * s);
        }
        //this is the correct intrinsic physics for S3

        // 4) the gradient of c=<p,q> on S3
        //gradient in the p variables: store to this._u4
        //gradient in the q variables: store to this._v4
        for (let d = 0; d < 4; d++) {
            this._u4[d] = q[d] - c * p[d];
            this._v4[d] = p[d] - c * q[d];
        }


        // 5) accumulate into grad[4*i … 4*i+3] and grad[4*j … 4*j+3]
        const ai = 4 * cA.i, aj = 4 * cB.i;
        for (let d = 0; d < 4; d++) {
            grad[ai + d] += coef * this._u4[d];
            grad[aj + d] += coef * this._v4[d];
        }

    }
}
