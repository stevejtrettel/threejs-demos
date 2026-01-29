/**
 * PlaneConstraint.js - Constrain vertices to one side of a plane
 *
 * Useful for floors, walls, and other flat boundaries.
 * Vertices that cross the plane are projected back and their
 * velocity is reflected with optional energy loss (restitution).
 */

import { Constraint } from './Constraint.js';

export class PlaneConstraint extends Constraint {
    /**
     * @param {Object} options
     * @param {number[]} options.normal - outward normal of the plane (unit vector)
     *                                    e.g. [0, 1, 0] for a floor (points up)
     * @param {number} options.offset - plane equation: normal · p = offset
     *                                  e.g. offset = -5 means floor at y = -5
     * @param {number} options.restitution - bounce coefficient (0 = stick, 1 = perfect bounce)
     */
    constructor({ normal = [0, 1, 0], offset = 0, restitution = 0.8 } = {}) {
        super();

        // Normalize the normal vector
        const len = Math.sqrt(normal[0] ** 2 + normal[1] ** 2 + normal[2] ** 2);
        this.nx = normal[0] / len;
        this.ny = normal[1] / len;
        this.nz = normal[2] / len;

        this.offset = offset;
        this.restitution = restitution;
    }

    /**
     * Create a floor constraint at y = yMin
     */
    static floor(yMin, restitution = 0.8) {
        return new PlaneConstraint({
            normal: [0, 1, 0],
            offset: yMin,
            restitution
        });
    }

    /**
     * Create a ceiling constraint at y = yMax
     */
    static ceiling(yMax, restitution = 0.8) {
        return new PlaneConstraint({
            normal: [0, -1, 0],
            offset: -yMax,
            restitution
        });
    }

    /**
     * Create a wall constraint
     * @param {'left'|'right'|'front'|'back'} side
     * @param {number} position - x or z coordinate of the wall
     * @param {number} restitution
     */
    static wall(side, position, restitution = 0.8) {
        const normals = {
            left:  [1, 0, 0],   // wall at x = position, normal points +x
            right: [-1, 0, 0], // wall at x = position, normal points -x
            front: [0, 0, 1],   // wall at z = position, normal points +z
            back:  [0, 0, -1]  // wall at z = position, normal points -z
        };
        const signs = { left: 1, right: -1, front: 1, back: -1 };

        return new PlaneConstraint({
            normal: normals[side],
            offset: signs[side] * position,
            restitution
        });
    }

    enforce(pos, vel, N) {
        const { nx, ny, nz, offset, restitution } = this;

        for (let i = 0; i < N; i++) {
            const idx = i * 3;

            // Signed distance to plane: n · p - offset
            // Positive = on correct side, negative = penetrating
            const dist = nx * pos[idx] + ny * pos[idx + 1] + nz * pos[idx + 2] - offset;

            if (dist < 0) {
                // Project position back onto plane
                pos[idx]     -= dist * nx;
                pos[idx + 1] -= dist * ny;
                pos[idx + 2] -= dist * nz;

                // Velocity component along normal
                const vn = nx * vel[idx] + ny * vel[idx + 1] + nz * vel[idx + 2];

                // If moving into the plane, reflect velocity
                if (vn < 0) {
                    // Reflect: v' = v - (1 + e) * vn * n
                    const impulse = -(1 + restitution) * vn;
                    vel[idx]     += impulse * nx;
                    vel[idx + 1] += impulse * ny;
                    vel[idx + 2] += impulse * nz;
                }
            }
        }
    }
}
