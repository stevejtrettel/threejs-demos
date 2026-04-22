# Manifolds (n-D)

The intrinsic-geometry core of the library, parameterized by dimension.

A `Manifold` is a coordinate patch of any dimension carrying a metric. It
generalizes the 2D `MetricPatch` that lives in `math/surfaces/`; when
`dim === 2` the two concepts coincide. The surfaces module will retire
`MetricPatch` and implement `Manifold` directly in Phase 2 — see
[`docs/planning/nd-generalization.md`](../../../docs/planning/nd-generalization.md).

## What's here

| File | What it is |
| --- | --- |
| `types.ts` | `Manifold`, `ManifoldDomain` interfaces. |
| `christoffel.ts` | `christoffelFromMetric(metric, p, h)` — n-D Christoffel symbols via central finite differences. |
| `Euclidean.ts` | Flat ℝⁿ reference implementation — identity metric, zero Christoffel. |

Matrix utilities (`det`, `invert`, `solve`, etc.) live in
[`math/linear-algebra/`](../linear-algebra/); this module uses them, doesn't
duplicate them.

## Conventions

- **Points are `number[]` of length `dim`.** Not tuples. Not `THREE.Vector3`.
- **Metrics are `Matrix`** from `math/linear-algebra` — `Float64Array`-backed,
  with methods for `invert`, `solve`, etc. Symmetric in practice (pseudo-
  Riemannian as well as Riemannian), but that constraint is not enforced in
  the type.
- **Christoffel is `number[][][]` indexed as `Γ[k][i][j]`** — upper index
  first, symmetric in `(i, j)`. A plain rank-3 tensor, outside the scope of
  the rank-2 `Matrix` type.
- **No THREE.js.** Intrinsic-only; no embedding is assumed. Rendering glue
  lives in the surfaces / rendering layers.

## `Matrix` for metrics, nested arrays for tensor formulas

The metric is a `Matrix`. For methods — `g.invert()`, `g.mulVec(v)`,
`g.det()` — this is ergonomic. For tensor-index formulas, extract nested
arrays once with `.toArrays()` and use direct `g[i][j]` indexing:

```ts
// Christoffel: fundamentally an indexed sum, wants direct array access
const gInv = metric(p).invert().toArrays();   // number[][]
for (let k = 0; k < n; k++)
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let l = 0; l < n; l++)
        sum += gInv[k][l] * (dg[i][l][j] + dg[j][l][i] - dg[l][i][j]);
      // ...
    }
```

The `.toArrays()` call is O(n²), run once per function, negligible for
small n. See [`linear-algebra/README.md`](../linear-algebra/README.md)
for the full rationale.

## Quick start

```ts
import { Euclidean, christoffelFromMetric } from '@/math';

// Sanity: Christoffel symbols on flat ℝ⁴ must all vanish.
const flat = new Euclidean(4);
const p = [1, 2, 3, 4];
const G = christoffelFromMetric((q) => flat.computeMetric(q), p);
// G[k][i][j] ≈ 0 for all k, i, j
```

## Status

- [x] Phase 1 — primitives (types, linear utilities, Christoffel, Euclidean)
- [ ] Phase 2 — 2D surfaces implement `Manifold` directly; `MetricPatch`
      retires
- [ ] Phase 3 — differential forms layer (`math/forms/`)
- [ ] Phase 4 — symplectic + Hamiltonian (`math/symplectic/`)
