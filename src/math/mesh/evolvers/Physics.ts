/**
 * Physics — semi-implicit (symplectic) Euler with mass, drag, and optional gravity.
 *
 * Each step:
 *   F   = −∇E − drag · v + m · g          (per vertex, force from energy + damping + gravity)
 *   v ← v + dt · F / m                    (velocity update from current force)
 *   x ← x + dt · v                        (position update from *new* velocity)
 *
 * Symplectic for separable Hamiltonian systems. The drag term breaks
 * energy conservation deliberately — without it the springs would
 * oscillate forever. Per-vertex mass and drag are allowed, useful for
 * pinning effects (huge mass = effectively pinned without using a
 * constraint).
 *
 * Stability: the explicit force evaluation requires
 * `dt · sqrt(k_max / m_min) < 2` (rough rule). For most spring
 * networks `dt ~ 0.01` is comfortable; if you see numerical blow-up,
 * cut `dt` or `density` (or up the drag).
 */

import type { Embedding } from '../Embedding';
import type { Energy } from '../energy/Energy';
import type { Evolver } from './types';

export interface PhysicsOptions {
  /** Per-vertex mass. Scalar (uniform) or per-vertex array. Default 1. */
  mass?: number | Float32Array;
  /** Per-vertex linear-drag coefficient. Scalar or per-vertex array. Default 0. */
  drag?: number | Float32Array;
  /** Constant gravitational acceleration `[gx, gy, gz]`. Default: no gravity. */
  gravity?: readonly [number, number, number];
}

export class Physics implements Evolver {
  readonly emb: Embedding;
  readonly energy: Energy;
  readonly velocity: Float32Array;          // length 3·N — exposed for inspection / reset

  private readonly grad: Float32Array;      // length 3·N
  private readonly mass: Float32Array;      // length N
  private readonly invMass: Float32Array;   // length N
  private readonly drag: Float32Array;      // length N
  private readonly gravity: readonly [number, number, number] | null;

  constructor(emb: Embedding, energy: Energy, options: PhysicsOptions = {}) {
    this.emb = emb;
    this.energy = energy;
    this.velocity = new Float32Array(emb.positions.length);
    this.grad = new Float32Array(emb.positions.length);

    this.mass = expandPerVertex('mass', options.mass ?? 1, emb.N);
    this.invMass = new Float32Array(emb.N);
    for (let i = 0; i < emb.N; i++) this.invMass[i] = 1 / this.mass[i];

    this.drag = expandPerVertex('drag', options.drag ?? 0, emb.N);
    this.gravity = options.gravity ?? null;
  }

  step(dt: number): void {
    this.energy.gradient(this.emb, this.grad);

    const pos = this.emb.positions;
    const { velocity: vel, grad, mass, invMass, drag, gravity } = this;
    const N = this.emb.N;

    for (let i = 0; i < N; i++) {
      const a = 3 * i;
      const d = drag[i];
      const im = invMass[i];

      // Force = −∇E − drag·v + m·g
      let fx = -grad[a]     - d * vel[a];
      let fy = -grad[a + 1] - d * vel[a + 1];
      let fz = -grad[a + 2] - d * vel[a + 2];
      if (gravity) {
        const m = mass[i];
        fx += m * gravity[0];
        fy += m * gravity[1];
        fz += m * gravity[2];
      }

      // Semi-implicit Euler: advance velocity first, then position with NEW v.
      vel[a]     += dt * im * fx;
      vel[a + 1] += dt * im * fy;
      vel[a + 2] += dt * im * fz;

      pos[a]     += dt * vel[a];
      pos[a + 1] += dt * vel[a + 1];
      pos[a + 2] += dt * vel[a + 2];
    }
  }
}

function expandPerVertex(name: string, value: number | Float32Array, N: number): Float32Array {
  if (typeof value === 'number') {
    const arr = new Float32Array(N);
    arr.fill(value);
    return arr;
  }
  if (value.length !== N) {
    throw new Error(
      `Physics: ${name} array length ${value.length} does not match vertex count ${N}.`,
    );
  }
  return value;
}
