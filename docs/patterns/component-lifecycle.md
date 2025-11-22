# Component Lifecycle Pattern

## The Problem

Math components have two fundamentally different types of parameter changes:

1. **Rebuild (Expensive)**: Changes topology/structure - requires new `BufferGeometry`
   - Examples: `segments`, `tMin`/`tMax`, `uMin`/`uMax`, resolution
   - Cost: Allocates memory, rebuilds vertex/index buffers (~1-100ms)

2. **Update (Cheap)**: Changes existing vertices/colors in place
   - Examples: `color`, `wireframe`, `opacity`, material properties
   - Cost: Just updates `Float32Array` values (~0.1ms)

Without a clear pattern, every component author has to manually wire this up, leading to:
- ❌ Inconsistent behavior across components
- ❌ Expensive rebuilds for cheap changes
- ❌ Boilerplate `onChange` callbacks everywhere
- ❌ Easy to forget to call rebuild/update

## The Solution

### 1. MathComponent Interface

All math components now have optional lifecycle methods:

```typescript
export interface MathComponent {
  /**
   * Rebuild geometry from scratch
   * Called when structural parameters change
   * EXPENSIVE - allocates new BufferGeometry
   */
  rebuild?(): void;

  /**
   * Update existing geometry in place
   * Called when visual parameters change
   * CHEAP - modifies existing Float32Array
   */
  update?(): void;

  // Also: animate?(), dispose?(), mesh?
}
```

### 2. Parameter Triggers

Declare what each parameter affects:

```typescript
this.params.define('segments', 32, {
  min: 4, max: 128, step: 1,
  triggers: 'rebuild'  // ← Declares intent
});

this.params.define('color', 0xff0000, {
  type: 'color',
  triggers: 'update'   // ← Cheaper operation
});

this.params.define('customParam', value, {
  triggers: 'none',    // ← Manual control
  onChange: (v) => { /* custom logic */ }
});
```

### 3. Automatic Triggering

`ComponentParams` automatically calls the right method:

```typescript
// User changes parameter
curve.segments = 64;

// ComponentParams setter:
// 1. Updates value
// 2. Calls onChange (if provided)
// 3. Calls owner.rebuild() (if triggers='rebuild')
```

## Component Author Pattern

### Full Example

```typescript
export class ParametricSurface implements MathComponent {
  mesh: THREE.Mesh;
  params: ComponentParams;

  private fn: SurfaceFunction;
  private geometry!: THREE.BufferGeometry;
  private material!: THREE.Material;

  // Reactive properties
  uMin!: number;
  uMax!: number;
  uSegments!: number;
  vSegments!: number;
  wireframe!: boolean;
  colorHex!: number;

  constructor(fn: SurfaceFunction, options: SurfaceOptions = {}) {
    this.fn = fn;
    this.params = new ComponentParams(this);

    // STRUCTURAL PARAMETERS → rebuild
    this.params.define('uMin', options.uMin ?? 0, {
      label: 'U Min',
      min: -10, max: 10, step: 0.1,
      triggers: 'rebuild'  // ← Changing domain needs new geometry
    });

    this.params.define('uSegments', options.uSegments ?? 32, {
      label: 'U Segments',
      min: 4, max: 128, step: 1,
      triggers: 'rebuild'  // ← Changing segments needs new geometry
    });

    // VISUAL PARAMETERS → update
    this.params.define('wireframe', options.wireframe ?? false, {
      label: 'Wireframe',
      type: 'boolean',
      triggers: 'update'   // ← Just toggle material property
    });

    this.params.define('colorHex', options.color ?? 0xff0000, {
      label: 'Color',
      type: 'color',
      triggers: 'update'   // ← Just change material color
    });

    // Build initial mesh
    this.geometry = this.buildGeometry();
    this.material = this.buildMaterial();
    this.mesh = new THREE.Mesh(this.geometry, this.material);
  }

  /**
   * Rebuild geometry when structural params change
   */
  rebuild(): void {
    try {
      const newGeometry = this.buildGeometry();
      const oldGeometry = this.geometry;

      this.mesh.geometry = newGeometry;
      this.geometry = newGeometry;

      oldGeometry.dispose();
    } catch (error) {
      console.error('Rebuild failed:', error);
    }
  }

  /**
   * Update visual properties in place
   */
  update(): void {
    const mat = this.material as THREE.MeshStandardMaterial;
    mat.wireframe = this.wireframe;
    mat.color.setHex(this.colorHex);
    mat.needsUpdate = true;
  }

  private buildGeometry(): THREE.BufferGeometry {
    // Expensive: sample grid based on uMin/uMax/segments
    const positions: number[] = [];

    for (let i = 0; i <= this.uSegments; i++) {
      const u = this.uMin + (i / this.uSegments) * (this.uMax - this.uMin);
      // ... build vertices
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }

  private buildMaterial(): THREE.Material {
    return new THREE.MeshStandardMaterial({
      color: this.colorHex,
      wireframe: this.wireframe
    });
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
```

## Parameter Categories Cheat Sheet

### Always `triggers: 'rebuild'`
- Domain bounds: `tMin`, `tMax`, `uMin`, `uMax`, etc.
- Segment counts: `segments`, `uSegments`, `vSegments`
- Resolution: `resolution`, `divisions`
- Topology: `closed`, `doubleSided`

### Always `triggers: 'update'`
- Colors: `color`, `colorHex`
- Material: `wireframe`, `opacity`, `roughness`, `metalness`
- Visibility: `visible`

### Sometimes Either (Implementation Dependent)
- `scale`: Could update vertex positions OR rebuild
- Animation params: Depends on implementation

### Use `triggers: 'none'` When
- Custom logic needed beyond simple rebuild/update
- Parameter affects multiple systems
- Need fine-grained control

## Performance Impact

```typescript
// User tweaking parameters in GUI
surface.uSegments = 64;    // triggers rebuild() → 50ms
surface.wireframe = true;  // triggers update()  → 0.1ms
surface.colorHex = 0xff00; // triggers update()  → 0.1ms

// Total: 50.2ms = still interactive!

// If everything triggered rebuild:
// Total: 50ms + 50ms + 50ms = 150ms = LAGGY
```

## Migration Guide

### Old Pattern (Manual)
```typescript
this.params.define('segments', 32, {
  onChange: () => this.rebuild()  // ❌ Boilerplate
});

this.params.define('color', 0xff0000, {
  onChange: (c) => {  // ❌ Duplicated logic
    this.mesh.material.color.setHex(c);
  }
});
```

### New Pattern (Declarative)
```typescript
this.params.define('segments', 32, {
  triggers: 'rebuild'  // ✅ Intent is clear
});

this.params.define('color', 0xff0000, {
  triggers: 'update'   // ✅ System handles it
});

// Implement once:
update(): void {
  this.mesh.material.color.setHex(this.color);
}
```

## Gotchas

### Infinite Loops
```typescript
// ❌ BAD - infinite loop!
update(): void {
  this.scale = this.scale * 2;  // Triggers update() again!
}

// ✅ GOOD - modify other properties
update(): void {
  this.mesh.scale.setScalar(this.scale);  // Modify mesh, not param
}
```

### Both onChange AND triggers
```typescript
// Both are called (onChange first, then auto-trigger)
this.params.define('segments', 32, {
  onChange: (v) => console.log(`Segments changing to ${v}`),
  triggers: 'rebuild'  // Will call rebuild() after onChange
});
```

## Benefits

✅ **Consistent**: All components follow same pattern
✅ **Performant**: Clear separation of expensive vs cheap operations
✅ **Discoverable**: `grep 'triggers.*rebuild'` shows all expensive params
✅ **Type-safe**: TypeScript enforces interface
✅ **Future-proof**: GUI can show rebuild params with warning icons
✅ **Less code**: No boilerplate `onChange` callbacks
