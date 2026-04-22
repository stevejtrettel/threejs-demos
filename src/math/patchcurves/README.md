# Patch curves

Curves that live in a 2D coordinate patch — a `(u, v)[]` polyline — plus
renderers that draw them on arbitrary surfaces.

Two shapes cover the use cases we actually see:

## Streaming: `Trail` / `TrailTube`

For "state evolves frame by frame and I want a trail behind it."
Standalone classes; own your state externally, push each frame.

```ts
const trail = new Trail(sphere, { maxPoints: 5000, color: 0xff5522 });
scene.add(trail);

// animate loop:
trail.push(u, v);
```

`TrailTube` has the same API, renders as a mesh tube:

```ts
const trail = new TrailTube(sphere, { maxPoints: 5000, radius: 0.12 });
```

Methods: `push(u, v)`, `reset()`, `setAll(points)`. Reactive to surface
param changes — if the surface morphs, existing points re-map through
the new `evaluate`.

## Precomputed: `FlowCurve` + `CurveLine`

For "integrate once, draw in multiple places." Producer + renderer
decomposition.

```ts
const curve = new FlowCurve(field, { initialPosition, steps: 500 });
scene.add(new CurveLine(graph, curve));
scene.add(new CurveLine(flat,  curve));
```

`FlowCurve` integrates on any upstream change; both `CurveLine`s render
the same `(u, v)[]` through their own `Surface`.

### Why not always use precomputed?

Streaming has different semantics: points come in one at a time from
user-owned state (physics integration, drag events, etc.), and it would
be awkward to pipe that through a reactive producer. The two APIs reflect
two genuinely different use patterns.

## Producers implement `PatchCurve`

The `PatchCurve` interface is minimal:

```ts
interface PatchCurve {
  getDomain(): SurfaceDomain;
  getPoints(): ReadonlyArray<[number, number]>;
  readonly params: Params;
}
```

`FlowCurve` implements it. A future `GeodesicCurve` will too. You can
also supply one manually (e.g., from a file, from a symbolic
parameterization of a curve in the patch). `CurveLine` renders any of
them uniformly.

## Topological cascade

`CurveLine` depends on both a surface and a curve. When both become dirty
from the same root (e.g., a scalar field that drives both the graph
surface and the gradient field), the framework walks the dependent DAG
in topological order, guaranteeing that `CurveLine.rebuild()` fires
*after* both sources have been rebuilt. No manual ordering, no lazy
flags — it just works.
