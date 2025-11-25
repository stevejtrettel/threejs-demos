# Shared Utilities

Cross-domain utilities that don't belong to a specific mathematical domain.

## What Goes Here

### Materials (`materials/`)
Custom materials and shaders used across multiple domains.

**Examples:**
- `createCurvatureMaterial.ts` - Visualizes Gaussian/mean curvature with color
- `createFlowMaterial.ts` - Animated flow visualization
- `shaderChunks.ts` - Reusable GLSL code snippets

### Animation (`animation/`)
Animation utilities and types.

**Examples:**
- `types.ts` - Animatable interface, animation controller types
- `createAnimationLoop.ts` - Higher-order animation loop helpers

### Other Shared Code
Any utilities that serve multiple domains:
- Color maps
- Interpolation functions
- Sampling utilities
- Math helpers (quaternions, etc.)

## Import Examples

```typescript
// Materials
import { createCurvatureMaterial } from '@/math/shared/materials/createCurvatureMaterial';

// Animation
import { Animatable } from '@/math/shared/animation/types';
```

## Usage Patterns

### Curvature Visualization
```typescript
import { Torus } from '@/math/surfaces/Torus';
import { buildGeometry } from '@/math/surfaces/buildGeometry';
import { createCurvatureMaterial } from '@/math/shared/materials/createCurvatureMaterial';

const torus = new Torus({ R: 2, r: 1 });
const geometry = buildGeometry(torus, { uSegments: 128, vSegments: 128 });
const material = createCurvatureMaterial({
  minCurvature: -2,
  maxCurvature: 2,
  colorScale: 'coolwarm'
});

const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
```

## Design Principles

- **No Domain Lock-In**: Utilities here should work with any domain
- **Composition**: Should be composable with domain-specific code
- **Optional**: Core functionality shouldn't depend on shared utilities
