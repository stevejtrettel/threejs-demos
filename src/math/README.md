# Mathematical Visualization Library

A modular, composable library for creating mathematical animations and visualizations in THREE.js.

## Architecture

The library is organized into **four conceptual layers**:

1. **Primitives**: Pure mathematical abstractions (no THREE.js scene objects)
2. **Builders**: Functions that transform math → THREE.js geometry
3. **Components**: Complete scene objects that extend THREE.js classes
4. **Helpers**: Utilities for composition and decoration

These layers are organized by **mathematical domain** rather than by type:

```
math/
├── types.ts              # Shared base types
├── surfaces/             # Parametric surfaces
├── curves/               # Parametric curves
├── geodesics/            # Geodesics on surfaces
└── shared/               # Cross-domain utilities
```

## Naming Conventions

Rather than deep folder nesting, we use naming conventions:

| Category   | Convention                  | Examples                                |
|------------|-----------------------------|-----------------------------------------|
| Primitives | Mathematical name only      | `Helicoid.ts`, `Torus.ts`, `GeodesicIntegrator.ts` |
| Builders   | `build*` or verb prefix     | `buildGeometry.ts`, `extractBoundary.ts` |
| Components | Ends with visual type       | `SurfaceMesh.ts`, `CurveLine.ts`, `GeodesicTrail.ts` |
| Helpers    | Descriptive of purpose      | `withNormals.ts`, `syncGeometry.ts` |
| Types      | Always `types.ts`           | `types.ts` |

## Quick Start

### Surfaces
```typescript
import { Torus } from '@/math/surfaces/Torus';
import { SurfaceMesh } from '@/math/surfaces/SurfaceMesh';

const torus = new Torus({ R: 2, r: 1 });
const mesh = new SurfaceMesh(torus, { color: 0x4488ff });
scene.add(mesh);

// Reactive updates
torus.params.set('R', 3);  // Mesh rebuilds automatically
```

### Geodesics
```typescript
import { Torus } from '@/math/surfaces/Torus';
import { SurfaceMesh } from '@/math/surfaces/SurfaceMesh';
import { GeodesicTrail } from '@/math/geodesics/GeodesicTrail';

const torus = new Torus({ R: 2, r: 1 });
const surface = new SurfaceMesh(torus, { transmission: 0.5 });
const geodesic = new GeodesicTrail(torus, {
  initialPosition: [0, 0],
  initialVelocity: [1, 0],
  color: 0xff0000
});

scene.add(surface);
scene.add(geodesic);

// In animation loop
function animate(time, delta) {
  geodesic.animate(time, delta);
}
```

### Custom Visualization
```typescript
import { Helicoid } from '@/math/surfaces/Helicoid';
import { buildGeometry } from '@/math/surfaces/buildGeometry';

const helicoid = new Helicoid({ pitch: 1.0 });
const geometry = buildGeometry(helicoid, { uSegments: 128 });
const material = new THREE.ShaderMaterial({ /* custom shader */ });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
```

## Design Principles

1. **Separation of Concerns**: Math doesn't know about visuals
2. **Composition**: Build complex objects from simple pieces
3. **Progressive Disclosure**: Simple for beginners, powerful for experts
4. **No Lock-In**: Can always drop down to raw THREE.js
5. **Reactivity**: Automatic updates via Params system
6. **Clean Dependencies**: Lower levels don't import higher levels

## Domain Structure

Each domain folder contains:
- `types.ts` - Domain-specific interfaces
- Primitive implementations (mathematical objects)
- Builders (math → THREE.js functions)
- Components (scene objects)
- `helpers/` - Domain-specific utilities
- `README.md` - Domain documentation

See individual domain READMEs for details:
- [surfaces/README.md](./surfaces/README.md)
- [curves/README.md](./curves/README.md)
- [geodesics/README.md](./geodesics/README.md)
- [shared/README.md](./shared/README.md)

## Adding New Content

### New Surface Type
```typescript
// Create: surfaces/MySurface.ts
import { DifferentialSurface, SurfaceDomain } from './types';
import { Params } from '@/Params';
import { Parametric } from '@/math/types';
import * as THREE from 'three';

export class MySurface implements DifferentialSurface, Parametric {
  readonly params = new Params(this);

  myParam!: number;

  constructor(options: { myParam: number }) {
    this.params.define('myParam', options.myParam);
  }

  evaluate(u: number, v: number): THREE.Vector3 {
    // Implementation
  }

  getDomain(): SurfaceDomain {
    // Implementation
  }

  computeNormal(u: number, v: number): THREE.Vector3 {
    // Implementation
  }

  computePartials(u: number, v: number) {
    // Implementation
  }

  computeMetric(u: number, v: number) {
    // Implementation
  }
}

// Use with existing infrastructure
const surface = new MySurface({ myParam: 2.0 });
const mesh = new SurfaceMesh(surface);  // Works automatically!
```

### New Domain
```bash
# Create new domain folder
mkdir src/math/vectorfields

# Add standard files
touch src/math/vectorfields/types.ts
touch src/math/vectorfields/README.md
mkdir src/math/vectorfields/helpers

# Follow naming conventions for contents
```

## Reactive Parameters

All math objects support reactive parameters via the `Params` system:

```typescript
class MyObject {
  readonly params = new Params(this);

  myValue!: number;

  constructor() {
    this.params.define('myValue', 10, {
      triggers: 'rebuild'  // or 'update' or 'none'
    });
  }

  rebuild() {
    // Called when myValue changes
  }
}
```

Dependencies are automatically tracked:
```typescript
const surface = new Torus({ R: 2, r: 1 });
const mesh = new SurfaceMesh(surface);

// Mesh automatically subscribes to surface param changes
surface.params.set('R', 3);  // mesh.rebuild() called automatically
```

## Status

Currently implemented:
- ✅ Folder structure and types
- ✅ Documentation
- ✅ Surface primitives (Torus, FunctionGraph)
- ✅ Surface builders (buildGeometry)
- ✅ Surface components (SurfaceMesh, SurfaceMesh.fromFunction)
- ✅ Geodesic integration (GeodesicIntegrator with bounded support)
- ✅ Geodesic visualization (GeodesicTrail)

See [design document](../../docs/math-type-design.md) for full architecture details.
