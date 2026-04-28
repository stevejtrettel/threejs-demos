# Lie groups, Lie algebras, Poisson structures, and symmetric spaces — plan

**Date:** 2026-04-22 (updated as phases land)
**Status:** phases 1 and 2 shipped; phase 3 queued
**Supersedes:** [`lie-groups.md`](./lie-groups.md) (the SO(3)-only plan; its phase-1 code sketches are still authoritative and referenced below)
**Prerequisite for:** rigid-body dynamics, gyroscope/spinning-top demos, symplectic reduction, coadjoint-orbit visualizations, holonomy demos, Möbius/hyperbolic-geometry demos, symmetric-space geometry, future gauge-theory work

## What's shipped (as of writing)

**Phase 1 — as planned, plus three small additions driven by demo needs:**

- `MatrixLieGroup` abstract base class with defaulted `bracket`, `adjoint`, `coadjoint`, `leftTranslate`, `rightTranslate`, `multiply`. (Later tweak: `bracket` uses `this.multiply` so per-group overrides propagate — essential for groups with non-standard storage like `SU(2)`.)
- `SO(3)` with closed-form `hat` / `vee`, Rodrigues `exp`, inverse-Rodrigues `log`, cross-product `bracket`, matrix-vector `adjoint` / `coadjoint`.
- `PoissonManifold` interface + `PoissonGradient` + `liePoissonManifold` with cached structure constants.
- `RigidBody` with torque-free splitting integrator.
- `so3ToMatrix4` rendering glue.
- **Added along the way:** `SO(2)` (abelian, all closed form; needed for holonomy demos).
- **Added along the way:** `parallelTransportOperator` in `math/manifolds/` — returns the transport operator as an SO(n) matrix in orthonormal frames at each sample. Consumed by the sphere-holonomy and graph-holonomy rewrites.
- **Added along the way:** optional `torque?: (R, L) => number[]` on `rigidBodyStep` — enables the spinning-top demo without forking `RigidBody`.

**Phase 2 — as planned:**

- `SU(2)` with quaternion storage in a `Matrix(2, 2)` shell; closed-form `exp` / `log` / `inverse`; overrides `multiply` with quaternion arithmetic. Double cover of `SO(3)` verified in smoke tests (`Ad_q(v) = Ad_{−q}(v) = SO3.exp(ξ)·v`).
- `SE(3)` with standard 4×4 homogeneous storage; closed-form `exp` with left-Jacobian; closed-form `inverse`. Bracket verified against the semidirect-product formula.
- `padeExp` — generic Padé-3 exp with scaling-and-squaring. Available as a utility, not forced as the base-class default.
- `polar` factorization (`A = Q·P` via `eigensym(AᵀA)`).
- `so3ToQuaternion` (Shepperd's algorithm), `se3ToMatrix4`, `su2ToQuaternion` — THREE.js rendering glue.

**Added after phase 2:**

- `SE(2)` — 3-dim planar rigid motions. 3×3 homogeneous storage, closed-form exp with 2D left-Jacobian. Completes the `SE` story.
- `stepBody`, `stepWorld` — generic Lie-group integration-step combinators. Extract the `R ← exp(dt · ξ) · R` pattern that was inlined in Dzhanibekov, rolling-ball, and spinning-top.

**Smoke tests:** 54 checks cover Rodrigues, double cover, semidirect bracket, Padé-vs-closed-form, polar reconstruction + orthogonality, stepper preservation of SO(3), Lie-Poisson Jacobi, and long-run conservation laws from the rigid-body splitting integrator.

**What's intentionally still out (deferred, no consumer yet):**

- Generic Padé `log` via inverse scaling-and-squaring — deferred because every concrete group shipped so far has a closed-form log.
- "Apply `R(t)` to an initial v̂ and push back to coord basis" utility on `ParallelTransportOperatorResult` — still only two consumers; rule of three says wait.

## Goal

Build out Lie-theoretic infrastructure as a first-class domain in the math library, broad enough to serve the animation use cases the library is actually chasing: rigid-body physics, bundle holonomy, hyperbolic geometry, symmetric spaces, and group-theoretic coordinate systems. Explicitly *not* a general abstract-algebra package — this is the visualization-grade subset that makes beautiful demos possible.

## Scope

**In scope.**

- **Matrix Lie groups only**, canonical storage as `math/linear-algebra/Matrix`. Covers SO(n), SU(n), SE(n), SL(n,ℝ), SL(n,ℂ), Sp(2n,ℝ), SO(p,q) — everything the library will want to animate.
- **Lie algebras** as length-`dim` `number[]`s, bridged to matrix form by `hat`/`vee`.
- **Poisson manifolds** as a sibling to `SymplecticManifold`, with `PoissonGradient` paralleling `SymplecticGradient`.
- **Lie-Poisson structure** on `𝔤*` built from a `MatrixLieGroup`.
- **Group actions** (left, right, adjoint, coadjoint) as first-class.
- **Factorizations** (polar / KAK, Iwasawa / KAN, classification of elements).
- **Rendering glue** — SO(3) → `THREE.Quaternion`, SE(3) → `THREE.Matrix4`.
- **Symmetric spaces** as a *sibling* top-level folder `math/symmetric-spaces/` that implements `Manifold` and consumes `lie/`.

**Out of scope.**

- Abstract (non-matrix) Lie groups.
- Infinite-dimensional groups (diffeomorphism groups, loop groups, current groups).
- Full representation theory — Young tableaux, Clebsch-Gordan, character tables. Algebraic, low visual payoff.
- Root systems / Weyl groups as a standalone product — add only if a Schubert-calculus demo shows up.
- General non-symmetric eigendecomposition (library-wide limitation, same as `linear-algebra`).
- Gauge-theory scaffolding (𝔤-valued forms, curvature 2-form `F = dA + A∧A`) — separate future phase.
- Moment maps and full symplectic reduction — separate future phase; needs action + Hamiltonian machinery, but only once a demo wants it.

## Why this is worth the build-out

### Use cases, organized by what they demand

**Mechanics / dynamics** — the plan's immediate payoff.
- Torque-free rigid body on SO(3): Dzhanibekov / tumbling T-handle.
- Spinning top, gyroscope (SO(3) with potential).
- Free rigid body with translation on SE(3) — objects in flight.
- Lie-Poisson flow for *arbitrary* Hamiltonians on `𝔤*`, not just rigid body — same machinery covers very different physics.

**Group geometry itself.**
- One-parameter subgroups `t ↦ exp(tξ)` as orbits.
- Exponential map as "polar chart at identity."
- Visualizing SO(3) ≅ ℝℙ³, SU(2) ≅ S³.
- Left- and right-invariant vector fields on G.
- Bi-invariant geodesics.

**Group actions + orbits.**
- Adjoint orbits in 𝔤, coadjoint orbits in 𝔤* (the sphere picture for rigid body is a special case).
- G acting on ℝⁿ, Sⁿ — orbit foliations.
- Möbius transformations on ℍ², Ĉ.
- Kleinian / Fuchsian group action, limit sets.

**Bundles and holonomy — directly plugs into work already in progress.**
- `math/manifolds/parallelTransport.ts` (new, uncommitted) + `demos/sphere-holonomy/` + `demos/graph-holonomy/` are currently computing holonomy by hand. Holonomy around a loop **is** a group element in SO(n). Lie infrastructure formalizes and sharpens what those demos already do.
- `math/hopf/` is a principal SU(2)-bundle over S². Once SU(2) lands, the bundle language becomes first-class.

**Kinematics / interpolation.**
- SLERP as a bi-invariant geodesic.
- Rotation averaging, rotation splines.
- Rolling without slipping — connects to `linkages/`: a ball rolling on a surface traces a path in SO(3) via a non-holonomic distribution.

**Hyperbolic geometry and Möbius maps (SL(2,ℝ), SL(2,ℂ)).**
- PSL(2,ℝ) acting on ℍ² by Möbius; connection to existing `lattices/` and modular forms work.
- PSL(2,ℤ) fundamental domain, Ford circles, modular flow.
- Geodesic and horocycle flow on ℍ²/Γ.
- Kleinian groups, limit sets, hyperbolic 3-manifolds (SL(2,ℂ)).
- Elliptic / parabolic / hyperbolic / loxodromic classification of Möbius transformations — `|tr|` decides.

**Symmetric spaces.**
- ℍ² = SL(2,ℝ)/SO(2), ℍ³ = SL(2,ℂ)/SU(2), Sⁿ = SO(n+1)/SO(n).
- Closed-form geodesics `γ(t) = exp(tX)·p₀` for `X ∈ 𝔭`.
- Closed-form curvature `R(X,Y)Z = −[[X,Y], Z]` on 𝔭.
- Invariant metric for free from the Killing form (or K-invariant form on 𝔭).
- Later: CPⁿ (Kähler), Siegel upper half space Sp(2n,ℝ)/U(n) (moduli of abelian varieties — connects to elliptic-curve work).

## Architectural decisions, with rationale

### 1. `lie/` and `symmetric-spaces/` are **siblings**, not parent/child

```
src/math/
  lie/                  groups, algebras, Poisson, actions, factorizations
  symmetric-spaces/     Riemannian geometry of G/K; sibling consumer of lie/
  ...
```

A symmetric space is fundamentally a manifold — it implements `Manifold` and the rest of the library consumes it as such without knowing about the group-theoretic origin. It happens to be *built from* Lie data, so `symmetric-spaces/` imports from `lie/`, but it is its own top-level domain and neither conceptually nor API-wise belongs underneath.

### 2. Matrix Lie groups only; canonical storage is `Matrix`

Every group element is stored as a `math/linear-algebra/Matrix` of the group's representation size (3×3 for SO(3), 2×2 complex — held as 4×4 real or as two Float64 pairs — for SU(2), 4×4 for SE(3), 2×2 for SL(2,ℝ), etc.). Lie-algebra elements are `number[]` of length `dim`, bridged by `hat`/`vee`.

**Why matrices and not quaternions for SO(3)?** Consistency with the library's `Matrix` abstraction, which already supports the operations we need. `THREE.Quaternion` is used by rendering glue only. A single internal conversion at the render boundary beats two codepaths everywhere.

### 3. `MatrixLieGroup` is an **abstract base class**, not just an interface

Concrete groups supply `hat`, `vee`, `matrixSize`, `dim`, and optionally closed-form `exp` / `log` / `adjoint`. The base class provides generic fallbacks:

- `exp` via **Padé approximation + scaling-and-squaring** (the industry-standard numerically stable algorithm; ~60 LOC).
- `log` via a well-conditioned series, or generic Schur-based for rougher inputs.
- `bracket` as `hat(ξ)·hat(η) − hat(η)·hat(ξ)` followed by `vee`.
- `adjoint(g, ξ) = vee(g · hat(ξ) · g⁻¹)`.
- `coadjoint(g, μ)` as the transpose-inverse of `adjoint` under a chosen inner product.

Closed-form overrides land for SO(3) (Rodrigues), SU(2) (quaternion-style), SE(3) (exp has a translation-correction term), and SL(2,ℝ) / SL(2,ℂ) where available. Everything else uses the generic path and is plenty fast for demos.

### 4. Lie algebra = `number[]` of length `dim`, bridged via `hat` / `vee`

Elements of so(3), su(2), se(3), sl(2,ℝ), etc. are stored as length-`dim` vectors (3 for so(3)/su(2), 6 for se(3)/sl(2,ℂ), 3 for sl(2,ℝ)). Matches the existing "vectors as `number[]`" convention in `math/manifolds/`.

### 5. Rigid body uses Lie-Poisson, not the canonical cotangent bundle

`T*SO(3)` is 6-D canonical symplectic, but for torque-free rigid body the physics factors through the 3-D Lie-Poisson manifold `so(3)*` with bracket `{f, g}(L) = −⟨L, [∇f, ∇g]⟩`. This is odd-dimensional (3), so it isn't symplectic — it's *Poisson*. Build `PoissonManifold` as a sibling to `SymplecticManifold`, with `PoissonGradient` producing the Hamiltonian vector field on a Poisson manifold. Both structures are needed; neither subsumes the other.

### 6. Integration on SO(3) uses a Lie-group splitting step

For the `(R, L)` rigid-body state:

```
dL/dt = L × (I⁻¹ L)                      — ODE in ℝ³, solve with rk4
R_{n+1} = R_n · exp(dt · hat(I⁻¹ L_n))   — Lie-group step, exact in SO(3)
```

The matrix exp keeps `R` exactly on `SO(3)` step to step; no re-orthogonalization.

### 7. `liePoissonManifold` caches structure constants at construction

The Poisson tensor is linear in μ: `π^{ij}(μ) = −Σ_k c^k_{ij} · μ_k`. The constants `c^k_{ij}` depend on the group, not on μ, so compute them once (an `n²` loop of `G.bracket(e_i, e_j)`) into a `Float64Array(n³)`, and have `computePoissonTensor(μ)` do one tight triple-sum contraction with zero allocations. Any uncached version hemorrhages garbage in inner loops (arrow-glyph visualization of the vector field, RK4 steps, etc.).

### 8. Actions are first-class in the interface

`MatrixLieGroup` carries not just multiplication and exp, but `leftTranslate`, `rightTranslate`, `adjoint`, `coadjoint` as top-level methods. Adding them now locks the interface so SE(3), SU(2), SL(2,ℝ) drop in without a rewrite, and later symmetric-space / moment-map code can assume them.

### 9. Factorizations live in `lie/factorizations/`

Polar (KAK), Iwasawa (KAN), and element-classification utilities are cross-group; SL(2,ℝ) and SL(2,ℂ) provide closed forms, larger groups use generic iterative methods. Factorizations expose coordinate systems: Iwasawa on SL(2,ℝ) *is* upper-half-plane coordinates, polar *is* SVD. They're not just algebra — they're the map between abstract group elements and geometric pictures.

### 10. Symmetric spaces implement `Manifold`

`SymmetricSpace` extends `Manifold` — `dim`, `getDomainBounds`, `computeMetric`, optional analytic `computeChristoffel`, **plus** basepoint, involution `σ`, Cartan decomposition `𝔤 = 𝔨 ⊕ 𝔭`, and closed-form `geodesic(p₀, v, t) = exp(t·hat(v))·p₀` for `v ∈ 𝔭`. Downstream consumers see a Riemannian manifold with extra-efficient geodesics; group theory stays encapsulated unless they want it.

## Folder layout

```
src/math/lie/
  types.ts                 MatrixLieGroup (abstract base), LieAlgebraElement conventions, actions
  MatrixLieGroupBase.ts    abstract class with generic exp/log/bracket/adjoint/coadjoint fallbacks

  exp/
    pade.ts                generic Padé scaling-and-squaring matrix exp + log
    expSO3.ts              Rodrigues (phase 1)
    expSE3.ts              closed-form exp on se(3) (phase 2)
    expSU2.ts              quaternion-style closed form (phase 2)
    expSL2R.ts             closed form for sl(2, ℝ) via trace-based dispatch (phase 3)

  groups/
    SO3.ts                 phase 1
    SE3.ts                 phase 2
    SU2.ts                 phase 2
    SL2R.ts                phase 3
    SL2C.ts                phase 3
    SpectralFallback.ts    generic class for any (hat/vee)-equipped matrix group — phase 2

  hat/
    hatSO3.ts, veeSO3.ts   phase 1
    hatSE3.ts, veeSE3.ts   phase 2
    hatSU2.ts, veeSU2.ts   phase 2
    hatSL2R.ts, veeSL2R.ts phase 3

  factorizations/
    polar.ts               polar / KAK decomposition — phase 2
    iwasawa.ts             KAN decomposition — phase 3
    classify.ts            elliptic/parabolic/hyperbolic/loxodromic — phase 3

  PoissonManifold.ts       sibling to SymplecticManifold — phase 1
  PoissonGradient.ts       sibling to SymplecticGradient — phase 1
  liePoisson.ts            build Lie-Poisson structure on 𝔤* from a MatrixLieGroup — phase 1

  RigidBody.ts             torque-free rigid-body Hamiltonian + splitting integrator — phase 1

  render/
    so3ToMatrix4.ts        phase 2
    so3ToQuaternion.ts     phase 2
    se3ToMatrix4.ts        phase 2

  index.ts
  README.md


src/math/symmetric-spaces/        (phase 4 — sibling to lie/, not under it)
  types.ts                 SymmetricSpace interface extending Manifold
  cartan.ts                Cartan decomposition helpers
  geodesics.ts             exp-based closed-form geodesics
  curvature.ts             R(X,Y)Z = −[[X,Y], Z] on 𝔭
  spaces/
    H2.ts                  upper half plane and Poincaré disk models of SL(2,ℝ)/SO(2)
    H3.ts                  SL(2,ℂ)/SU(2)
    Sn.ts                  SO(n+1)/SO(n)
    RHn.ts                 SO(n,1)/SO(n) — generic hyperbolic n-space
  index.ts
  README.md


demos/
  dzhanibekov/                   phase 1 payoff
  mobius-upper-half-plane/       phase 3 payoff
  mobius-riemann-sphere/         phase 3 payoff
  psl2z-fundamental-domain/      phase 3–4 (consumes lattices/ + lie/)
  hyperbolic-tiling-H2/          phase 4
  hopf-as-SU2-bundle/            phase 2, rewrites existing hopf/ demo in bundle language
  holonomy-as-SO3-element/       phase 1–2, rewrites sphere-holonomy/ + graph-holonomy/
```

## Phased roadmap

Each phase is independently shippable, with its own smoke tests and (where appropriate) a visual demo.

### Phase 1 — SO(3) + rigid body

**Deliverables.** See [`lie-groups.md`](./lie-groups.md) sections "File layout," "Interfaces," "SO(3) concrete implementation," "Poisson manifold + Lie-Poisson bracket," "Rigid body," and "Demo: Dzhanibekov / tumbling T-handle" — those code sketches are still authoritative for this phase.

- `types.ts`, `MatrixLieGroupBase.ts` (skeleton only, no fallbacks yet)
- `hat/hatSO3.ts`, `hat/veeSO3.ts`
- `exp/expSO3.ts` — Rodrigues + logSO3
- `groups/SO3.ts`
- `PoissonManifold.ts`, `PoissonGradient.ts`
- `liePoisson.ts` with cached structure constants
- `RigidBody.ts`
- `render/so3ToMatrix4.ts` (enough glue to drive the demo)
- `demos/dzhanibekov/`
- Smoke test file — Rodrigues round-trips, group axioms, Jacobi identity, principal-axis stability, H + |L|² conservation, `R Rᵀ = I` / `det R = 1` to 1e-10 over 10k frames.

**Total.** ~340 LOC library + ~250 LOC demo. Roughly 5 sessions.

### Phase 2 — SU(2), SE(3), generic matrix exp, polar, rendering

- `exp/pade.ts` — generic Padé scaling-squaring exp + log. All subsequent groups get exp / log for free via the base class if they don't override.
- `MatrixLieGroupBase.ts` fleshed out — generic `bracket`, `adjoint`, `coadjoint`, `leftTranslate`, `rightTranslate` implementations.
- `hat/hatSE3.ts`, `exp/expSE3.ts`, `groups/SE3.ts` — 6-D, closed-form exp with translation-correction Jacobian.
- `hat/hatSU2.ts`, `exp/expSU2.ts`, `groups/SU2.ts` — 2×2 complex, Pauli basis, double cover of SO(3).
- `factorizations/polar.ts` — `g = k·a·k'`, via symmetric-eigendecomposition of `gᵀg` (we have `eigensym`).
- `render/so3ToQuaternion.ts`, `render/se3ToMatrix4.ts`.
- Demo rewrite: express Hopf as explicit principal `SU(2)`-bundle, rewrite `sphere-holonomy/` to report holonomy as an explicit `SO(3)` element.
- Smoke tests: SE(3) round-trips, SU(2) → SO(3) double-cover map, polar decomposition reconstructs, Hopf bundle structure holds.

**Total.** ~500 LOC. Roughly 4–5 sessions.

### Phase 3 — SL(2,ℝ), SL(2,ℂ), Iwasawa, classification, Möbius

- `hat/hatSL2R.ts`, `exp/expSL2R.ts`, `groups/SL2R.ts` — exp has three cases by sign of `det(ξ)` (elliptic / parabolic / hyperbolic).
- `hat/hatSL2C.ts`, `groups/SL2C.ts` — falls back to generic Padé exp, closed form for matrix log.
- `factorizations/iwasawa.ts` — `g = k·a·n` for SL(2,ℝ), closed form.
- `factorizations/classify.ts` — elliptic / parabolic / hyperbolic / loxodromic by trace.
- Möbius action helpers — `mobius(g, z)` for both SL(2,ℝ) acting on ℍ² and SL(2,ℂ) acting on Ĉ.
- Demos: `mobius-upper-half-plane`, `mobius-riemann-sphere`, `psl2z-fundamental-domain` (consumes `lattices/` + `lie/`).
- Smoke tests: elliptic/parabolic/hyperbolic exp matches classification, Iwasawa reconstructs, Möbius action satisfies cocycle `g·(h·z) = (gh)·z`.

**Total.** ~400 LOC library + ~600 LOC demo. Roughly 5–6 sessions.

### Phase 4 — `math/symmetric-spaces/`

New top-level sibling folder.

- `types.ts` — `SymmetricSpace extends Manifold`, with basepoint, involution `σ: G → G`, Cartan decomposition data `𝔤 = 𝔨 ⊕ 𝔭`.
- `cartan.ts` — helper to build Cartan data from a `MatrixLieGroup` + subgroup specification.
- `geodesics.ts` — closed-form `geodesic(p₀, v, t) = exp(t·hat(v))·p₀`.
- `curvature.ts` — `R(X, Y)Z = −[[X, Y], Z]` on `𝔭`.
- Concrete spaces: `H2` (upper half + Poincaré disk), `H3`, `Sn`, `RHn`.
- Demos: `hyperbolic-tiling-H2`, geodesic flow on ℍ², comparison of symmetric-space geodesic (closed form) vs numeric `GeodesicIntegrator` (validation).
- Smoke tests: constant sectional curvature ±1, geodesic reversal, distance triangle inequality, `computeMetric` is G-invariant.

**Total.** ~350 LOC library + ~400 LOC demo. Roughly 4 sessions.

### Phase 5+ — deferred, demand-driven

Pick up when a specific demo motivates:

- **Sp(2n, ℝ)** — symplectic linear group. Phase space symmetries, classical mechanics reductions.
- **SO(p, q)** — pseudo-orthogonal; Lorentz SO(1, 3)⁺ is an SL(2,ℂ) double quotient.
- **CPⁿ** as a symmetric space — Kähler geometry.
- **Siegel upper half space** Sp(2n,ℝ)/U(n) — moduli of abelian varieties, connects to the `lattices/` / elliptic-curve work.
- **Moment maps and symplectic reduction** — Noether, reduced phase spaces.
- **Gauge-theory scaffolding** — 𝔤-valued differential forms, curvature `F = dA + A∧A`. Probably a small addition to `forms/` + `lie/`, not a new folder.
- **Representation-theory machinery** — only if a specific algebraic-visualization demo demands it.

## Core interface sketches

### `MatrixLieGroup` — abstract base class

```ts
// src/math/lie/types.ts

import type { Matrix } from '@/math/linear-algebra';

/**
 * A finite-dimensional matrix Lie group. Manifold / algebra dimension is
 * `dim`; the matrix representation is `matrixSize × matrixSize`.
 *
 * Concrete groups extend `MatrixLieGroupBase`, supplying `hat`/`vee` and
 * optional closed-form overrides for `exp` / `log` / `adjoint`. The base
 * class provides generic fallbacks (Padé scaling-squaring, commutator
 * bracket, conjugation-based adjoint).
 */
export abstract class MatrixLieGroup {
  abstract readonly dim: number;
  abstract readonly matrixSize: number;

  // --- Required overrides ---
  abstract hat(xi: number[]): Matrix;
  abstract vee(X: Matrix): number[];
  abstract identity(): Matrix;

  // --- Default implementations; overridable for closed-form speed ---

  /** `A · B`. Default: delegate to `Matrix.multiply`. */
  multiply(A: Matrix, B: Matrix): Matrix {
    return A.multiply(B);
  }

  /** `A⁻¹`. Default: generic LU inverse. Override for e.g. SO(n) (Aᵀ). */
  inverse(A: Matrix): Matrix {
    return A.invert();
  }

  /** Matrix exp. Default: Padé scaling-squaring on `hat(xi)`. */
  exp(xi: number[]): Matrix {
    return padeExp(this.hat(xi));
  }

  /** Matrix log. Default: Padé-based log; overridable. */
  log(g: Matrix): number[] {
    return this.vee(padeLog(g));
  }

  /** Lie bracket `[ξ, η]` — default: vee(hat(ξ)·hat(η) − hat(η)·hat(ξ)). */
  bracket(xi: number[], eta: number[]): number[] {
    const X = this.hat(xi);
    const Y = this.hat(eta);
    return this.vee(X.multiply(Y).add(Y.multiply(X).scale(-1)));
  }

  /** Adjoint action `Ad_g(ξ) = vee(g · hat(ξ) · g⁻¹)`. */
  adjoint(g: Matrix, xi: number[]): number[] {
    return this.vee(g.multiply(this.hat(xi)).multiply(this.inverse(g)));
  }

  /**
   * Coadjoint action `Ad*_g(μ)`. Default: transpose-inverse of adjoint
   * under the standard inner product on ℝ^dim.
   */
  coadjoint(g: Matrix, mu: number[]): number[] {
    // Ad*_g = (Ad_{g⁻¹})ᵀ on the μ side — implemented by building the
    // adjoint matrix once and transposing.
    const n = this.dim;
    const ginv = this.inverse(g);
    const out = new Array(n).fill(0);
    const ej = new Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      ej.fill(0);
      ej[j] = 1;
      const col = this.adjoint(ginv, ej);   // j-th column of Ad_{g⁻¹}
      for (let i = 0; i < n; i++) out[i] += col[i] * mu[j];
    }
    return out;
  }

  /** Left translation on the group itself: `L_g(h) = g · h`. */
  leftTranslate(g: Matrix, h: Matrix): Matrix {
    return g.multiply(h);
  }

  /** Right translation: `R_g(h) = h · g`. */
  rightTranslate(g: Matrix, h: Matrix): Matrix {
    return h.multiply(g);
  }
}
```

### Concrete group sketches

SO(3), hat/vee, Rodrigues, logSO3: see [`lie-groups.md`](./lie-groups.md), "`SO(3)` concrete implementation — hat, exp, log" section — those code sketches port directly to this layout (wrap in `class SO3 extends MatrixLieGroup`).

### PoissonManifold, PoissonGradient, liePoisson

See [`lie-groups.md`](./lie-groups.md), "Poisson manifold + Lie-Poisson bracket" section. Two deltas from the old plan:

1. `liePoissonManifold(G)` **must** cache structure constants at construction — see rationale section 7 above. The unoptimized inline version in the old doc is a reference sketch, not the shippable code.
2. `PoissonGradient`'s structure is identical to `SymplecticGradient`; they should live in sibling files and share doc-comment style.

### SymmetricSpace (phase 4)

```ts
// src/math/symmetric-spaces/types.ts

import type { Manifold, ManifoldDomain } from '@/math/manifolds';
import type { Matrix } from '@/math/linear-algebra';
import type { MatrixLieGroup } from '@/math/lie';

/**
 * A Riemannian symmetric space M = G/K.
 *
 * Built from a matrix Lie group `G`, a closed subgroup `K` specified by
 * a Cartan involution σ: G → G (fixed-point set = K, eigenspaces of
 * dσ on 𝔤 give the decomposition 𝔤 = 𝔨 ⊕ 𝔭).
 *
 * Implements `Manifold`: every consumer that integrates, parallel-
 * transports, or renders on a Riemannian manifold works unmodified.
 *
 * Extra structure beyond `Manifold`:
 *  - `basepoint`: a reference point p₀ (usually the coset [e·K]).
 *  - `geodesic(p₀, v, t) = exp(t · hat(v)) · p₀` — closed form, no ODE.
 *  - Curvature R(X, Y)Z = −[[X, Y], Z] on 𝔭 — closed form from Lie bracket.
 */
export interface SymmetricSpace extends Manifold {
  readonly group: MatrixLieGroup;
  readonly basepoint: Matrix;              // group element representing p₀

  /** Is `X ∈ 𝔤` in the 𝔭 summand? */
  isInP(xi: number[]): boolean;

  /**
   * Closed-form geodesic starting at `p₀` with tangent direction `v ∈ T_{p₀} M`.
   * For symmetric spaces, T_{p₀} M ≅ 𝔭, and γ(t) = exp(t · hat(v)) · p₀.
   */
  geodesicFromBasepoint(v: number[], t: number): Matrix;

  /**
   * Curvature operator R(X, Y)Z at the basepoint, with X, Y, Z ∈ 𝔭.
   * Equals −[[X, Y], Z] (Lie bracket twice, structure constants contracted).
   */
  curvatureAtBasepoint(X: number[], Y: number[], Z: number[]): number[];
}
```

## Sanity checks

Collected per-phase; each lands as a smoke-test file, not tied to any demo.

**Phase 1 — SO(3) + Lie-Poisson + rigid body.** As in [`lie-groups.md`](./lie-groups.md), "Sanity checks" section.

**Phase 2 — SE(3), SU(2), polar, generic exp.**
- `padeExp` matches `expSO3` to 1e-12 on so(3) inputs.
- `SE3.exp([0,0,0, tx,ty,tz])` = pure translation (`R = I`, `t = (tx,ty,tz)`).
- `SE3.exp(ξ) · SE3.exp(−ξ) = I` to 1e-10.
- `SU(2) → SO(3)` double cover: for `q = SU2.exp(ξ/2)`, the associated rotation equals `SO3.exp(ξ)`.
- Polar decomposition: `g = k · a · k'` reconstructs to `g`, `k, k' ∈ K`, `a` diagonal.

**Phase 3 — SL(2,ℝ), SL(2,ℂ), Iwasawa, classification.**
- `SL2R.exp(ξ)` matches `padeExp(hat(ξ))` to 1e-10 in all three trace regimes.
- Iwasawa `g = k·a·n` reconstructs `g`; `k ∈ SO(2)`, `a` diagonal positive, `n` upper-unipotent.
- Classification: constructed elliptic/parabolic/hyperbolic elements land in the right buckets.
- Möbius action cocycle: `(gh)·z = g·(h·z)` for random `g, h ∈ SL(2,ℝ)`, `z ∈ ℍ²`.

**Phase 4 — symmetric spaces.**
- ℍ² has constant sectional curvature −1 (computed from `curvatureAtBasepoint`).
- Sⁿ has constant sectional curvature +1.
- Closed-form geodesic on ℍ² matches numeric `GeodesicIntegrator` result to stepper accuracy over 100 steps.
- G-invariance of the metric: `computeMetric(g·p) = computeMetric(p)` after pullback by `Ad_g` (sampled over random g).

## Open design questions

Decide during implementation; don't block phase 1 on any of these.

1. **Storage of SU(2).** Complex 2×2 as 4 reals (the raw matrix), 4 reals as quaternion `(w, x, y, z)` (more rendering-convenient), or 4×4 real block (simplest for the generic fallback path). Lean toward raw 2×2 complex-as-4-reals for consistency, with a `toQuaternion` helper.

2. **Abstract base class vs pure interface.** Proposed above as an abstract class with defaults. Alternative: interface + standalone utility functions. Class form is cleaner for the "inherit defaults, override the closed-form cases" pattern we want, at the cost of conceding to JS classes (which the library has already conceded in many places, so it's not new tension).

3. **Lie-group stepper utility.** Worth adding `lieGroupStepper(G, state, ξ, dt)` that generalizes the second half of `rigidBodyStep` once SE(3) lands? Probably yes by phase 2 — defer the decision to phase 2 though.

4. **`coadjoint` default implementation.** The transpose-inverse construction above is correct but allocates an `n × n` intermediate per call. For compact groups where an `Ad`-invariant inner product reduces this to a simple action, we can override in `SO(n)` / `SU(n)`. Not a phase-1 concern.

5. **Naming.** `hat` and `vee` are standard but slightly obscure to non-specialists. Stick with them; document thoroughly in the README.

6. **Grouping `hat/` and `exp/` into subfolders.** Shown above. Alternative is flat `lie/hatSO3.ts` etc. Subfolders start paying off in phase 2 when 3–4 groups each have their own `exp`; worth adopting from day 1 to avoid a mid-plan reorganization.

## Success criteria

- All phase-specific smoke tests pass at the tolerances listed.
- Dzhanibekov demo runs at 60 fps; `H` and `|L|²` conserved to integrator accuracy over 10k+ frames; `R` stays exactly on SO(3).
- Interface composes cleanly with existing `math/ode`, `math/vectorfields`, `math/manifolds`, `math/symplectic`, `math/hopf`, `math/lattices` — adding a new group or symmetric space never forces an interface change.
- By the end of phase 4, at least one demo from each of these families is live: rigid-body mechanics, hyperbolic geometry, holonomy-as-group-element, Möbius action, symmetric-space geodesic.
- No dependency inversion: `symmetric-spaces/` imports from `lie/`, never the reverse; `lie/` imports from `linear-algebra/`, `manifolds/`, `functions/`, `ode/`, `vectorfields/`, `symplectic/` (for the Poisson sibling story); nothing imports from `symplectic/` via `lie/`.
