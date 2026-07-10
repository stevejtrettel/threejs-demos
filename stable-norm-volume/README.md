# stable-norm-volume

Self-contained, dependency-free TypeScript for computing the **inner estimate of
the stable-norm ball volume** of a hyperbolic once-punctured torus, as a function
over Teichmüller space. No renderer, no `npm` dependencies — copy the folder into
your project and call the functions; draw the result with whatever you like
(three.js, etc.).

## What it computes

For a hyperbolic structure on the once-punctured torus, the stable norm on
`H₁(T;ℝ) ≅ ℝ²` has a centrally symmetric convex unit ball. We approximate it from
inside: every simple closed curve of slope `(p, q)` and hyperbolic length `ℓ`
contributes the boundary point `±(p, q)/ℓ`; the convex hull of these is an inner
polygon, and its **area** is the functional

```
V(structure) = area of conv{ ±(p,q)/ℓ : simple curves out to radius R }.
```

`V` is the height you graph over Teichmüller space.

## The math (brief)

A structure is a trace triple `(x, y, z) = (tr A, tr B, tr AB)` on the **Markoff
cubic** `x² + y² + z² = xyz` (the cusp condition `tr[A,B] = −2`). Curve traces
come from the **Vieta recurrence** `t(u+v) = t(u)·t(v) − t(u−v)` over the Farey
tree, lengths from `ℓ = 2·arccosh(|t|/2)`. No matrices are needed. (Fuller
write-ups — including the matrix and cutting-sequence routes, and the outer
approximation — live in the parent project.)

## Domain: Teichmüller space / the rep variety

Teichmüller space here is 2-real-dimensional, matching the Markoff cubic surface
`{x² + y² + z² = xyz}` in `ℝ³` (the relevant Fuchsian component, through
`(3,3,3)`). Two natural ways to graph `V`:

- **Over the `(x, y)` plane.** `tripleFromTraces(x, y)` solves the cubic for `z`
  (minus branch, the sheet through the modular torus) and returns `null` outside
  Teichmüller space. Sweep an `(x, y)` grid, height = `V`. This is the "right
  projection" of the rep variety — projecting the cubic surface onto `(x, y)`.
- **On the cubic surface itself.** The same `tripleFromTraces(x, y)` gives the
  surface point `(x, y, z)`; render that surface in 3D and use `V` as color or
  as displacement along the normal.

## API

```ts
import {
  modularTorus, tripleFromTraces, generateCurves,
  normBallSamples, normBallHull, normBallArea, normBallAreaAt,
  type TraceTriple, type Vec2,
} from "./stable-norm-volume";

normBallAreaAt(x, y, R): number | null   // volume at (x,y); null if outside Teich
normBallArea(triple, R): number          // volume for an explicit triple
normBallHull(triple, R): Vec2[]          // the inner polygon (to draw the ball)
normBallSamples(triple, R): Vec2[]       // raw ±(p,q)/ℓ point cloud
generateCurves(triple, R): Curve[]       // { slope, trace, length } per curve
tripleFromTraces(x, y): TraceTriple|null // chart: (x,y) → (x,y,z) on the cubic
```

`Vec2 = readonly [number, number]`. `Curve = { slope: { p, q }, trace, length }`.

## Graphing it (renderer-agnostic)

```ts
const R = 30;            // sampling cutoff (see notes)
const N = 120;           // grid resolution
const lo = 2.9, hi = 6;  // (x,y) window around the modular torus

for (let i = 0; i < N; i++) {
  for (let j = 0; j < N; j++) {
    const x = lo + (hi - lo) * (i / (N - 1));
    const y = lo + (hi - lo) * (j / (N - 1));
    const v = normBallAreaAt(x, y, R);   // null ⇒ outside Teich: leave a hole
    if (v !== null) addVertex(x, y, v);  // ← your three.js mesh / surface here
  }
}
```

Build a surface mesh from the `(x, y, v)` samples (skip `null`s, or treat the
`null` region as the boundary of the graph).

## Notes & caveats

- **Inner estimate, finite radius.** `V` rises monotonically toward the true ball
  volume as `R → ∞`. Use a fixed `R` across the whole grid so the surface is
  consistent; `R ≈ 20–40` is a good range. Cost per evaluation grows like `R²`
  (`R = 30` ≈ 850 curves), so precompute the grid once.
- **Domain boundary.** `V` is defined where `tripleFromTraces` is non-null
  (discriminant `≥ 0`) *and* the structure stays hyperbolic; near the boundary a
  curve pinches, `ℓ → 0`, points fly off, and the area diverges — the graph shoots
  up toward the edges of Teichmüller space.
- **The minimum is the modular torus.** `(3,3,3)` is the most symmetric structure
  and the **minimum** of `V` (`≈ 0.892` at `R = 40`); the surface is a shallow bowl
  there and grows outward. (It's the systole *maximizer* — the same fact seen
  inversely.) Sanity check: `normBallArea(modularTorus, 40) ≈ 0.892`.
- **Symmetry.** `V` inherits the symmetries of the Markoff cubic (permuting the
  roles of the three traces), so the graph has matching symmetry about the
  diagonal in the `(x, y)` chart.

## Files

```
curves.ts     Slope + the Vieta trace recurrence → { slope, trace, length }
chart.ts      tripleFromTraces: (x, y) → (x, y, z) on the Markoff cubic
norm-ball.ts  samples, convex hull, polygon area → normBallArea / normBallAreaAt
index.ts      public API
```
