/**
 * GradientDescent — explicit Euler step against an energy gradient.
 *
 *   positions ← positions − dt · ∇E(positions)
 *
 * The simplest evolver: equivalent to forward Euler on the ODE
 * `dx/dt = −∇E`, where `dt` doubles as the learning rate. For stiff
 * elastic systems, `dt` must be small (~ 1/k_max) for stability — when
 * that's too restrictive, switch to `Physics` (semi-implicit Euler with
 * mass + drag) which handles stiffness gracefully.
 *
 * The gradient scratch buffer is allocated once at construction and
 * reused every step.
 */

import type { Embedding } from '../Embedding';
import type { Energy } from '../energy/Energy';
import type { Evolver } from './types';

export class GradientDescent implements Evolver {
  readonly emb: Embedding;
  readonly energy: Energy;
  private readonly grad: Float32Array;

  constructor(emb: Embedding, energy: Energy) {
    this.emb = emb;
    this.energy = energy;
    this.grad = new Float32Array(emb.positions.length);
  }

  step(dt: number): void {
    this.energy.gradient(this.emb, this.grad);
    this.emb.addScaledVector(this.grad, -dt);
  }
}
