# Auto-cascading `Params` — plan

**Date:** 2026-04-22
**Status:** proposed (awaiting approval)

## Goal

Make the `Params` reactivity system automatically walk the full dependent
DAG on `triggers: 'rebuild'` / `triggers: 'update'`. Today it only notifies
*direct* dependents — intermediate nodes have to hand-write a pass-through
`rebuild()` that iterates `getDependents()`. Forgetting it silently leaves
downstream state stale. We want the framework to handle propagation, so
intermediate nodes only write `rebuild()` when they have real local work.

Out of scope for this plan: deduplication / topological flushing of redundant
fires. That's phase B in the earlier discussion, deferred until there's a
demo that visibly suffers from it.

## Exact inventory of affected files

The whole surface of the change is small. I grepped `getDependents` and
manual `.rebuild()` / `.update()` call sites across `src/` and `demos/`.

### Files that gain real behavior (`Params.ts`)

| File | Change |
| --- | --- |
| `src/Params.ts` | Replace the two trigger blocks in `define()` with a single recursive cascade helper (cycle-safe via visited set). |

### Pure pass-through `rebuild()`s that get deleted

These three methods today do nothing except iterate `getDependents()` and
call `dependent.rebuild()`. After auto-cascade they become redundant —
keeping them would cause each dependent's `rebuild()` to fire **twice**
(once from the framework, once from the manual loop). Delete entirely.

| File | Lines | Current contents |
| --- | --- | --- |
| `src/math/surfaces/FunctionGraph.ts` | 122–129 | `rebuild() { for (const dep of this.params.getDependents()) dep.rebuild?.(); }` |
| `src/math/vectorfields/GradientField.ts` | 56–62 | Same shape (I just added it in phase 1). |
| `demos/vector-field-gradient/main.ts` | 66–72 | `BumpyField.rebuild()` — same shape. |

### `rebuild()`s / `update()`s that do real work — no change needed

Verified (via grep): none of these iterate `getDependents()` or hard-code a
specific dependent's `rebuild()`. They just do their own local work. Under
auto-cascade they continue to do that local work; the framework handles
propagation to *their* dependents afterwards.

```
src/math/curves/ParametricCurve.ts:75     (rebuild — geometry)
src/math/curves/NumericalCurve.ts:75      (rebuild — geometry)
src/math/curves/CurveTube.ts:108,129      (rebuild + update — tube)
src/math/surfaces/SurfaceMesh.ts:217,239  (rebuild + update — mesh)
src/math/surfaces/EllipticCurveMesh.ts:158,165
src/math/geodesics/GeodesicIntegrator.ts:327
src/math/geodesics/GeodesicTrail.ts:324,417
src/math/vectorfields/FlowTrail.ts:242,304
src/math/hopf/HopfTorus.ts:286
src/math/linkages/Linkage.ts:54
src/math/linkages/LinkageMesh.ts:121,154
```

### Docs

| File | Change |
| --- | --- |
| `src/math/README.md` | The "Reactive Parameters" section claims dependencies are auto-tracked. Today that's half-true (direct dependents only). Tighten the example + note that transitive cascade is automatic. |
| `src/types.ts` | Update the JSDoc on `ParamOptions.triggers` to note the cascade is transitive. |

No new tests required — the math-selftest demo plus a visual run of
`vector-field-gradient` (which exercises a 4-deep chain) is sufficient
verification.

## The `Params.ts` change — design detail

### Current (lines 82–103, elided)

```ts
if (options.triggers === 'rebuild') {
  if (typeof owner.rebuild === 'function') owner.rebuild();
  for (const dependent of paramsInstance.dependents) {
    if (typeof dependent.rebuild === 'function') dependent.rebuild();
  }
} else if (options.triggers === 'update') {
  if (typeof owner.update === 'function') owner.update();
  for (const dependent of paramsInstance.dependents) {
    if (typeof dependent.update === 'function') dependent.update();
  }
}
```

### Proposed

A single module-scoped helper, used by both branches:

```ts
/**
 * Walk the dependent DAG rooted at `node`, calling `method` on each
 * reachable Parametric object once. Visited-set guards against cycles —
 * the Params DAG is conceptually acyclic, but nothing in the API prevents
 * a user from introducing one, and silent infinite recursion would be
 * a miserable bug to debug.
 */
function cascade(node: any, method: 'rebuild' | 'update', visited: Set<any>): void {
  if (visited.has(node)) return;
  visited.add(node);

  if (typeof node[method] === 'function') {
    node[method]();
  }

  const params = node?.params;
  if (params && typeof params.getDependents === 'function') {
    for (const dep of params.getDependents()) {
      cascade(dep, method, visited);
    }
  }
}
```

Then the setter body becomes:

```ts
if (options.triggers === 'rebuild' || options.triggers === 'update') {
  cascade(owner, options.triggers, new Set());
}
// 'none' or undefined: unchanged — do nothing.
```

### Design decisions, made explicit

1. **Shared helper for both triggers.** Same walk, different method name.
   Keeps the two trigger types symmetric by construction, so there's no
   drift.
2. **Visited set always allocated.** Allocation cost is trivial compared to
   the rebuild work. Simpler than optimizing for the common "no cycle"
   case.
3. **`onChange` callback stays in place.** Fires before the cascade (current
   behavior). It's a local-only hook; semantics unchanged.
4. **Bail silently on non-`Parametric` nodes.** If some node in the graph
   doesn't have `.params`, stop recursing *through* it but still call its
   method. Matches the existing `dependOn()` behavior, which ignores
   non-`Parametric` sources silently.
5. **No return value.** A future "I didn't actually change, skip me"
   short-circuit would be a `rebuild(): boolean` convention — not adding
   until a demo wants it. Keeps the API minimal.
6. **`getDependents()` stays public.** It's now almost vestigial (only
   `Params.ts` itself consumes it internally), but leaving the API
   surface alone means no import breakage for any external code.

## Execution order

Strictly in this order, so at no point is the repo in a "both cascading"
state where rebuilds double-fire:

1. **Delete the three pass-through `rebuild()`s** (`FunctionGraph`,
   `GradientField`, `BumpyField` in the demo). At this moment the repo is
   *broken* — dependents downstream of these nodes won't rebuild.
2. **Land the `Params.ts` cascade change.** Repo is fixed again; now the
   framework handles propagation.
3. **Update the two doc files** (`src/math/README.md`, `src/types.ts`
   JSDoc).
4. **Validate** — run demos:
   - `demos/vector-field-gradient/main.ts` — should still morph the surface
     + re-flow trails every frame (this is the 4-deep chain:
     `BumpyField → FunctionGraph → SurfaceMesh` and
     `BumpyField → GradientField → FlowTrail`).
   - `demos/linkage-4-geodesic/main.ts` — non-trivial existing demo,
     smoke-test.
   - One surface demo and one curve demo, for breadth.
5. **Typecheck** — `npx tsc --noEmit` shows no new errors beyond the
   existing baseline.

Steps 1 and 2 should land in a single commit (no intermediate broken state
on disk, just during the edit session).

## Risks & how they're handled

| Risk | Mitigation |
| --- | --- |
| A real-work `rebuild()` I missed was also manually cascading → now double-fires. | Grep covered both `getDependents` and explicit `.rebuild()` / `.update()` call sites. Inventory above is exhaustive; no other call sites cascade. |
| Someone adds a cycle to the dep graph (bug) → infinite recursion without visited set. | Visited set included from day one. |
| A non-`Parametric` dependent gets added to a `dependents` set and recursion tries to read `.params`. | Guarded by `params && typeof params.getDependents === 'function'`. |
| Performance regression from the extra function calls + Set allocation. | Cascade is the same depth as the existing single-hop case in ~all demos today. Set allocation once per `set()` is negligible relative to the rebuild work being scheduled. |
| Pass-through `rebuild()` accidentally re-added later by force of habit. | Doc updates call out that it's no longer required. |

## What this unlocks (for later plans)

- **Phase B — dedup / topological flushing.** With propagation in the
  framework, dedup becomes a drop-in change to `cascade()`: maintain a
  per-frame dirty set, flush before render. No API changes required.
- **Simpler new domain authoring.** Forms, symplectic, groups — the
  authors don't have to remember the pass-through incantation. Just
  `dependOn(...)` and `rebuild()` if there's local state; otherwise
  nothing.
