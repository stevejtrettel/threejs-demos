/**
 * Constraint.js - Base class for physics constraints
 *
 * Constraints modify positions and velocities after each physics step
 * to enforce geometric boundaries (floors, walls, spheres) or fix
 * specific vertices in place.
 */

export class Constraint {
    /**
     * Enforce the constraint on positions and velocities.
     * Called after each physics integration step.
     *
     * @param {Float32Array} pos - position array (3*N floats)
     * @param {Float32Array} vel - velocity array (3*N floats)
     * @param {number} N - number of vertices
     */
    enforce(pos, vel, N) {
        // Override in subclass
    }
}
