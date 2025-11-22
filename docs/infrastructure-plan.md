# Infrastructure Development Plan

## Overview

This document outlines the major infrastructure work needed to make this framework fully capable before building a comprehensive demo library. The goal is to create a powerful, flexible system that makes common patterns trivial while staying out of the way.

**Philosophy:** Direct Three.js access everywhere, no cages, explicit over magical. The framework should fade into the background.

---

## Phase 1: Renderer Configuration System

### Goal
Make renderer configuration easy and discoverable without limiting access to Three.js capabilities.

### Implementation

**RendererManager** (`packages/core/src/managers/RendererManager.ts`)

```typescript
interface RendererConfig {
  // Shadow configuration
  shadows?: boolean | {
    enabled: boolean;
    type?: 'basic' | 'pcf' | 'pcfsoft' | 'vsm';
    mapSize?: number;
    autoUpdate?: boolean;
  };

  // Tone mapping
  toneMapping?: 'none' | 'linear' | 'reinhard' | 'cineon' | 'aces' | 'neutral';
  toneMappingExposure?: number;

  // Physically correct lighting
  physicallyCorrectLights?: boolean;

  // Color management
  outputColorSpace?: 'srgb' | 'linear-srgb' | 'display-p3';

  // Performance
  antialias?: boolean;
  pixelRatio?: number | 'auto';
  powerPreference?: 'default' | 'high-performance' | 'low-power';

  // Advanced
  logarithmicDepthBuffer?: boolean;
  alpha?: boolean;
  premultipliedAlpha?: boolean;
  preserveDrawingBuffer?: boolean;
}
```

**Methods:**
- `configure(config: Partial<RendererConfig>): void` - Apply configuration
- `enableShadows(options?)` - Quick shadow setup
- `setToneMapping(type, exposure?)` - Quick tone mapping
- Direct access: `renderer` property for full Three.js control

**Integration:**
- App constructor creates RendererManager
- Sensible defaults (shadows off, ACES tone mapping, sRGB output)
- Easy to override in demos

---

## Phase 2: Advanced Background/Environment System

### Goal
Support sophisticated environment and background workflows while keeping simple cases simple.

### Current State
BackgroundManager has basic capabilities:
- `setColor(color)`
- `setGradient(color1, color2)`
- `setStarfield(options)`
- `loadHDR(path)`

### Needed Additions

#### 2.1 Scene-to-Environment Pipeline

**Use case:** Build a Three.js scene, render it to cubemap, use as environment/background

```typescript
fromScene(scene: THREE.Scene, options?: {
  resolution?: number;
  blur?: number;
  renderPosition?: THREE.Vector3;
}): Promise<void>
```

**Implementation:**
- Use `WebGLCubeRenderTarget` to capture scene
- Optional blur using PMREM pipeline
- Can re-render on demand or cache

#### 2.2 Separate Background vs Environment

**Use case:** Blurred background for aesthetics, crisp reflections for materials

```typescript
setSeparateBackgroundAndEnvironment(options: {
  background: {
    type: 'scene' | 'hdr' | 'color' | 'gradient';
    blur?: number;
    // ... type-specific options
  };
  environment: {
    type: 'scene' | 'hdr' | 'preset';
    intensity?: number;
    // ... type-specific options
  };
}): void
```

**Implementation:**
- `scene.background` vs `scene.environment` are independent
- PMREM pipeline with different blur levels
- Can use same source with different processing

#### 2.3 PMREM Utilities

```typescript
class PMREMUtilities {
  constructor(renderer: THREE.WebGLRenderer);

  fromScene(scene: THREE.Scene, options?): THREE.Texture;
  fromEquirectangular(texture: THREE.Texture): THREE.Texture;
  fromCubemap(texture: THREE.CubeTexture): THREE.Texture;

  blur(envMap: THREE.Texture, blurAmount: number): THREE.Texture;
}
```

#### 2.4 Preset Environments

```typescript
loadPreset(preset: 'studio' | 'sunset' | 'night' | 'warehouse'): Promise<void>
```

Ship with a few high-quality HDR presets for quick prototyping.

---

## Phase 3: Material System

### Goal
Make material creation and management intuitive with good defaults while preserving full Three.js access.

### MaterialManager (`packages/core/src/managers/MaterialManager.ts`)

#### 3.1 Material Presets

```typescript
interface MaterialPresets {
  // Physical materials
  'metal': (color?) => THREE.MeshStandardMaterial;
  'glass': (color?, opacity?) => THREE.MeshPhysicalMaterial;
  'plastic': (color?) => THREE.MeshStandardMaterial;
  'rubber': (color?) => THREE.MeshStandardMaterial;
  'ceramic': (color?) => THREE.MeshStandardMaterial;

  // Non-physical
  'basic': (color?) => THREE.MeshBasicMaterial;
  'lambert': (color?) => THREE.MeshLambertMaterial;
  'phong': (color?) => THREE.MeshPhongMaterial;
  'toon': (color?) => THREE.MeshToonMaterial;

  // Special
  'wireframe': (color?) => THREE.MeshBasicMaterial;
  'normal': () => THREE.MeshNormalMaterial;
  'depth': () => THREE.MeshDepthMaterial;
}
```

**Usage:**
```typescript
const material = app.materials.create('glass', 0x88ccff, 0.3);
// Returns configured MeshPhysicalMaterial with glass properties
```

#### 3.2 Shader Material Helpers

```typescript
interface ShaderMaterialOptions {
  uniforms?: { [key: string]: THREE.IUniform };
  vertexShader?: string;
  fragmentShader?: string;
  vertexPreamble?: string;  // Injected before main()
  fragmentPreamble?: string;
  transparent?: boolean;
  side?: THREE.Side;
  // ... other material properties
}

createShader(options: ShaderMaterialOptions): THREE.ShaderMaterial
```

**Built-in snippets library:**
- Common noise functions (simplex, perlin, etc.)
- Color space conversions
- Utility functions (rotation matrices, etc.)

#### 3.3 Material Parameters

Materials created through MaterialManager should be parameter-compatible:

```typescript
const mat = app.materials.create('metal', 0xff0000);
app.params.add(mat, 'roughness', { min: 0, max: 1 });
app.params.addColor(mat, 'color');
```

---

## Phase 4: Enhanced Lighting System

### Goal
Expand beyond basic presets while maintaining simplicity for common cases.

### Current State
LightManager has:
- Presets: 'three-point', 'ambient', 'directional'
- `add()`, `remove()`, `clear()` for custom lights

### Needed Additions

#### 4.1 More Presets

```typescript
interface LightPresets {
  'three-point': () => THREE.Light[];
  'ambient': () => THREE.Light[];
  'directional': () => THREE.Light[];
  'studio': () => THREE.Light[];      // Professional photography setup
  'sunset': () => THREE.Light[];      // Warm directional + orange ambient
  'night': () => THREE.Light[];       // Cool ambient + moon directional
  'dramatic': () => THREE.Light[];    // Single strong directional + fill
}
```

#### 4.2 Light Helpers

```typescript
interface LightHelpers {
  createSpotlight(options: {
    position?: THREE.Vector3;
    target?: THREE.Vector3 | THREE.Object3D;
    color?: THREE.ColorRepresentation;
    intensity?: number;
    angle?: number;
    penumbra?: number;
    decay?: number;
    distance?: number;
    castShadow?: boolean;
  }): THREE.SpotLight;

  createPoint(options: { ... }): THREE.PointLight;
  createDirectional(options: { ... }): THREE.DirectionalLight;
  createHemisphere(skyColor, groundColor, intensity?): THREE.HemisphereLight;
}
```

#### 4.3 Shadow Configuration

```typescript
configureShadows(light: THREE.Light, options: {
  mapSize?: number;
  camera?: {
    near?: number;
    far?: number;
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  };
  bias?: number;
  normalBias?: number;
  radius?: number;
}): void
```

---

## Phase 5: Math Component Type System

### Goal
Establish consistent patterns and interfaces for all math components.

### Core Interfaces

**Update `types.ts`:**

```typescript
// Base math object interface
export interface MathObject extends MathComponent {
  params: ComponentParams;
  mesh: THREE.Object3D;

  // Lifecycle
  rebuild(): void;      // Complete reconstruction (expensive)
  dispose(): void;      // Cleanup

  // Optional
  update?(): void;      // Incremental update (cheap)
  animate?(time: number, delta: number): void;
}

// Specific types
export interface Curve extends MathObject {
  mesh: THREE.Line;
  tMin: number;
  tMax: number;
  segments: number;
}

export interface Surface extends MathObject {
  mesh: THREE.Mesh;
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
  uSegments: number;
  vSegments: number;
}

export interface VectorFieldLike extends MathObject {
  mesh: THREE.Group;  // Collection of arrows
  bounds: {
    xMin: number; xMax: number;
    yMin: number; yMax: number;
    zMin: number; zMax: number;
  };
  density: { x: number; y: number; z: number };
}

export interface ImplicitSurface extends MathObject {
  mesh: THREE.Mesh;
  bounds: {
    xMin: number; xMax: number;
    yMin: number; yMax: number;
    zMin: number; zMax: number;
  };
  resolution: number;
  isovalue: number;
}
```

### Rebuild vs Update Pattern

**Rebuild:** Complete geometry reconstruction
- Changed parameter domains (tMin, tMax)
- Changed resolution (segments)
- Changed topology

**Update:** Modify existing geometry
- Changed colors
- Changed scale/position
- Animation of function parameters

**Example:**
```typescript
class ParametricCurve implements Curve {
  private rebuild(): void {
    // Called when tMin, tMax, or segments change
    const newGeometry = this.buildGeometry();
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;
  }

  update(): void {
    // Called for incremental updates
    // Modify existing geometry.attributes
  }
}
```

---

## Phase 6: Math Component Library

### Goal
Build comprehensive library of mathematical visualization components with consistent patterns.

### Priority Components

#### Curves
- [x] `ParametricCurve` - Already implemented
- [ ] `SpaceCurve` - Helper for common 3D curves
- [ ] `PlaneCurve` - 2D curves in 3D space
- [ ] `FrenetFrame` - TNB frame along curve

#### Surfaces
- [ ] `ParametricSurface` - Core surface type
- [ ] `RevolutionSurface` - Revolve curve around axis
- [ ] `ExtrusionSurface` - Extrude curve along path
- [ ] `ImplicitSurface` - Level sets F(x,y,z) = c (marching cubes)

#### Vector Fields
- [ ] `VectorField2D` - 2D vector field visualization
- [ ] `VectorField3D` - 3D vector field visualization
- [ ] `FlowLines` - Integral curves of vector field
- [ ] `Streamtubes` - Tube visualization of flow

#### Complex Functions
- [ ] `ComplexDomainColoring` - Color-based visualization
- [ ] `RiemannSurface` - Multi-valued functions
- [ ] `ConformalMap` - Grid deformation visualization

#### Differential Geometry
- [ ] `TangentPlane` - Tangent plane at point
- [ ] `NormalLine` - Normal line at point
- [ ] `GaussMap` - Gauss map visualization
- [ ] `CurvatureVisualization` - Gaussian/mean curvature

#### Special Objects
- [ ] `CoordinateAxes` - Labeled coordinate system
- [ ] `Grid` - Customizable grid plane
- [ ] `LatticePath` - Path through lattice points
- [ ] `Polyhedron` - Custom polyhedra from vertex/face data

### Component Development Pattern

For each new component:

1. Define clear interface in `types.ts`
2. Implement with ComponentParams for all interactive properties
3. Distinguish rebuild vs update operations
4. Include sensible defaults
5. Write minimal demo in `demos/test/`
6. Test parameter reactivity
7. Document usage patterns

---

## Implementation Order

### Immediate (Weeks 1-2)
1. **RendererManager** - Core infrastructure
2. **Material presets** - Needed for all future components
3. **Enhanced LightManager** - Shadow configuration critical

### Near-term (Weeks 3-4)
4. **ParametricSurface** - Second major math component type
5. **Advanced BackgroundManager** - Scene-to-environment pipeline
6. **Shader material helpers** - Enable custom visualizations

### Medium-term (Weeks 5-8)
7. **VectorField components** - Complex but very useful
8. **ImplicitSurface** - Requires marching cubes implementation
9. **Special objects** - CoordinateAxes, Grid, etc.

### Ongoing
- Build math component library incrementally
- Refine patterns based on real usage
- Add utilities as needs arise

---

## Success Criteria

A successful infrastructure implementation means:

1. **Renderer:** Can configure shadows, tone mapping, etc. in 1-2 lines
2. **Backgrounds:** Can go from scene → blurred background in 1 function call
3. **Materials:** Can create good-looking materials without Googling parameters
4. **Lighting:** Can set up professional lighting in 1-2 lines
5. **Math Components:** New components follow clear, consistent patterns
6. **Developer Experience:** Framework fades into background, Three.js is always accessible

---

## Open Questions

1. **Shader library organization:** Separate package? Embedded strings? External files?
2. **Material parameter linking:** Auto-link all material properties or opt-in?
3. **PMREM caching:** How aggressive? Memory vs re-computation tradeoff?
4. **Math component naming:** `ParametricSurface` vs `Surface.Parametric` vs `Parametric.Surface`?
5. **Type system:** How strict? TypeScript interfaces vs runtime checks?

These will be resolved as we build and use the system.
