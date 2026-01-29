/**
 * SphereConstraint.js - Constrain vertices inside or outside a sphere
 *
 * Can be used to keep a mesh inside a bounding sphere (interior mode)
 * or to keep it outside an obstacle sphere (exterior mode).
 */

import { Constraint } from './Constraint.js';

export class SphereConstraint extends Constraint {
    /**
     * @param {Object} options
     * @param {number[]} options.center - center of the sphere [x, y, z]
     * @param {number} options.radius - radius of the sphere
     * @param {boolean} options.interior - if true, keep vertices inside; if false, keep outside
     * @param {number} options.restitution - bounce coefficient (0 = stick, 1 = perfect bounce)
     */
    constructor({ center = [0, 0, 0], radius = 1, interior = true, restitution = 0.8 } = {}) {
        super();

        this.cx = center[0];
        this.cy = center[1];
        this.cz = center[2];
        this.radius = radius;
        this.interior = interior;
        this.restitution = restitution;
    }

    /**
     * Create a bounding sphere that keeps vertices inside
     */
    static inside(center, radius, restitution = 0.8) {
        return new SphereConstraint({ center, radius, interior: true, restitution });
    }

    /**
     * Create an obstacle sphere that keeps vertices outside
     */
    static outside(center, radius, restitution = 0.8) {
        return new SphereConstraint({ center, radius, interior: false, restitution });
    }

    enforce(pos, vel, N) {
        const { cx, cy, cz, radius, interior, restitution } = this;

        for (let i = 0; i < N; i++) {
            const idx = i * 3;

            // Vector from center to vertex
            const dx = pos[idx]     - cx;
            const dy = pos[idx + 1] - cy;
            const dz = pos[idx + 2] - cz;

            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < 1e-10) continue; // At center, skip to avoid division by zero

            // Check if constraint is violated
            const violated = interior ? (dist > radius) : (dist < radius);

            if (violated) {
                // Unit normal pointing outward from center
                const nx = dx / dist;
                const ny = dy / dist;
                const nz = dz / dist;

                // Project position onto sphere surface
                pos[idx]     = cx + radius * nx;
                pos[idx + 1] = cy + radius * ny;
                pos[idx + 2] = cz + radius * nz;

                // Velocity component along radial direction
                const vn = nx * vel[idx] + ny * vel[idx + 1] + nz * vel[idx + 2];

                // For interior: reflect if moving outward (vn > 0)
                // For exterior: reflect if moving inward (vn < 0)
                const shouldReflect = interior ? (vn > 0) : (vn < 0);

                if (shouldReflect) {
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
