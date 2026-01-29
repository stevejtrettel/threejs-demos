/**
 * PhysicsFlow.js - Newtonian mechanics with mass and drag
 *
 * Simulates physical dynamics: F = ma with drag forces.
 * Uses semi-implicit Euler integration for stability.
 *
 * Supports optional constraints (floors, walls, spheres, pins) that are
 * enforced after each integration step.
 *
 * Good for cloth simulations and physically realistic behavior.
 */

import { Flow } from './Flow.js';

// Helper: convert scalar or array to Float32Array
function buildFloatArray(data, N) {
    if (Array.isArray(data) || ArrayBuffer.isView(data)) {
        if (data.length !== N) {
            throw new Error(`buildFloatArray: length ${data.length} != expected ${N}`);
        }
        return Float32Array.from(data);
    }
    return new Float32Array(N).fill(data);
}

export class PhysicsFlow extends Flow {
    /**
     * @param {Energy} energy
     * @param {Embedding} emb
     * @param {Object} options
     * @param {number|number[]} options.mass - mass per vertex (scalar or array)
     * @param {number|number[]} options.drag - drag coefficient per vertex (scalar or array)
     * @param {number[]} options.gravity - gravitational acceleration [gx, gy, gz] (default null = no gravity)
     * @param {Constraint[]} options.constraints - array of constraints to enforce after each step
     */
    constructor(energy, emb, { mass = 1, drag = 0, gravity = null, constraints = [] } = {}) {
        super(energy, emb);

        const N = emb.N;
        this.mass = buildFloatArray(mass, N);
        this.drag = buildFloatArray(drag, N);
        this.gravity = gravity;  // [gx, gy, gz] or null
        this.constraints = constraints;

        this.vel = new Float32Array(3 * N);
        this.invMass = Float32Array.from(this.mass, m => 1 / m);
    }

    /**
     * Add a constraint to the simulation
     * @param {Constraint} constraint
     */
    addConstraint(constraint) {
        this.constraints.push(constraint);
    }

    /**
     * Remove a constraint from the simulation
     * @param {Constraint} constraint
     */
    removeConstraint(constraint) {
        const idx = this.constraints.indexOf(constraint);
        if (idx !== -1) {
            this.constraints.splice(idx, 1);
        }
    }

    step(dt = 0.1) {
        this.energy.gradient(this.emb, this.grad);

        const { pos } = this.emb;
        const { grad, vel, drag, invMass, mass, gravity } = this;
        const N = this.emb.N;

        for (let i = 0; i < N; i++) {
            const a = 3 * i;
            const m = mass[i];

            // Force = -grad(E) - drag*v + m*g
            let fx = -grad[a] - drag[i] * vel[a];
            let fy = -grad[a + 1] - drag[i] * vel[a + 1];
            let fz = -grad[a + 2] - drag[i] * vel[a + 2];

            // Add gravitational force F = m * g
            if (gravity) {
                fx += m * gravity[0];
                fy += m * gravity[1];
                fz += m * gravity[2];
            }

            const invm = invMass[i];

            // Semi-implicit Euler
            vel[a] += dt * invm * fx;
            vel[a + 1] += dt * invm * fy;
            vel[a + 2] += dt * invm * fz;

            pos[a] += dt * vel[a];
            pos[a + 1] += dt * vel[a + 1];
            pos[a + 2] += dt * vel[a + 2];
        }

        // Enforce constraints after integration
        for (const constraint of this.constraints) {
            constraint.enforce(pos, vel, N);
        }
    }
}
