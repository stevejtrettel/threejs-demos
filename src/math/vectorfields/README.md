# Vector fields & flows

A vector field on a 2D coordinate patch is a function `(u, v) ↦ (du/dt, dv/dt)`.
Integrating it produces a flow line — the integral curve of the field.

This module covers the **fields themselves** and their **glyph visualization**.
Drawing integral curves (as lines or tubes, on one or more surfaces) lives
in `math/patchcurves/`.

## What's here

- **Primitive:** [`VectorField`](./types.ts) — any object with `getDomain` and
  `evaluate(u, v, t?)`. Time is optional so autonomous and non-autonomous
  fields share a single interface.
- **Integrator:** [`FlowIntegrator`](./FlowIntegrator.ts) — RK4 wrapper over
  `math/ode/`, with an optional `integrateBounded` variant that bisects to the
  domain boundary.
- **Glyph component:** [`FieldArrows`](./FieldArrows.ts) — `THREE.InstancedMesh`
  of cones sampled on a grid; pushes the field forward to 3D via
  `computePartials`.

## Primitives (field producers)

| Class | What it is |
| --- | --- |
| `FromFunction` | Wraps `(u, v, t?) => [du, dv]` + a domain. The quick-sketch constructor. |
| `ConstantField` | `(u, v) ↦ (a, b)`. Params `a`, `b` are reactive. |
| `GradientField` | Riemannian gradient of a `DifferentiableScalarField2D` on a `MetricPatch`: raises the index via `g^{ij} ∂_j f`. Pass `descend: true` for gradient descent. |

## Typical use

```ts
import { FromFunction, FieldArrows } from '@/math';
import { FlowCurve, CurveLine } from '@/math';  // from patchcurves/

// Planar rotation: X(u, v) = (-v, u)
const field = new FromFunction(
  (u, v) => [-v, u],
  { uMin: -2, uMax: 2, vMin: -2, vMax: 2 }
);

// Flat patch as the drawing surface.
const patch = {
  evaluate: (u, v) => new THREE.Vector3(u, 0, v),
  getDomain: () => field.getDomain(),
};

// Arrows.
scene.add(new FieldArrows(patch as any, field, { uSegments: 14, vSegments: 14 }));

// An integral curve.
const curve = new FlowCurve(field, { initialPosition: [1, 0], steps: 800 });
scene.add(new CurveLine(patch, curve, { color: 0x00aaff }));
```

## Curves and trails

See [`math/patchcurves/`](../patchcurves/) for:

- `FlowCurve` — integrates a `VectorField` into a `(u, v)[]` trajectory.
- `CurveLine` — renders any `PatchCurve` on any `Surface`.
- `Trail` / `TrailTube` — streaming trail: push `(u, v)` each frame.

## What is **not** here

- **No Lie-derivative, no bracket `[X, Y]`** — none of the current primitives
  compose two fields. Cheap to add once we need it.
- **No `VectorField<n>` generic** — everything is 2D. The n-D sweep is tracked
  in `docs/planning/vector-fields-and-flows.md` and will also touch
  `FirstFundamentalForm` and `TangentVector`.

See the planning doc for the full roadmap (forms → symplectic → groups →
bundles → Riemann surfaces).
