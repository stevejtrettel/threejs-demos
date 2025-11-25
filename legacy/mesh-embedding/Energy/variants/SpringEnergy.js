import  Energy  from "../Energy.js";

/* ------------------------------------------------------------------ */
/*  Tiny helper: Spring data holder                                   */
/* ------------------------------------------------------------------ */
/*  You can also build plain objects {i,j,k,rest} if you prefer;      */
/*  the Energy class only reads the four fields.                      */
export class Spring {
    /**
     * @param {number|Vertex} p   – vertex index *or* Vertex object
     * @param {number|Vertex} q   – idem
     * @param {number} k          – stiffness
     * @param {number} rest       – rest length
     */
    constructor(p, q, k, rest) {
        /* Accept either indices or Vertex objects for user convenience */
        this.i = typeof p === "number" ? p : p.idx;
        this.j = typeof q === "number" ? q : q.idx;
        this.k = k;
        this.rest = rest;
    }
}

/* ------------------------------------------------------------------ */
/*  SpringEnergy: ½ k (‖x_i−x_j‖ − rest)² over all springs              */
/* ------------------------------------------------------------------ */
export class SpringEnergy extends Energy {
    /**
     * @param {Spring[]} springs  – array of Spring objects
     */
    constructor(springs) {
        super();
        this.springs = springs;
        this._scratch = new Float32Array(3);   // reused by difference()
    }

    /* ------------ (1) number of terms ------------------------------ */
    termCount() { return this.springs.length; }

    /* ------------ (2) value of term k ------------------------------ */
    termValue(k, emb) {
        const s  = this.springs[k];
        const L  = emb.distance(s.i, s.j);
        const dL = L - s.rest;
        return 0.5 * s.k * dL * dL;
    }

    /* ------------ (3) gradient contribution of term k -------------- */
    termGradAccumulate(k, emb, grad) {

        //get the spring
        const s = this.springs[k];

        // diff is just a convenient name pointing to this._scratch
        const diff = emb.difference(s.j, s.i, this._scratch); // x_i - x_j

        const L2   = diff[0]**2 + diff[1]**2 + diff[2]**2;
        if (L2 === 0) return;                   // avoid divide-by-zero

        const L     = Math.sqrt(L2);
        const coef  = s.k * (1 - s.rest / L);   // k·(L−L₀)/L

        const a = 3 * s.i, b = 3 * s.j;       // indices in grad[]

        grad[a    ] += coef * diff[0];
        grad[a + 1] += coef * diff[1];
        grad[a + 2] += coef * diff[2];

        grad[b    ] -= coef * diff[0];
        grad[b + 1] -= coef * diff[1];
        grad[b + 2] -= coef * diff[2];
    }
}
