# Lie groups — plan

**Date:** 2026-04-22
**Status:** proposed, ready to implement
**Prerequisite for:** rigid-body dynamics, gyroscope/spinning-top demos, symplectic reduction, coadjoint-orbit visualizations, future gauge-theory work

## Goal

Add matrix Lie groups as a library-level concept so we can build:

1. **Rigid-body dynamics** on `SO(3)` with Euler's equations (including the Dzhanibekov / tumbling T-handle effect).
2. **One-parameter subgroup visualizations** — continuous rotation flows, matrix exponential orbits.
3. **Lie-Poisson dynamics** on dual Lie algebras — a sibling to the cotangent-bundle symplectic framework we have, needed whenever the phase space is a Poisson manifold rather than a canonical cotangent bundle.

Scope is **matrix Lie groups with finite matrix dimension**. Infinite-dimensional groups and abstract (non-matrix) Lie groups are explicitly out of scope.

## What the library already has (implementation can rely on)

- `math/linear-algebra/`: `Matrix` class (`Float64Array`-backed), `det`, `invert`, `multiply`, `transpose`, `cholesky`, symmetric `eigensym`. Use these for all matrix operations.
- `math/manifolds/`: `Manifold` interface with `dim`, `computeMetric`, optional `computeChristoffel`.
- `math/forms/`: `OneForm`, `TwoForm`. Forms are optional for this phase.
- `math/symplectic/`: `SymplecticManifold`, `cotangentBundle`, `SymplecticGradient`. The canonical Hamiltonian mechanics story for *canonical symplectic* systems. Rigid body is **not** canonical — it's Lie-Poisson — and needs its own bracket machinery that this phase builds.
- `math/ode/`: `rk4`, `gaussLegendre4`, `integrate`, `poincareSection`. For time stepping.
- `math/vectorfields/`: `VectorField` interface, `ArrowGlyphs` for instanced cone rendering.

## Design decisions, with rationale

### 1. Matrix Lie groups only, canonical storage is `Matrix`

Every group element is stored as a `math/linear-algebra/Matrix` of the group's representation size (3×3 for `SO(3)`, 2×2 complex — handled as 4×4 real — for `SU(2)`, etc.). Lie-algebra elements are stored as length-`dim` number arrays when possible (via a `hat`/`vee` pair converting to/from matrix form).

**Why matrices and not quaternions for `SO(3)`?** Consistency with the rest of the library. `Three.js.Quaternion` exists and can be used by rendering glue, but the math library's canonical form is the matrix. A single internal conversion at the render boundary beats two codepaths everywhere.

### 2. Lie algebra as `number[]` (hat/vee bridged)

Elements of `so(3)`, `su(2)`, `se(3)` etc. are stored as length-`dim` vectors (3 for `so(3)`, 3 for `su(2)`, 6 for `se(3)`). A `hat` function produces the matrix form when needed; `vee` is the inverse. This matches the "vectors as `number[]` / `Float64Array`" convention from `math/manifolds/`.

### 3. Rigid-body dynamics uses Lie-Poisson, not cotangent-bundle

`T*SO(3)` is 6-dim canonical symplectic, but for torque-free rigid body the physics factors through the 3-dim Lie-Poisson manifold `so(3)*` with bracket

```
{f, g}(L) = -⟨L, [∇f, ∇g]⟩ = -L · (∇f × ∇g)
```

This is odd-dimensional (3), so it isn't symplectic — it's *Poisson*. We build a parallel `PoissonManifold` primitive alongside `SymplecticManifold`, with `PoissonGradient(manifold, H)` producing the corresponding Hamiltonian vector field on the Poisson manifold. Both symplectic and Poisson structures are needed to cover mechanics; neither subsumes the other.

Motion on `so(3)*` lies on coadjoint orbits — here, the 2-spheres `|L| = const`. These are the beautiful picture for rigid-body dynamics.

### 4. Integration: splitting scheme for rigid body on `SO(3) × ℝ³`

The full rigid-body state is `(R, L)` with `R ∈ SO(3)`, `L ∈ ℝ³` (body-frame angular momentum). Equations:

```
dL/dt = L × Ω              where Ω = I⁻¹ L
dR/dt = R · hat(Ω)
```

`L` lives in `ℝ³` and evolves via an ODE (use `rk4` or `gaussLegendre4`). `R` must stay in `SO(3)`; naive vector integration drifts off the group. Solution: use the Lie-group step

```
R_{n+1} = R_n · exp(dt · hat(Ω_n))
```

The matrix exp keeps `R` exactly in `SO(3)` step to step. Combined with an accurate `L` integrator this gives clean long-run rigid-body motion.

## File layout

```
src/math/lie/
  types.ts              MatrixLieGroup, LieAlgebra element conventions
  hat.ts                hatSO3, veeSO3 — skew/unskew 3-vectors ↔ 3×3 matrices
  expSO3.ts             Rodrigues' formula for exp on so(3), log via its inverse
  SO3.ts                SO(3) implementing MatrixLieGroup
  PoissonManifold.ts    Generic Poisson bracket interface + PoissonGradient
  liePoisson.ts         Lie-Poisson bracket constructor from a MatrixLieGroup
  RigidBody.ts          Torque-free rigid body: Hamiltonian + splitting integrator
  index.ts
  README.md

demos/dzhanibekov/main.ts   Tumbling-box demo
```

`SU(2)` and `SE(3)` can be added in a follow-up phase; `SO(3)` + rigid body is enough for the first payoff.

## Interfaces (copy-pasteable)

```ts
// src/math/lie/types.ts

import type { Matrix } from '@/math/linear-algebra';

/**
 * A finite-dimensional matrix Lie group. The manifold's dimension equals
 * the Lie algebra's dimension; both are stored in `dim`. The matrix
 * representation is `matrixSize × matrixSize`.
 */
export interface MatrixLieGroup {
  /** Manifold / algebra dimension (3 for SO(3), SU(2); 6 for SE(3)). */
  readonly dim: number;

  /** Size of the matrix representation (3 for SO(3), 2 for SU(2)—but see note below). */
  readonly matrixSize: number;

  // --- Group operations (all on matrices of size matrixSize × matrixSize) ---

  /** `e` — the group identity as a matrix. */
  identity(): Matrix;

  /** `A · B`. */
  multiply(A: Matrix, B: Matrix): Matrix;

  /** `A⁻¹`. For `SO(n)` this is `Aᵀ`; implementations may exploit that. */
  inverse(A: Matrix): Matrix;

  // --- Algebra ↔ group ---

  /** Matrix exponential `exp: 𝔤 → G`. Input is a length-`dim` algebra vector. */
  exp(xi: number[]): Matrix;

  /**
   * Inverse of `exp` (a local diffeomorphism, well-defined near identity).
   * Returns a length-`dim` algebra vector.
   */
  log(g: Matrix): number[];

  // --- Algebra vector ↔ matrix (the "hat"/"vee" maps) ---

  /** `hat: ℝ^dim → 𝔤 ⊂ ℝ^{matrixSize × matrixSize}`. */
  hat(xi: number[]): Matrix;

  /** Inverse of `hat`: matrix-form algebra element → length-`dim` vector. */
  vee(X: Matrix): number[];

  // --- Lie-algebraic structure ---

  /**
   * Lie bracket `[ξ, η]` in the vector representation. For `so(n)` in
   * matrix form this is `ξη − ηξ`; expressed on the vector side it's
   * the hat-map of that commutator.
   */
  bracket(xi: number[], eta: number[]): number[];

  /**
   * Adjoint action `Ad_g(ξ) = g hat(ξ) g⁻¹`, returned in vector form.
   * For `SO(3)` this simplifies to `Ad_R(ξ) = R ξ` (since rotation acts
   * on the vector-form algebra by ordinary matrix-vector product).
   */
  adjoint(g: Matrix, xi: number[]): number[];
}
```

### `SO(3)` concrete implementation — hat, exp, log

```ts
// src/math/lie/hat.ts

import { Matrix } from '@/math/linear-algebra';

/**
 * hat: ℝ³ → so(3).
 *   hat([ω₀, ω₁, ω₂]) = [[  0,  −ω₂,  ω₁],
 *                        [ ω₂,    0, −ω₀],
 *                        [−ω₁,  ω₀,    0]]
 * Property: hat(ω) · v = ω × v.
 */
export function hatSO3(xi: number[]): Matrix {
  const [a, b, c] = xi;
  const m = new Matrix(3, 3);
  m.data[0] =  0; m.data[1] = -c; m.data[2] =  b;
  m.data[3] =  c; m.data[4] =  0; m.data[5] = -a;
  m.data[6] = -b; m.data[7] =  a; m.data[8] =  0;
  return m;
}

export function veeSO3(X: Matrix): number[] {
  // X = [[0, -c, b], [c, 0, -a], [-b, a, 0]]
  return [X.data[7], X.data[2], X.data[3]];
}
```

```ts
// src/math/lie/expSO3.ts

import { Matrix } from '@/math/linear-algebra';
import { hatSO3 } from './hat';

/**
 * Rodrigues' formula for exp on so(3).
 *   exp(hat(ω)) = I + sin(θ)/θ · hat(ω) + (1 − cos(θ))/θ² · hat(ω)²
 * where θ = |ω|.
 *
 * Uses Taylor expansion near θ ≈ 0 to avoid division by a small number.
 */
export function expSO3(xi: number[]): Matrix {
  const [a, b, c] = xi;
  const theta = Math.sqrt(a * a + b * b + c * c);

  const R = new Matrix(3, 3);
  R.data[0] = 1; R.data[4] = 1; R.data[8] = 1;   // start as identity

  if (theta < 1e-8) {
    // Taylor: exp(K) ≈ I + K + K²/2 for small θ.
    const K = hatSO3(xi);
    const K2 = K.multiply(K);
    for (let i = 0; i < 9; i++) {
      R.data[i] += K.data[i] + 0.5 * K2.data[i];
    }
    return R;
  }

  const K = hatSO3(xi);
  const K2 = K.multiply(K);
  const s = Math.sin(theta) / theta;
  const c2 = (1 - Math.cos(theta)) / (theta * theta);
  for (let i = 0; i < 9; i++) {
    R.data[i] += s * K.data[i] + c2 * K2.data[i];
  }
  return R;
}

/**
 * Inverse Rodrigues: log map on SO(3) near the identity.
 *   Given R, find ω such that exp(hat(ω)) = R.
 *   θ = arccos((tr(R) − 1) / 2)
 *   hat(ω) = (θ / (2 sin θ)) · (R − Rᵀ)
 *
 * Undefined at θ = π (antipodal rotation). For our demos this is not
 * reached — callers can guard if needed.
 */
export function logSO3(R: Matrix): number[] {
  const trR = R.data[0] + R.data[4] + R.data[8];
  const cosTheta = Math.max(-1, Math.min(1, (trR - 1) / 2));
  const theta = Math.acos(cosTheta);

  if (theta < 1e-8) {
    // Taylor: log(I + E) ≈ E for small E; for R near I we have
    // (R − Rᵀ)/2 ≈ hat(ω).
    return [
      0.5 * (R.data[7] - R.data[5]),
      0.5 * (R.data[2] - R.data[6]),
      0.5 * (R.data[3] - R.data[1]),
    ];
  }

  const s = theta / (2 * Math.sin(theta));
  return [
    s * (R.data[7] - R.data[5]),
    s * (R.data[2] - R.data[6]),
    s * (R.data[3] - R.data[1]),
  ];
}
```

```ts
// src/math/lie/SO3.ts

import { Matrix } from '@/math/linear-algebra';
import type { MatrixLieGroup } from './types';
import { hatSO3, veeSO3 } from './hat';
import { expSO3, logSO3 } from './expSO3';

/**
 * SO(3) — the group of 3×3 rotation matrices, `R Rᵀ = I`, `det R = 1`.
 *
 * Lie algebra so(3) = skew-symmetric 3×3 matrices, isomorphic to ℝ³ via
 * the hat map. Lie bracket on the vector side is the cross product.
 */
export const SO3: MatrixLieGroup = {
  dim: 3,
  matrixSize: 3,

  identity(): Matrix {
    const m = new Matrix(3, 3);
    m.data[0] = 1; m.data[4] = 1; m.data[8] = 1;
    return m;
  },

  multiply(A: Matrix, B: Matrix): Matrix {
    return A.multiply(B);
  },

  inverse(A: Matrix): Matrix {
    // R⁻¹ = Rᵀ for rotations.
    return A.transpose();
  },

  exp(xi: number[]): Matrix {
    return expSO3(xi);
  },

  log(g: Matrix): number[] {
    return logSO3(g);
  },

  hat: hatSO3,
  vee: veeSO3,

  bracket(xi: number[], eta: number[]): number[] {
    // [ξ, η] = ξ × η on so(3).
    return [
      xi[1] * eta[2] - xi[2] * eta[1],
      xi[2] * eta[0] - xi[0] * eta[2],
      xi[0] * eta[1] - xi[1] * eta[0],
    ];
  },

  adjoint(g: Matrix, xi: number[]): number[] {
    // Ad_R(ξ) = R · ξ (as vectors) on so(3).
    const v = g.mulVec(xi);
    return Array.from(v);
  },
};
```

### Poisson manifold + Lie-Poisson bracket

```ts
// src/math/lie/PoissonManifold.ts

import type { ManifoldDomain } from '@/math/manifolds';

/**
 * A Poisson manifold: a manifold equipped with a Poisson bivector `π`
 * such that the Poisson bracket `{f, g} = π(df, dg)` satisfies the
 * Jacobi identity. Unlike a symplectic manifold, `π` need not be
 * invertible — odd-dimensional Poisson manifolds are common (e.g.
 * `so(3)* = ℝ³`).
 *
 * The bracket is stored as a function that contracts two covectors
 * (gradients of scalar functions) at a point. For a Hamiltonian system
 * `dH`, the Hamiltonian vector field is `X_H^i = π^{ij}(p) ∂_j H`, and
 * for canonical coordinates `π` is the standard symplectic matrix.
 */
export interface PoissonManifold {
  readonly dim: number;
  getDomainBounds(): ManifoldDomain;

  /**
   * Poisson tensor `π^{ij}(p)` stored as a `dim × dim` antisymmetric
   * matrix flat-packed as `Float64Array(dim * dim)`. Callers use it
   * to compute `X_H^i = Σ_j π^{ij}(p) · ∂_j H`.
   */
  computePoissonTensor(p: number[]): Float64Array;
}
```

```ts
// src/math/lie/PoissonGradient.ts  (can live alongside PoissonManifold.ts)

import { Params } from '@/Params';
import type { Parametric } from '@/math/types';
import type { VectorField } from '@/math/vectorfields';
import type { DifferentiableScalarField } from '@/math/functions/types';
import type { ManifoldDomain } from '@/math/manifolds';
import type { PoissonManifold } from './PoissonManifold';

/**
 * Hamiltonian vector field on a Poisson manifold: `X_H^i = π^{ij} ∂_j H`.
 * Direct parallel to `SymplecticGradient` but for the Poisson case.
 */
export class PoissonGradient implements VectorField, Parametric {
  readonly dim: number;
  readonly params = new Params(this);
  private readonly manifold: PoissonManifold;
  private readonly H: DifferentiableScalarField;
  private readonly buf: Float64Array;

  constructor(manifold: PoissonManifold, H: DifferentiableScalarField) {
    if (manifold.dim !== H.dim) {
      throw new Error(`PoissonGradient: dim mismatch ${manifold.dim} vs ${H.dim}`);
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
```

```ts
// src/math/lie/liePoisson.ts

import type { MatrixLieGroup } from './types';
import type { PoissonManifold } from './PoissonManifold';
import type { ManifoldDomain } from '@/math/manifolds';

/**
 * Build the Lie-Poisson manifold `𝔤*` from a matrix Lie group `G`.
 *
 * Structure: the dual algebra `𝔤*` (identified with `ℝ^{dim}` by a fixed
 * inner product — for compact groups like `SO(n)` we use the Euclidean
 * inner product on the `hat`/`vee`-basis) with bracket
 *
 *   {f, g}(μ) = -⟨μ, [∇f, ∇g]⟩
 *
 * In components, with structure constants `c^k_{ij}`:
 *
 *   π^{ij}(μ) = -Σ_k c^k_{ij} · μ_k
 *
 * Specialization for `SO(3)` (structure constants = ε_{ijk}):
 *
 *   π^{ij}(μ) = -ε_{ijk} μ_k   ⇒   π =  [[  0,  μ₂, -μ₁],
 *                                         [-μ₂,   0,  μ₀],
 *                                         [ μ₁, -μ₀,   0]]
 *
 * and `{L_i, H}(μ) = -Σ_j π_{ij}(μ) ∂H/∂μ_j` reproduces `μ × ∇H`.
 *
 * Domain: unbounded in every coordinate.
 */
export function liePoissonManifold(G: MatrixLieGroup): PoissonManifold {
  const n = G.dim;
  return {
    dim: n,
    getDomainBounds: (): ManifoldDomain => ({
      min: new Array(n).fill(-Infinity),
      max: new Array(n).fill(Infinity),
    }),
    computePoissonTensor: (mu: number[]): Float64Array => {
      // Build π^{ij}(μ) = -Σ_k c^k_{ij} μ_k using the bracket on basis vectors.
      // For a matrix Lie group we can extract structure constants from
      // G.bracket(e_i, e_j), where e_i is the i-th standard basis vector.
      //
      // To avoid recomputing per call, implementations can cache c^k_{ij}
      // at construction time for a given G. Sketch of the per-call form:
      const pi = new Float64Array(n * n);
      const ei = new Array(n).fill(0);
      const ej = new Array(n).fill(0);
      for (let i = 0; i < n; i++) {
        ei.fill(0); ei[i] = 1;
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          ej.fill(0); ej[j] = 1;
          const bracket_ij = G.bracket(ei, ej);  // = Σ_k c^k_{ij} · e_k
          let s = 0;
          for (let k = 0; k < n; k++) s += bracket_ij[k] * mu[k];
          // Note the sign: π^{ij}(μ) = -⟨μ, [e_i, e_j]⟩ = -s.
          pi[i * n + j] = -s;
        }
      }
      return pi;
    },
  };
}
```

**Performance note for implementers:** the above `computePoissonTensor` body
rebuilds structure constants every call. For a real implementation, cache
`c^k_{ij}` at construction time — a `Float64Array(n³)` lookup that
`computePoissonTensor` contracts with `μ` via a single `O(n²·n)` sum.

### Rigid body

```ts
// src/math/lie/RigidBody.ts

import { Matrix } from '@/math/linear-algebra';
import type { DifferentiableScalarField } from '@/math/functions/types';
import type { ManifoldDomain } from '@/math/manifolds';
import type { Stepper } from '@/math/ode';
import { rk4 } from '@/math/ode';
import { SO3 } from './SO3';

/**
 * Torque-free rigid body with principal moments of inertia
 * `I = diag(I₁, I₂, I₃)`.
 *
 * Phase space is `SO(3) × ℝ³` (rotation × body-frame angular momentum).
 * Hamiltonian `H(L) = ½ Σᵢ Lᵢ² / Iᵢ` depends only on `L`; the `R`
 * dynamics are driven but do not feed back into the `L` equation.
 *
 * Splitting integrator per step:
 *   1. Advance L via `dL/dt = L × (I⁻¹ L)` using the given stepper (RK4).
 *   2. Advance R via `R ← R · exp(dt · hat(I⁻¹ L))`, using the new L.
 *
 * Step 2 keeps R exactly in SO(3) — no re-orthogonalization needed.
 */
export interface RigidBodyState {
  R: Matrix;       // 3×3 rotation matrix
  L: number[];     // length-3 body-frame angular momentum
}

export interface RigidBodyOptions {
  inertia: [number, number, number];  // principal moments I₁, I₂, I₃
  stepper?: Stepper;                   // default rk4 for L dynamics
}

/** Hamiltonian for `H(L) = ½ Σᵢ Lᵢ² / Iᵢ` on ℝ³ (as scalar field for Lie-Poisson use). */
export function rigidBodyHamiltonian(
  inertia: [number, number, number],
): DifferentiableScalarField {
  const [I1, I2, I3] = inertia;
  return {
    dim: 3,
    getDomain: (): ManifoldDomain => ({
      min: [-Infinity, -Infinity, -Infinity],
      max: [ Infinity,  Infinity,  Infinity],
    }),
    evaluate: (L) =>
      0.5 * (L[0] * L[0] / I1 + L[1] * L[1] / I2 + L[2] * L[2] / I3),
    computePartials: (L) => {
      const out = new Float64Array(3);
      out[0] = L[0] / I1;
      out[1] = L[1] / I2;
      out[2] = L[2] / I3;
      return out;
    },
  };
}

/**
 * One splitting step. Returns a *new* state (does not mutate inputs).
 */
export function rigidBodyStep(
  state: RigidBodyState,
  dt: number,
  options: RigidBodyOptions,
): RigidBodyState {
  const [I1, I2, I3] = options.inertia;
  const stepper = options.stepper ?? rk4;

  // 1. Advance L via Euler's equation dL/dt = L × (I⁻¹ L).
  const deriv = (L: number[]): number[] => {
    const Omega = [L[0] / I1, L[1] / I2, L[2] / I3];
    return [
      L[1] * Omega[2] - L[2] * Omega[1],
      L[2] * Omega[0] - L[0] * Omega[2],
      L[0] * Omega[1] - L[1] * Omega[0],
    ];
  };
  const Lnext = stepper(deriv, state.L, 0, dt);

  // 2. Advance R via Lie-group step using the new L's angular velocity.
  const OmegaNext = [Lnext[0] / I1, Lnext[1] / I2, Lnext[2] / I3];
  const dR = SO3.exp(OmegaNext.map((x) => x * dt));
  const Rnext = state.R.multiply(dR);

  return { R: Rnext, L: Lnext };
}
```

## Sanity checks

Land in a single smoke-test file, not tied to any demo.

**`SO(3)` basics:**
- `SO3.exp([0, 0, 0])` returns `I` to ~1e-12
- `SO3.exp([0, 0, π/2])` rotates `(1, 0, 0)` to `(0, 1, 0)` to 1e-10
- `SO3.log(SO3.exp(ξ))` recovers `ξ` for random `|ξ| < π − 0.1`
- `SO3.exp(ξ) · SO3.exp(−ξ) = I` to 1e-10
- `SO3.adjoint(R, ξ) = R · ξ` for random `R`, `ξ`
- `SO3.bracket([1,0,0], [0,1,0]) = [0, 0, 1]` (cross-product sanity)

**Lie-Poisson + PoissonGradient:**
- On `so(3)*`, Casimir `C(L) = |L|²` should have `dC/dt = 0` along any Hamiltonian flow (integrate for 100s, check `|L|²` drift is O(stepper error))
- Energy `H` should also be conserved to stepper accuracy

**Rigid body:**
- Principal-axis spin: init `L = (1, 0, 0)` is a fixed point of `dL/dt = L × Ω` for `I = diag(1,2,3)` — should stay at `(1, 0, 0)` indefinitely
- Near-intermediate-axis tumbling: init `L = (0.01, 1, 0)`, `I = diag(1, 2, 3)` → `L` trajectory on the energy-momentum sphere should qualitatively show the tumbling pattern (crossing the unstable saddle each period)
- Both `H` and `|L|²` conserved to stepper accuracy over 10,000+ steps
- `R` stays exactly in `SO(3)`: `R Rᵀ = I` and `det R = 1` to 1e-10 at all times

## Demo: Dzhanibekov / tumbling T-handle

**Goal:** the classic visualization of rigid-body instability on the intermediate axis. Two coupled views:

1. **3D box rotating** via the current `R ∈ SO(3)` — use `Three.js.Matrix4` fed from `SO3` matrix data. Render as a `BoxGeometry` with non-uniform dimensions (`2 × 1 × 0.5` for easy recognition of axes).
2. **Angular-momentum sphere** showing the coadjoint orbit `|L| = const`: a translucent sphere of radius `|L₀|`, with a bright dot tracking the current `L` and a `StreamLine` trail showing the trajectory.

**Interactive controls:**
- Principal moments `I₁, I₂, I₃` (three sliders; must stay positive; `I₁ < I₂ < I₃` to get the interesting case)
- Initial angular momentum direction (slider for angle away from intermediate axis; show both axes as markers)
- Play/pause; reset

**What to look for visually:**
- `L₀` exactly on `ê₂` (intermediate): unstable — any perturbation grows. `L` loops wildly across the sphere.
- `L₀` on `ê₁` or `ê₃` (extremal): stable. `L` stays near that axis.
- The box tumbles dramatically in physical 3D when the dot is far from the stable axes.
- Reset to same initial conditions → identical trajectory (confirming the integration is clean, not chaotic in a dissipative-pseudorandom sense).

**Approximate structure (~250 LOC):**
```
demos/dzhanibekov/main.ts
  - scene setup
  - box mesh rendering, apply R as a Matrix4
  - sphere mesh (semi-transparent)
  - L-tracking dot + StreamLine trail
  - I and L₀ sliders
  - animate loop: call rigidBodyStep per frame, update renderings
```

## Proposed implementation order

Each step independently shippable with its own smoke test.

1. **`hat.ts`, `expSO3.ts`** — ~80 LOC + tests. Sanity: Rodrigues round-trips.
2. **`SO3.ts`, `types.ts`** — ~60 LOC. Sanity: group axioms + adjoint identities.
3. **`PoissonManifold.ts`, `PoissonGradient.ts`** — ~80 LOC. Sanity: using a known 2-D symplectic structure (which is a special case of Poisson), `PoissonGradient` reproduces pendulum dynamics identical to `SymplecticGradient`.
4. **`liePoisson.ts`** — ~60 LOC. Sanity: Jacobi identity check on 3-vector Poisson bracket from `SO3`.
5. **`RigidBody.ts`** — ~60 LOC. Sanity: principal-axis stability + tumbling quality + `H`, `|L|²` conservation.
6. **`demos/dzhanibekov/main.ts`** — ~250 LOC. Visual.

Total library code: ~340 LOC. Demo: ~250 LOC. One session each for Phase 1–5, probably one session for the demo.

## What this phase does NOT build

- **`SU(2)`** (follow-up): 2×2 unitary matrices, Pauli-matrix basis, double-covers `SO(3)`. Adds the connection to Hopf (which is a principal `SU(2)`-bundle). Straightforward once `SO(3)` is in.
- **`SE(3)`** (follow-up): rigid motions in 3D. 6-dim. Needed for full rigid-body-with-translation, robotics.
- **Symplectic reduction** (later): Noether's theorem, moment map, reduced phase space. Needs the above plus group-action infrastructure.
- **General Lie groups** (not planned): abstract Lie groups without a matrix representation. Matrix groups cover everything we want to animate.
- **Representations** (not planned): this is mostly algebraic/computational, low visual payoff.
- **Infinite-dimensional groups** (not planned): diffeomorphism groups, loop groups. Way out of scope.

## Open design questions (decide during implementation)

1. **Storage of `SU(2)`**: complex 2×2 matrix packed as 4 real (a, b, c, d) via `a + bi` vs `c + di` vs standard quaternion `(w, x, y, z)`. Prefer whichever is cleanest; likely matrix form for consistency, with a helper for `Three.js.Quaternion` conversion at rendering time.

2. **Caching structure constants**: `liePoissonManifold` should cache `c^k_{ij}` at construction rather than recomputing per `computePoissonTensor` call. Don't ship without caching.

3. **Lie-group stepper ergonomics**: should we add a `lieGroupStepper` utility that takes `(state, Lie algebra velocity) → new state` as a combinator, generalizing the second half of `rigidBodyStep`? Worth doing if SE(3) body dynamics land. Defer for phase A.

4. **`MatrixLieGroup` as a const vs class**: `SO3` is exported as a `const` implementing the interface. This is fine for SO(3) (no parameters), but groups with parameters (like `SO(n)` for variable `n`) would need a class or factory. Don't over-engineer: add `SO(n)` only when a demo needs it.

## Success criteria

- All smoke tests pass with the tolerances specified above.
- Dzhanibekov demo runs at 60 FPS with box tumbling visible and L trail filling the ellipsoid-intersection curves on the sphere.
- Energy and angular momentum conserved to integrator accuracy over at least 10,000 frames.
- The `MatrixLieGroup` interface composes cleanly with the existing `math/ode` and `math/vectorfields` stacks — adding `SU(2)` or `SE(3)` later should not require interface changes.
