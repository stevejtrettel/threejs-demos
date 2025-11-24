# Mathematical Visualization Library: System Architecture

**Version 1.0**  
**Purpose:** Reference document for implementing a reusable library of mathematical visualization components

---

## Table of Contents

1. [System Overview](#system-overview)
2. [The Four Categories](#the-four-categories)
3. [Dependency Flow](#dependency-flow)
4. [File Structure](#file-structure)
5. [The Params System](#the-params-system)
6. [Surfaces Implementation Guide](#surfaces-implementation-guide)
7. [Geodesics Implementation Guide](#geodesics-implementation-guide)
8. [Common Patterns](#common-patterns)
9. [Design Principles](#design-principles)

---

## System Overview

The library is organized into four distinct categories, each with clear responsibilities:

```
┌─────────────────────────────────────────────────┐
│  1. MATHEMATICAL PRIMITIVES                     │
│     Pure mathematical abstractions              │
│     No THREE.js dependencies                    │
│     Surface, Curve, VectorField, etc.           │
└─────────────────────────────────────────────────┘
                    ↓
                 used by
                    ↓
┌─────────────────────────────────────────────────┐
│  2. BUILDERS                                    │
│     Math → THREE.js transformers                │
│     Pure functions (mostly)                     │
│     buildSurfaceGeometry(), etc.                │
└─────────────────────────────────────────────────┘
                    ↓
                 used by
                    ↓
┌─────────────────────────────────────────────────┐
│  3. COMPONENTS                                  │
│     Complete scene objects                      │
│     Extend THREE.js classes                     │
│     SurfaceMesh, GeodesicTrail, etc.            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  4. HELPERS                                     │
│     Composition utilities (work with any level) │
│     withNormals(), syncGeometry(), etc.         │
└─────────────────────────────────────────────────┘
```

**Key Insight:** Lower levels know nothing about higher levels. Builders don't import Components. Primitives don't import Builders. This keeps the system composable.

---

## The Four Categories

### 1. Mathematical Primitives

**Location:** `src/math/primitives/`

**What they are:**
- Pure mathematical abstractions
- Can be queried (evaluated at points)
- May have reactive parameters
- **Zero THREE.js dependencies**

**What they're NOT:**
- Visual objects
- Managers of geometry or materials
- Scene objects

**Core interfaces:**

```typescript
// primitives/types.ts

// Base parametric interface
interface Parametric {
  readonly params: Params;
}

// Surfaces
interface Surface {
  evaluate(u: number, v: number): THREE.Vector3;
  getDomain(): { uMin: number, uMax: number, vMin: number, vMax: number };
}

interface DifferentialSurface extends Surface {
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

// Curves
interface Curve {
  evaluate(t: number): THREE.Vector3;
  getDomain(): { tMin: number, tMax: number };
}

interface DifferentialCurve extends Curve {
  computeTangent(t: number): THREE.Vector3;
  computeCurvature(t: number): number;
}
```

**Example implementations:**

```typescript
// primitives/surfaces/Helicoid.ts
export class Helicoid implements DifferentialSurface, Parametric {
  readonly params = new Params(this);
  
  pitch!: number;
  radius!: number;
  
  constructor(options: { pitch: number, radius?: number }) {
    this.params.define('pitch', options.pitch);
    this.params.define('radius', options.radius ?? 1);
  }
  
  evaluate(u: number, v: number): THREE.Vector3 {
    return new THREE.Vector3(
      this.radius * v * Math.cos(u),
      this.radius * v * Math.sin(u),
      this.pitch * u
    );
  }
  
  getDomain() {
    return { uMin: -Math.PI, uMax: Math.PI, vMin: 0, vMax: 1 };
  }
  
  computeNormal(u: number, v: number): THREE.Vector3 {
    const du = this.computePartials(u, v).du;
    const dv = this.computePartials(u, v).dv;
    return du.cross(dv).normalize();
  }
  
  computePartials(u: number, v: number) {
    const du = new THREE.Vector3(
      -this.radius * v * Math.sin(u),
      this.radius * v * Math.cos(u),
      this.pitch
    );
    const dv = new THREE.Vector3(
      this.radius * Math.cos(u),
      this.radius * Math.sin(u),
      0
    );
    return { du, dv };
  }
  
  computeMetric(u: number, v: number) {
    const { du, dv } = this.computePartials(u, v);
    return {
      E: du.dot(du),
      F: du.dot(dv),
      G: dv.dot(dv)
    };
  }
}
```

```typescript
// primitives/surfaces/Torus.ts
export class Torus implements DifferentialSurface, Parametric {
  readonly params = new Params(this);
  
  R!: number;  // Major radius
  r!: number;  // Minor radius
  
  constructor(options: { R: number, r: number }) {
    this.params.define('R', options.R);
    this.params.define('r', options.r);
  }
  
  evaluate(u: number, v: number): THREE.Vector3 {
    return new THREE.Vector3(
      (this.R + this.r * Math.cos(v)) * Math.cos(u),
      (this.R + this.r * Math.cos(v)) * Math.sin(u),
      this.r * Math.sin(v)
    );
  }
  
  getDomain() {
    return { uMin: 0, uMax: 2 * Math.PI, vMin: 0, vMax: 2 * Math.PI };
  }
  
  // ... differential geometry methods
}
```

**Also in this category:**

```typescript
// primitives/geodesics/GeodesicIntegrator.ts
export class GeodesicIntegrator implements Parametric {
  readonly params = new Params(this);
  
  stepSize!: number;
  
  constructor(
    private surface: DifferentialSurface,
    options: { stepSize?: number }
  ) {
    this.params.define('stepSize', options.stepSize ?? 0.01);
    
    // Track surface changes
    if ('params' in surface) {
      surface.params.addDependent(this);
    }
  }
  
  // Integrate geodesic equation using RK4
  integrate(state: TangentVector, dt: number): TangentVector {
    // Uses surface.computeMetric() and Christoffel symbols
    // Returns new state (position + velocity on surface)
  }
  
  rebuild(): void {
    // Recompute cached Christoffel symbols if needed
  }
}

// Types
export interface TangentVector {
  position: [number, number];  // (u, v) coordinates
  velocity: [number, number];  // (du/dt, dv/dt)
}
```

---

### 2. Builders

**Location:** `src/math/builders/`

**What they are:**
- Pure(ish) functions
- Transform Primitives → THREE.js objects
- Stateless - caller manages lifecycle
- Reusable across many demos

**Import pattern:**
```typescript
// Builders import from:
import * as THREE from 'three';
import { Surface, Curve } from '@/math/primitives/types';
import { Helicoid } from '@/math/primitives/surfaces/Helicoid';

// But NOT from Components or Helpers
```

**Surface geometry builder:**

```typescript
// builders/geometry/buildSurfaceGeometry.ts

export interface SurfaceGeometryOptions {
  uMin?: number;
  uMax?: number;
  vMin?: number;
  vMax?: number;
  uSegments?: number;
  vSegments?: number;
  computeTangentSpace?: boolean;
}

export function buildSurfaceGeometry(
  surface: Surface,
  options: SurfaceGeometryOptions = {}
): THREE.BufferGeometry {
  const domain = surface.getDomain();
  const uMin = options.uMin ?? domain.uMin;
  const uMax = options.uMax ?? domain.uMax;
  const vMin = options.vMin ?? domain.vMin;
  const vMax = options.vMax ?? domain.vMax;
  const uSegments = options.uSegments ?? 32;
  const vSegments = options.vSegments ?? 32;
  
  const geometry = new THREE.BufferGeometry();
  
  // Build vertices
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  
  for (let i = 0; i <= vSegments; i++) {
    const v = vMin + (vMax - vMin) * (i / vSegments);
    for (let j = 0; j <= uSegments; j++) {
      const u = uMin + (uMax - uMin) * (j / uSegments);
      
      const point = surface.evaluate(u, v);
      vertices.push(point.x, point.y, point.z);
      
      // Compute normal if surface supports it
      if ('computeNormal' in surface) {
        const normal = surface.computeNormal(u, v);
        normals.push(normal.x, normal.y, normal.z);
      }
      
      uvs.push(j / uSegments, i / vSegments);
    }
  }
  
  // Build indices
  const indices: number[] = [];
  for (let i = 0; i < vSegments; i++) {
    for (let j = 0; j < uSegments; j++) {
      const a = i * (uSegments + 1) + j;
      const b = a + uSegments + 1;
      const c = a + 1;
      const d = b + 1;
      
      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }
  
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  
  if (normals.length > 0) {
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  
  if (options.computeTangentSpace) {
    geometry.computeTangents();
  }
  
  return geometry;
}
```

**Curve geometry builder:**

```typescript
// builders/geometry/buildCurveGeometry.ts

export interface CurveGeometryOptions {
  tMin?: number;
  tMax?: number;
  segments?: number;
  closed?: boolean;
}

export function buildCurveGeometry(
  curve: Curve,
  options: CurveGeometryOptions = {}
): THREE.BufferGeometry {
  const domain = curve.getDomain();
  const tMin = options.tMin ?? domain.tMin;
  const tMax = options.tMax ?? domain.tMax;
  const segments = options.segments ?? 64;
  const closed = options.closed ?? false;
  
  const points: THREE.Vector3[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = tMin + (tMax - tMin) * (i / segments);
    points.push(curve.evaluate(t));
  }
  
  if (closed && points.length > 0) {
    points.push(points[0].clone());
  }
  
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return geometry;
}
```

**Boundary extraction (builder utility):**

```typescript
// builders/geometry/extractBoundaryCurves.ts

export function extractBoundaryCurves(
  surface: Surface
): { u0: Curve, u1: Curve, v0: Curve, v1: Curve } {
  const domain = surface.getDomain();
  
  // Return 4 curves representing the boundary
  return {
    u0: {
      evaluate: (t: number) => surface.evaluate(domain.uMin, t),
      getDomain: () => ({ tMin: domain.vMin, tMax: domain.vMax })
    },
    u1: {
      evaluate: (t: number) => surface.evaluate(domain.uMax, t),
      getDomain: () => ({ tMin: domain.vMin, tMax: domain.vMax })
    },
    v0: {
      evaluate: (t: number) => surface.evaluate(t, domain.vMin),
      getDomain: () => ({ tMin: domain.uMin, tMax: domain.uMax })
    },
    v1: {
      evaluate: (t: number) => surface.evaluate(t, domain.vMax),
      getDomain: () => ({ tMin: domain.uMin, tMax: domain.uMax })
    }
  };
}
```

**Mesh builders (geometry + material convenience):**

```typescript
// builders/mesh/buildSurfaceMesh.ts

export interface SurfaceMeshOptions extends SurfaceGeometryOptions {
  color?: number;
  roughness?: number;
  metalness?: number;
  transmission?: number;
  wireframe?: boolean;
}

export function buildSurfaceMesh(
  surface: Surface,
  options: SurfaceMeshOptions = {}
): THREE.Mesh {
  const geometry = buildSurfaceGeometry(surface, options);
  
  const material = new THREE.MeshPhysicalMaterial({
    color: options.color ?? 0x4488ff,
    roughness: options.roughness ?? 0.3,
    metalness: options.metalness ?? 0.1,
    transmission: options.transmission ?? 0,
    wireframe: options.wireframe ?? false,
    side: THREE.DoubleSide
  });
  
  return new THREE.Mesh(geometry, material);
}
```

---

### 3. Components

**Location:** `src/math/components/`

**What they are:**
- Complete scene objects extending THREE.js classes
- Have `params: Params` for reactivity
- Manage their own lifecycle (rebuild/update/dispose)
- Opinionated defaults for quick demos

**Import pattern:**
```typescript
// Components import from:
import * as THREE from 'three';
import { Params } from '@/math/core/Params';
import { Surface, DifferentialSurface } from '@/math/primitives/types';
import { Helicoid } from '@/math/primitives/surfaces/Helicoid';
import { buildSurfaceGeometry } from '@/math/builders/geometry/buildSurfaceGeometry';

// Can also import other Components for composition
import { SurfaceMesh } from '@/math/components/SurfaceMesh';
```

**Simple component: SurfaceMesh**

```typescript
// components/SurfaceMesh.ts

export interface SurfaceMeshOptions {
  // Geometry options
  uSegments?: number;
  vSegments?: number;
  
  // Material options
  color?: number;
  roughness?: number;
  metalness?: number;
  transmission?: number;
  wireframe?: boolean;
}

export class SurfaceMesh extends THREE.Mesh {
  readonly params = new Params(this);
  
  // Geometry params (trigger rebuild)
  uSegments!: number;
  vSegments!: number;
  
  // Material params (trigger update)
  color!: number;
  roughness!: number;
  wireframe!: boolean;
  
  constructor(
    private surface: Surface,
    options: SurfaceMeshOptions = {}
  ) {
    super();
    
    // Define reactive parameters
    this.params.define('uSegments', options.uSegments ?? 32, {
      triggers: 'rebuild'
    });
    this.params.define('vSegments', options.vSegments ?? 32, {
      triggers: 'rebuild'
    });
    
    this.params.define('color', options.color ?? 0x4488ff, {
      triggers: 'update'
    });
    this.params.define('roughness', options.roughness ?? 0.3, {
      triggers: 'update'
    });
    this.params.define('wireframe', options.wireframe ?? false, {
      triggers: 'update'
    });
    
    // Track surface parameter changes
    if ('params' in surface) {
      surface.params.addDependent(this);
    }
    
    // Initial build
    this.material = new THREE.MeshPhysicalMaterial({
      side: THREE.DoubleSide
    });
    this.rebuild();
    this.update();
  }
  
  rebuild(): void {
    // Rebuild geometry
    this.geometry?.dispose();
    this.geometry = buildSurfaceGeometry(this.surface, {
      uSegments: this.uSegments,
      vSegments: this.vSegments
    });
  }
  
  update(): void {
    // Update material properties
    const mat = this.material as THREE.MeshPhysicalMaterial;
    mat.color.set(this.color);
    mat.roughness = this.roughness;
    mat.wireframe = this.wireframe;
    mat.needsUpdate = true;
  }
  
  dispose(): void {
    this.geometry.dispose();
    (this.material as THREE.Material).dispose();
    
    // Remove from surface dependencies
    if ('params' in this.surface) {
      this.surface.params.removeDependent(this);
    }
  }
}
```

**Usage:**
```typescript
const helicoid = new Helicoid({ pitch: 1.0 });
const mesh = new SurfaceMesh(helicoid, {
  color: 0x4488ff,
  uSegments: 64
});
scene.add(mesh);

// Reactive updates
mesh.params.set('color', 0xff4444);  // Calls update()
helicoid.params.set('pitch', 2.0);   // Calls rebuild() on mesh
```

**Composition component: DecoratedSurface**

```typescript
// components/DecoratedSurface.ts

export interface DecoratedSurfaceOptions extends SurfaceMeshOptions {
  showBoundary?: boolean;
  showCorners?: boolean;
  boundaryColor?: number;
  boundaryWidth?: number;
}

export class DecoratedSurface extends THREE.Group {
  readonly params = new Params(this);
  
  readonly mesh: SurfaceMesh;
  private boundary?: THREE.LineSegments;
  private corners?: THREE.Points;
  
  showBoundary!: boolean;
  showCorners!: boolean;
  
  constructor(
    surface: Surface,
    options: DecoratedSurfaceOptions = {}
  ) {
    super();
    
    // Main surface mesh
    this.mesh = new SurfaceMesh(surface, options);
    this.add(this.mesh);
    
    // Decoration flags
    this.params.define('showBoundary', options.showBoundary ?? true, {
      triggers: 'rebuild'
    });
    this.params.define('showCorners', options.showCorners ?? false, {
      triggers: 'rebuild'
    });
    
    // Track mesh rebuilds to update decorations
    this.mesh.params.addDependent(this);
    
    this.rebuild();
  }
  
  rebuild(): void {
    // Boundary
    if (this.showBoundary && !this.boundary) {
      this.boundary = this.createBoundary();
      this.add(this.boundary);
    } else if (!this.showBoundary && this.boundary) {
      this.remove(this.boundary);
      this.boundary.geometry.dispose();
      (this.boundary.material as THREE.Material).dispose();
      this.boundary = undefined;
    } else if (this.showBoundary && this.boundary) {
      // Update existing boundary
      const newBoundary = this.createBoundary();
      this.boundary.geometry.dispose();
      this.boundary.geometry = newBoundary.geometry;
    }
    
    // Similar for corners...
  }
  
  private createBoundary(): THREE.LineSegments {
    const curves = extractBoundaryCurves(this.mesh.surface);
    const segments: THREE.Vector3[] = [];
    
    // Sample each boundary curve
    [curves.u0, curves.u1, curves.v0, curves.v1].forEach(curve => {
      const geom = buildCurveGeometry(curve, { segments: 32 });
      const positions = geom.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        segments.push(new THREE.Vector3(
          positions.getX(i),
          positions.getY(i),
          positions.getZ(i)
        ));
      }
      geom.dispose();
    });
    
    const geometry = new THREE.BufferGeometry().setFromPoints(segments);
    const material = new THREE.LineBasicMaterial({ color: 0x000000 });
    return new THREE.LineSegments(geometry, material);
  }
  
  dispose(): void {
    this.mesh.dispose();
    this.boundary?.geometry.dispose();
    (this.boundary?.material as THREE.Material)?.dispose();
    // ... etc
  }
}
```

**Animated component: GeodesicTrail**

```typescript
// components/GeodesicTrail.ts

export interface GeodesicTrailOptions {
  initialPosition: [number, number];
  initialVelocity: [number, number];
  color?: number;
  lineWidth?: number;
  maxPoints?: number;
  stepSize?: number;
}

export class GeodesicTrail extends THREE.Line {
  readonly params = new Params(this);
  
  private integrator: GeodesicIntegrator;
  private state: TangentVector;
  private readonly initialState: TangentVector;
  private points: THREE.Vector3[] = [];
  
  color!: number;
  maxPoints!: number;
  
  constructor(
    private surface: DifferentialSurface,
    options: GeodesicTrailOptions
  ) {
    super();
    
    this.initialState = {
      position: options.initialPosition,
      velocity: options.initialVelocity
    };
    this.state = { ...this.initialState };
    
    this.integrator = new GeodesicIntegrator(surface, {
      stepSize: options.stepSize ?? 0.01
    });
    
    this.params.define('color', options.color ?? 0xff0000, {
      triggers: 'update'
    });
    this.params.define('maxPoints', options.maxPoints ?? 500, {
      triggers: 'rebuild'
    });
    
    this.material = new THREE.LineBasicMaterial();
    this.geometry = new THREE.BufferGeometry();
    
    this.update();
  }
  
  animate(time: number, delta: number): void {
    // Integrate one step
    this.state = this.integrator.integrate(this.state, delta);
    
    // Add point to trail
    const point = this.surface.evaluate(
      this.state.position[0],
      this.state.position[1]
    );
    this.points.push(point);
    
    // Limit trail length
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }
    
    // Update geometry
    this.geometry.setFromPoints(this.points);
  }
  
  reset(): void {
    this.state = { ...this.initialState };
    this.points = [];
    this.geometry.setFromPoints([]);
  }
  
  rebuild(): void {
    // Trim points if maxPoints decreased
    if (this.points.length > this.maxPoints) {
      this.points = this.points.slice(-this.maxPoints);
      this.geometry.setFromPoints(this.points);
    }
  }
  
  update(): void {
    (this.material as THREE.LineBasicMaterial).color.set(this.color);
  }
  
  dispose(): void {
    this.geometry.dispose();
    (this.material as THREE.Material).dispose();
  }
}
```

**Usage:**
```typescript
const torus = new Torus({ R: 2, r: 1 });
const geodesic = new GeodesicTrail(torus, {
  initialPosition: [0, 0],
  initialVelocity: [1, 0],
  color: 0xff0000
});
scene.add(geodesic);

// In animation loop
function animate(time, delta) {
  geodesic.animate(time, delta);
  renderer.render(scene, camera);
}
```

---

### 4. Helpers

**Location:** `src/math/helpers/`

**What they are:**
- Composition utilities
- Decorators
- Glue code between categories
- Not standalone - enhance other objects

**Import pattern:**
```typescript
// Helpers can import from anywhere - they're utilities
import * as THREE from 'three';
import { SurfaceMesh } from '@/math/components/SurfaceMesh';
import { DifferentialSurface } from '@/math/primitives/types';
import { buildSurfaceGeometry } from '@/math/builders/geometry/buildSurfaceGeometry';
```

**Decorator: withNormals**

```typescript
// helpers/decorators/withNormals.ts

export interface WithNormalsOptions {
  density?: number;
  length?: number;
  color?: number;
}

export function withNormals(
  surfaceMesh: SurfaceMesh,
  options: WithNormalsOptions = {}
): THREE.Group {
  const group = new THREE.Group();
  group.add(surfaceMesh);
  
  const density = options.density ?? 5;
  const length = options.length ?? 0.2;
  const color = options.color ?? 0xff0000;
  
  // Create arrow helpers
  const arrows = createNormalArrows(
    surfaceMesh.surface as DifferentialSurface,
    density,
    length,
    color
  );
  group.add(arrows);
  
  // Update arrows when surface changes
  const updateArrows = () => {
    group.remove(arrows);
    arrows.geometry?.dispose();
    (arrows.material as THREE.Material)?.dispose();
    
    const newArrows = createNormalArrows(
      surfaceMesh.surface as DifferentialSurface,
      density,
      length,
      color
    );
    group.add(newArrows);
  };
  
  surfaceMesh.params.addDependent({ rebuild: updateArrows });
  
  return group;
}

function createNormalArrows(
  surface: DifferentialSurface,
  density: number,
  length: number,
  color: number
): THREE.Group {
  const group = new THREE.Group();
  const domain = surface.getDomain();
  
  const uStep = (domain.uMax - domain.uMin) / density;
  const vStep = (domain.vMax - domain.vMin) / density;
  
  for (let i = 0; i <= density; i++) {
    const v = domain.vMin + i * vStep;
    for (let j = 0; j <= density; j++) {
      const u = domain.uMin + j * uStep;
      
      const point = surface.evaluate(u, v);
      const normal = surface.computeNormal(u, v);
      
      const arrow = new THREE.ArrowHelper(
        normal,
        point,
        length,
        color
      );
      group.add(arrow);
    }
  }
  
  return group;
}
```

**Usage:**
```typescript
const helicoid = new Helicoid({ pitch: 1 });
const mesh = new SurfaceMesh(helicoid, { color: 0x4488ff });
const withArrows = withNormals(mesh, { density: 10, length: 0.3 });
scene.add(withArrows);
```

**Synchronization helper:**

```typescript
// helpers/sync/syncGeometry.ts

export function syncGeometry(
  geometry: THREE.BufferGeometry,
  surface: Surface & Parametric,
  options: SurfaceGeometryOptions
): () => void {
  const update = () => {
    // Dispose old geometry attributes
    geometry.dispose();
    
    // Rebuild from surface
    const newGeom = buildSurfaceGeometry(surface, options);
    
    // Copy attributes
    geometry.setAttribute('position', newGeom.getAttribute('position'));
    geometry.setAttribute('normal', newGeom.getAttribute('normal'));
    geometry.setAttribute('uv', newGeom.getAttribute('uv'));
    geometry.setIndex(newGeom.getIndex());
    
    newGeom.dispose();
  };
  
  surface.params.addDependent({ rebuild: update });
  
  return update; // For manual triggering
}
```

**Material creator:**

```typescript
// helpers/materials/createCurvatureMaterial.ts

export interface CurvatureMaterialOptions {
  minCurvature?: number;
  maxCurvature?: number;
  colorScale?: 'rainbow' | 'heat' | 'coolwarm';
}

export function createCurvatureMaterial(
  options: CurvatureMaterialOptions = {}
): THREE.ShaderMaterial {
  const minK = options.minCurvature ?? -1;
  const maxK = options.maxCurvature ?? 1;
  
  return new THREE.ShaderMaterial({
    uniforms: {
      uMinCurvature: { value: minK },
      uMaxCurvature: { value: maxK }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormal;
      
      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uMinCurvature;
      uniform float uMaxCurvature;
      varying vec2 vUv;
      varying vec3 vNormal;
      
      // Compute Gaussian curvature from discrete geometry
      float computeGaussianCurvature() {
        // Simplified - would need proper discrete differential geometry
        return 0.0;
      }
      
      vec3 curvatureToColor(float k) {
        float t = (k - uMinCurvature) / (uMaxCurvature - uMinCurvature);
        t = clamp(t, 0.0, 1.0);
        
        // Simple rainbow mapping
        return vec3(
          sin(t * 3.14159),
          sin(t * 3.14159 + 2.094),
          sin(t * 3.14159 + 4.189)
        );
      }
      
      void main() {
        float k = computeGaussianCurvature();
        vec3 color = curvatureToColor(k);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.DoubleSide
  });
}
```

**Animation controller:**

```typescript
// helpers/animation/createGeodesicController.ts

export interface GeodesicController {
  update(delta: number): void;
  reset(): void;
  getState(): TangentVector;
}

export function createGeodesicController(
  integrator: GeodesicIntegrator,
  line: THREE.Line,
  initialState: TangentVector,
  surface: DifferentialSurface,
  options: { maxPoints?: number } = {}
): GeodesicController {
  let state = { ...initialState };
  const points: THREE.Vector3[] = [];
  const maxPoints = options.maxPoints ?? 500;
  
  return {
    update(delta: number): void {
      state = integrator.integrate(state, delta);
      const point = surface.evaluate(state.position[0], state.position[1]);
      points.push(point);
      
      if (points.length > maxPoints) {
        points.shift();
      }
      
      line.geometry.setFromPoints(points);
    },
    
    reset(): void {
      state = { ...initialState };
      points.length = 0;
      line.geometry.setFromPoints([]);
    },
    
    getState(): TangentVector {
      return { ...state };
    }
  };
}
```

---

## Dependency Flow

**Strict hierarchy (no circular dependencies):**

```
Primitives
    ↓ (can be used by)
Builders
    ↓ (can be used by)
Components
    ↑ (can import anything)
Helpers
```

**Import rules:**
- ✅ Primitives: Only import THREE.js Vector3/Matrix3/etc (math types), and Params
- ✅ Builders: Import Primitives
- ✅ Components: Import Primitives + Builders + other Components
- ✅ Helpers: Import anything
- ❌ Never: Primitives importing Builders, Builders importing Components, etc.

---

## File Structure

```
src/math/
├── core/
│   ├── Params.ts                 # Reactive parameter system
│   └── types.ts                  # Shared types (Parametric, Rebuildable, etc.)
│
├── primitives/
│   ├── types.ts                  # Surface, Curve, DifferentialSurface, etc.
│   ├── surfaces/
│   │   ├── Helicoid.ts
│   │   ├── Torus.ts
│   │   ├── Sphere.ts
│   │   └── ...
│   ├── curves/
│   │   ├── Helix.ts
│   │   ├── Circle.ts
│   │   └── ...
│   └── geodesics/
│       ├── GeodesicIntegrator.ts
│       └── types.ts              # TangentVector, etc.
│
├── builders/
│   ├── geometry/
│   │   ├── buildSurfaceGeometry.ts
│   │   ├── buildCurveGeometry.ts
│   │   ├── extractBoundaryCurves.ts
│   │   └── updateGeometry.ts     # For reactive updates
│   └── mesh/
│       ├── buildSurfaceMesh.ts
│       └── buildCurveLine.ts
│
├── components/
│   ├── SurfaceMesh.ts
│   ├── DecoratedSurface.ts
│   ├── GeodesicTrail.ts
│   ├── CurveLine.ts
│   └── ...
│
├── helpers/
│   ├── decorators/
│   │   ├── withNormals.ts
│   │   ├── withBoundary.ts
│   │   └── withGrid.ts
│   ├── sync/
│   │   └── syncGeometry.ts
│   ├── materials/
│   │   ├── createCurvatureMaterial.ts
│   │   └── shaderChunks.ts       # Reusable GLSL
│   └── animation/
│       └── createGeodesicController.ts
│
└── index.ts                      # Public API exports
```

---

## The Params System

**Core concepts:**

The `Params` system provides reactive parameters with automatic dependency tracking.

```typescript
// core/Params.ts

export interface Rebuildable {
  rebuild(): void;
}

export interface Updatable {
  update(): void;
}

export type ParamTrigger = 'rebuild' | 'update' | 'none';

export class Params {
  private dependents = new Set<Rebuildable>();
  
  constructor(private owner: any) {}
  
  define<T>(
    key: string,
    initialValue: T,
    options: { triggers?: ParamTrigger } = {}
  ): void {
    let value = initialValue;
    const trigger = options.triggers ?? 'none';
    
    Object.defineProperty(this.owner, key, {
      get: () => value,
      set: (newValue: T) => {
        if (value !== newValue) {
          value = newValue;
          this.triggerDependents(trigger);
        }
      },
      enumerable: true,
      configurable: true
    });
  }
  
  set(key: string, value: any): void {
    this.owner[key] = value;
  }
  
  addDependent(dependent: Rebuildable): void {
    this.dependents.add(dependent);
  }
  
  removeDependent(dependent: Rebuildable): void {
    this.dependents.delete(dependent);
  }
  
  private triggerDependents(trigger: ParamTrigger): void {
    if (trigger === 'none') return;
    
    this.dependents.forEach(dep => {
      if (trigger === 'rebuild' && 'rebuild' in dep) {
        dep.rebuild();
      } else if (trigger === 'update' && 'update' in dep) {
        (dep as any).update();
      }
    });
  }
  
  // Proxy one object's parameter to another
  proxy(
    targetKey: string,
    sourceParams: Params,
    sourceKey: string
  ): void {
    Object.defineProperty(this.owner, targetKey, {
      get: () => (sourceParams as any).owner[sourceKey],
      set: (value) => sourceParams.set(sourceKey, value),
      enumerable: true,
      configurable: true
    });
  }
}
```

**Usage patterns:**

```typescript
// In a Primitive
class Helicoid {
  readonly params = new Params(this);
  pitch!: number;
  
  constructor(options) {
    this.params.define('pitch', options.pitch);
    // No trigger - Primitives don't rebuild themselves
  }
}

// In a Component
class SurfaceMesh extends THREE.Mesh {
  readonly params = new Params(this);
  color!: number;
  
  constructor(surface, options) {
    super();
    this.params.define('color', options.color, { triggers: 'update' });
    
    // Track surface
    if ('params' in surface) {
      surface.params.addDependent(this);
    }
  }
  
  update() {
    (this.material as THREE.Material).color.set(this.color);
  }
  
  rebuild() {
    // Rebuild geometry when surface changes
  }
}
```

---

## Common Patterns

### Pattern 1: Creating a new surface type

1. **Implement the Primitive:**
```typescript
// primitives/surfaces/MySurface.ts
export class MySurface implements DifferentialSurface, Parametric {
  readonly params = new Params(this);
  myParam!: number;
  
  constructor(options) {
    this.params.define('myParam', options.myParam);
  }
  
  evaluate(u, v) { /* ... */ }
  computeNormal(u, v) { /* ... */ }
  // ... etc
}
```

2. **Use existing Builders and Components:**
```typescript
// In your demo
const surface = new MySurface({ myParam: 2.0 });
const mesh = new SurfaceMesh(surface, { color: 0x44ff88 });
scene.add(mesh);
```

### Pattern 2: Custom visualization with standard geometry

1. **Use Builder for geometry:**
```typescript
const surface = new Torus({ R: 2, r: 1 });
const geometry = buildSurfaceGeometry(surface, {
  uSegments: 128,
  vSegments: 128,
  computeTangentSpace: true
});
```

2. **Create custom material:**
```typescript
const material = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: myVertexShader,
  fragmentShader: myFragmentShader
});
```

3. **Combine:**
```typescript
const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);

// Optional: sync with surface changes
syncGeometry(geometry, surface, { uSegments: 128, vSegments: 128 });
```

### Pattern 3: Decorating a Component

```typescript
const surface = new Helicoid({ pitch: 1.0 });
const mesh = new SurfaceMesh(surface, { color: 0x4488ff });
const decorated = withNormals(mesh, { density: 10 });
scene.add(decorated);
```

### Pattern 4: Building a custom Component from Builders

```typescript
class MyCustomComponent extends THREE.Group {
  readonly params = new Params(this);
  
  constructor(surface: Surface, options) {
    super();
    
    // Use builders internally
    const mainMesh = buildSurfaceMesh(surface, options);
    this.add(mainMesh);
    
    const boundary = this.createBoundary(surface);
    this.add(boundary);
    
    // Add custom logic...
  }
}
```

---

## Design Principles

1. **Separation of Concerns**
   - Math doesn't know about visuals
   - Builders don't manage state
   - Components encapsulate lifecycle

2. **Composition over Inheritance**
   - Use helpers to combine
   - Components can wrap other components
   - Keep class hierarchies shallow

3. **Progressive Disclosure**
   - Beginners: Use Components
   - Intermediate: Mix Components + custom materials
   - Advanced: Build from Primitives + Builders

4. **No Lock-In**
   - Components can be decomposed
   - Always possible to drop down a level
   - Direct THREE.js access when needed

5. **Reactivity by Default**
   - Use `Params` consistently
   - Automatic dependency tracking
   - Explicit rebuild/update separation

6. **Clean Dependencies**
   - Lower levels don't know about higher levels
   - No circular imports
   - Easy to test in isolation

---

## Implementation Priority

**Phase 1: Core + Basic Surfaces**
- [ ] `Params` system
- [ ] `Surface` interface
- [ ] `Helicoid`, `Torus`, `Sphere` primitives
- [ ] `buildSurfaceGeometry` builder
- [ ] `SurfaceMesh` component

**Phase 2: Geodesics**
- [ ] `DifferentialSurface` interface
- [ ] `GeodesicIntegrator` primitive
- [ ] `GeodesicTrail` component
- [ ] Animation helpers

**Phase 3: Enhancements**
- [ ] `DecoratedSurface` component
- [ ] `withNormals` helper
- [ ] Boundary extraction
- [ ] Material helpers

---

## Example Usage in Demos

**Quick demo (5 minutes):**
```typescript
import { Helicoid } from '@/math/primitives/surfaces/Helicoid';
import { DecoratedSurface } from '@/math/components/DecoratedSurface';

const helicoid = new Helicoid({ pitch: 1.0, radius: 1.5 });
const surface = new DecoratedSurface(helicoid, {
  color: 0x4488ff,
  showBoundary: true,
  uSegments: 64
});
scene.add(surface);

// Animate
surface.params.set('color', 0xff4488);
helicoid.params.set('pitch', 2.0);
```

**Research visual (custom shaders):**
```typescript
import { Torus } from '@/math/primitives/surfaces/Torus';
import { buildSurfaceGeometry } from '@/math/builders/geometry/buildSurfaceGeometry';
import { createCurvatureMaterial } from '@/math/helpers/materials/createCurvatureMaterial';

const torus = new Torus({ R: 2, r: 1 });
const geometry = buildSurfaceGeometry(torus, {
  uSegments: 128,
  vSegments: 128,
  computeTangentSpace: true
});
const material = createCurvatureMaterial({
  minCurvature: -2,
  maxCurvature: 2
});

const mesh = new THREE.Mesh(geometry, material);
scene.add(mesh);
```

**Geodesics on surface:**
```typescript
import { Torus } from '@/math/primitives/surfaces/Torus';
import { SurfaceMesh } from '@/math/components/SurfaceMesh';
import { GeodesicTrail } from '@/math/components/GeodesicTrail';

const torus = new Torus({ R: 2, r: 1 });
const surface = new SurfaceMesh(torus, { 
  color: 0x4488ff,
  transmission: 0.5 
});
scene.add(surface);

const geodesic = new GeodesicTrail(torus, {
  initialPosition: [0, 0],
  initialVelocity: [1, 0],
  color: 0xff0000
});
scene.add(geodesic);

function animate(time, delta) {
  geodesic.animate(time, delta);
}
```

---

This document provides the complete architecture for implementing the mathematical visualization library. Start with Phase 1 (Core + Basic Surfaces) and build up from there. Each piece is designed to be implemented and tested independently while fitting into the larger system.