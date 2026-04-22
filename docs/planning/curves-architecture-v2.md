# Curves architecture — decomposition proposal

**Date:** 2026-04-22
**Status:** proposal, awaiting decision
**Context:** fourth pass on this module. Previous passes (FlowTrail+GeodesicTrail → FlowPolyline+FlowLine → Trail/TrailTube/FlowCurve/CurveLine) each reduced duplication but didn't fully eliminate it. This plan proposes the decomposition I believe we should have arrived at from the start, with honest tradeoffs.

## Problem statement

The current `src/math/patchcurves/` module has four classes that each own some subset of the same three responsibilities:

| Class | Owns `(u, v)[]` storage? | Owns (u, v) → Vector3 mapping? | Owns rendering (Line / Tube)? |
| --- | --- | --- | --- |
| `FlowCurve` | yes (passive) | no | no |
| `CurveLine` | no (reads from producer) | yes | line |
| `Trail` | yes (ring buffer) | yes | line |
| `TrailTube` | yes (ring buffer) | yes | tube (via `NumericalCurve` + `CurveTube`) |

The ring-buffer logic lives in two classes. The surface-mapping logic lives in three. Adding a new integrator (e.g. `GeodesicCurve`) would naturally require adding bundled `GeodesicTrail` / `GeodesicTrailTube` classes too — the pattern proliferates.

## Proposed architecture — three boxes

```
  producer            adapter                   renderer
(stores (u,v)[])   (maps via surface)      (existing THREE machinery)

  FlowCurve   ──┐                          ┌─→ CurveTube   (existing)
  StreamPoints ─┼→ CurveOnSurface  ────────┤
  GeodesicCurve┘  (returns NumericalCurve) └─→ CurveLine    (new, 3D)
  (future)
```

Each box has one responsibility. Producers don't know about surfaces. The adapter doesn't know about rendering. Renderers don't know about `(u, v)` — they consume the existing 3D `NumericalCurve` interface. New producers slot in with no new renderers. New rendering styles work with any producer.

### The pieces

**Producers — implement `PatchCurve`:**
- `FlowCurve(field, opts)` — integrates a `VectorField`, stores `(u, v)[]`. Reactive to field.
- `StreamPoints(opts)` — mutable `(u, v)[]` with `push` / `setAll` / `reset`. Ring buffer with *proper* wrap (shift on push-when-full, one canonical fix).
- `GeodesicCurve(patch, opts)` — future. Implements the same interface.

`PatchCurve` interface is two methods: `getPoints(): ReadonlyArray<[number, number]>` and `readonly params: Params`. Drop the unused `getDomain`.

**Adapter:**
- `CurveOnSurface(patchCurve, surface)` — extends `NumericalCurve`. On cascade rebuild, maps each `(u, v)` through `surface.evaluate`, calls `super.updatePoints(vec3s)`. Depends on `(patchCurve, surface)`. Users treat it as a `NumericalCurve` — pass it to any existing renderer.

**Renderers (in `math/curves/`, working on 3D curves):**
- `CurveTube` — already exists.
- `CurveLine` — **new, ~40 LoC**. Takes a `Curve` (3D), produces a `THREE.Line`. Fills a real gap: there's no current way to render a `NumericalCurve` as a thin line (only as a tube).

**Optional ergonomic wrappers** — because "3 classes for a single-surface trail" feels heavy:
- `StreamLine(surface, opts)` — thin `THREE.Group` wrapper composing `StreamPoints + CurveOnSurface + CurveLine`. Exposes `push`, `reset`, `setAll`.
- `StreamTube(surface, opts)` — same shape, exposes tube.

These are trivial (~30 LoC each, no new logic) and can be skipped if we decide "no, force users to compose the primitives."

## What demos look like

### linkage-4-geodesic (streaming tube, single surface)

**Current:**
```ts
const trail = new TrailTube(abstractShell, {
  maxPoints: 5000, radius: 0.12, color: 0xff5522,
});
abstractGroup.add(trail);
// animate: trail.push(phi, t);
```

**Proposed with wrapper:**
```ts
const trail = new StreamTube(abstractShell, {
  maxPoints: 5000, radius: 0.12, color: 0xff5522,
});
abstractGroup.add(trail);
// animate: trail.push(phi, t);
```

Identical. Wrapper name changes, nothing else.

**Proposed without wrapper (if we decide to skip wrappers):**
```ts
const pts = new StreamPoints({ maxPoints: 5000 });
const lifted = new CurveOnSurface(pts, abstractShell);
const tube = new CurveTube({ curve: lifted, radius: 0.12, color: 0xff5522 });
abstractGroup.add(tube);
// animate: pts.push(phi, t);
```

3 vars instead of 1. Each line does one thing. More explicit, more verbose.

### vector-field-dual-view (precomputed, two surfaces)

**Current:**
```ts
const curve = new FlowCurve(grad, { initialPosition, steps });
scene.add(new CurveLine(graph, curve, { color: 0xff5500 }));
scene.add(new CurveLine(flat,  curve, { color: 0xff5500 }));
```

**Proposed:**
```ts
const curve = new FlowCurve(grad, { initialPosition, steps });
scene.add(new CurveLine({ curve: new CurveOnSurface(curve, graph), color: 0xff5500 }));
scene.add(new CurveLine({ curve: new CurveOnSurface(curve, flat),  color: 0xff5500 }));
```

One extra `new CurveOnSurface(...)` per render. Could hide behind a helper:

```ts
const on = (surface) => new CurveOnSurface(curve, surface);
scene.add(new CurveLine({ curve: on(graph), color: 0xff5500 }));
scene.add(new CurveLine({ curve: on(flat),  color: 0xff5500 }));
```

### Bonus: multi-surface *streaming* (doesn't work today)

Current architecture can't do this — `Trail` / `TrailTube` bundle one surface per instance. You'd have to push to two separate trails and keep them in sync. Proposed architecture makes it trivial:

```ts
const pts = new StreamPoints({ maxPoints: 5000 });
scene.add(new CurveTube({ curve: new CurveOnSurface(pts, graph), radius: 0.1 }));
scene.add(new CurveTube({ curve: new CurveOnSurface(pts, flat),  radius: 0.1 }));
// animate: pts.push(u, v);  // both tubes update from the same source
```

## Code delta

**Delete:**
- `src/math/patchcurves/Trail.ts` (~155 LoC)
- `src/math/patchcurves/TrailTube.ts` (~130 LoC)
- `src/math/patchcurves/CurveLine.ts` (~95 LoC)

**Add:**
- `src/math/patchcurves/StreamPoints.ts` (~90 LoC — ring buffer + fix for wraparound)
- `src/math/patchcurves/CurveOnSurface.ts` (~60 LoC — extends `NumericalCurve`)
- `src/math/curves/CurveLine.ts` (~50 LoC — render a 3D curve as `THREE.Line`)
- *(optional)* `src/math/patchcurves/StreamLine.ts` + `StreamTube.ts` (~40 LoC each)

**Modify:**
- `FlowCurve` — drop unused `getDomain`, minor cleanup
- `PatchCurve` interface — drop `getDomain`
- All three demos — migrate (small)
- Barrels + READMEs

**Net LoC:** ~380 deleted, ~200–280 added → **100–180 fewer LoC**. Plus the duplication goes away, which is the actual win — future producers (`GeodesicCurve` etc.) don't need parallel bundled classes.

## Three options

### Option X: Do the refactor

**Pros:**
- No duplicated ring-buffer or mapping logic
- Ring-buffer wraparound bug fixed in one place
- Extensibility: new producers work with all renderers for free
- Enables multi-surface streaming (no current demo needs it, but it's natural)
- Cleaner mental model: three independent boxes

**Cons:**
- Fourth refactor of the same module
- Demos need migration *again*
- `CurveOnSurface` is a new concept users have to learn. It's the right abstraction but it's one more name than current
- Without wrappers, single-surface cases get more verbose (2–3 lines instead of 1)
- With wrappers, we end up with 4 patchcurves classes + 2 wrappers = 6 names, not radically fewer than current

### Option Y: Defer. Keep current system. Move to forms.

**Pros:**
- Current system works. Demos pass. Typecheck clean.
- No more iteration cost on this module
- User can actually make progress on the math (forms, symplectic)
- Duplication is real but small; ~250 LoC of overlap in a ~530 LoC module

**Cons:**
- Duplication persists. Adding `GeodesicCurve` later will mean adding parallel bundled classes or doing this refactor then anyway
- Ring-buffer wraparound bug lives on until someone hits it
- Architectural smell — `patchcurves/` has two competing patterns (bundled `Trail*` vs split `FlowCurve + CurveLine`)

### Option Z: Minimal dedup. Keep the shape; extract one helper.

Extract the ring-buffer logic into a single internal helper (`PointRingBuffer` class in `patchcurves/internal.ts`). `Trail` and `TrailTube` both use it. No API changes, no demo migration.

**Pros:**
- Cheapest fix. One new internal file, ~60 LoC.
- Ring-buffer wraparound can be fixed here once.
- Doesn't commit to any larger redesign.

**Cons:**
- Doesn't fix the surface-mapping duplication (`Trail`, `TrailTube`, `CurveLine` still each do it)
- Doesn't enable multi-surface streaming
- Future producers still need parallel bundled classes
- Doesn't satisfy the "three boxes" complaint — just dedups one slice

## Honest recommendation

**Option Y (defer).**

Reasons:
1. I've iterated on this module four times now. Each iteration was defensible in isolation but the cumulative cost is real. One more refactor to "clean it up" risks a fifth one when the next concern emerges.
2. Current system has duplication but *works*. No demo is broken. The ring-buffer wraparound is a bug but it's not biting anyone.
3. Forms + symplectic are the actual payoff path. Every hour spent on curve-rendering architecture is an hour not spent there.
4. If adding `GeodesicCurve` later reveals that the bundled-class pattern really can't scale, we do Option X then — with a concrete driver, not speculation.

**Option X** is architecturally cleaner and I'd choose it if we were starting fresh. Given we're not, deferring costs us some duplication but saves the churn and lets us get to the math.

**Option Z** is tempting as "something" but it's half a refactor. It doesn't cleanly land on either side of the design question.

## What I will NOT do

- Propose a fifth architecture a week from now to "fix" whatever I find
- Iterate on this plan. If you say "do X," I do X and stop. If you say "do Y," I do nothing and we move to forms. If you say "do Z," Z and stop.
- Relitigate the tradeoffs in a follow-up message. They're all here.

The decision is yours. I stop touching this module until you tell me to.
