# Update Strategies

This document explains how to design efficient parameter-driven updates in math objects, avoiding unnecessary rebuilds and maximizing performance.

## Core Concepts

### rebuild() vs update()

Math objects implement two lifecycle methods:

**rebuild()** - Expensive, creates new geometry
- Allocates new BufferGeometry
- Rebuilds vertex positions, indices, normals
- Called when topology/structure changes
- Examples: segment count, domain bounds, curve definition

**update()** - Cheap, modifies existing geometry in place
- Modifies existing Float32Array values
- Updates materials, colors, line width
- Called when visual properties change
- Examples: color, opacity, visibility

### The triggers System

Parameters declare what they affect using the `triggers` option:

```typescript
this.params.define('segments', 100, {
  triggers: 'rebuild'  // Structural change → expensive
});

this.params.define('color', 0xff0000, {
  triggers: 'update'   // Visual change → cheap
});

this.params.define('scale', 1.0, {
  triggers: 'none',    // Manual control via onChange
  onChange: (v) => this.mesh.scale.setScalar(v)
});
```

## Decision Tree

When defining a parameter, ask:

1. **Does this change the number of vertices or topology?**
   → YES: `triggers: 'rebuild'`
   - Segment counts (curve segments, surface resolution)
   - Domain bounds (uMin, uMax, tMin, tMax)
   - Switching between different curve/surface definitions

2. **Does this only change visual appearance?**
   → YES: `triggers: 'update'`
   - Colors (hex values)
   - Materials (switching between presets that don't affect geometry)
   - Opacity, visibility flags

3. **Does this affect transforms or external state?**
   → YES: `triggers: 'none'` + custom `onChange`
   - Scale, position, rotation (use mesh transforms)
   - External state synchronization
   - Complex updates requiring multiple steps

## Patterns

### Pattern 1: Structural Parameters

All parameters that affect geometry structure should trigger rebuild:

```typescript
export class ParametricCurve {
  constructor(options: ParametricCurveOptions) {
    this.params.define('segments', options.segments ?? 100, {
      min: 10,
      max: 500,
      step: 10,
      label: 'Segments',
      triggers: 'rebuild'  // Changes vertex count
    });

    this.params.define('tMin', options.tMin ?? 0, {
      label: 'Domain Start',
      triggers: 'rebuild'  // Changes which part of curve to show
    });
  }
}
```

### Pattern 2: Visual Parameters

Color and material properties should trigger update:

```typescript
this.params.define('colorHex', options.color ?? 0xff0000, {
  type: 'color',
  label: 'Color',
  triggers: 'update'  // Just changes material color
});

this.params.define('linewidth', options.linewidth ?? 2, {
  min: 1,
  max: 10,
  label: 'Line Width',
  triggers: 'update'  // Material property
});
```

Implement update() efficiently:

```typescript
update(): void {
  if (this.material instanceof THREE.LineBasicMaterial) {
    this.material.color.setHex(this.colorHex);
    this.material.linewidth = this.linewidth;
    this.material.needsUpdate = true;
  }
}
```

### Pattern 3: Manual Control

For complex updates or when you need fine-grained control:

```typescript
this.params.define('animationSpeed', 1.0, {
  min: 0,
  max: 5,
  label: 'Speed',
  triggers: 'none',  // Don't auto-trigger anything
  onChange: (speed) => {
    // Custom logic
    this.timeScale = speed;
    if (speed === 0) {
      this.pause();
    } else {
      this.resume();
    }
  }
});
```

### Pattern 4: Hybrid Parameters

Some parameters might affect BOTH geometry and appearance. Choose the most expensive operation:

```typescript
// BAD: This will rebuild even though it's just visual
this.params.define('showNormals', false, {
  type: 'boolean',
  triggers: 'rebuild'  // Overkill!
});

// GOOD: Manual control for conditional logic
this.params.define('showNormals', false, {
  type: 'boolean',
  triggers: 'none',
  onChange: (show) => {
    if (show && !this.normalLines) {
      this.createNormalLines();  // Lazy creation
    }
    if (this.normalLines) {
      this.normalLines.visible = show;
    }
  }
});
```

## Performance Optimization

### Avoid Cascading Rebuilds

If multiple parameters change at once, rebuild only once:

```typescript
// BAD: Each parameter triggers rebuild independently
this.uSegments = 50;  // rebuild()
this.vSegments = 50;  // rebuild() again!

// GOOD: Batch changes, then rebuild once
this.params.set('uSegments', 50);
this.params.set('vSegments', 50);
this.rebuild();  // Only once
```

To support this, consider adding a batch update method:

```typescript
updateMultiple(changes: Record<string, any>): void {
  let needsRebuild = false;
  let needsUpdate = false;

  for (const [key, value] of Object.entries(changes)) {
    const def = this.params.getDefinition(key);
    this[key] = value;  // Set without triggering

    if (def?.options.triggers === 'rebuild') needsRebuild = true;
    if (def?.options.triggers === 'update') needsUpdate = true;
  }

  if (needsRebuild) this.rebuild();
  else if (needsUpdate) this.update();
}
```

### Lazy Evaluation

Don't rebuild in constructor if user might change parameters before first render:

```typescript
// BAD: Build geometry immediately
constructor(options) {
  this.params.define(...);
  this.geometry = this.buildGeometry();  // Might be wasted work
}

// GOOD: Build on first access
constructor(options) {
  this.params.define(...);
  // Don't build yet
}

get mesh(): THREE.Mesh {
  if (!this._mesh) {
    this.rebuild();  // Build on demand
  }
  return this._mesh;
}
```

### Differential Updates

For animate(), avoid triggering rebuilds. Update geometry directly:

```typescript
animate(time: number, delta: number): void {
  // BAD: Don't trigger rebuilds in animation loop
  // this.phase = time;  // if this triggers rebuild → disaster!

  // GOOD: Direct geometry manipulation
  const positions = this.geometry.attributes.position.array as Float32Array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 2] = Math.sin(positions[i] + time);
  }
  this.geometry.attributes.position.needsUpdate = true;
}
```

## Common Pitfalls

### ❌ Pitfall 1: Rebuilding on Every Frame

```typescript
// WRONG: This rebuilds geometry 60 times per second!
animate(time: number): void {
  this.phase = time;  // triggers rebuild
}
```

**Fix:** Use `triggers: 'none'` and update geometry directly, or don't make animated values parameters at all.

### ❌ Pitfall 2: Using 'update' When You Need 'rebuild'

```typescript
// WRONG: Changing segments doesn't actually rebuild
this.params.define('segments', 100, {
  triggers: 'update'  // Not enough!
});
```

**Fix:** Structural changes need `triggers: 'rebuild'`.

### ❌ Pitfall 3: Forgetting needsUpdate

```typescript
// WRONG: Geometry changed but not flagged
update(): void {
  this.material.color.setHex(this.colorHex);
  // Missing: this.material.needsUpdate = true;
}
```

**Fix:** Always set `needsUpdate = true` when modifying materials or geometry attributes.

### ❌ Pitfall 4: Object Mutation Without Triggering

```typescript
// WRONG: Mutating Vector3 doesn't trigger onChange
this.origin.x = 5;  // Silent mutation

// RIGHT: Replace the object or use setter method
this.origin = new THREE.Vector3(5, 0, 0);  // Triggers onChange
this.setOrigin(5, 0, 0);  // Explicit setter
```

## Real-World Examples

### Example 1: ParametricCurve

```typescript
// Structural parameters → rebuild
this.params.define('segments', 100, { triggers: 'rebuild' });
this.params.define('tMin', 0, { triggers: 'rebuild' });
this.params.define('tMax', 2 * Math.PI, { triggers: 'rebuild' });

// Visual parameters → update
this.params.define('colorHex', 0xff0000, { triggers: 'update' });
this.params.define('linewidth', 2, { triggers: 'update' });
```

### Example 2: Geodesic

```typescript
// Geodesic parameters → rebuild
this.params.define('maxSteps', 1000, { triggers: 'rebuild' });
this.params.define('stepSize', 0.01, { triggers: 'rebuild' });

// Visual → update
this.params.define('colorHex', 0x00ff00, { triggers: 'update' });

// Initial conditions → rebuild (changes the path)
this.params.define('initialPosition', [0, 0], { triggers: 'rebuild' });
this.params.define('initialVelocity', [1, 0], { triggers: 'rebuild' });
```

### Example 3: ImplicitSurface

```typescript
// Resolution → rebuild
this.params.define('resolution', 64, { triggers: 'rebuild' });

// Domain bounds → rebuild
this.params.define('xMin', -5, { triggers: 'rebuild' });
this.params.define('xMax', 5, { triggers: 'rebuild' });

// Visual → update
this.params.define('colorHex', 0xff0000, { triggers: 'update' });
this.params.define('opacity', 1.0, { triggers: 'update' });
```

## Summary

**Use `triggers: 'rebuild'` when:**
- Changing vertex count, indices, or topology
- Changing domain bounds or sampling resolution
- Switching between different mathematical definitions

**Use `triggers: 'update'` when:**
- Changing colors, materials, opacity
- Modifying existing geometry values in place
- Updating visual properties only

**Use `triggers: 'none'` when:**
- You need custom onChange logic
- Affecting transforms (position, rotation, scale)
- Coordinating multiple systems
- Performance-critical animation updates

**Always remember:**
- Rebuild is expensive → minimize calls
- Update is cheap → safe to call frequently
- Set `needsUpdate = true` after manual changes
- Batch parameter changes when possible
- Don't trigger rebuilds in animate()
