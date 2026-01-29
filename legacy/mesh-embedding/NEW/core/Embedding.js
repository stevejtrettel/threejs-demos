/**
 * Embedding.js - Positions of vertices in R³
 *
 * This is the object that gets evolved during simulation.
 * Uses flat Float32Array for performance: [x0, y0, z0, x1, y1, z1, ...]
 */

export default class Embedding {
    /**
     * @param {Topology} topology - the mesh topology
     * @param {Array} initPos - initial positions as [[x,y,z], ...] or null
     */
    constructor(topology, initPos = null) {
        this.topology = topology;
        this.N = topology.vertices.length;
        this.pos = new Float32Array(3 * this.N);

        // Scratch arrays for computations
        this._scratch = new Float32Array(3);

        if (initPos) {
            this.setPositions(initPos);
        }
    }

    // ========================================================================
    // Setters
    // ========================================================================

    /** Set all positions from array of [x,y,z] triples */
    setPositions(triples) {
        for (let i = 0; i < this.N; i++) {
            const t = triples[i];
            const a = 3 * i;
            this.pos[a] = t[0];
            this.pos[a + 1] = t[1];
            this.pos[a + 2] = t[2];
        }
    }

    /** Set position of vertex i */
    setPositionAt(i, p) {
        const a = 3 * i;
        this.pos[a] = p[0];
        this.pos[a + 1] = p[1];
        this.pos[a + 2] = p[2];
    }

    /** pos += scale * vec (for gradient updates) */
    addScaledVector(vec, scale = 1) {
        const { pos } = this;
        for (let a = 0; a < pos.length; a++) {
            pos[a] += scale * vec[a];
        }
    }

    /** pos[i] += scale * vec */
    addScaledVectorAt(i, vec, scale = 1) {
        const a = 3 * i;
        this.pos[a] += scale * vec[0];
        this.pos[a + 1] += scale * vec[1];
        this.pos[a + 2] += scale * vec[2];
    }

    // ========================================================================
    // Getters
    // ========================================================================

    /** Get position of vertex i (returns scratch array) */
    position(i, out = this._scratch) {
        const a = 3 * i;
        out[0] = this.pos[a];
        out[1] = this.pos[a + 1];
        out[2] = this.pos[a + 2];
        return out;
    }

    /** Euclidean distance between vertices i and j */
    distance(i, j) {
        const ai = 3 * i, aj = 3 * j;
        return Math.hypot(
            this.pos[ai] - this.pos[aj],
            this.pos[ai + 1] - this.pos[aj + 1],
            this.pos[ai + 2] - this.pos[aj + 2]
        );
    }

    /** Squared distance between vertices i and j */
    distance2(i, j) {
        const ai = 3 * i, aj = 3 * j;
        const dx = this.pos[ai] - this.pos[aj];
        const dy = this.pos[ai + 1] - this.pos[aj + 1];
        const dz = this.pos[ai + 2] - this.pos[aj + 2];
        return dx * dx + dy * dy + dz * dz;
    }

    /** Vector from i to j (returns scratch array) */
    difference(i, j, out = this._scratch) {
        const a = 3 * i, b = 3 * j;
        out[0] = this.pos[b] - this.pos[a];
        out[1] = this.pos[b + 1] - this.pos[a + 1];
        out[2] = this.pos[b + 2] - this.pos[a + 2];
        return out;
    }

    // ========================================================================
    // For visualization (project internal coords to R³)
    // ========================================================================

    /** Get display coordinates for vertex i (for R³ embedding, same as position) */
    coords(i, out = this._scratch) {
        return this.position(i, out);
    }

    /** Reproject onto constraint manifold (no-op for R³) */
    reproject() {
        // No-op for standard R³ embedding
    }
}
