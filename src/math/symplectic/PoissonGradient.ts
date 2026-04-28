/**
 * Hamiltonian vector field on a Poisson manifold — sibling to
 * `SymplecticGradient`.
 *
 * Given a Poisson manifold `(M, π)` and a Hamiltonian `H: M → ℝ`, the
 * Poisson-Hamiltonian vector field is
 *
 *   X_H^i = π^{ij}(p) · ∂_j H.
 *
 * For the canonical `T*M` symplectic structure this reproduces Hamilton's
 * equations exactly (`π = −ω⁻¹`). On a genuinely Poisson (non-symplectic)
 * manifold like `so(3)* ≅ ℝ³` it gives the Lie-Poisson flow of `H`.
 *
 * Implements `VectorField`, so it plugs into the generic n-D integrator
 * infrastructure (`math/ode/integrate`, `rk4`, `gaussLegendre4`) without
 * further glue.
 */

import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { VectorField } from '@/math/vectorfields';
import type { DifferentiableScalarField } from '@/math/functions/types';
import type { ManifoldDomain } from '@/math/manifolds';
import type { PoissonManifold } from './PoissonManifold';

export class PoissonGradient implements VectorField, Parametric {
  readonly dim: number;
  readonly params = new Params(this);

  private readonly manifold: PoissonManifold;
  private readonly H: DifferentiableScalarField;
  private readonly buf: Float64Array;

  constructor(manifold: PoissonManifold, H: DifferentiableScalarField) {
    if (manifold.dim !== H.dim) {
      throw new Error(
        `PoissonGradient: dim mismatch manifold=${manifold.dim}, H=${H.dim}`,
      );
    }
    this.manifold = manifold;
    this.H = H;
    this.dim = manifold.dim;
    this.buf = new Float64Array(this.dim);
    this.params.dependOn(H);
  }

  evaluate(p: number[], _t?: number): Float64Array {
    const n = this.dim;
    const pi = this.manifold.computePoissonTensor(p);
    const dH = this.H.computePartials(p);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = 0; j < n; j++) s += pi[i * n + j] * dH[j];
      this.buf[i] = s;
    }
    return this.buf;
  }

  getDomain(): ManifoldDomain {
    return this.manifold.getDomainBounds();
  }
}
