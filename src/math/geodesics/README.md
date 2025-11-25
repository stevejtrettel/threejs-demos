# Geodesics

Geodesic curves on surfaces - the "straightest possible" paths.

## What Goes Here

### Primitives (Mathematical Objects)
Pure mathematical geodesic integration and computation.

**Examples:**
- `GeodesicIntegrator.ts` - Integrates geodesic equation using RK4
- `ChristoffelComputer.ts` - Computes Christoffel symbols (finite difference or analytical)

**Interface:** Work with `DifferentialSurface` from `../surfaces/types.ts`

### Components (Scene Objects)
Animated geodesic visualizations.

**Examples:**
- `GeodesicTrail.ts` - Extends THREE.Line, animates geodesic path
- `GeodesicFlow.ts` - Multiple geodesics flowing from a point
- `ParallelTransport.ts` - Visualizes parallel transport along geodesic

**Naming:** Descriptive of the geodesic visualization

### Helpers
Animation controllers and utilities.

**Location:** `helpers/` subfolder

**Examples:**
- `createController.ts` - Controller for geodesic animation

## Import Examples

```typescript
// Types
import { TangentVector, GeodesicState } from '@/math/geodesics/types';
import { DifferentialSurface } from '@/math/surfaces/types';

// Primitives
import { GeodesicIntegrator } from '@/math/geodesics/GeodesicIntegrator';

// Components
import { GeodesicTrail } from '@/math/geodesics/GeodesicTrail';
import { Torus } from '@/math/surfaces/Torus';
```

## Usage Patterns

### Animated Geodesic on Surface
```typescript
// Create surface
const torus = new Torus({ R: 2, r: 1 });
const surfaceMesh = new SurfaceMesh(torus, {
  color: 0x4488ff,
  transmission: 0.3
});
scene.add(surfaceMesh);

// Create geodesic
const geodesic = new GeodesicTrail(torus, {
  initialPosition: [0, 0],
  initialVelocity: [1, 0.5],
  color: 0xff0000,
  maxPoints: 500
});
scene.add(geodesic);

// In animation loop
function animate(time, delta) {
  geodesic.animate(time, delta);
  renderer.render(scene, camera);
}
```

### Multiple Geodesics
```typescript
const torus = new Torus({ R: 2, r: 1 });
const geodesics = [];

// Launch geodesics in different directions
for (let i = 0; i < 8; i++) {
  const angle = (i / 8) * Math.PI * 2;
  const geodesic = new GeodesicTrail(torus, {
    initialPosition: [0, 0],
    initialVelocity: [Math.cos(angle), Math.sin(angle)],
    color: 0xff0000
  });
  geodesics.push(geodesic);
  scene.add(geodesic);
}

// Animate all
function animate(time, delta) {
  geodesics.forEach(g => g.animate(time, delta));
}
```

### Custom Integration
```typescript
const torus = new Torus({ R: 2, r: 1 });
const integrator = new GeodesicIntegrator(torus, { stepSize: 0.01 });

let state: TangentVector = {
  position: [0, 0],
  velocity: [1, 0]
};

// Integrate manually
for (let i = 0; i < 1000; i++) {
  state = integrator.integrate(state);
  const point = torus.evaluate(state.position[0], state.position[1]);
  // Do something with point...
}
```

### Bounded Integration (Domain Boundaries)
```typescript
// For surfaces with finite domains (e.g., FunctionGraph)
const surface = SurfaceMesh.fromFunction((x, y) => Math.sin(x) * Math.cos(y));
const integrator = new GeodesicIntegrator(surface, { stepSize: 0.01 });
const domain = surface.getDomain();

let state: TangentVector = { position: [0, 0], velocity: [1, 0.5] };

// Integrate with boundary detection
const result = integrator.integrateBounded(state, domain);
if (result.hitBoundary) {
  console.log(`Hit ${result.boundaryEdge} boundary`);
}
```

### Geodesic Trail with Boundaries
```typescript
// GeodesicTrail automatically handles boundaries when bounded: true
const geodesic = new GeodesicTrail(surface, {
  initialPosition: [0, 0],
  initialVelocity: [1, 0.3],
  bounded: true  // Stop at domain boundaries
});

// Check if stopped
if (geodesic.stopped) {
  console.log(`Stopped at: ${geodesic.stoppedAtBoundary}`);
}
```

## Mathematical Background

A geodesic on a surface satisfies the geodesic equation:

```
d²uᵏ/dt² + Γᵏᵢⱼ(duⁱ/dt)(duʲ/dt) = 0
```

Where:
- `uᵏ` are the parameter coordinates (u, v)
- `Γᵏᵢⱼ` are the Christoffel symbols
- `t` is the curve parameter (arc length or time)

The integrator solves this system numerically using RK4 integration.
