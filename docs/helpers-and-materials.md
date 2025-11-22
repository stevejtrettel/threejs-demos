# Essential Helpers & Material Manager

## Overview

New additions to the framework:
- **Essential Helpers**: CoordinateAxes, Grid (located in `packages/core/src/math/helpers/`)
- **MaterialManager**: Non-limiting material creation system

---

## Essential Helpers

### CoordinateAxes

Located: `packages/core/src/math/helpers/CoordinateAxes.ts`

Creates RGB coordinate axes with arrowheads:
- **X-axis**: Red
- **Y-axis**: Green
- **Z-axis**: Blue

**Usage:**
```typescript
import { App, CoordinateAxes } from '@core';

const app = new App();

// Basic usage
const axes = new CoordinateAxes({
  size: 5,              // Length of each axis
  showNegative: true    // Show negative directions
});

app.add(axes);
```

**Options:**
```typescript
interface CoordinateAxesOptions {
  size?: number;           // Default: 5
  lineWidth?: number;      // Default: 1
  colors?: {
    x?: number;           // Default: 0xff0000 (red)
    y?: number;           // Default: 0x00ff00 (green)
    z?: number;           // Default: 0x0000ff (blue)
  };
  showNegative?: boolean; // Default: false
  labels?: boolean;       // Future: text labels (not implemented)
}
```

**Features:**
- Arrowhead cones at endpoints to show direction
- Proper disposal handling
- Named mesh for debugging

---

### Grid

Located: `packages/core/src/math/helpers/Grid.ts`

Flexible grid helper that supports multiple planes (XY, XZ, YZ).

**Usage:**
```typescript
import { App, Grid } from '@core';

const app = new App();

// Floor grid (XZ plane)
const grid = new Grid({
  size: 10,
  divisions: 20,
  plane: 'xz',
  colorCenterLine: 0x666666,
  colorGrid: 0x333333
});

app.add(grid);

// Change opacity later
grid.setOpacity(0.5);
```

**Options:**
```typescript
interface GridOptions {
  size?: number;           // Default: 10 (total size)
  divisions?: number;      // Default: 10 (number of divisions)
  colorCenterLine?: number; // Default: 0x444444
  colorGrid?: number;       // Default: 0x222222
  plane?: 'xy' | 'xz' | 'yz'; // Default: 'xz' (floor)
  opacity?: number;         // Default: 1
  fadeDistance?: number;    // Not yet implemented
}
```

**Methods:**
- `setOpacity(opacity: number)` - Change grid transparency

**Features:**
- Vertex colors for center line emphasis
- Supports all 3 coordinate planes
- Proper rotation handling
- Dynamic opacity control

---

## MaterialManager

Located: `packages/core/src/managers/MaterialManager.ts`

**Philosophy**: Returns actual Three.js materials, not wrappers. Never limiting - you can always fall back to `new THREE.MeshPhysicalMaterial()` directly.

### Core Method

**`physical(options)`** - Create MeshPhysicalMaterial with sensible defaults

```typescript
const mat = app.materials.physical({
  color: 0xff0000,
  roughness: 0.5,
  metalness: 0.8,
  clearcoat: 0.5,
  // ... any other MeshPhysicalMaterial parameter
});
```

**Defaults:**
- `roughness: 0.3`
- `metalness: 0.1`
- `clearcoat: 0.0`
- `clearcoatRoughness: 0.0`

All options can be overridden.

---

### Presets

All presets return `MeshPhysicalMaterial` and accept an optional `options` parameter to override anything.

#### **plastic(color, options)**

```typescript
const mat = app.materials.plastic(0xff0000);

// With overrides
const mat = app.materials.plastic(0xff0000, {
  clearcoat: 0.5  // Extra shiny plastic
});
```

**Defaults:**
- `roughness: 0.4`
- `metalness: 0.0`
- `clearcoat: 0.3`
- `clearcoatRoughness: 0.2`

#### **metal(color, options)**

```typescript
const mat = app.materials.metal(0xcccccc);
```

**Defaults:**
- `roughness: 0.2`
- `metalness: 1.0`

#### **glass(color, opacity, options)**

```typescript
const mat = app.materials.glass(0x88ccff, 0.6);

// With custom IOR
const mat = app.materials.glass(0xffffff, 0.5, {
  ior: 1.33  // Water
});
```

**Defaults:**
- `transparent: true`
- `roughness: 0.0`
- `metalness: 0.0`
- `transmission: 0.9`
- `thickness: 0.5`
- `ior: 1.5`

#### **matte(color, options)**

```typescript
const mat = app.materials.matte(0xffffff);
```

**Defaults:**
- `roughness: 1.0`
- `metalness: 0.0`

#### **glossy(color, options)**

```typescript
const mat = app.materials.glossy(0xff00ff);
```

**Defaults:**
- `roughness: 0.1`
- `metalness: 0.0`
- `clearcoat: 1.0`
- `clearcoatRoughness: 0.1`

---

### Other Material Types

#### **standard(options)** - MeshStandardMaterial

```typescript
const mat = app.materials.standard({
  color: 0xff0000,
  roughness: 0.5
});
```

#### **basic(options)** - MeshBasicMaterial (unlit)

```typescript
const mat = app.materials.basic({ color: 0xff0000 });
```

#### **normal(options)** - MeshNormalMaterial (debugging)

```typescript
const mat = app.materials.normal();
```

#### **line(options)** - LineBasicMaterial

```typescript
const mat = app.materials.line({
  color: 0xff0000,
  linewidth: 2
});
```

#### **points(options)** - PointsMaterial

```typescript
const mat = app.materials.points({
  color: 0xff0000,
  size: 0.1
});
```

---

## Integration with Parameters

Materials work seamlessly with the parameter system:

```typescript
const mat = app.materials.plastic(0xff0000);

// Expose material properties to UI
app.params.add(mat, 'roughness', {
  min: 0,
  max: 1,
  label: 'Roughness'
});

app.params.add(mat, 'metalness', {
  min: 0,
  max: 1,
  label: 'Metalness'
});

app.params.add(mat, 'clearcoat', {
  min: 0,
  max: 1,
  label: 'Clearcoat'
});

// Color requires special handling
app.params.add(mat, 'color', {
  type: 'color',
  onChange: (v) => mat.color.setHex(v),
  label: 'Color'
});
```

---

## Demo

See `demos/test/helpers-demo.ts` for a complete example showing:
- CoordinateAxes with arrowheads
- Grid on XZ floor plane
- 5 spheres with different materials (plastic, metal, glass, matte, glossy)
- Material parameters exposed to parameter system

**Run the demo:**
```bash
npm run dev
# Then open http://localhost:5173
```

The demo shows all 5 material presets side-by-side with parameter controls.

---

## Design Principles

### Why This Design Works

1. **No Wrappers** - Returns actual Three.js materials
2. **Not Limiting** - Can always use `new THREE.MeshPhysicalMaterial()` directly
3. **Sensible Defaults** - Optimized for math visualizations
4. **Full Override** - Every parameter can be overridden
5. **Parameter Integration** - Works with ParameterManager but not coupled to it

### When to Use What

**Use presets when:**
- You want quick, good-looking materials
- The defaults match your needs
- You want consistency across demos

**Use `physical()` when:**
- You need custom settings but want the base defaults
- Presets are close but not quite right

**Use raw Three.js when:**
- You need maximum control
- Working with complex material setups
- The MaterialManager doesn't add value

---

## Future Extensions

Potential additions:
- **Shader material helpers** (when needed)
- **Material cloning utilities**
- **More sophisticated presets** (velvet, silk, ceramic, etc.)
- **Material parameter groups** (expose common sets together)

**Philosophy**: Only add what's actually needed. Keep it minimal and non-limiting.
