/**
 * PinConstraint.js - Fix specific vertices in place
 *
 * Pins vertices to their initial positions (or specified positions),
 * preventing them from moving. Useful for anchoring corners of cloth,
 * fixing boundary vertices, etc.
 */

import { Constraint } from './Constraint.js';

export class PinConstraint extends Constraint {
    /**
     * @param {Object} options
     * @param {number[]} options.indices - vertex indices to pin
     * @param {number[][]|Float32Array} options.positions - optional fixed positions
     *        If not provided, vertices are pinned to their current positions on first enforce()
     */
    constructor({ indices = [], positions = null } = {}) {
        super();

        this.indices = Array.isArray(indices) ? indices : [indices];
        this.initialized = false;

        // Store pinned positions as flat array [x0, y0, z0, x1, y1, z1, ...]
        if (positions) {
            this.pinnedPos = new Float32Array(this.indices.length * 3);
            for (let i = 0; i < this.indices.length; i++) {
                const p = positions[i];
                this.pinnedPos[i * 3]     = p[0];
                this.pinnedPos[i * 3 + 1] = p[1];
                this.pinnedPos[i * 3 + 2] = p[2];
            }
            this.initialized = true;
        } else {
            this.pinnedPos = null;
        }
    }

    /**
     * Create a pin constraint for a single vertex
     */
    static vertex(index, position = null) {
        return new PinConstraint({
            indices: [index],
            positions: position ? [position] : null
        });
    }

    /**
     * Create a pin constraint for multiple vertices
     */
    static vertices(indices, positions = null) {
        return new PinConstraint({ indices, positions });
    }

    /**
     * Create a pin constraint from an embedding's current positions
     * @param {Embedding} embedding
     * @param {number[]} indices - which vertices to pin
     */
    static fromEmbedding(embedding, indices) {
        const positions = indices.map(i => {
            const idx = i * 3;
            return [embedding.pos[idx], embedding.pos[idx + 1], embedding.pos[idx + 2]];
        });
        return new PinConstraint({ indices, positions });
    }

    /**
     * Add a vertex to the pin constraint
     * @param {number} index - vertex index
     * @param {number[]} position - optional position [x, y, z]
     */
    addVertex(index, position = null) {
        this.indices.push(index);

        if (this.pinnedPos && position) {
            // Expand the pinned positions array
            const newPinnedPos = new Float32Array(this.indices.length * 3);
            newPinnedPos.set(this.pinnedPos);
            const i = this.indices.length - 1;
            newPinnedPos[i * 3]     = position[0];
            newPinnedPos[i * 3 + 1] = position[1];
            newPinnedPos[i * 3 + 2] = position[2];
            this.pinnedPos = newPinnedPos;
        } else if (position) {
            // First position being added
            this.pinnedPos = new Float32Array(3);
            this.pinnedPos[0] = position[0];
            this.pinnedPos[1] = position[1];
            this.pinnedPos[2] = position[2];
            this.initialized = true;
        } else {
            // Will be initialized on first enforce
            this.initialized = false;
        }
    }

    /**
     * Remove a vertex from the pin constraint
     * @param {number} index - vertex index to unpin
     */
    removeVertex(index) {
        const localIdx = this.indices.indexOf(index);
        if (localIdx === -1) return;

        this.indices.splice(localIdx, 1);

        if (this.pinnedPos && this.indices.length > 0) {
            const newPinnedPos = new Float32Array(this.indices.length * 3);
            let writeIdx = 0;
            for (let i = 0; i < this.indices.length + 1; i++) {
                if (i !== localIdx) {
                    newPinnedPos[writeIdx * 3]     = this.pinnedPos[i * 3];
                    newPinnedPos[writeIdx * 3 + 1] = this.pinnedPos[i * 3 + 1];
                    newPinnedPos[writeIdx * 3 + 2] = this.pinnedPos[i * 3 + 2];
                    writeIdx++;
                }
            }
            this.pinnedPos = newPinnedPos;
        }
    }

    enforce(pos, vel, N) {
        // Initialize pinned positions from current state if not set
        if (!this.initialized) {
            this.pinnedPos = new Float32Array(this.indices.length * 3);
            for (let i = 0; i < this.indices.length; i++) {
                const vertIdx = this.indices[i];
                const idx = vertIdx * 3;
                this.pinnedPos[i * 3]     = pos[idx];
                this.pinnedPos[i * 3 + 1] = pos[idx + 1];
                this.pinnedPos[i * 3 + 2] = pos[idx + 2];
            }
            this.initialized = true;
        }

        // Enforce pinned positions and zero velocity
        for (let i = 0; i < this.indices.length; i++) {
            const vertIdx = this.indices[i];
            const idx = vertIdx * 3;
            const pinIdx = i * 3;

            // Reset position to pinned location
            pos[idx]     = this.pinnedPos[pinIdx];
            pos[idx + 1] = this.pinnedPos[pinIdx + 1];
            pos[idx + 2] = this.pinnedPos[pinIdx + 2];

            // Zero velocity
            vel[idx]     = 0;
            vel[idx + 1] = 0;
            vel[idx + 2] = 0;
        }
    }
}
