# Relativity

Spacetimes, coordinate charts, null geodesics, light cones, and optical
metrics — the machinery behind the black-hole demos.

## The one idea: charts are manifolds

A **spacetime** is a physical solution (`Schwarzschild` of mass `M`, a
`MajumdarPapapetrou` cluster of extremal holes). A **chart** is one coordinate
presentation of it, obtained with `spacetime.chart(name)`. Every chart
implements the n-D [`Manifold`](../manifolds/) interface, so the single
`geodesicDeriv` (in [`math/geodesics`](../geodesics/)) flows geodesics on any
of them — no per-chart integrator.

| Chart kind | Dimension | Signature | Geodesics are… |
| --- | --- | --- | --- |
| spacetime (`'standard'`, `'spacetime'`) | n+1 | Lorentzian `(−,+,…)` | worldlines; **null** ones are light rays |
| optical (`'optical'`) | n | Riemannian | spatial light-ray paths (Fermat) |

Geodesic character is fixed by the **initial velocity**, not the integrator:
flow preserves `g(v,v)` (see `geodesicNorm`), so a null start stays null. That
is why light cones and massive worldlines share one code path.

## Static spacetimes and the optical metric

Both demos are **static**: in adapted coordinates,

```
ds² = −N²(x) dt² + h_ij(x) dx^i dx^j.
```

`staticSpacetime.ts` builds both charts from a lapse `N²` and spatial metric
`h`:

- `spacetimeChart` — the Lorentzian `[t, x…]` chart.
- `opticalChart` — the **Fermat metric** `h/N²`, whose geodesics are the
  spatial projections of null geodesics (the optical-metric theorem). The
  horizon `N → 0` sits at infinite optical distance, so light "freezes" there.

`opticalMetric(chart)` derives the optical chart from *any* static
block-diagonal Lorentzian chart, generically — used to cross-check the
hand-written charts (the validation script confirms they agree to machine
precision). It refuses stationary charts with a `dt dx` cross term (those have
a Randers-type optical geometry).

For Schwarzschild the optical metric is the spiral geometry of the photon
sphere at `r = 3M`; for Majumdar–Papapetrou it is the conformally-flat `U⁴·δ`.

## Light cones

Two ways to build a cone, both returning the same `NullRay` grid that
`lightConeGeometry` sweeps into a closed `THREE.BufferGeometry`:

- `sampleLightCone(lorentzianChart, event)` — true null geodesics in a
  spacetime chart, plotted with the chart's `embed` (space flat, time vertical).
  Physically the coordinate-time cone; it **freezes at the horizon** because
  `dt/dλ → ∞` there (standard coordinates are singular).
- `sampleOpticalLightCone(opticalChart, event)` — the **wavefront** the legacy
  demos used: each null direction is flowed in the 2D *optical* metric and
  lifted by its optical arc length (`timeScale = 1` → a 45° cone). The optical
  metric merely *slows* light near a horizon, so rays spiral right up to the
  hole and the cone wraps/refocuses with no blow-up. This is the one to use for
  the interesting close-in behaviour.

Rays that hit a `stop` predicate (horizon buffer / near a hole) freeze, keeping
the grid rectangular; truncating the grid grows the cone over time.

**Conformal ↔ actual blend.** `traceOpticalCone` records, along each ray, both
the spatial proper length σ and the coordinate time `t` (= optical arc length).
`opticalConeRays` then truncates every ray at the same spatial reach σ and lifts
it by `height = (1 − blend)·σ + blend·t`:

- `blend = 0` — the **conformal/ultrastatic** cone (`−dt² + h`): height is
  spatial reach, a clean ~45° cone. This is what the legacy demos drew.
- `blend = 1` — the **actual static metric**: height is real coordinate time,
  which races ahead near a horizon (`dt/dσ = 1/N → ∞`) so the cone spikes up
  vertically while staying ~45° far away.

The legacy uniform-time construction is exactly `blend = 0`; the tipping you
expect physically is `blend = 1`.

## The funnel (b)

A rotationally-symmetric optical metric `h_rr dr² + ρ_c² dφ²` embeds as a
surface of revolution where `h_rr ≥ ρ_c'²`. `FunnelSurface.fromOpticalChart`
integrates the profile inward from the rim and stops where embedding fails, so
you get **the portion that embeds** — the classic optical funnel. It is a
`Surface` (mesh it) and exposes `lift(x, y)` to draw rays integrated in the
optical metric *on* the embedded surface.

## Conventions

- **Mostly-plus** signature `(−,+,…,+)`; `N² = −g_tt > 0`. Timelike `g(v,v)<0`,
  null `=0`, spacelike `>0`.
- Geometric units `G = c = 1`; mass `M` sets the length scale (`r_H = 2M`,
  photon sphere `3M`).
- The math layer is **THREE-free**. Charts return plot points as `[x,y,z]`
  tuples via `embed`; meshing (`funnel`, `lightcone`) is the only THREE part.

## Validating

```
node --import ./scripts/reg-alias.mjs scripts/validate-relativity.ts
```

Checks flat-space straightness, optical-metric norm preservation, the generic
vs analytic optical metric, MP `= U⁴δ`, null velocities, the **photon-sphere
orbit at r = 3M**, and the light-cone grid.

## Status / roadmap

- [x] Charts, static spacetimes, optical metric, null geodesics, light cones, funnel
- [x] Schwarzschild (`standard`, `optical`, `eddingtonFinkelstein`), Majumdar–Papapetrou (`spacetime`, `optical`)
- [x] Horizon-penetrating chart: ingoing Eddington–Finkelstein — regular at
      `r = 2M`, so cones tip *through* the horizon. Uses the optional
      `Chart.futurePointing` (advanced time `v = t̃ + r`) to pick the future
      null root where `g_t̃t̃` flips sign. Sample cones from *outside* the
      horizon (a spatial-direction ring is only well-defined there); their
      inward rays carry the picture across.
- [ ] Isotropic chart (also spatially conformally-flat, like MP)
- [ ] Analytic `computeChristoffel` overrides if a hot path needs them
