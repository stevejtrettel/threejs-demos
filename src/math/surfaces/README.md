# Surfaces

Parametric surfaces and differential geometry.

## What Goes Here

### Primitives (Mathematical Objects)
Pure mathematical surface definitions. No THREE.js dependencies except Vector3/Matrix3 math types.

**Examples:**
- `Helicoid.ts` - Helicoid surface
- `Torus.ts` - Torus surface
- `Sphere.ts` - Spherical surface
- `ParametricSurface.ts` - Generic surface from user function

**Interface:** Implement `Surface` or `DifferentialSurface` from `./types.ts`

### Builders (Math → THREE.js)
Pure functions that transform surfaces into THREE.js objects. Stateless.

**Examples:**
- `buildGeometry.ts` - Surface → BufferGeometry
- `buildMesh.ts` - Surface → Mesh (convenience: geometry + material)
- `extractBoundary.ts` - Surface → boundary curves

**Naming:** Start with `build*` or use verb prefix

### Components (Scene Objects)
Complete scene objects extending THREE.js classes. Manage lifecycle, have reactive params.

**Examples:**
- `SurfaceMesh.ts` - Extends THREE.Mesh, wraps a Surface
- `DecoratedSurface.ts` - Extends THREE.Group, composes multiple visual elements

**Naming:** Ends with THREE.js type (Mesh, Group, Line, etc.)

### Helpers (Utilities)
Composition and decoration utilities.

**Location:** `helpers/` subfolder

**Examples:**
- `withNormals.ts` - Decorator that adds normal vector arrows
- `withBoundary.ts` - Decorator that adds boundary highlighting
- `syncGeometry.ts` - Keeps geometry in sync with surface parameters

**Naming:** Descriptive of purpose

## Import Examples

```typescript
// Types
import { Surface, DifferentialSurface } from '@/math/surfaces/types';

// Primitives
import { Torus } from '@/math/surfaces/Torus';
import { Helicoid } from '@/math/surfaces/Helicoid';

// Builders
import { buildGeometry } from '@/math/surfaces/buildGeometry';
import { buildMesh } from '@/math/surfaces/buildMesh';

// Components
import { SurfaceMesh } from '@/math/surfaces/SurfaceMesh';

// Helpers
import { withNormals } from '@/math/surfaces/helpers/withNormals';
```

## Usage Patterns

### Quick Demo (Use Components)
```typescript
const torus = new Torus({ R: 2, r: 1 });
const mesh = new SurfaceMesh(torus, { color: 0x4488ff });
scene.add(mesh);

// Reactive updates
torus.params.set('R', 3);  // Mesh rebuilds automatically
```

### Custom Visualization (Use Builders)
```typescript
const helicoid = new Helicoid({ pitch: 1.0 });
const geometry = buildGeometry(helicoid, { uSegments: 128 });
const material = new THREE.ShaderMaterial({ /* custom shader */ });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
```

### Decorated Surface (Use Helpers)
```typescript
const surface = new SurfaceMesh(torus, { color: 0x4488ff });
const decorated = withNormals(surface, { density: 10 });
scene.add(decorated);
```

## Design Principles

1. **Separation of Concerns**: Math doesn't know about visuals
2. **Composition**: Build complex objects from simple pieces
3. **Progressive Disclosure**: Simple for beginners, powerful for experts
4. **No Lock-In**: Can always drop down to raw THREE.js
5. **Reactivity**: Params system provides automatic updates
