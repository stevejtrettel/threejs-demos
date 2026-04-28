# Lie groups, Lie algebras, and Poisson structures

Matrix Lie groups as a first-class domain in the math library. Covers the classical mechanics story (rigid body, spinning top, Lie-Poisson dynamics), group-theoretic coordinate systems, and — once later phases land — hyperbolic geometry via SL(2,ℝ) / SL(2,ℂ), and principal-bundle holonomy.

See [`docs/planning/lie.md`](../../../docs/planning/lie.md) for the full phased roadmap.

## Status

**Phase 1 — shipped.**
- `MatrixLieGroup` abstract base class (interface + defaulted `bracket`, `adjoint`, `coadjoint`, `multiply`, `leftTranslate`, `rightTranslate`).
- `SO(3)` with closed-form Rodrigues `exp`, inverse Rodrigues `log`, cross-product bracket, matrix-vector adjoint.
- `PoissonManifold` interface (sibling to `SymplecticManifold`).
- `PoissonGradient` — Hamiltonian vector field `X_H^i = π^{ij} ∂_j H` on a Poisson manifold.
- `liePoissonManifold(G)` — Lie-Poisson structure on `𝔤*` from a matrix Lie group, with cached structure constants.
- `RigidBody` — torque-free rigid-body splitting integrator.
- `so3ToMatrix4` — rendering glue for `THREE.js`.

**Phase 2+ — planned.**
- SU(2), SE(3), closed-form `exp` / `log` for each.
- Generic matrix `exp` / `log` via Padé scaling-and-squaring fallback.
- Polar / KAK factorization.
- Additional rendering glue (`so3ToQuaternion`, `se3ToMatrix4`).

## Storage conventions

| Object | Type | Notes |
|---|---|---|
| Group element `g ∈ G` | `Matrix` (`matrixSize × matrixSize`) | 3×3 for `SO(3)` |
| Algebra element `ξ ∈ 𝔤` | `number[]` of length `dim` | 3 for `so(3)` |
| Dual element `μ ∈ 𝔤*` | `number[]` of length `dim` | identified with `𝔤` via standard basis |
| Poisson tensor `π(p)` | `Float64Array(dim²)`, row-major | antisymmetric by contract |

`hat` and `vee` bridge algebra elements between `number[]` and `Matrix` form.

## Example — rigid body

```typescript
import { SO3, rigidBodyStep, so3ToMatrix4 } from '@/math';
import * as THREE from 'three';

const inertia: [number, number, number] = [1, 2, 3];
let state = {
  R: SO3.identity(),
  L: [0.01, 1.0, 0],   // near intermediate axis — Dzhanibekov regime
};

const box = new THREE.Mesh(
  new THREE.BoxGeometry(2, 1, 0.5),
  new THREE.MeshStandardMaterial({ color: 0x4488ff }),
);
const pose = new THREE.Matrix4();
scene.add(box);

function animate(_t: number, dt: number) {
  state = rigidBodyStep(state, dt, { inertia });
  so3ToMatrix4(state.R, pose);
  box.matrix.copy(pose);
  box.matrixAutoUpdate = false;
}
```

## Example — Lie-Poisson flow with generic `PoissonGradient`

```typescript
import {
  SO3, liePoissonManifold,
  rigidBodyHamiltonian, PoissonGradient,
  integrate, rk4,
} from '@/math';

const manifold = liePoissonManifold(SO3);
const H = rigidBodyHamiltonian([1, 2, 3]);
const X_H = new PoissonGradient(manifold, H);

// Same physics as rigidBodyStep's L equation, via the generic machinery.
const traj = integrate({
  deriv: (state, _t) => Array.from(X_H.evaluate(state)),
  initial: [0.01, 1.0, 0],
  dt: 0.01,
  steps: 1000,
  stepper: rk4,
});
```

## Testing

Phase-1 sanity checks live in [`smokeTest.ts`](./smokeTest.ts). They cover:

- Rodrigues identities and round-trips (`log(exp(ξ)) = ξ`, `exp(ξ)·exp(−ξ) = I`).
- Group axioms and adjoint identities on `SO(3)`.
- Cached structure constants reproduce the cross-product bracket.
- Jacobi identity on the Lie-Poisson bracket.
- Casimir `|L|²` and Hamiltonian `H` conservation during rigid-body evolution.
- `R Rᵀ = I`, `det R = 1` to 1e-10 over 10k+ steps.

Import `runLieSmokeTests()` from that file and call it — it returns pass/fail counts plus per-check details. The Dzhanibekov demo runs it on load for visibility.
