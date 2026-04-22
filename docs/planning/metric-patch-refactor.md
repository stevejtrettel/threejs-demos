# MetricPatch refactor — scope, rationale, and future work

**Date:** 2026-04-22
**Status:** landed

## What shipped

Split the intrinsic-Riemannian half out of `DifferentialSurface` into its own
small interface so geodesics, curvature, and parallel transport can run on
abstract metrics that have no natural R³ embedding (linkage configuration
spaces, surfaces embedded in R⁴ / H³ viewed through a projection, conformal
deformations, etc.).

### New type hierarchy (intrinsic vs. extrinsic)

```
Surface          : getDomain + evaluate                  (extrinsic only)
MetricPatch      : getDomain + computeMetric             (intrinsic only)
                   (+ optional computeChristoffel, computeGaussianCurvature)
DifferentialSurface : extends Surface, MetricPatch       (both — embedding
                   + induced metric + extrinsic curvature)
```

Existing analytic surfaces (`Torus`, `BoysSurface`, `KleinBottle`,
`FunctionGraph`) are unchanged and structurally satisfy `MetricPatch`.

### New building blocks

| Class / function         | What it's for                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| `NumericSurface`         | Wraps a user-supplied `evaluate(u,v)` into a full `DifferentialSurface` with finite-diff partials, normal, and induced metric. For quick sketches. |
| `MetricSurface`          | A `MetricPatch` that carries a metric function plus an optional `display: Surface` for visualization. The display and metric are **not** mathematically linked. |
| `pullbackMetric(f, ...)` | Factory. Given an embedding `f: R² → R^n` (Euclidean target, any `n`), returns a `MetricSurface` with `g_ij = ∂f/∂xⁱ · ∂f/∂xʲ`. Euclidean only. |
| `christoffelFromMetric`  | Numerical Γᵏᵢⱼ from any `MetricPatch` via central differences. |
| `gaussianCurvatureFromMetric` | Numerical `K` via the Brioschi formula. Purely intrinsic. |

`GeodesicIntegrator` now accepts any `MetricPatch` (widened from
`DifferentialSurface`) and uses `computeChristoffel?` when provided, falling
back to `christoffelFromMetric` otherwise.

## What's in scope for this interface, and what isn't

`MetricPatch` is deliberately **intrinsic-only**. Anything that requires the
embedding lives on `DifferentialSurface`, not here.

### Explicitly in scope (for `MetricPatch` and its helpers)

- Geodesics (have them — `GeodesicIntegrator`)
- Christoffel symbols (have them — `christoffelFromMetric`)
- Gaussian curvature (have it — `gaussianCurvatureFromMetric`, Brioschi)
- Parallel transport along a curve (future — below)
- Geodesic distance, exponential map (future — below)
- Length / area / angles on the patch (future — below)

### Explicitly NOT in scope for `MetricPatch`

Require the embedding. These stay on `DifferentialSurface`:

- Second fundamental form (L, M, N)
- Mean curvature (H)
- Unit normal (n)
- Principal curvatures and directions
- Gauss map, Weingarten operator
- Ambient-space geodesics (as opposed to intrinsic geodesics on the patch)

## Future-work checklist

When the next demo needs one of these, here's where it should land and how it
should be wired up so we don't re-invent the decomposition.

### Intrinsic helpers (operate on `MetricPatch`)

Good to have, probably pulled out when first needed:

- `parallelTransport(patch, curve, vector)` — integrate the parallel-transport
  ODE along a curve in the patch's domain. Takes a `MetricPatch` and a sampled
  curve; returns the transported vector. Lives in `math/geodesics/` or a new
  `math/metrics/`.
- `exponentialMap(patch, point, vector)` — shoot a geodesic from `point` in
  direction `vector` for unit time. Thin wrapper on `GeodesicIntegrator`.
- `geodesicDistance(patch, p, q, opts?)` — shortest-path distance. Hard in
  general (boundary-value problem); start with a straight-line initial guess
  + shooting + Newton iteration on the endpoint. Possibly out of scope until
  a specific demo drives it.
- `arcLength(patch, curve)` — ∫ √(g_ij ẋⁱ ẋⁱ) dt along a sampled domain curve.
- `patchArea(patch)` — ∫∫ √(EG − F²) du dv over the domain.

### Extrinsic helpers (operate on `DifferentialSurface`)

Candidates for extraction from wherever they first appear. None of these
belong on `MetricPatch`.

- `secondFundamentalFormNumeric(surface, u, v)` — finite-diff on
  `computePartials`, project second derivatives onto the normal.
- `meanCurvatureNumeric(surface, u, v)` — from first + second fundamental forms.
- `principalCurvatures(surface, u, v)` — eigendecomposition of the shape operator.
- `shapeOperator(surface, u, v)` — Weingarten map as a 2×2 matrix on tangent space.

When we first need any of these, extract them to `src/math/surfaces/extrinsic.ts`
(or similar) as plain functions taking a `DifferentialSurface`. Don't clutter
the interface with default implementations — keep the interface small, let
helpers do the numerical work, and let individual surfaces override with
analytic versions when they want to.

### Non-Euclidean pullbacks

Current `pullbackMetric` is Euclidean R^n only. For surfaces in hyperbolic
H^n, on a sphere S^n, or with any non-flat ambient metric, the workflow is:

1. Compute the metric by hand (or write a formula). Pass it directly to
   `MetricSurface`.
2. Build a `display: Surface` by composing the ambient embedding with a
   projection to R³ (Poincaré ball, stereographic, drop-a-coordinate, etc.).
3. `MetricSurface` keeps these two fully decoupled.

**When** we have a handful of demos doing this, consider a
`pullbackWithInnerProduct(f, innerProduct, domain, ...)` helper that takes a
target-space inner product callback. Don't build it speculatively — pick the
right abstraction after seeing two or three concrete use cases.

### `Params` reactivity on `MetricSurface`

`MetricSurface` currently has no built-in reactive params — callers rebuild
it when their upstream params change (cf. `setL` in `linkage-4-geodesic`).
That's the right default for a value type. If a concrete demo wants
param-driven rebuild, wrap in a `Parametric` class that owns the upstream
params and the `MetricSurface` together. Don't push reactivity into
`MetricSurface` itself.

## Lesson: the `Γ¹₂₂` bug uncovered during the port

The old inline Christoffel expansion in `GeodesicIntegrator.computeChristoffel`
had a transcription typo in one of the six terms:

```ts
// Wrong — survived because every existing surface had F ≡ 0
gamma_1_22 = 0.5 * (gi11 * (2 * F_v - G_u) + gi12 * (2 * G_v - G_u));

// Correct — the l=1 term should be g^{01} · G_v
gamma_1_22 = 0.5 * (gi11 * (2 * F_v - G_u) + gi12 * G_v);
```

The buggy term is multiplied by `g^{01} = −F/det`. Every analytic surface
previously integrated over (`Torus`, `Clifford`, rectangular torus, function
graphs) has orthogonal (u,v) coordinates with `F ≡ 0`, which silently zeroed
out the bug. It first manifested as energy-nonconserving geodesics when the
linkage-4-geodesic port pointed the kinetic-energy metric (which has `F ≠ 0`
from the off-diagonal `h_pt`) at `GeodesicIntegrator`.

Lesson for future helpers: when the metric can have `F ≠ 0`, prefer the
tensor-loop form of Christoffel over hand-expanded formulas — the index
bookkeeping alone is enough to trip up careful people. Or test against a
non-orthogonal metric (the linkage pullback, a hyperbolic upper-half-plane
metric, etc.) before trusting an inline expansion.

## Design invariants to preserve

When extending any of this, these have kept the system honest so far:

1. **`MetricPatch` does not know about embeddings.** If a new method needs
   `evaluate()`, it belongs on `DifferentialSurface`, not here.

2. **`MetricSurface.display` is never read by intrinsic code.** Geodesic
   integration, curvature, parallel transport — none should touch it. It's a
   drawing-only handle.

3. **Analytic overrides are optional, numerical fallbacks are always
   available.** Consumers call `patch.computeChristoffel?.() ?? christoffelFromMetric(...)`.
   Never require an analytic version; never skip the fallback.

4. **`DifferentialSurface.computeMetric` = induced Euclidean pullback from R³.**
   This is a structural promise. If a surface needs a different metric for
   intrinsic work, it should pair an ordinary `Surface` with a separate
   `MetricPatch` via `MetricSurface`, not subclass `DifferentialSurface`.
