# Curve rendering — plan

**Date:** 2026-04-22
**Status:** proposed

## Goal

Give the user two obvious, ergonomic ways to draw curves that live in a
coordinate patch, covering the two use cases that actually come up:

1. **Streaming:** state evolves frame by frame, a trail grows behind it.
   (Example: `linkage-4-geodesic` — drag ball, release, watch geodesic.)
2. **Precomputed / shared:** integrate once, draw on one or several
   surfaces. (Example: `vector-field-dual-view` — gradient field shown on
   graph and flat rectangle simultaneously.)

## API

### Streaming — `Trail` / `TrailTube`

Standalone classes. Own your state externally; push to the trail each
frame.

```ts
const trail = new Trail(surface, {
  maxPoints: 5000,
  color: 0xff5522,
  lineWidth: 2,
});
scene.add(trail);

// in animate:
trail.push(u, v);
```

Tube version, same API, mesh instead of line:

```ts
const trail = new TrailTube(surface, {
  maxPoints: 5000,
  radius: 0.12,
  color: 0xff5522,
});
```

Methods:
- `push(u, v)` — append one point (ring buffer when full).
- `clear()` — reset.
- `setAll(points)` — replace all points at once.

Reactive to surface param changes (if the surface morphs, existing points
re-map through the new `evaluate`).

### Precomputed — `FlowCurve` + `CurveLine` / `CurveTube`

```ts
const curve = new FlowCurve(field, { initialPosition, steps: 500 });
scene.add(new CurveLine(graph, curve));
scene.add(new CurveLine(flat,  curve));
```

`FlowCurve` integrates once on any field change; both `CurveLine`s render
the same `(u, v)[]` points through their own `Surface`. One computation,
many drawings.

`GeodesicCurve` mirrors `FlowCurve` for geodesics (added when a demo
wants it — parallel structure, small file).

## What replaces what

| Goes away | Replaced by |
| --- | --- |
| `src/math/vectorfields/FlowTrail.ts` | `Trail` for streaming; `FlowCurve` + `CurveLine` for precomputed |
| `src/math/vectorfields/FlowPolyline.ts` | `FlowCurve` (same thing, better name; no lazy/ensureFresh) |
| `src/math/vectorfields/FlowLine.ts` | `CurveLine` (generalized, drops "Flow") |
| `src/math/geodesics/GeodesicTrail.ts` | `Trail` if streaming; future `GeodesicCurve` + `CurveLine` if precomputed |

Four files out, three in, cleaner API.

## Framework prerequisite

`CurveLine.rebuild()` depends on both the surface and the curve. Today's
DFS cascade with visited-set doesn't guarantee source-before-dependent
order when both become dirty from the same root. Fix once, in
`src/Params.ts`, with **topological sort** (Kahn's algorithm, ~30 LoC,
cycle-guarded).

After that, `FlowCurve.rebuild()` just re-integrates eagerly and
`CurveLine.rebuild()` just reads `curve.getPoints()`. No `ensureFresh`,
no lazy flags, no special patterns.

## What the demos look like after

### `linkage-4-geodesic` trail (streaming)

Currently ~15 lines of trail plumbing (`trailBuffer`, `sphereLocalPoint`,
`trailPoints`, `pushTrail`, `NumericalCurve` seed, `CurveTube`
construction). After:

```ts
const trail = new TrailTube(abstractShell, {
  maxPoints: 5000,
  radius: 0.12,
  color: 0xff5522,
});
abstractGroup.add(trail);

// in animate:
trail.push(geoState[0], geoState[1]);
```

### `vector-field-dual-view` (precomputed, two surfaces)

Current (post-split): `FlowPolyline` + two `FlowLine`s with an
`ensureFresh` contract. After:

```ts
const curve = new FlowCurve(field, { initialPosition: start, steps });
scene.add(new CurveLine(graph, curve));
scene.add(new CurveLine(flat,  curve));
```

Same line count, but no footgun: both renders always show the curve that
the field currently produces.

## File list

**New — `src/math/patchcurves/`:**
- `types.ts` — `PatchCurve` interface (minimal, internal-ish).
- `Trail.ts` — streaming line renderer.
- `TrailTube.ts` — streaming tube renderer.
- `FlowCurve.ts` — integrates a `VectorField` into a `PatchCurve`.
- `CurveLine.ts` — renders any `PatchCurve` on a `Surface` as `THREE.Line`.
- `index.ts`, `README.md`.

**Deleted:**
- `src/math/vectorfields/FlowTrail.ts`
- `src/math/vectorfields/FlowPolyline.ts`
- `src/math/vectorfields/FlowLine.ts`
- `src/math/geodesics/GeodesicTrail.ts`

**Modified:**
- `src/Params.ts` — topological-sort cascade.
- `src/math/index.ts`, `vectorfields/index.ts`, `geodesics/index.ts` — exports.
- `demos/vector-field-dual-view/main.ts` — switch to `FlowCurve` +
  `CurveLine`.
- `demos/vector-field-gradient/main.ts` — switch to `FlowCurve` +
  `CurveLine` (or delete, since dual-view supersedes).
- `demos/linkage-4-geodesic/main.ts` — switch to `TrailTube`.
- `src/math/vectorfields/README.md` — remove the lazy/ensureFresh
  discussion entirely.

## Ordering of execution

1. Topological sort in `Params.ts` (framework fix).
2. Create `patchcurves/` module with the five files.
3. Migrate the three demos.
4. Delete the four old files + update exports.
5. Typecheck + eyeball each demo.

Each step leaves the repo compiling (we can migrate demos before deleting
old files, since both coexist until exports are swapped).

## Open questions

1. **`GeodesicCurve` now or later?** No current demo uses a precomputed
   geodesic on multiple surfaces. I'd defer — write it when `TrailTube`
   proves insufficient for a geodesic demo that wants multi-view.
2. **`CurveTube` as a precomputed renderer?** Not needed yet either. The
   streaming case is covered by `TrailTube`; the precomputed case is
   covered by `CurveLine`. Add `CurveTube` if a demo wants a pre-computed
   trajectory rendered as a tube.
