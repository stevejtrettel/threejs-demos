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
export class ChargeEnergy extends Energy {
    /**
     * @param {Charge[]} charges  – array of Charge objects
     */
    constructor(charges) {
        super();
        this.charges = charges;
        this.kC      = 1;//Coulomb's constant
        this.cutoff = 100;//where charge stops

        // Build lists of unordered charge pairs: (two instead of one list of [i,j] for speed reasons)
        // pairA[k] and pairB[k] form one unique pair of charges as k ranges over the length of A (or B)
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


        this._scratch = new Float32Array(3);   // tmp vector
    }

    /* -------- term by term calculations ---------------------- */

    termCount() { return this.A.length; }

    termValue(k, emb) {
        const cA = this.charges[this.A[k]];
        const cB = this.charges[this.B[k]];

        const r  = emb.distance(cA.i, cB.i);
        if (r < 0.000001) return 0;                // ignore self-coincident
        if(r>this.cutoff) return 0;//dont impose charge for large distances
        return this.kC * cA.q * cB.q / (r*r);
    }

    termGradAccumulate(k, emb, grad) {
        const cA = this.charges[this.A[k]];
        const cB = this.charges[this.B[k]];

        const diff = emb.difference(cB.i, cA.i, this._scratch); // x_B - x_A
        const r2   = diff[0]**2 + diff[1]**2 + diff[2]**2;
        if (r2 === 0) return;
        if (r2 > this.cutoff*this.cutoff) return;// no force for large distances

        const invR3 = 1 / (r2 * Math.sqrt(r2));                 // 1/r³  (because we multiply by a vector of length r)
        const coef  = this.kC * cA.q * cB.q * invR3;            // kC qi qj / r³

        const a = 3 * cA.i, b = 3 * cB.i;

        grad[a    ] -= coef * diff[0];
        grad[a + 1] -= coef * diff[1];
        grad[a + 2] -= coef * diff[2];

        grad[b    ] += coef * diff[0];
        grad[b + 1] += coef * diff[1];
        grad[b + 2] += coef * diff[2];
    }
}
