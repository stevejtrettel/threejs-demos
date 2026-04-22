# Differential forms

n-D differential forms: `OneForm`, `TwoForm`, and the operations that close under them (wedge, exterior derivative, interior product, Hodge star).

Forms are intrinsic structure — they live on a coordinate patch without needing a metric. The one exception is the Hodge star, which does need a metric and so takes a `Manifold` argument.

## Storage

Matches the conventions in `math/linear-algebra/` and `math/manifolds/`:

| Object | Storage | Convention |
|---|---|---|
| 1-form | `Float64Array(dim)` | `ω[i]` |
| 2-form | `Matrix(dim, dim)` | antisymmetric: `ω[i][j] = −ω[j][i]`, diagonal zero |
| 0-form (scalar) | plain `number` (via `ScalarField`) | — |
| Higher rank | not implemented | would be flat `Float64Array(dim^k)` |

## What's here

| File | What |
|---|---|
| `types.ts` | `OneForm`, `TwoForm` interfaces |
| `FromGradient.ts` | `df` for a `DifferentiableScalarField` (0-form → 1-form) |
| `wedge.ts` | `α ∧ β` for two 1-forms → 2-form |
| `d.ts` | Exterior derivative `d: Ω^1 → Ω^2` via central finite differences |
| `interior.ts` | `ι_X α` (1-form → 0-form) and `ι_X ω` (2-form → 1-form) |
| `hodge.ts` | 2D Hodge star for 1-forms and 2-forms (needs `Manifold` metric) |

## Dependencies

- Always: `math/linear-algebra` (`Matrix`, `Float64Array`)
- For `FromGradient`: `math/functions` (`DifferentiableScalarField`)
- For `interior`: `math/vectorfields` (`VectorField`)
- For `hodge`: `math/manifolds` (`Manifold`, for the metric)

The base algebra (`types`, `wedge`, `d`, `FromGradient`) does not touch `math/manifolds` — forms are defined without a metric.

## Sanity checks that should hold

- `d(df) = 0` for any scalar `f` (`d²` on 0-forms → 2-forms).
- `∫∫_S dω = ∫_{∂S} ω` (Stokes — numerical check on a rectangle).
- `ι_X(dq ∧ dp) = X^q dp − X^p dq` for `X = X^q ∂/∂q + X^p ∂/∂p`.
- `** = +id` on even-dim Riemannian (`*` twice returns you to the input, with a sign depending on rank).

## Out of scope for now

- k-forms for k ≥ 3 (would be flat `Float64Array` of length `dim^k` with a convention; build when a demo needs it).
- Analytic exterior derivative (current `d` uses FD; accept an analytic 2-form override when a consumer is hot).
- Pullback of forms along a map.
- Lie derivative `L_X ω`.
