# Curves

Parametric curves and differential geometry.

## What Goes Here

### Primitives (Mathematical Objects)
Pure mathematical curve definitions. No THREE.js dependencies except Vector3 math types.

**Examples:**
- `Helix.ts` - Helical curve
- `Circle.ts` - Circular curve
- `Lissajous.ts` - Lissajous curve
- `ParametricCurve.ts` - Generic curve from user function

**Interface:** Implement `Curve` or `DifferentialCurve` from `./types.ts`

### Builders (Math → THREE.js)
Pure functions that transform curves into THREE.js objects.

**Examples:**
- `buildGeometry.ts` - Curve → BufferGeometry (line)
- `buildTubeGeometry.ts` - Curve → TubeGeometry

**Naming:** Start with `build*` or use verb prefix

### Components (Scene Objects)
Complete scene objects extending THREE.js classes.

**Examples:**
- `CurveLine.ts` - Extends THREE.Line, wraps a Curve
- `CurveTube.ts` - Extends THREE.Mesh, renders curve as tube
- `FrenetFrameVisualizer.ts` - Shows TNB frame along curve

**Naming:** Ends with THREE.js type (Line, Mesh, etc.)

## Import Examples

```typescript
// Types
import { Curve, DifferentialCurve } from '@/math/curves/types';

// Primitives
import { Helix } from '@/math/curves/Helix';
import { Circle } from '@/math/curves/Circle';

// Builders
import { buildGeometry } from '@/math/curves/buildGeometry';

// Components
import { CurveLine } from '@/math/curves/CurveLine';
```

## Usage Patterns

### Simple Curve Line
```typescript
const helix = new Helix({ radius: 1, pitch: 2 });
const line = new CurveLine(helix, { color: 0xff0000 });
scene.add(line);
```

### Tube Representation
```typescript
const lissajous = new Lissajous({ A: 1, B: 2, a: 3, b: 2 });
const tube = new CurveTube(lissajous, {
  radius: 0.1,
  tubularSegments: 200
});
scene.add(tube);
```

### Custom Shader
```typescript
const circle = new Circle({ radius: 2 });
const geometry = buildGeometry(circle, { segments: 128 });
const material = new THREE.ShaderMaterial({ /* custom */ });
const line = new THREE.Line(geometry, material);
scene.add(line);
```
