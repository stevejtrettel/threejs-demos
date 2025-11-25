/* Embedding.js
A flat-array map  vertices → ℝ³  with index-based helpers.
*/


// Construct a rotation matrix in SO(4)
// angles is an object like { xy:0.2, xz:0.5, xw:1.0, yz:0.1, yw:0.3, zw:0.0 }
function buildSO4Rotation(angles={xy:0,xz:0,xw:0,yw:0,zw:0}) {
    const M = new Float32Array(16);
    // start with identity
    for (let i = 0; i < 16; i++) M[i] = (i % 5 === 0 ? 1 : 0);

    function rotate(a, b, theta) {
        if (!theta) return;
        const c = Math.cos(theta), s = Math.sin(theta);
        for (let i = 0; i < 4; i++) {
            const ai = 4*a + i, bi = 4*b + i; // column-major
        }
    }

    // Instead of writing inline, apply rotations by hand:
    function applyPlaneRotation(i, j, theta) {
        if (!theta) return;
        const c = Math.cos(theta), s = Math.sin(theta);
        for (let row = 0; row < 4; row++) {
            const xi = M[row*4 + i];
            const xj = M[row*4 + j];
            M[row*4 + i] = c*xi - s*xj;
            M[row*4 + j] = s*xi + c*xj;
        }
    }

    applyPlaneRotation(0,1, angles.xy || 0);
    applyPlaneRotation(0,2, angles.xz || 0);
    applyPlaneRotation(0,3, angles.xw || 0);
    applyPlaneRotation(1,2, angles.yz || 0);
    applyPlaneRotation(1,3, angles.yw || 0);
    applyPlaneRotation(2,3, angles.zw || 0);

    return M;
}

// Apply M (4x4 matrix, row-major) to a vec4
function applyMat4(M, v, out) {
    out = out || new Float32Array(4);
    for (let r = 0; r < 4; r++) {
        out[r] = M[r*4+0]*v[0] + M[r*4+1]*v[1] + M[r*4+2]*v[2] + M[r*4+3]*v[3];
    }
    return out;
}











//this has to be FAST! This is the main object modified in the simulation loop
export default class EmbeddingS3 {
    /**
     * @param {Topology}           – the topology/geometery we are embedding
     * @param {Float32Array|Array[]} [initPos] – optional initial [x,y,z] triples
     */
    constructor(topology, initPos = null) {

        this.topology = topology;
        this.N   = topology.vertices.length;
        this.pos = new Float32Array(4 * this.N);   // xyzw, xyzw,  … points in 3 sphere

        //scratch positions and velocity for working with things
        // this._p = new Float32Array(4);
        // this._q = new Float32Array(4);
        // this._u = new Float32Array(4);
        // this._v = new Float32Array(4);

        this._scratch = new Float32Array(4);       // reusable temp vec with dim many coords
        this._coords = new Float32Array(3);         //reusable temp array with 3 coords


        //for rotations of the coordinates before visualizing
        this.rotation = buildSO4Rotation(); // identity
        this._rotated = new Float32Array(4); // scratch for rotated point

        if (initPos) this.setPositions(initPos);   // bulk copy
    }



    /* ------------------------------------------------------------------ */
    /*  Bulk & per-vertex mutators                                         */
    /* ------------------------------------------------------------------ */

    /** Set vertex *i* to p=[x,y,z,w] */
    setPositionAt(i, p) {
        const a = 4 * i;
        this.pos[a    ] = p[0];
        this.pos[a + 1] = p[1];
        this.pos[a + 2] = p[2];
        this.pos[a + 3] = p[3];
    }

    /** pos_i += s · vec   (vec is [vx,vy,vz,vw]) */
    addScaledVectorAt(i, vec, s = 1) {
        const a = 3 * i;
        this.pos[a    ] += s * vec[0];
        this.pos[a + 1] += s * vec[1];
        this.pos[a + 2] += s * vec[2];
        this.pos[a + 3] += s * vec[3];
    }


    /** Overwrite all positions from an array of quadruples [[x,y,z,w], …] */
    setPositions(quadruples) {
        if (quadruples.length !== this.N)
            throw new Error("setPositions: wrong length");

        for (let i = 0; i < this.N; ++i) {
            const t = quadruples[i];
            if (!Array.isArray(t) || t.length !== 4)
                throw new Error(`setPositions: element ${i} is not [x,y,z,w]`);
            this.setPositionAt(i, t);     // reuse helper
        }
    }


    /** Update pos by a scaled multiple of another Float32Array */
    /** pos_i += scale * grad[4*i : 4*i+3]  (no allocations) */
    addScaledVector(vec,scale=1){
        const { pos } = this;
        for (let a = 0; a < pos.length; a += 4) {
            pos[a    ] += scale * vec[a    ];
            pos[a + 1] += scale * vec[a + 1];
            pos[a + 2] += scale * vec[a + 2];
            pos[a + 3] += scale * vec[a + 3];
        }
    }


    /* ------------------------------------------------------------------ */
    /*  Geometric queries (all index-based)                                */
    /* ------------------------------------------------------------------ */

    /** Return position of vertex *i* into `out` (default scratch) */
    position(i, out = this._scratch) {
        const a = 4 * i;
        out[0] = this.pos[a    ];
        out[1] = this.pos[a + 1];
        out[2] = this.pos[a + 2];
        out[3] = this.pos[a + 3];
        return out;
    }

    /** Distance */
    distance(i, j) {
        const ai = 4 * i, aj = 4 * j;

        const xi = this.pos[ai];
        const yi = this.pos[ai+1];
        const zi = this.pos[ai+2];
        const wi = this.pos[ai+3];

        const xj = this.pos[aj];
        const yj = this.pos[aj+1];
        const zj = this.pos[aj+2];
        const wj = this.pos[aj+3];

        const dotProd = xi*xj + yi*yj + zi*zj + wi*wj;
        return Math.acos(dotProd);
    }

    /** Squared distance*/
    distance2(i, j) {
        const d = this.distance(i,j);
        return d*d;
    }


    /** Vector (v_j − v_i) into `out` */
    //this is a vector based at vi: it points in direction of geodesic to vj, and has length the distance between them
    // unitTangent(i, j, out = this._scratch) {
    //
    //     const p = this.position(i,this._p);
    //     const q = this.position(j,this._q);
    //     let v = this._v;
    //
    //     // 1) diff = q − p
    //     v[0] = q[0] - p[0];
    //     v[1] = q[1] - p[1];
    //     v[2] = q[2] - p[2];
    //     v[3] = q[3] - p[3];
    //
    //     // 2) project diff onto radial direction p:  proj = ⟨p, diff⟩
    //     const proj =
    //         p[0]*v[0] +
    //         p[1]*v[1] +
    //         p[2]*v[2] +
    //         p[3]*v[3];
    //
    //     // 3) subtract off radial part and accumulate squared length
    //     let lenSq = 0;
    //     for (let i = 0; i < 4; i++) {
    //         const V = v[i] - proj * p[i];
    //         out[i] = V;
    //         lenSq += V * V;
    //     }
    //
    //     // 4) normalize (if non‑degenerate)
    //     if (lenSq > 0) {
    //         const invLen = 1 / Math.sqrt(lenSq);
    //         for (let i = 0; i < 4; i++) {
    //             out[i] *= invLen;
    //         }
    //     } else {
    //         // p==q or antipodal: no unique tangent
    //         out.fill(0);
    //     }
    //
    //
    //     return out;
    // }



    /* ------------------------------------------------------------------ */
    /*  PROJECT INTO R3                                       */
    /* ------------------------------------------------------------------ */
    //
    // coords(i, out=this._coords){
    //     //get the coordinates of the embedding at idx
    //     const a = 4 * i;
    //     const w = this.pos[a+3];
    //     const denom = 1-w;
    //
    //     out[0] = this.pos[a]/denom;
    //     out[1] = this.pos[a + 1]/denom;
    //     out[2] = this.pos[a + 2]/denom;
    //     return out;
    // }


    setRotation(angles) {
        this.rotation = buildSO4Rotation(angles);
    }

    coords(i, out=this._coords) {
        const a = 4*i;
        const p = this.pos.subarray(a,a+4);

        // apply rotation
        const q = applyMat4(this.rotation, p, this._rotated);

        const denom = 1 - q[3];
        out[0] = q[0] / denom;
        out[1] = q[1] / denom;
        out[2] = q[2] / denom;
        return out;
    }



    reproject(){
        const { pos } = this;
        for (let a = 0; a < pos.length; a += 4) {
            let x = pos[a];
            let y = pos[a+1];
            let z = pos[a+2];
            let w = pos[a+3];
            let r = Math.sqrt(x*x+y*y+z*z+w*w);

            pos[a]=x/r;
            pos[a+1]=y/r;
            pos[a+2]=z/r;
            pos[a+3]=w/r;
        }
    }


}
