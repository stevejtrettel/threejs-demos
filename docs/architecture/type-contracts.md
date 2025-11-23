# Math Demo Framework - Type Contracts

This document defines all TypeScript interfaces, types, and contracts that make up the framework's API surface.

## Table of Contents
1. [Core Interfaces](#core-interfaces)
2. [App Types](#app-types)
3. [Manager Types](#manager-types)
4. [Parameter System Types](#parameter-system-types)
5. [Component Types](#component-types)
6. [Utility Types](#utility-types)

---

## Core Interfaces

### Animatable

Objects that animate over time. The `animate()` method is called every frame.

```typescript
interface Animatable {
  /**
   * Called every frame for time-based animation
   * @param time - Total elapsed time in milliseconds
   * @param delta - Time since last frame in milliseconds
   */
  animate(time: number, delta: number): void;
}
```

**Usage:**
```typescript
class Geodesic implements Animatable {
  animate(time: number, delta: number) {
    this.advanceParticle(delta);
  }
}
```

### Disposable

Objects that need cleanup when removed from the scene.

```typescript
interface Disposable {
  /**
   * Clean up resources (geometries, materials, textures)
   */
  dispose(): void;
}
```

**Usage:**
```typescript
class Geodesic implements Disposable {
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
```

### Renderable

Objects that have a visual representation in the Three.js scene.

```typescript
interface Renderable {
  /**
   * The Three.js object to add to the scene
   * Can be any THREE.Object3D subclass (Mesh, Line, Points, Group, etc.)
   */
  mesh?: THREE.Object3D;
}
```

**Usage:**
```typescript
class Geodesic implements Renderable {
  mesh: THREE.Line;
  
  constructor() {
    this.mesh = new THREE.Line(geometry, material);
  }
}
```

### MathComponent

A complete component that can be added to the app. Combines all lifecycle interfaces.

```typescript
interface MathComponent extends Partial<Animatable>, Partial<Disposable>, Partial<Renderable> {
  /**
   * Optional internal parameter system
   */
  params?: ComponentParams;
}
```

**Usage:**
```typescript
class Geodesic implements MathComponent {
  mesh: THREE.Line;
  params: ComponentParams;
  
  animate(time: number, delta: number) { /* ... */ }
  dispose() { /* ... */ }
}
```

---

## App Types

### AppOptions

Configuration for App construction.

```typescript
interface AppOptions {
  // Camera configuration
  fov?: number;
  near?: number;
  far?: number;
  cameraPosition?: THREE.Vector3 | [number, number, number];
  
  // Renderer configuration
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
  
  // Quick setup shortcuts
  layout?: 'fullscreen' | LayoutConfig;
  background?: string;
  lights?: string;
  controls?: string;
}
```

**Usage:**
```typescript
const app = new App({
  fov: 60,
  antialias: true,
  layout: 'fullscreen',
  lights: 'three-point'
});
```

### AddOptions

Options for adding objects to the app.

```typescript
interface AddOptions {
  /**
   * Parameter exposure configuration
   * - true: Expose all component parameters
   * - false: Don't expose any parameters
   * - string[]: Expose specific parameters by name
   * - Record: Expose with overrides
   */
  params?: boolean | string[] | Record<string, boolean | ParamOptions>;
  
  /**
   * Set parameter values without exposing to UI
   */
  set?: Record<string, any>;
}
```

**Usage:**
```typescript
// Expose all parameters
app.add(geo, { params: true });

// Expose specific parameters
app.add(geo, { params: ['radius', 'color'] });

// Expose with overrides
app.add(geo, {
  params: {
    mass: { min: 0.5, max: 5, step: 0.1 },
    color: true
  }
});

// Set without exposing
app.add(geo, {
  params: false,
  set: { radius: 0.2, color: 0xff0000 }
});
```

### AnimateCallback

Function called every frame for custom animation logic.

```typescript
type AnimateCallback = (time: number, delta: number) => void;
```

**Usage:**
```typescript
let rotation = 0;
app.addAnimateCallback((time, delta) => {
  rotation += delta * 0.001;
  sphere.rotation.y = rotation;
});
```

---

## Manager Types

### Layout Types

#### LayoutConfig

Configuration for custom layouts.

```typescript
interface LayoutConfig {
  /**
   * Layout type
   */
  type: 'fullscreen' | 'fixed' | 'custom';
  
  /**
   * For fixed layouts: width in pixels
   */
  width?: number;
  
  /**
   * For fixed layouts: height in pixels
   */
  height?: number;
  
  /**
   * Container element or selector
   */
  container?: HTMLElement | string;
  
  /**
   * Called when layout resizes (custom layouts only)
   */
  onResize?: (width: number, height: number) => void;
}
```

**Usage:**
```typescript
// Fullscreen
app.layout.setFullscreen();

// Fixed size
app.layout.setFixed(800, 600, '#canvas-container');

// Custom with resize handler
app.layout.setCustom({
  container: '#canvas-container',
  onResize: (w, h) => {
    console.log(`Resized to ${w}x${h}`);
  }
});
```

### Background Types

#### StarfieldOptions

Options for procedural starfield background.

```typescript
interface StarfieldOptions {
  /**
   * Number of stars to generate
   * @default 2000
   */
  count?: number;
  
  /**
   * Maximum star radius in pixels
   * @default 2
   */
  size?: number;
}
```

**Usage:**
```typescript
app.backgrounds.setStarfield({ count: 5000, size: 3 });
```

### Controls Types

#### OrbitControlsOptions

Extended options for OrbitControls (from Three.js).

```typescript
interface OrbitControlsOptions {
  enableDamping?: boolean;
  dampingFactor?: number;
  enableZoom?: boolean;
  enablePan?: boolean;
  enableRotate?: boolean;
  minDistance?: number;
  maxDistance?: number;
  minPolarAngle?: number;
  maxPolarAngle?: number;
  autoRotate?: boolean;
  autoRotateSpeed?: number;
  target?: THREE.Vector3;
}
```

**Usage:**
```typescript
app.controls.setOrbit({
  enableDamping: true,
  dampingFactor: 0.05,
  minDistance: 5,
  maxDistance: 50,
  autoRotate: true
});
```

---

## Parameter System Types

### ParamOptions

Options for defining or exposing a parameter.

```typescript
interface ParamOptions {
  /**
   * Minimum value (for numeric parameters)
   */
  min?: number;
  
  /**
   * Maximum value (for numeric parameters)
   */
  max?: number;
  
  /**
   * Step size for numeric parameters
   */
  step?: number;
  
  /**
   * Parameter type
   * @default 'number' (inferred from value)
   */
  type?: 'number' | 'boolean' | 'color' | 'string' | 'select';
  
  /**
   * Display label in UI
   */
  label?: string;
  
  /**
   * UI folder/group for organization
   */
  folder?: string;
  
  /**
   * Options for select type
   */
  options?: string[] | Record<string, any>;
  
  /**
   * Called when parameter value changes
   * @param value - New value
   */
  onChange?: (value: any) => void;
}
```

**Usage:**
```typescript
// Numeric parameter
app.params.add(geo, 'radius', {
  min: 0.01,
  max: 1,
  step: 0.01,
  label: 'Tube Radius',
  folder: 'Geometry',
  onChange: () => geo.rebuild()
});

// Boolean parameter
app.params.add(geo, 'showParticle', {
  type: 'boolean',
  label: 'Show Particle',
  onChange: (v) => geo.particle.visible = v
});

// Color parameter
app.params.add(geo.material, 'color', {
  type: 'color',
  label: 'Path Color',
  onChange: (v) => geo.material.color.setHex(v)
});

// Select parameter
app.params.add(sim, 'metric', {
  type: 'select',
  options: ['Schwarzschild', 'Kerr', 'Reissner-Nordström'],
  onChange: (v) => sim.setMetric(v)
});
```

### ParamDefinition

Internal representation of a parameter definition.

```typescript
interface ParamDefinition {
  /**
   * Parameter name
   */
  name: string;
  
  /**
   * Default value
   */
  defaultValue: any;
  
  /**
   * Parameter options
   */
  options: ParamOptions;
}
```

**Usage (internal):**
```typescript
// Used by ComponentParams to store parameter definitions
this.params.set('radius', {
  name: 'radius',
  defaultValue: 0.1,
  options: { min: 0.01, max: 1, onChange: () => this.rebuild() }
});
```

### RegisteredParam

A parameter registered with the ParameterManager.

```typescript
interface RegisteredParam {
  /**
   * Object that owns the parameter
   */
  object: any;
  
  /**
   * Property name on the object
   */
  property: string;
  
  /**
   * Parameter options
   */
  options: ParamOptions;
  
  /**
   * How this parameter was registered
   */
  type: 'adhoc' | 'component';
}
```

**Usage (internal):**
```typescript
// ParameterManager tracks all registered parameters
this.registeredParams.push({
  object: geodesic,
  property: 'radius',
  options: { min: 0.01, max: 1, onChange: () => geodesic.rebuild() },
  type: 'component'
});
```

---

## Component Types

### ComponentParams Class

The ComponentParams class allows components to define their own internal parameters.

```typescript
class ComponentParams {
  /**
   * Define a parameter on the owning component
   * Creates a reactive property that triggers onChange when set
   * 
   * @param name - Property name
   * @param defaultValue - Initial value
   * @param options - Parameter options including onChange
   */
  define(name: string, defaultValue: any, options: ParamOptions): void;
  
  /**
   * Get a parameter value
   * 
   * @param name - Property name
   * @returns Current value
   */
  get(name: string): any;
  
  /**
   * Set a parameter value (triggers onChange)
   * 
   * @param name - Property name
   * @param value - New value
   */
  set(name: string, value: any): void;
  
  /**
   * Check if parameter is defined
   * 
   * @param name - Property name
   * @returns True if parameter exists
   */
  has(name: string): boolean;
  
  /**
   * Get parameter definition
   * 
   * @param name - Property name
   * @returns Parameter definition or undefined
   */
  getDefinition(name: string): ParamDefinition | undefined;
  
  /**
   * Get all parameter definitions
   * 
   * @returns Map of all definitions
   */
  getAllDefinitions(): Map<string, ParamDefinition>;
}
```

**Usage:**
```typescript
class Geodesic {
  params: ComponentParams;
  radius: number; // Will be created by params.define()
  
  constructor() {
    this.params = new ComponentParams(this);
    
    // Define parameters (creates reactive properties)
    this.params.define('radius', 0.1, {
      min: 0.01,
      max: 1,
      onChange: () => this.rebuildGeometry()
    });
    
    this.params.define('color', 0xff0000, {
      type: 'color',
      onChange: (v) => this.mesh.material.color.setHex(v)
    });
  }
  
  // Later, change a value
  changeRadius() {
    this.params.set('radius', 0.5); // Triggers onChange
    // OR
    this.radius = 0.5; // Also triggers onChange
  }
}
```

---

## Utility Types

### Vector3Like

Flexible vector input (array or Three.js Vector3).

```typescript
type Vector3Like = THREE.Vector3 | [number, number, number];
```

**Usage:**
```typescript
function setPosition(position: Vector3Like) {
  if (Array.isArray(position)) {
    this.mesh.position.set(...position);
  } else {
    this.mesh.position.copy(position);
  }
}

// Both work
setPosition([1, 2, 3]);
setPosition(new THREE.Vector3(1, 2, 3));
```

### ColorLike

Flexible color input (hex number, CSS string, or Three.js Color).

```typescript
type ColorLike = number | string | THREE.Color;
```

**Usage:**
```typescript
function setColor(color: ColorLike) {
  if (typeof color === 'number') {
    this.material.color.setHex(color);
  } else if (typeof color === 'string') {
    this.material.color.set(color);
  } else {
    this.material.color.copy(color);
  }
}

// All work
setColor(0xff0000);
setColor('#ff0000');
setColor('red');
setColor(new THREE.Color(1, 0, 0));
```

---

## Complete Example: Component with All Types

Here's a complete component that uses all the major type contracts:

```typescript
import * as THREE from 'three';
import { ComponentParams } from '@/components/ComponentParams';
import type { Animatable, Disposable, Renderable, MathComponent } from '@/types';

/**
 * A geodesic path visualization with animated particle
 */
class Geodesic implements MathComponent {
  // Renderable
  mesh: THREE.Line;
  particle: THREE.Mesh;
  
  // Component parameters
  params: ComponentParams;
  
  // Internal properties (created by params.define())
  tubeRadius!: number;
  pathColor!: number;
  particleSpeed!: number;
  mass!: number;
  
  private path: THREE.Vector3[];
  private currentIndex: number = 0;
  
  constructor(
    private metric: any,
    private initialConditions: any
  ) {
    this.params = new ComponentParams(this);
    
    // Define parameters
    this.params.define('tubeRadius', 0.05, {
      min: 0.01,
      max: 0.2,
      label: 'Tube Radius',
      folder: 'Geometry',
      onChange: () => this.rebuildTube()
    });
    
    this.params.define('pathColor', 0xff0000, {
      type: 'color',
      label: 'Path Color',
      folder: 'Appearance',
      onChange: (v) => this.mesh.material.color.setHex(v)
    });
    
    this.params.define('particleSpeed', 1, {
      min: 0,
      max: 5,
      step: 0.1,
      label: 'Animation Speed',
      folder: 'Animation',
      onChange: (v) => this.particleSpeed = v
    });
    
    this.params.define('mass', 1, {
      min: 0.1,
      max: 10,
      step: 0.1,
      label: 'Black Hole Mass',
      folder: 'Physics',
      onChange: () => this.recomputePath()
    });
    
    // Build geometry
    this.path = this.computePath();
    this.mesh = this.buildTube();
    this.particle = this.buildParticle();
  }
  
  // Animatable interface
  animate(time: number, delta: number): void {
    // Animate particle along path
    this.currentIndex += delta * 0.01 * this.particleSpeed;
    if (this.currentIndex >= this.path.length) {
      this.currentIndex = 0;
    }
    
    const index = Math.floor(this.currentIndex);
    this.particle.position.copy(this.path[index]);
  }
  
  // Disposable interface
  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.particle.geometry.dispose();
    (this.particle.material as THREE.Material).dispose();
  }
  
  // Parameter-triggered rebuilds
  private rebuildTube(): void {
    // Rebuild tube geometry with new radius
    const newGeometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(this.path),
      this.path.length,
      this.tubeRadius,
      8,
      false
    );
    
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;
  }
  
  private recomputePath(): void {
    // Recompute path with new mass
    this.metric.mass = this.mass;
    this.path = this.computePath();
    this.rebuildTube();
  }
  
  private computePath(): THREE.Vector3[] {
    // Integration logic here
    return [];
  }
  
  private buildTube(): THREE.Line {
    const geometry = new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(this.path),
      this.path.length,
      this.tubeRadius,
      8,
      false
    );
    
    const material = new THREE.MeshStandardMaterial({
      color: this.pathColor
    });
    
    return new THREE.Mesh(geometry, material) as any;
  }
  
  private buildParticle(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(0.05);
    const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    return new THREE.Mesh(geometry, material);
  }
}

// Usage in a demo
import { App } from '@/App';

const app = new App();
const metric = { mass: 1 };
const geo = new Geodesic(metric, initialConditions);

// Add with selective parameter exposure
app.add(geo, {
  params: {
    tubeRadius: { min: 0.02, max: 0.15 }, // Override range
    pathColor: true,                       // Use defaults
    particleSpeed: true,
    mass: { min: 0.5, max: 5 }            // Override range
  }
});

app.start();
```

---

## Type Exports

All types should be exported from a central `types.ts` file:

```typescript
// packages/core/src/types.ts

export interface Animatable {
  animate(time: number, delta: number): void;
}

export interface Disposable {
  dispose(): void;
}

export interface Renderable {
  mesh?: THREE.Object3D;
}

export interface MathComponent extends 
  Partial<Animatable>, 
  Partial<Disposable>, 
  Partial<Renderable> {
  params?: ComponentParams;
}

export interface AppOptions {
  fov?: number;
  near?: number;
  far?: number;
  cameraPosition?: Vector3Like;
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';
  layout?: 'fullscreen' | LayoutConfig;
  background?: string;
  lights?: string;
  controls?: string;
}

export interface AddOptions {
  params?: boolean | string[] | Record<string, boolean | ParamOptions>;
  set?: Record<string, any>;
}

export type AnimateCallback = (time: number, delta: number) => void;

export interface LayoutConfig {
  type: 'fullscreen' | 'fixed' | 'custom';
  width?: number;
  height?: number;
  container?: HTMLElement | string;
  onResize?: (width: number, height: number) => void;
}

export interface StarfieldOptions {
  count?: number;
  size?: number;
}

export interface ParamOptions {
  min?: number;
  max?: number;
  step?: number;
  type?: 'number' | 'boolean' | 'color' | 'string' | 'select';
  label?: string;
  folder?: string;
  options?: string[] | Record<string, any>;
  onChange?: (value: any) => void;
}

export interface ParamDefinition {
  name: string;
  defaultValue: any;
  options: ParamOptions;
}

export interface RegisteredParam {
  object: any;
  property: string;
  options: ParamOptions;
  type: 'adhoc' | 'component';
}

export type Vector3Like = THREE.Vector3 | [number, number, number];
export type ColorLike = number | string | THREE.Color;
```

---

## Summary

The type system provides:

✅ **Clear contracts** - Animatable, Disposable, Renderable define object lifecycle
✅ **Flexible options** - AppOptions, AddOptions, ParamOptions allow customization
✅ **Type safety** - TypeScript catches errors at compile time
✅ **Self-documenting** - Interfaces describe expected behavior
✅ **Optional implementation** - Use `Partial<>` for optional interfaces
✅ **Utility types** - Vector3Like, ColorLike accept multiple input formats

These contracts define the "shape" of the framework without dictating implementation details. Components can implement what they need, ignore what they don't.