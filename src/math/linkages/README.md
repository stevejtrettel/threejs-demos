# Linkages

Planar and spatial linkages — graphs of joints connected by rigid rods.

## Data Model

A linkage is a graph. Joints (nodes) may be pinned or free; rods (edges) carry a rest length that acts as a constraint. Configurations are stored as **joint positions** — a flat `Float32Array` with stride = `dim`. Rod-length equations `|p_a − p_b|² = L²` are implicit; the configuration space is the algebraic variety they cut out in the position-coordinate ambient.

Chain-like topologies get an angle-based convenience layer in `PlanarChain.ts`, but angles are just a view onto positions — the primitive is topology-agnostic.

## What Goes Here

### Primitives
- `Linkage.ts` — graph + positions, with constraint residuals and Jacobian.
- `LinkagePath.ts` — parameterized path `t ∈ [0, 1] → positions`.

### Components
- `LinkageMesh.ts` — renders a `Linkage` as rod cylinders + joint spheres. One mesh per rod/joint, so per-frame updates re-pose only.

### Helpers
- `PlanarChain.ts` — `buildPlanarChain({ lengths, pinA, pinB })` and `setChainAngles(linkage, θ)`.

## Import

```typescript
import {
  Linkage,
  LinkageMesh,
  buildPlanarChain,
  setChainAngles,
  LinkagePath,
} from '@/math/linkages';
```

## Usage

```typescript
const chain = buildPlanarChain({
  lengths: [1, 1, 1],
  pinA: [-1.2, 0],
  pinB: [1.2, 0],
});
const mesh = new LinkageMesh(chain, { rodRadius: 0.04 });
scene.add(mesh);

// Pose by angles (forward kinematics)
setChainAngles(chain, [Math.PI / 4, 0, -Math.PI / 4]);

// Inspect closure error (for a chain, this is how far the last joint is from pinB,
// expressed as the rod-length residuals)
console.log(chain.constraintResiduals());
```

## Convention

- Angles are measured globally from the +x axis.
- Positions use stride = 2 for planar, 3 for spatial. Default `dim = 2`.

## Growth Path

Pass 2 will add a Newton projection `linkage.project()` onto the constraint variety, a `tangentBasis()` helper, and constrained ODE integration for physical motion.
