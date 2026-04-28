/**
 * Lie-Poisson structure on `𝔤*`, built from a matrix Lie group.
 *
 * ## The bracket
 *
 * For a matrix Lie group `G` with Lie algebra `𝔤` and structure constants
 * `c^k_{ij}` defined by `[e_i, e_j] = Σ_k c^k_{ij} e_k`, the canonical
 * Lie-Poisson bracket on `𝔤*` is
 *
 *   {f, g}(μ) = −⟨μ, [∇f, ∇g]⟩.
 *
 * In components with the standard basis on `𝔤 ≅ ℝ^dim ≅ 𝔤*`:
 *
 *   π^{ij}(μ) = −Σ_k c^k_{ij} · μ_k
 *
 * The tensor is linear in `μ` (and antisymmetric in `ij`).
 *
 * ## For `SO(3)` (Euler's rigid body)
 *
 * Structure constants `c^k_{ij} = ε_{ijk}` give
 *
 *   π(μ) = [[   0, −μ_2,  μ_1],
 *           [ μ_2,    0, −μ_0],
 *           [−μ_1,  μ_0,    0]]
 *
 * For `H(L) = ½ Σ L_i²/I_i` with gradient `Ω_i = L_i/I_i`, the Hamiltonian
 * vector field `X_H = π·dH` evaluates to `L × Ω` — Euler's equation.
 *
 * ## Caching structure constants
 *
 * `c^k_{ij}` depends only on the group. We compute it once at construction
 * (an `n²` loop of `G.bracket(e_i, e_j)`) into a flat `Float64Array(n³)`,
 * and have `computePoissonTensor(μ)` do one tight triple-sum contraction
 * with zero allocations. Only the strict-upper triangle `i < j` is computed;
 * `π^{ji} = −π^{ij}` fills the rest.
 */

import type { MatrixLieGroup } from './types';
import type { PoissonManifold } from '@/math/symplectic';
import type { ManifoldDomain } from '@/math/manifolds';

export function liePoissonManifold(G: MatrixLieGroup): PoissonManifold {
  const n = G.dim;

  // Cache structure constants: c[i*n*n + j*n + k] = c^k_{ij}.
  // Only i < j is non-redundant; antisymmetry handles i > j at evaluate time.
  const c = new Float64Array(n * n * n);
  const ei = new Array(n).fill(0);
  const ej = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      ei.fill(0); ei[i] = 1;
      ej.fill(0); ej[j] = 1;
      const bracket = G.bracket(ei, ej);
      for (let k = 0; k < n; k++) {
        c[i * n * n + j * n + k] = bracket[k];
      }
    }
  }

  const bounds: ManifoldDomain = {
    min: new Array(n).fill(-Infinity),
    max: new Array(n).fill(Infinity),
  };

  return {
    dim: n,
    getDomainBounds: () => bounds,
    computePoissonTensor: (mu: number[]): Float64Array => {
      const pi = new Float64Array(n * n);
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          let s = 0;
          const base = i * n * n + j * n;
          for (let k = 0; k < n; k++) s += c[base + k] * mu[k];
          // π^{ij} = -c^k_{ij} μ_k
          pi[i * n + j] = -s;
          pi[j * n + i] =  s;
        }
      }
      return pi;
    },
  };
}
