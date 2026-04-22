/**
 * Symplectic gradient of a Hamiltonian function.
 *
 * On a symplectic manifold `(M, ω)`, the symplectic gradient of a scalar
 * `H` (the "Hamiltonian") is the unique vector field `X_H` satisfying
 *
 *   ι_{X_H} ω = dH.
 *
 * It's the symplectic analogue of the Riemannian gradient — both "raise
 * the index on a 1-form using a rank-2 tensor," just one antisymmetric
 * (ω) and one symmetric (g).
 *
 * ## Formula
 *
 * From `(ι_X ω)_j = Σ_i ω_{ij} X^i = (dH)_j`, in matrix form
 * `ω^T · X = dH`, and since `ω` is antisymmetric (`ω^T = −ω`),
 *
 *   X_H = −ω^{-1} · dH.
 *
 * For the canonical cotangent bundle `T*M` this specializes to
 * Hamilton's equations
 *
 *   q̇^i = ∂H/∂p_i,    ṗ_i = −∂H/∂q^i.
 *
 * ## Implementation
 *
 * We invert ω at every point and use `X = −ω^{-1} · dH`, which works for
 * any `SymplecticManifold`. On the canonical cotangent bundle this
 * reduces to `ω · dH` (since `ω^{-1} = −ω` there), but we don't special-
 * case it — `Matrix.invert()` has a 2×2 fast path, and general inversion
 * is fine for the n = 4, 6, 8 cases demos will actually hit.
 */

import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { VectorField } from '@/math/vectorfields';
import type { DifferentiableScalarField } from '@/math/functions/types';
import type { ManifoldDomain } from '@/math/manifolds';
import type { SymplecticManifold } from './types';

export class SymplecticGradient implements VectorField, Parametric {
  readonly dim: number;
  readonly params = new Params(this);

  private readonly symp: SymplecticManifold;
  private readonly H: DifferentiableScalarField;
  private readonly buf: Float64Array;

  constructor(symp: SymplecticManifold, H: DifferentiableScalarField) {
    if (symp.dim !== H.dim) {
      throw new Error(
        `SymplecticGradient: dim mismatch symp=${symp.dim}, H=${H.dim}`,
      );
    }
    if (symp.dim % 2 !== 0) {
      throw new Error(
        `SymplecticGradient: symplectic manifold must have even dim, got ${symp.dim}`,
      );
    }
    this.symp = symp;
    this.H = H;
    this.dim = symp.dim;
    this.buf = new Float64Array(this.dim);

    this.params.dependOn(H);
  }

  evaluate(p: number[], _t?: number): Float64Array {
    const n = this.dim;
    const omega = this.symp.symplecticForm.evaluate(p);
    const omegaInv = omega.invert().data;
    const dH = this.H.computePartials(p);

    // X^i = −Σ_j (ω^{-1})_{ij} · (dH)_j
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += omegaInv[i * n + j] * dH[j];
      this.buf[i] = -s;
    }
    return this.buf;
  }

  getDomain(): ManifoldDomain {
    return this.symp.getDomainBounds();
  }
}
