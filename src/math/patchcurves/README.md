# Patch curves

Curves in a 2D coordinate patch, decomposed into three independent concerns:

```
   producer              adapter                   renderer
(stores (u,v)[])     (maps via surface)       (existing, from math/curves/)

  FlowCurve      ─┐                            ┌─→ CurveTube
  StreamPoints   ─┼→ CurveOnSurface   ─────────┤
  (future:        │  (exposes .curve:          └─→ CurveLine
   GeodesicCurve)─┘   NumericalCurve)
```

Each box has one responsibility. Producers don't know about surfaces.
The adapter doesn't know about rendering. Renderers consume the existing
`NumericalCurve` interface — they don't know about `(u, v)` or patches.

## Producers

All implement `PatchCurve` (`getPoints()` + `params`):

| Class | What it is |
| --- | --- |
| `FlowCurve` | Integrates a `VectorField` end-to-end on construction / on any upstream change. Reactive to field params. |
| `StreamPoints` | Mutable `(u, v)[]` with `push`, `setAll`, `reset`. Ring buffer when full (drops oldest; `getPoints()` always returns logical order, so no visual seam). |

## Adapter

`CurveOnSurface(patchCurve, surface)` — maps every `(u, v)` through
`surface.evaluate`, exposes a reactive `NumericalCurve` via `.curve`.
Rebuilds when the producer or the surface changes.

```ts
const lifted = new CurveOnSurface(patchCurve, surface);
scene.add(new CurveTube({ curve: lifted.curve, radius: 0.1 }));
```

## Ergonomic wrappers for single-surface streaming

The common "trail behind evolving state, one surface, one rendering"
case gets a wrapper that bundles everything:

```ts
const trail = new StreamTube(surface, { maxPoints: 5000, radius: 0.12 });
scene.add(trail);
// in animate:
trail.push(u, v);
```

Also `StreamLine` (same shape, renders as `THREE.Line`).

For **multi-surface streaming**, don't use the wrappers — compose
directly:

```ts
const pts = new StreamPoints({ maxPoints: 5000 });
scene.add(new CurveTube({ curve: new CurveOnSurface(pts, graph).curve, radius: 0.1 }));
scene.add(new CurveTube({ curve: new CurveOnSurface(pts, flat ).curve, radius: 0.1 }));
// animate: pts.push(u, v);  // both tubes update from the same source
```

## Topological cascade

Producers, adapters, and renderers all depend on their respective
upstream nodes via `Params.dependOn`. The framework walks the dependent
DAG in topological order on every change, so adapters always see
fresh producer points before a downstream renderer reads them. No
manual ordering, no lazy flags.
