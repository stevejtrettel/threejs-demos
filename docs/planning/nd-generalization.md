# n-D generalization — plan

**Date:** 2026-04-22
**Status:** proposed, awaiting decision
**Prerequisite for:** differential forms, symplectic geometry, Hamiltonian mechanics

## Goal

Generalize the math library's core types from 2D-hardcoded to n-D. The immediate driver is Hamiltonian mechanics: even a 2D configuration manifold has a 4D phase space, so symplectic geometry cannot be done while the primitives are 2D-locked.

Non-goal: rewrite the 2D surface-rendering stack. 2D-specific features (embedding `Surface ↪ ℝ³`, `SurfaceMesh`, `FieldArrows`, second fundamental form, Gaussian curvature as a scalar) stay as they are.

## What is actually 2D in the current library

Before the plan, it helps to be precise about what "2D" means in the existing code. There are two distinct 2D things, and they subsume differently:

**1. 2D intrinsic (metric on a patch, no embedding)** — generalizes cleanly.

- `MetricPatch` ([`src/math/surfaces/types.ts`](../../src/math/surfaces/types.ts)) — `getDomain`, `computeMetric`, optional `computeChristoffel`, optional `computeGaussianCurvature`. Intrinsic; no embedding.
- `MetricSurface` — concrete implementation: abstract metric on a box, no embedding at all.
- `pullback.ts` — constructs a `MetricPatch` by pulling back a metric through a map.
- Intrinsic consumers that currently take a `MetricPatch`: `GradientField`, `GeodesicIntegrator`, `christoffel.ts`.

All of this becomes n-D without fuss. `MetricPatch` → `Manifold`, `MetricSurface` → `AbstractManifold` on a box in ℝⁿ, `pullback` generalizes to maps ℝⁿ → ℝᵐ, and the intrinsic consumers become generic.

**2. 2D extrinsic (embedded into ℝ³)** — stays 2D.

- `Surface.evaluate(u, v): Vector3` — parametric embedding into ℝ³.
- `DifferentialSurface` extends `MetricPatch` with embedding (`computeNormal`, `computePartials`, optional `SecondFundamentalForm`, optional mean curvature).
- `SurfaceMesh`, `RollUpMesh`, `EllipticCurveMesh`, `FieldArrows` — rendering / pushforward via `computePartials`.
- `CurveOnSurface` — lifts `(u, v)` patch curves to ℝ³ through a `Surface`.

These stay 2D because the embedding target is ℝ³. They implement the n-D interfaces (a `Surface` is a `Manifold` with dim=2) but retain their extrinsic methods as 2D-specific additions.

**3. 2D-intrinsic-special — the one genuinely 2D mathematical convenience** — stays on the 2D type.

- `computeGaussianCurvature`: Gaussian curvature as a scalar is 2D-only. The Brioschi formula (K from metric alone) is a 2D identity. In n-D the honest replacement is the Riemann curvature tensor, which is a separate future concern. In the subsumed world, this accessor lives on the 2D `Surface`-style interface, not on the generic `Manifold`.

## The fork: subsume or parallel

### Option A — Subsume (recommended)

One set of core types, parameterized by dimension. `Surface` is a concrete specialization that fixes n=2 and adds the embedding into ℝ³. Existing 2D consumers keep working; new n-D consumers (forms, symplectic) use the generic interfaces directly.

**Pros:**
- One `VectorField`, one `Metric`, one `FlowIntegrator` — not two.
- Forms and symplectic get to work on 2D surfaces *for free*. A Hamiltonian on T\*M-of-a-torus is just a Hamiltonian field, no bridge code.
- Future n-D concrete manifolds (Lie groups, product manifolds, cotangent bundles) plug into the same infrastructure as surfaces.
- The 2D specialization doesn't go away — it just stops being the floor.

**Cons:**
- Non-trivial blast radius: ~12 files touch `FirstFundamentalForm` (E, F, G) or `ChristoffelSymbols` (named fields). Each needs to migrate from a named-field struct to an indexed matrix/tensor.
- Churn on working code. The changes are mechanical, not conceptual, but there are a lot of them.

### Option B — Parallel systems

New `math/manifolds/` folder for the n-D world. `math/surfaces/`, `math/vectorfields/`, `math/geodesics/` stay exactly as they are. Forms and symplectic are built on the new folder only.

**Pros:**
- Zero risk to existing demos.
- Fastest path to forms + Hamiltonian mechanics in n-D.

**Cons:**
- Two `VectorField` types, two metric types, two integrators. A gradient flow on a 2D surface and a gradient flow on a 4D manifold are different classes — conceptually identical, codewise distinct.
- Can't run a Hamiltonian system on a surface without writing bridge code (wrap `Surface` as a `Manifold`).
- Duplication spreads as we build more: n-D `GradientField`, n-D `FieldArrows`-analog, n-D streamtube renderer, etc.
- Violates the existing library's "one concept, one implementation" principle.

### Recommendation: Option A

Given the partition above, subsuming is mostly mechanical. The intrinsic 2D types (`MetricPatch`, `MetricSurface`, `pullback`) generalize straight through — they are already "abstract metric on a box," the box just becomes n-dim instead of 2-dim. The extrinsic 2D types (`DifferentialSurface`, `SurfaceMesh`, `FieldArrows`, `CurveOnSurface`) stay 2D because embedding into ℝ³ is 2D-specific, and they gain the n-D interfaces as a supertype rather than losing anything.

The intrinsic core (metric, Christoffel, geodesic integration, vector fields, flows, forms, symplectic) generalizes cleanly. The surface layer sits *on top* of the generic core, adding embedding-specific features. Gaussian curvature stays as a 2D-only accessor on the 2D interface.

## The new core

### Types

```ts
// math/manifolds/types.ts

// n-dim box in parameter space. Length n arrays.
export interface ManifoldDomain {
  min: number[];  // length n
  max: number[];  // length n
}

// Intrinsic n-dim manifold with a Riemannian (or pseudo-Riemannian) metric.
// Replaces MetricPatch in the n-D world.
export interface Manifold {
  readonly dim: number;
  getDomain(): ManifoldDomain;
  computeMetric(p: number[]): number[][];       // n×n symmetric matrix
  computeChristoffel?(p: number[]): number[][][]; // Γ^k_ij, shape [n][n][n]
}

// k-th order tensor helpers live alongside as utilities, not as types:
// invert(n×n matrix), det(n×n matrix), christoffelFromMetric(metric fn, p).
```

### The 2D connection

`MetricPatch` *is* `Manifold` specialized to dim=2. In practice we delete `MetricPatch` as a separate interface and have the 2D types implement `Manifold` directly, with dim-2 specific accessors (Gaussian curvature, optional 2D convenience helpers) added as extensions.

```ts
// A DifferentialSurface is a 2D Manifold + embedding into ℝ³ + 2D-special
// extrinsic accessors. Nothing else changes externally: existing code calling
// surface.evaluate(u, v) keeps working.
export interface DifferentialSurface extends Manifold /* with dim=2 */ {
  evaluate(u: number, v: number): THREE.Vector3;
  computeNormal(u: number, v: number): THREE.Vector3;
  computePartials(u: number, v: number): SurfacePartials;
  // 2D-intrinsic-special (Brioschi):
  computeGaussianCurvature?(u: number, v: number): number;
  // 2D-extrinsic (embedding-only):
  computeSecondFundamentalForm?(u: number, v: number): SecondFundamentalForm;
  computeMeanCurvature?(u: number, v: number): number;
}
```

`MetricSurface` — currently a `MetricPatch`-only implementation — becomes an n-D `Manifold` implementation. Same code shape, just no longer hard-coded to dim=2.

`pullback.ts` — currently takes a map `(u, v) → ℝ³` and produces a 2D `MetricPatch` with the induced metric. Generalizes to: take a map `ℝⁿ → ℝᵐ` and produce an n-D `Manifold`. Surfaces remain a special case.

`FirstFundamentalForm` (E, F, G) is deleted. `computeMetric(u, v)` returns a 2×2 matrix `[[E, F], [F, G]]`. Helper accessors for readability if we miss the named form:

```ts
// math/manifolds/helpers.ts
export const E = (m: number[][]) => m[0][0];
export const F = (m: number[][]) => m[0][1];
export const G = (m: number[][]) => m[1][1];
```

Same story for `ChristoffelSymbols`: the named-field struct becomes a 3-index array `Γ[k][i][j]`.

### VectorField

```ts
// math/vectorfields/types.ts (replaces current 2D VectorField)

export interface VectorField {
  readonly dim: number;
  getDomain(): ManifoldDomain;
  evaluate(p: number[], t?: number): number[];  // length dim
}
```

`FromFunction`, `ConstantField`, `GradientField` all update to take/return `number[]`. `FlowIntegrator` becomes trivial — the ODE layer is *already* n-D, so `FlowIntegrator` is almost an identity wrapper at that point.

### Patchcurves

`StreamPoints`, `FlowCurve` become dimension-agnostic internally — points are `number[]` not `[number, number]`. Rendering adapters (`CurveOnSurface`) stay 2D because they need a `Surface` embedding. New adapters for n-D (`ProjectedCurve`, `PhasePlaneCurve`) come later in Phase 3.

## Phases

Each phase is independently shippable. We can pause after any of them.

### Phase 1 — n-D core, no existing code changed

**New files:**
- `math/manifolds/types.ts` — `Manifold`, `ManifoldDomain`
- `math/manifolds/linear.ts` — `invert`, `det`, `symmetric` utilities (generalizes tiny slice of `linear-algebra/`)
- `math/manifolds/christoffel.ts` — n-D Christoffel-from-metric via finite differences
- `math/manifolds/Euclidean.ts` — flat ℝⁿ as a reference `Manifold`
- `math/manifolds/index.ts`, README

**Changed:** none. Phase 1 is purely additive.

**Unit test / demo:** Hand-write a 3D `Manifold` (e.g. flat ℝ³), compute Christoffel, verify they're zero.

### Phase 2 — Subsume 2D into the n-D core

Two sub-steps; Phase 2a is the harder one because it retires `MetricPatch` as a distinct interface.

**Phase 2a — intrinsic-2D collapses into `Manifold` (dim=2).**
- `math/surfaces/types.ts` — delete `MetricPatch` and `FirstFundamentalForm`. `DifferentialSurface` extends `Manifold` directly (dim=2) + embedding + `computeGaussianCurvature?` + extrinsic helpers.
- `math/surfaces/christoffel.ts` — input is now a metric-returning function with matrix output; drop named-field struct.
- `math/surfaces/pullback.ts` — generalize signature to map `ℝⁿ → ℝᵐ`. Surface case becomes the n=2 specialization.
- `math/surfaces/MetricSurface.ts` — already intrinsic-only; lifts to an n-D `AbstractManifold` implementation.
- `math/vectorfields/GradientField.ts` — currently consumes `MetricPatch`, switches to `Manifold` (no behavior change for 2D call sites).
- `math/geodesics/GeodesicIntegrator.ts` — consume matrix metric + 3-index Christoffel.

**Phase 2b — embedded-2D types get n-D-compatible APIs.**
- `math/surfaces/*.ts` (Torus, BoysSurface, KleinBottle, FunctionGraph, FlatPatch, NumericSurface) — `computeMetric` returns 2×2 matrix instead of `FirstFundamentalForm`. They keep their 2D `evaluate(u, v)` signatures.
- `math/vectorfields/*.ts` — `VectorField` is now n-D (`number[]` in/out), but concrete 2D fields keep returning length-2 arrays.
- `math/patchcurves/*.ts` — internal arrays go `number[]`; public API unchanged for 2D consumers.

**Demos touched:** zero, if we preserve the outward API of 2D classes (the user-facing shape `(u, v)` stays).

**Unit:** all existing demos pass. Phase 2 is "mechanical migration with no behavior change."

### Phase 3 — Differential forms

**New files:**
- `math/forms/types.ts` — `OneForm`, `TwoForm` (and later `KForm<k>` if useful). A k-form on dim-n manifold: `evaluate(p: number[]) => <indexed antisymmetric coefficients>`.
  - `OneForm.evaluate(p): number[]` — n components.
  - `TwoForm.evaluate(p): number[][]` — n×n antisymmetric.
- `math/forms/wedge.ts` — `ω ∧ η`.
- `math/forms/d.ts` — exterior derivative (numerical first, analytic overrides allowed).
- `math/forms/interior.ts` — `ι_X ω`.
- `math/forms/hodge.ts` — Hodge star (needs `Manifold` metric).
- `math/forms/FromGradient.ts` — `df` for a `DifferentiableScalarField`.

**Unit:** Stokes' theorem check numerically on a 2D patch; `d² = 0` on a sample form; `ι_X ω` on a 2D rotation agrees with known formula.

### Phase 4 — Symplectic & Hamiltonian

**New files:**
- `math/symplectic/types.ts` — `SymplecticManifold` (`Manifold` dim 2n + closed nondegenerate `TwoForm`).
- `math/symplectic/CotangentBundle.ts` — given a `Manifold M` of dim n, construct T\*M: dim 2n, coords (q, p), canonical form ω = Σ dp_i ∧ dq_i.
- `math/symplectic/HamiltonianField.ts` — given H: number[] → number and ω, produce a `VectorField` on the symplectic manifold via ι_{X_H} ω = dH.

**Demos:**
- Pendulum (2D phase space): H = p²/2 − cos(q), trajectories on (q, p) plane.
- Kepler orbit (4D phase space): H = |p|²/(2m) − GMm/|q|, trajectories projected to (q₁, q₂) position plane.
- Geodesic flow *via Hamiltonian*: H = ½ g^{ij} p_i p_j on T\*(surface). Should agree with direct geodesic integration. Good correctness check.

### Phase 5 — n-D visualization utilities (as needed)

Only build when a demo demands it. Candidates:
- `ProjectedCurve` — projects n-D trajectories to 3D via a fixed linear map (or PCA over the trajectory).
- `PhasePlaneView` — picks two coords out of 2n and renders as a 2D plane.
- `PoincareSection` — intersect a trajectory with a codim-1 hypersurface, plot the hits.
- Dual-view helpers (position-space + momentum-space side-by-side).

## What is explicitly out of scope

- **Atlases / multi-chart manifolds.** Stay with one-chart-per-manifold for now. Hopf and lattices already handle their own chart logic; we don't need to generalize.
- **Riemann curvature tensor.** The n-D Christoffel is enough for geodesic flow. Full curvature tensor comes when a demo wants it.
- **Lie groups.** Listed in the roadmap but not unlocked by this work.
- **Fiber bundles (general).** `CotangentBundle` is a specific construction we need; we are not writing a general `FiberBundle` abstraction.
- **Adaptive integration, implicit steppers, symplectic integrators.** The existing RK4 is fine for now. A symplectic-integrator pass (Verlet, Yoshida) is a clean follow-up after Phase 4 demos reveal energy-drift issues.

## Open design questions

Flagged here to resolve *before* Phase 2, since they affect the subsume:

1. **Matrix representation.** `number[][]` (readable, allocates) vs flat `Float32Array` (fast, error-prone). For the intended usage (small n: 2, 3, 4, 6), `number[][]` is fine. Can optimize in place later if a demo is slow.
2. **Keep E/F/G helpers?** Accessor helpers `E(m)`, `F(m)`, `G(m)` add surface-ness back to matrix code. Alternative: let 2D code use `m[0][0]` directly. I'd keep the helpers — they read like math on the written page.
3. **Point type.** `number[]` is flexible but untyped as to length. Alternatives: `readonly [number, number, ...number[]]`, generic `Point<N>` with number-literal types, branded types. I'd start plain `number[]` and only tighten if bugs force it.
4. **Non-autonomous fields.** Current `VectorField.evaluate(u, v, t?)` keeps the optional `t`. Carry it through to n-D: `evaluate(p: number[], t?: number): number[]`.
5. **2D call-site signatures.** `DifferentialSurface.evaluate(u, v)` and friends — keep the two-scalar signature for embedded 2D (it reads naturally, demos use it), even though the underlying `Manifold` interface takes `number[]`. The 2D types satisfy both: expose `evaluate(u, v)` as a user-facing method, adapt internally to `number[]` for n-D consumers. Minor duplication of surface code, worth it for readability.

## Milestone order (if greenlit)

1. Phase 1 — foundational types, no disruption (~1 session).
2. Phase 2 — migration (~2 sessions, most of the mechanical work).
3. Phase 3 — forms (~1–2 sessions).
4. Phase 4 — symplectic + Hamiltonian, with pendulum and Kepler demos (~2 sessions).
5. Phase 5 — whatever visualization helpers the demos actually demand.

Pause points: after any phase. The library is in a working state at each phase boundary.
