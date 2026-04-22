# Vector fields & flows — plan

**Date:** 2026-04-22
**Status:** proposed (not started)

## Goal

Introduce `VectorField` as a first-class mathematical object, and `FlowTrail`
as its visual counterpart — mirroring the existing `MetricPatch` /
`GeodesicTrail` pairing. This is the base layer for the whole next arc
(differential forms → symplectic → bundles).

A vector field is a section of the tangent bundle. On a 2D coordinate patch
it is just a function `(u,v) ↦ (du/dt, dv/dt)`. Integrating it produces an
integral curve — a flow line. This is the same ODE machinery you already
have in `math/ode/`; the new layer is the *mathematical framing* (fields
attached to patches, composable with metrics and curves).

## Design principles (carried over from existing modules)

- **Intrinsic by default.** A `VectorField` lives on a parameter domain, not
  an embedding. It composes with any `Surface` or `MetricPatch` by sharing a
  domain.
- **No THREE.js in primitives.** Primitives return plain tuples; components
  handle the push-forward to 3D.
- **Delegate integration to `math/ode/`.** `FlowIntegrator` is a thin wrapper
  that stacks `VectorField` + domain + `Stepper`.
- **Parallel API to geodesics.** `FlowTrail` looks and feels like
  `GeodesicTrail` — same options, same reset/recompute/animate shape — so
  anyone who learned one already knows the other.

## New types

### `VectorField` (primitive)

```ts
// src/math/vectorfields/types.ts

export interface VectorField {
  getDomain(): SurfaceDomain;
  evaluate(u: number, v: number, t?: number): [number, number];
}
```

Time parameter is optional to cover both autonomous (most) and
time-dependent fields (forced oscillators, non-autonomous Hamiltonians).
Autonomous fields just ignore `t`.

Rationale for 2D-only: the rest of the library is 2D (patches, curves in
parameter space). A generic `VectorField<n>` is a later refactor, tracked
together with a generic `Metric<n>`.

### `FlowState` (internal, for bounded integration)

```ts
export interface FlowState {
  position: [number, number];
  t: number;
}

export interface BoundedFlowResult {
  state: FlowState;
  hitBoundary: boolean;
  boundaryEdge?: BoundaryEdge;  // reuse from geodesics/types
  stepFraction?: number;
}
```

`BoundaryEdge` is re-exported from `@/math/geodesics/types` so both
trails speak the same vocabulary.

## New primitives

| File                              | What it is                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------ |
| `vectorfields/FromFunction.ts`    | Wrap a user `(u,v,t?) => [du,dv]` into a `VectorField`. The quick-sketch constructor. |
| `vectorfields/GradientField.ts`   | `∇f` on a `MetricPatch`. Uses `g^{ij} ∂_j f` — needs the inverse metric, built from `computeMetric`. Scalar `f` is a `DifferentiableScalarField2D` (already in `math/functions/`). |
| `vectorfields/ConstantField.ts`   | `(u,v) ↦ (a, b)`. Mostly for demos. |
| `vectorfields/FlowIntegrator.ts`  | RK4 integrator over a `VectorField`. Bounded variant uses bisection against domain edges, copying the existing `GeodesicIntegrator` boundary pattern. |

Further primitives (Killing fields, Hamiltonian fields, gauge fields) land
in later phases when the prerequisites exist.

## New components

| File                           | What it is                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `vectorfields/FlowTrail.ts`    | `THREE.Line` that flows a point along a `VectorField` on a `Surface`. API-parallel to `GeodesicTrail`. |
| `vectorfields/FieldArrows.ts`  | *(follow-up)* `THREE.Group` of arrow glyphs sampled on a grid in the patch domain and pushed forward via `computePartials`. Needs `DifferentialSurface`, not just `Surface`. |

## `FlowTrail` sketch

Same shape as `GeodesicTrail`, one ingredient more (the field). One state
component fewer (no velocity — flows are first-order).

```ts
export interface FlowTrailOptions {
  initialPosition: [number, number];
  color?: number;
  lineWidth?: number;
  maxPoints?: number;
  stepSize?: number;
  fixedSteps?: number;
  bounded?: boolean;
}

export class FlowTrail extends THREE.Line {
  constructor(surface: Surface, field: VectorField, options: FlowTrailOptions);
  animate(time: number, delta: number): void;
  reset(): void;
  recompute(): void;
  dispose(): void;
  get stopped(): boolean;
  get stoppedAtBoundary(): BoundaryEdge | undefined;
}
```

Contract: `field.getDomain()` and `surface.getDomain()` must agree. Enforce
at construction with a clear error message.

## File layout

```
src/math/vectorfields/
  types.ts            VectorField, FlowState, BoundedFlowResult
  FromFunction.ts     wrap a plain function
  ConstantField.ts    (u,v) => (a,b)
  GradientField.ts    ∇f on a MetricPatch
  FlowIntegrator.ts   RK4 integrator, bounded variant
  FlowTrail.ts        THREE.Line component
  README.md
  index.ts            public barrel
```

## Milestone demos

One demo per primitive, each under ~150 lines:

1. **`demos/gradient-flow-surface/`** — height function `f(u,v)` on a torus;
   many `FlowTrail`s from a grid of starts descending to the minima. Exercises
   `GradientField` + `MetricPatch`.
2. **`demos/phase-portrait/`** — classical planar ODE (Van der Pol or
   Lotka–Volterra) as a `FromFunction` field on a rectangle; `FieldArrows`
   + a handful of `FlowTrail`s. Exercises non-surface use (flat R² patch).
3. **`demos/flow-on-sphere/`** — a rotation (Killing) field on S² via
   `FromFunction`; shows flows are closed orbits. Sets up the later Lie-group
   layer by showing the orbit structure without naming it yet.

## Scope boundaries (what this phase does NOT do)

- No Lie-derivative, no bracket `[X, Y]`. (Possible once we have two fields
  and want to check commutativity — trivial to add, but nothing depends on
  it yet.)
- No flow on `MetricPatch`-only (no embedding). The intrinsic case works
  mathematically but needs a way to draw the point — deferred until we have
  an `AmbientSpace`-aware trail. For now, flow visuals require a `Surface`.
- No generic `VectorField<n>`. Everything is 2D. The 2D-to-n-D refactor is
  a later, cross-cutting change that also touches `MetricPatch`.
- No pushforward of vector fields along maps. (Useful later for Hopf-style
  constructions.)

## Follow-on roadmap (what comes after this phase)

Each subsequent phase reuses the layer below. The ordering is chosen so
that each phase unlocks a noticeably different *kind* of demo without
rewriting earlier code.

### Phase 2 — Differential forms

`math/forms/`: `OneForm`, `TwoForm`, exterior derivative `d`, interior
product `ι_X`, Hodge star (requires metric). On a 2D patch these are all
tiny — two coefficients, four coefficients, one coefficient. The payoff is
not visual but structural: symplectic, de Rham, Stokes all need forms.

Unlocks: the natural language for phase 3, and line-integral / flux demos
(`∫_γ ω`, `∫∫_S dω`) that were previously ad hoc.

### Phase 3 — Symplectic & Hamiltonian systems

`math/symplectic/`: `SymplecticPatch` (closed nondegenerate 2-form on a
2n-dim patch — for now 2D, which means n=1, i.e. a single canonical
(q, p) pair). `HamiltonianField(H, ω)` produces a `VectorField` that
**plugs straight into `FlowTrail`**. That's the whole trick.

- `CotangentBundle(M)` — build T\*M as a symplectic patch from a `MetricPatch`
  (canonical symplectic form).
- Demos: pendulum phase portrait, Kepler orbits, double-pendulum Poincaré
  sections, integrable tops.

Higher-dim symplectic waits until the 2D→nD refactor happens.

### Phase 4 — Lie groups & group actions

`math/groups/`: `LieGroup` interface (matrix groups: SO(3), SU(2), SL(2,ℝ),
SE(3), Heisenberg). `exp`, `log`, adjoint, one-parameter subgroups (which
*are* `VectorField`s on the group, so phase 1 pays off again).
`GroupAction<M>` — generic action on a manifold, orbit visualization.

This also retroactively cleans up:
- The modular group action already implicit in `math/lattices/`.
- The SU(2)-as-S³ structure implicit in `math/hopf/`.

### Phase 5 — Fiber bundles & connections (demand-driven)

`math/bundles/`: `PrincipalBundle`, `Connection` (a specific 1-form on
the total space), `Curvature` (its `d` plus the bracket term). Hopf is
already a principal S¹-bundle; extracting the interface lets it share
machinery with frame bundles, Berry phase, gauge-theory demos.

Only worth doing once a demo demands it. Don't front-load.

### Phase 6 — Riemann surfaces

Extends `math/algebra/` + `math/lattices/`. Hyperelliptic curves, period
integrals, Abel–Jacobi, theta divisors. Already have complex numbers,
lattices, the ℘-function, and elliptic curves over F_p. This phase is
targeted — specific classical objects, not a general framework.

## Cross-cutting: the 2D → n-D refactor

Three interfaces currently hard-code 2D:

- `FirstFundamentalForm` (E, F, G)
- `TangentVector` (position/velocity as `[number, number]`)
- `VectorField` (this plan)

Every phase above stays 2D for now. At some point — probably when the
first demo naturally wants a 3D phase space (e.g. Lorenz, rigid-body
Euler equations) — it will be worth one sweep that replaces these with
matrix/array-of-length-n equivalents. That refactor is easier *after*
phases 2–3 exist, because we will have seen how much of the code actually
assumes 2D vs. just happens to be written in 2D.
