# Geodesics

Geodesic integration on a `MetricPatch` — the "straightest possible" paths
given a Riemannian metric on a 2D coordinate patch.

## What's here

- `GeodesicIntegrator.ts` — RK4 integration of the geodesic equation
  `d²x^k/dt² = −Γ^k_ij (dx^i/dt)(dx^j/dt)`. Works on any `MetricPatch`
  (so intrinsic metrics work, not just embedded surfaces).
- `types.ts` — `TangentVector`, `GeodesicState`, `BoundaryEdge`,
  `BoundedIntegrationResult`.

## Curve rendering

Geodesic *visualization* lives in [`math/patchcurves/`](../patchcurves/):

- **Streaming** (watch a geodesic grow as state evolves, e.g.
  `linkage-4-geodesic`): own a `TangentVector`, call
  `integrator.integrate(state)` each frame, push `state.position` to a
  `StreamLine` or `StreamTube`.
- **Precomputed** (draw a geodesic on one or more surfaces): a future
  `GeodesicCurve` primitive in `patchcurves/` will play the role
  `FlowCurve` plays for vector fields. Add it when a demo wants it —
  parallel structure, small file.

## Import example

```ts
import { GeodesicIntegrator } from '@/math/geodesics/GeodesicIntegrator';
import { StreamTube } from '@/math';  // from patchcurves/
```

## Usage — streaming a geodesic on a torus

```ts
import { Torus, SurfaceMesh, GeodesicIntegrator, StreamTube } from '@/math';
import type { TangentVector } from '@/math/geodesics/types';

const torus = new Torus({ R: 2, r: 1 });
scene.add(new SurfaceMesh(torus));

const trail = new StreamTube(torus, { maxPoints: 2000, radius: 0.02, color: 0xff0000 });
scene.add(trail);

const integrator = new GeodesicIntegrator(torus, { stepSize: 0.01 });
let state: TangentVector = { position: [0, 0], velocity: [1, 0] };

function animate(time: number, delta: number) {
  state = integrator.integrate(state);
  trail.push(state.position[0], state.position[1]);
}
```

## Design notes

See `docs/planning/metric-patch-refactor.md` for the split between
`MetricPatch` (intrinsic metric) and `DifferentialSurface` (embedding +
induced metric). Geodesic integration only needs the former, which is why
it works for linkage configuration spaces and other abstract patches that
have no natural 3D embedding.
