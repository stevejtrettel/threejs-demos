# Math Library Type System Design

This document outlines the architecture for the mathematical visualization library in `src/math/`.

## Design Goals

1. **Stable, reusable primitives** - Only well-tested, general-purpose code belongs in `math/`
2. **Three-layer architecture** - Different levels of abstraction for different use cases
3. **Reactive parameters** - Objects automatically update when parameters change
4. **Automatic dependency tracking** - Dependent objects (like geodesics on surfaces) auto-rebuild
5. **Clean API** - Easy to use for both beginners and advanced users building custom demos

## Three-Layer Architecture

### Layer 1: Pure Functions

**Purpose:** Maximum performance, no state, complete control

**Characteristics:**
- Just functions, no classes
- No side effects
- Return raw THREE.js types or plain data
- User handles all lifecycle management

**Examples:**

```typescript
// algorithms/interpolation.ts
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(t: number): number {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

// surfaces/builders.ts
export function createParametricSurfaceGeometry(
  fn: (u: number, v: number) => THREE.Vector3,
  options: {
    uMin: number;
    uMax: number;
    vMin: number;
    vMax: number;
    uSegments: number;
    vSegments: number;
  }
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  // ... build geometry
  return geometry;
}
```

**Usage:**
```typescript
const geometry = createParametricSurfaceGeometry(mySurfaceFn, {...});
const material = new THREE.MeshPhysicalMaterial({ transmission: 0.9 });
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
```

**When to use:**
- Need complete control over materials/rendering
- Building custom one-off visualizations in demos
- Performance-critical code
- Want to avoid framework overhead

---

### Layer 2: Parametric Mathematical Objects

**Purpose:** Reusable mathematical abstractions with state and reactivity, but NOT visual scene objects

**Characteristics:**
- Classes or interfaces
- Have `params: Params` (reactive parameters)
- Can `rebuild()` when parameters change
- **NOT** `SceneObject` (no `object3D` property)
- Used as building blocks by Layer 3 or directly in custom demos

**Examples:**

#### 2a. Differential Geometry Interfaces

```typescript
// diffgeo/types.ts
export interface DifferentialSurface extends Parametric {
  evaluate(u: number, v: number): THREE.Vector3;
  computeNormal(u: number, v: number): THREE.Vector3;
  computePartials(u: number, v: number): {
    du: THREE.Vector3;
    dv: THREE.Vector3;
  };
  computeMetric(u: number, v: number): {
    E: number;  // <du, du>
    F: number;  // <du, dv>
    G: number;  // <dv, dv>
  };
}
```

This is a **mathematical object** - it can compute positions, normals, metric tensors, but has no visual representation. It's used by:
- Geodesic integrators (need metric)
- Surface normal visualizers (need normals)
- Curvature calculators (need second derivatives)
- Layer 3 visual components

#### 2b. Reactive Geometries (maybe?)

```typescript
// surfaces/ParametricSurfaceGeometry.ts
export class ParametricSurfaceGeometry extends THREE.BufferGeometry {
  readonly params = new Params(this);

  uMin!: number;
  uMax!: number;
  // ... etc

  constructor(fn: ParametricFunction, options) {
    super();
    this.params.define('uMin', options.uMin, { triggers: 'rebuild' });
    // ... etc
    this.rebuild();
  }

  rebuild(): void {
    // Regenerate vertex positions, normals, etc.
  }
}
```

This extends `THREE.BufferGeometry` directly. It's parametric and rebuildable, but it's **not** a `SceneObject` because `BufferGeometry` is not `Object3D`.

**Open Question:** Do we need these as separate public classes, or are they just implementation details of Layer 3?

#### 2c. Mathematical Computations

```typescript
// diffgeo/integrators.ts
export class GeodesicIntegrator {
  readonly params = new Params(this);

  constructor(
    private surface: DifferentialSurface,
    options
  ) {
    this.params.define('stepSize', options.stepSize ?? 0.01);
    surface.params.addDependent(this);
  }

  integrate(state: TangentVector, dt: number): TangentVector {
    // RK4 integration on the surface
  }

  rebuild(): void {
    // Recompute Christoffel symbols or other cached data
  }
}
```

This has no visual component at all - it's pure mathematical computation with reactive parameters.

**When to use Layer 2:**
- Building custom visualizations in demos
- Need mathematical object without predetermined visual style
- Composition/decorator patterns
- Implementing mathematical algorithms with parameters

---

### Layer 3: Complete Visual Components (MathObjects)

**Purpose:** Plug-and-play scene objects with sensible defaults

**Characteristics:**
- Implements `MathObject` interface
- Has `object3D: THREE.Object3D` - can be added to scene
- Has `params: Params` - reactive parameters
- Can `rebuild()` (geometry changes) and `update()` (material changes)
- Can `dispose()` - cleanup
- Includes both geometry AND material

**Core Interface:**
```typescript
export interface SceneObject {
  readonly object3D: THREE.Object3D;
  dispose(): void;
}

export interface Parametric {
  readonly params: Params;
}

export interface Rebuildable {
  rebuild(): void;
}

export interface Updatable {
  update(): void;
}

export interface MathObject extends
  SceneObject,
  Parametric,
  Rebuildable,
  Updatable
{}
```

**Examples:**

#### 3a. Simple Parametric Surface

```typescript
export class ParametricSurface implements MathObject {
  readonly object3D: THREE.Mesh;  // or extends THREE.Mesh?
  readonly params = new Params(this);

  // Geometry params trigger rebuild
  uMin!: number;
  uMax!: number;

  // Material params trigger update
  color!: number;
  roughness!: number;

  constructor(fn, options) {
    this.params.define('uMin', options.uMin, { triggers: 'rebuild' });
    this.params.define('color', options.color, { triggers: 'update' });
    // ... etc

    this.object3D = new THREE.Mesh(); // or if extends Mesh, this is implicit
    this.rebuild();
  }

  rebuild(): void {
    // Recreate geometry
  }

  update(): void {
    // Update material properties
  }

  dispose(): void {
    // Cleanup
  }
}
```

**Usage:**
```typescript
const surface = new ParametricSurface(fn, { uMin: 0, uMax: Math.PI });
scene.add(surface.object3D); // or scene.add(surface) if extends Mesh?
surface.params.set('color', 0xff0000); // auto-updates
```

**When to use Layer 3:**
- Quick demos and prototypes
- Standard visualizations
- Want sensible defaults
- Don't need custom materials/rendering

---

## Edge Cases and How They Fit

### Case 1: Vector Fields (Collections)

**Problem:** A vector field is hundreds of arrows, not a single mesh.

**Solution:** Use `THREE.Group` or `THREE.InstancedMesh` as the `object3D`:

```typescript
export class VectorField3D implements MathObject {
  readonly object3D: THREE.InstancedMesh;  // or THREE.Group
  readonly params = new Params(this);

  density!: number;

  constructor(field: VectorFieldFunction, options) {
    // Create instanced mesh for performance
    const arrowGeo = createArrowGeometry();
    const arrowMat = new THREE.MeshStandardMaterial();
    const count = options.density ** 3;

    this.object3D = new THREE.InstancedMesh(arrowGeo, arrowMat, count);
    this.params.define('density', options.density, { triggers: 'rebuild' });
    this.rebuild();
  }

  rebuild(): void {
    // Update all instance matrices
    for (let i = 0; i < count; i++) {
      // ... compute position and orientation
      this.object3D.setMatrixAt(i, matrix);
    }
    this.object3D.instanceMatrix.needsUpdate = true;
  }
}
```

`InstancedMesh` **is** an `Object3D`, so this fits the `MathObject` interface perfectly.

### Case 2: Surface Compositions (Surface + Normals)

**Problem:** Want to show a surface with its normal field. Should this be:
- A method? `surface.showNormals()`
- A decorator? `new SurfaceWithNormals(surface)`

From the original discussion, the decision was: **Decorator pattern** (separate class) to avoid bloating the surface class.

```typescript
export class SurfaceWithNormals implements MathObject {
  readonly object3D: THREE.Group;  // Contains both surface and normals
  readonly params = new Params(this);

  private surface: MathObject & DifferentialSurface;
  private normalArrows: THREE.InstancedMesh;

  density!: number;
  arrowLength!: number;

  constructor(surface: MathObject & DifferentialSurface, options) {
    this.surface = surface;
    this.object3D = new THREE.Group();

    // Add surface to group
    this.object3D.add(surface.object3D);

    // Track surface changes
    surface.params.addDependent(this);

    // Define decorator-specific params
    this.params.define('density', options.density ?? 5, { triggers: 'rebuild' });
    this.params.define('arrowLength', options.arrowLength ?? 0.5, { triggers: 'rebuild' });

    this.rebuild();
  }

  rebuild(): void {
    // Sample surface and create normal arrows
    // When surface rebuilds, this auto-rebuilds too (via dependency tracking)
  }

  dispose(): void {
    this.surface.params.removeDependent(this);
    // ... cleanup
  }
}
```

### Case 3: Geodesics (Dependent + Animated)

**Problem:** Geodesics depend on a surface AND animate over time.

**Solution:** Implement both `MathObject` and `Animatable`:

```typescript
export interface Animatable {
  animate(time: number, delta: number): void;
  reset(): void;
}

export class Geodesic implements MathObject, Animatable {
  readonly object3D: THREE.Line;
  readonly params = new Params(this);

  private surface: DifferentialSurface;
  private currentState: TangentVector;
  private initialState: TangentVector;

  constructor(surface: DifferentialSurface, options) {
    this.surface = surface;
    this.initialState = { /* from options */ };
    this.currentState = { ...this.initialState };

    // Auto-track surface changes
    surface.params.addDependent(this);

    this.object3D = new THREE.Line();
    this.rebuild();
  }

  rebuild(): void {
    // Recompute from scratch when surface changes
    this.reset();
  }

  update(): void {
    // Update line material/color
  }

  animate(time: number, delta: number): void {
    // Integrate geodesic equation using delta
    this.currentState = integrate(this.surface, this.currentState, delta);
    // Update line geometry with new point
  }

  reset(): void {
    this.currentState = { ...this.initialState };
    // Clear trail
  }
}
```

The `animate()` method receives both `time` (absolute) and `delta` (incremental) so it can support both:
- Stateless time-based animations: `position = fn(time)`
- Stateful evolution: `state += derivative(state) * delta`

### Case 4: Surface Normal Field

**Problem:** Unlike a regular 3D vector field (uniform grid), surface normal fields have one layer of vectors on the surface topology.

**Solution:** This is a surface-specific visualization, best handled as a decorator (see Case 2).

Alternatively, could be a method on the surface that returns a separate `MathObject`:

```typescript
class ParametricSurface implements MathObject, DifferentialSurface {
  // ...

  createNormalField(options): VectorFieldOnSurface {
    return new VectorFieldOnSurface(this, options);
  }
}
```

Where `VectorFieldOnSurface` is a specialized `MathObject`.

---

## Open Design Questions

### Question 1: Layer 2 Interface Design

**Issue:** Not all Layer 2 objects are the same kind of thing.

**Current situation:**
- `DifferentialSurface` - interface for mathematical surface (evaluate, computeNormal, etc.) ✓ Makes sense
- `SmartGeometry` - interface for `BufferGeometry` with params?
  - Has property `readonly geometry: THREE.BufferGeometry`
  - But if you're extending `BufferGeometry`, you ARE the geometry, not containing it
  - Awkward interface design

**Options:**

**A) Remove SmartGeometry interface**
- Layer 2 geometries just extend `THREE.BufferGeometry` directly
- They informally implement Parametric + Rebuildable pattern
- No formal interface needed since they're often implementation details

**B) Keep SmartGeometry but fix it**
```typescript
export interface SmartGeometry extends THREE.BufferGeometry, Parametric, Rebuildable {
  // Can't do this - TypeScript interfaces can't extend classes
}
```

**C) Layer 2 is just "mathematical abstractions that aren't SceneObjects"**
- Each domain defines its own interfaces (DifferentialSurface, DifferentialCurve, etc.)
- No unified "Layer 2 interface"
- Some happen to extend BufferGeometry, some don't

**Recommendation needed:** Should we have a SmartGeometry interface at all? Or just document that Layer 2 things sometimes extend BufferGeometry?

---

### Question 2: Layer 3 - Inheritance vs Composition

**Issue:** Should MathObjects extend THREE.js classes or wrap them?

**Option A: Inheritance**
```typescript
class ParametricSurface extends THREE.Mesh implements Parametric, Rebuildable, Updatable {
  readonly params = new Params(this);
  rebuild() { }
  update() { }
}

// Usage:
scene.add(surface);
surface.geometry;
surface.material;
```

**Pros:**
- Clean property access
- `surface` IS a Mesh, can use anywhere THREE.Mesh is expected
- No need for `.object3D`

**Cons:**
- Can't have unified `MathObject` interface (different objects extend different classes)
- `ParametricSurface extends Mesh`, `VectorField extends Group`, etc.
- Can't write functions that take `MathObject` as parameter

**Option B: Composition (current)**
```typescript
interface MathObject extends SceneObject, Parametric, Rebuildable, Updatable {}

class ParametricSurface implements MathObject {
  readonly object3D: THREE.Mesh;
  readonly params = new Params(this);
  rebuild() { }
  update() { }
}

// Usage:
scene.add(surface.object3D);
surface.object3D.geometry;
surface.object3D.material;
```

**Pros:**
- Unified `MathObject` interface
- Can write generic functions: `function cleanup(obj: MathObject)`
- Consistent API across all math objects

**Cons:**
- Need `.object3D` everywhere
- More verbose property access
- Wrapper overhead (minimal)

**Option C: Hybrid - Convenience Accessors**
```typescript
class ParametricSurface implements MathObject {
  readonly object3D: THREE.Mesh;

  // Convenience accessors
  get geometry() { return this.object3D.geometry; }
  get material() { return this.object3D.material; }
  set material(m) { this.object3D.material = m; }
}

// Usage:
scene.add(surface.object3D);  // Still need this
surface.geometry;  // But this works!
surface.material.color.set(0xff0000);  // And this!
```

**Pros:**
- Clean property access
- Still have unified interface
- Best of both worlds?

**Cons:**
- Still need `scene.add(surface.object3D)`
- Boilerplate getters/setters for each class
- Might be confusing (is `surface` the mesh or not?)

**The Core Question:**

How often do we write code that needs a unified `MathObject` interface vs code that works with specific types?

```typescript
// Do we often do this?
function cleanupAll(objects: MathObject[]) {
  objects.forEach(obj => obj.dispose());
}

// Or mostly this?
const surface = new ParametricSurface(...);
const geodesic = new Geodesic(...);
// Work with specific types
```

If we mostly work with specific types, inheritance might be better (cleaner API, no `.object3D`).
If we need generic `MathObject` handling, composition is better (unified interface).

**Recommendation needed:** Which pattern better fits actual usage in demos?

---

## Summary

The three-layer architecture provides:
1. **Layer 1** (functions) - Maximum control, no framework
2. **Layer 2** (mathematical abstractions) - Reusable building blocks, not visual
3. **Layer 3** (MathObjects) - Complete visual components, plug-and-play

Key design decisions made:
- ✅ Automatic dependency tracking via `Params.addDependent()`
- ✅ Decorator pattern for compositions (not methods)
- ✅ Unified `Animatable` interface with both `time` and `delta`
- ✅ `reset()` method on animated objects
- ✅ Instancing designed per-object (not automatic switching)

Open questions:
- ❓ Should Layer 2 have a `SmartGeometry` interface?
- ❓ Should Layer 3 use inheritance or composition?

These questions need to be resolved based on actual usage patterns before implementing concrete math objects.
