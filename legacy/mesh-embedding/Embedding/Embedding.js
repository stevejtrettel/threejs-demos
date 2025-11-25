/* Embedding.js
   A flat-array map  vertices → ℝ³  with index-based helpers.
*/


//this has to be FAST! This is the main object modified in the simulation loop
export default class Embedding {
    /**
     * @param {Topology} vertices          – the topology/geometery we are embedding
     * @param {Float32Array|Array[]} [initPos] – optional initial [x,y,z] triples
     */
    constructor(topology, initPos = null) {


        this.topology = topology;
        this.N   = topology.vertices.length;
        this.pos = new Float32Array(3 * this.N);   // xyz xyz …

        this._scratch = new Float32Array(3);       // reusable temp vec with dim many coords
        this._coords = new Float32Array(3);         //reusable temp array with 3 coords


        if (initPos) this.setPositions(initPos);   // bulk copy
    }



    /* ------------------------------------------------------------------ */
    /*  Bulk & per-vertex mutators                                         */
    /* ------------------------------------------------------------------ */

    /** Set vertex *i* to p=[x,y,z] */
    setPositionAt(i, p) {
        const a = 3 * i;
        this.pos[a    ] = p[0];
        this.pos[a + 1] = p[1];
        this.pos[a + 2] = p[2];
    }

    /** pos_i += s · vec   (vec is [vx,vy,vz]) */
    addScaledVectorAt(i, vec, s = 1) {
        const a = 3 * i;
        this.pos[a    ] += s * vec[0];
        this.pos[a + 1] += s * vec[1];
        this.pos[a + 2] += s * vec[2];
    }


    /** Overwrite all positions from an array of triples [[x,y,z], …] */
    setPositions(triples) {
        if (triples.length !== this.N)
            throw new Error("setPositions: wrong length");

        for (let i = 0; i < this.N; ++i) {
            const t = triples[i];
            if (!Array.isArray(t) || t.length !== 3)
                throw new Error(`setPositions: element ${i} is not [x,y,z]`);
            this.setPositionAt(i, t);     // reuse helper
        }
    }


    /** Update pos by a scaled multiple of another Float32Array */
    /** pos_i += scale * grad[3*i : 3*i+3]  (no allocations) */
    addScaledVector(vec,scale=1){
            const { pos } = this;
            for (let a = 0; a < pos.length; a += 3) {
                pos[a    ] += scale * vec[a    ];
                pos[a + 1] += scale * vec[a + 1];
                pos[a + 2] += scale * vec[a + 2];
            }
        }


    /* ------------------------------------------------------------------ */
    /*  Geometric queries (all index-based)                                */
    /* ------------------------------------------------------------------ */

    /** Return position of vertex *i* into `out` (default scratch) */
    position(i, out = this._scratch) {
        const a = 3 * i;
        out[0] = this.pos[a    ];
        out[1] = this.pos[a + 1];
        out[2] = this.pos[a + 2];
        return out;
    }

    /** Squared distance ‖v_i − v_j‖² */
    distance2(i, j) {
        const ai = 3 * i, aj = 3 * j;
        const dx = this.pos[ai]     - this.pos[aj];
        const dy = this.pos[ai + 1] - this.pos[aj + 1];
        const dz = this.pos[ai + 2] - this.pos[aj + 2];
        return dx*dx + dy*dy + dz*dz;
    }

    /** Distance ‖v_i − v_j‖ */
    distance(i, j) {
        const ai = 3 * i, aj = 3 * j;
        return Math.hypot(
            this.pos[ai]     - this.pos[aj],
            this.pos[ai + 1] - this.pos[aj + 1],
            this.pos[ai + 2] - this.pos[aj + 2]);
    }

    /** Vector (v_j − v_i) into `out` */
    difference(i, j, out = this._scratch) {
        const a = 3 * i, b = 3 * j;
        out[0] = this.pos[b]     - this.pos[a];
        out[1] = this.pos[b + 1] - this.pos[a + 1];
        out[2] = this.pos[b + 2] - this.pos[a + 2];
        return out;
    }




    /* ------------------------------------------------------------------ */
    /*  PROJECT INTO R3                                       */
    /* ------------------------------------------------------------------ */

    coords(i, out=this._coords){
        //get the coordinates of the embedding at idx
        //HERE DO NOTHING!
        const a = 3 * i;
        out[0] = this.pos[a    ];
        out[1] = this.pos[a + 1];
        out[2] = this.pos[a + 2];
        return out;
    }


    reproject(){
        //do nothing
    }



}
