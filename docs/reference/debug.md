# Debug & Performance System

Performance monitoring and debug visualization via the `DebugManager`.

**Location**: `src/app/DebugManager.ts`
**Access**: `app.debug`

## Overview

The DebugManager provides comprehensive development tools:
- **Stats Panel**: Real-time FPS, frame time, draw calls, triangles, memory
- **Debug Helpers**: Wireframe, grid, axes, normals, bounding boxes
- **Keyboard Shortcuts**: Quick toggle for all debug tools
- **Performance Profiling**: Time function execution
- **Scene Inspection**: Print scene graph, log memory usage

**IMPORTANT**: This is separate from the main UI (ParameterManager) - it's purely for development and debugging.

## Quick Start

```typescript
import { App } from '../src/app/App';

const app = new App({ debug: true });  // Enables keyboard shortcuts

// Show stats panel
app.debug.showStats(true);

// Toggle debug helpers
app.debug.toggleGrid();
app.debug.toggleAxes();
app.debug.toggleNormals();

// Profile performance
app.debug.profile('Rebuild Surface', () => {
  surface.rebuild();
});

// Inspect scene
app.debug.printSceneGraph();
app.debug.logMemoryUsage();
```

## Keyboard Shortcuts

Enable shortcuts with `debug: true` in App options, or call `app.debug.enable()`.

| Key | Action |
|-----|--------|
| **D** | Toggle stats panel |
| **W** | Toggle wireframe mode |
| **G** | Toggle grid helper |
| **A** | Toggle axes helper |
| **N** | Toggle normal helpers |
| **B** | Toggle bounding boxes |

**Note**: Shortcuts are ignored when typing in input fields.

## Stats Panel

### showStats(show: boolean)

Show or hide the stats overlay panel.

```typescript
// Show stats
app.debug.showStats(true);

// Hide stats
app.debug.showStats(false);
```

**Panel Contents:**
- **Performance**
  - FPS (current frame rate)
  - Frame time (ms per frame)
  - Min FPS (worst frame in last 2 seconds)
  - Max FPS (best frame in last 2 seconds)
  - Avg FPS (average over last 2 seconds)
- **Render Info**
  - Calls (draw calls per frame)
  - Triangles (total triangles rendered)
- **Memory**
  - Geometries (number of geometry buffers in memory)
  - Textures (number of textures in memory)

**Position**: Fixed top-left corner
**Update Rate**: Every frame (60 fps)

### getStats()

Get current stats programmatically.

```typescript
const stats = app.debug.getStats();
console.log(`FPS: ${stats.fps.toFixed(1)}`);
console.log(`Frame time: ${stats.frameTime.toFixed(2)}ms`);
console.log(`Min FPS: ${stats.minFps.toFixed(1)}`);
console.log(`Max FPS: ${stats.maxFps.toFixed(1)}`);
console.log(`Avg FPS: ${stats.avgFps.toFixed(1)}`);
```

**Returns**: `{ fps, frameTime, minFps, maxFps, avgFps }`

## Debug Helpers

### toggleWireframe()

Toggle wireframe mode for all meshes in the scene.

```typescript
app.debug.toggleWireframe();  // ON
app.debug.toggleWireframe();  // OFF
```

**How It Works:**
- Replaces all mesh materials with green wireframe materials
- Stores original materials for restoration
- No geometry changes (cheap operation)
- Logs state to console

**Use Cases:**
- See mesh topology and triangle density
- Debug geometry issues
- Verify mesh structure

### toggleGrid(size?, divisions?)

Toggle ground grid helper.

```typescript
// Default: 10x10 grid with 10 divisions
app.debug.toggleGrid();

// Custom size and divisions
app.debug.toggleGrid(20, 20);  // 20x20 grid with 20 divisions
```

**Parameters:**
- `size` - Grid size in world units (default: 10)
- `divisions` - Number of grid divisions (default: 10)

**Appearance**: White/gray grid on XZ plane

### toggleAxes(size?)

Toggle coordinate axes helper.

```typescript
// Default: 5-unit axes
app.debug.toggleAxes();

// Custom size
app.debug.toggleAxes(10);  // 10-unit axes
```

**Parameters:**
- `size` - Axis length in world units (default: 5)

**Appearance**:
- Red: +X axis
- Green: +Y axis
- Blue: +Z axis

### toggleNormals(size?)

Toggle normal vector visualization for all meshes.

```typescript
// Default: 0.1-unit normals
app.debug.toggleNormals();

// Custom size
app.debug.toggleNormals(0.5);  // Longer normal arrows
```

**Parameters:**
- `size` - Normal arrow length (default: 0.1)

**How It Works:**
- Creates `VertexNormalsHelper` for each mesh with normals
- Shows green arrows pointing in normal direction
- Useful for debugging lighting and shading issues

**Use Cases:**
- Verify normal directions (especially after custom geometry)
- Debug inverted normals
- Understand surface orientation

### toggleBoundingBoxes()

Toggle bounding box visualization for all objects.

```typescript
app.debug.toggleBoundingBoxes();  // ON
app.debug.toggleBoundingBoxes();  // OFF
```

**How It Works:**
- Creates `BoxHelper` for each mesh, line, and point cloud
- Shows yellow wireframe boxes around objects
- Automatically updates with object transforms

**Use Cases:**
- See object extents and bounds
- Debug culling issues
- Verify object positioning

## Performance Profiling

### profile(name, fn)

Profile a function execution and log the duration.

```typescript
const duration = app.debug.profile('Surface Rebuild', () => {
  surface.rebuild();
});

console.log(`Took ${duration.toFixed(2)}ms`);
```

**Parameters:**
- `name` - Profile name (for logging)
- `fn` - Function to profile

**Returns**: Duration in milliseconds

**Console Output**: `[Profile] Surface Rebuild: 12.34ms`

### startProfile(name) / endProfile(name)

Profile a block of code that can't be wrapped in a function.

```typescript
app.debug.startProfile('Complex Operation');

// ... do work ...
for (let i = 0; i < 1000; i++) {
  // complex calculations
}

const duration = app.debug.endProfile('Complex Operation');
console.log(`Operation took ${duration}ms`);
```

**Returns**: Duration in milliseconds

**Console Output**: `[Profile] Complex Operation: 45.67ms`

## Scene Inspection

### printSceneGraph()

Print the entire scene hierarchy to console.

```typescript
app.debug.printSceneGraph();
```

**Output Example:**
```
Scene Graph:
Scene: (unnamed)
  PerspectiveCamera: Camera
  AmbientLight: (unnamed)
  DirectionalLight: (unnamed)
  Mesh: RedSphere [1024 vertices]
  Mesh: CyanCube [24 vertices]
  Mesh: YellowTorus [6400 vertices]
  Mesh: GroundPlane [4 vertices]
```

**Shows**:
- Object type
- Object name (or "(unnamed)")
- Vertex count for meshes
- Hierarchical indentation

**Use Cases:**
- Debug scene structure
- Find unnamed objects
- Verify object hierarchy
- Check vertex counts

### logMemoryUsage()

Log current memory and render statistics.

```typescript
app.debug.logMemoryUsage();
```

**Output Example:**
```
Memory Usage:
  Geometries: 12
  Textures: 4
Render Info:
  Calls: 15
  Triangles: 8432
  Points: 0
  Lines: 0
```

**Shows**:
- Geometry buffers in memory
- Textures in memory
- Draw calls per frame
- Triangles, points, lines rendered

**Use Cases:**
- Detect memory leaks
- Optimize geometry count
- Reduce draw calls
- Monitor resource usage

## Enabling/Disabling

### enable()

Enable debug keyboard shortcuts.

```typescript
app.debug.enable();
```

**Automatically enabled** when `new App({ debug: true })`.

**Keyboard shortcuts**: D, W, G, A, N, B

### disable()

Disable debug keyboard shortcuts and clean up all debug visualizations.

```typescript
app.debug.disable();
```

**Cleanup Actions:**
- Hides stats panel
- Removes wireframe mode
- Removes grid helper
- Removes axes helper
- Removes normal helpers
- Removes bounding box helpers

## Common Patterns

### Pattern 1: Always-On Stats During Development

```typescript
const app = new App({ debug: true });
app.debug.showStats(true);  // Always visible

// Now you can monitor performance while developing
```

### Pattern 2: Profile Expensive Operations

```typescript
// Find slow operations
app.debug.profile('Generate 1000 Curves', () => {
  for (let i = 0; i < 1000; i++) {
    curves.push(new ParametricCurve(...));
  }
});

// Output: [Profile] Generate 1000 Curves: 234.56ms
// → Now you know if this is too slow!
```

### Pattern 3: Debug Geometry Issues

```typescript
// Surface looks weird? Check normals!
app.debug.toggleNormals(0.2);  // Show normals

// Verify they point the right direction
// If inverted, you might need to:
//   geometry.computeVertexNormals();
//   geometry.attributes.normal.needsUpdate = true;
```

### Pattern 4: Optimize Draw Calls

```typescript
app.debug.showStats(true);
app.debug.logMemoryUsage();

// Check "Calls" in stats panel
// Too many? Consider:
//   - Merging geometries
//   - Instanced rendering
//   - Reducing object count
```

### Pattern 5: Memory Leak Detection

```typescript
// Before adding objects
app.debug.logMemoryUsage();
// Geometries: 10, Textures: 2

// ... add 100 objects ...

// After removing objects
app.debug.logMemoryUsage();
// Geometries: 110, Textures: 2
// ⚠️ Geometries didn't decrease! Memory leak!

// Fix: Make sure to dispose geometries when removing objects
```

## Performance Notes

### Stats Panel Overhead

- **Negligible**: ~0.01ms per frame
- Safe to leave enabled during development

### Debug Helpers Overhead

| Helper | Cost | Notes |
|--------|------|-------|
| Wireframe | ~0ms | Material swap, same geometry |
| Grid | ~0.1ms | Single draw call |
| Axes | ~0.1ms | Single draw call |
| Normals | ~0.5-2ms | One draw call per mesh |
| Bounding Boxes | ~0.3-1ms | One draw call per object |

**Tip**: Use sparingly in production. Disable all debug helpers before final export.

## Examples

### Example 1: Basic Debug Setup

```typescript
const app = new App({ debug: true });

// Show stats
app.debug.showStats(true);

// Show grid and axes
app.debug.toggleGrid();
app.debug.toggleAxes();

// Now you can see FPS, grid, and axes
// Press D, G, A to toggle them via keyboard
```

### Example 2: Profile Rebuild Performance

```typescript
const surface = new ParametricSurface({...});

// Check rebuild performance
app.debug.startProfile('Initial Build');
surface.rebuild();
app.debug.endProfile('Initial Build');
// [Profile] Initial Build: 15.23ms

// Change parameters and rebuild
surface.params.set('resolution', 100);

app.debug.profile('High Resolution Rebuild', () => {
  surface.rebuild();
});
// [Profile] High Resolution Rebuild: 45.67ms
// → 3x slower at higher resolution, as expected
```

### Example 3: Debug Custom Geometry

```typescript
// Created custom geometry, but lighting looks wrong
const customMesh = new THREE.Mesh(customGeometry, material);
app.scene.add(customMesh);

// Check normals
app.debug.toggleNormals(0.2);
// → Normals are pointing the wrong way!

// Fix normals
customGeometry.computeVertexNormals();
customMesh.geometry.attributes.normal.needsUpdate = true;

// Check again
app.debug.toggleNormals();  // OFF
app.debug.toggleNormals(0.2);  // ON (refreshed)
// → Normals now correct!
```

### Example 4: Monitor Frame Rate

```typescript
app.debug.showStats(true);

// Add many objects
for (let i = 0; i < 100; i++) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xff0000 })
  );
  mesh.position.set(
    Math.random() * 20 - 10,
    Math.random() * 20,
    Math.random() * 20 - 10
  );
  app.scene.add(mesh);
}

// Check stats panel
// FPS: 45 (was 60 before)
// Calls: 105 (was 5 before)
// Triangles: 204,800 (was 800 before)

// → Adding 100 spheres increased draw calls and reduced FPS
```

## Integration with App

The DebugManager is automatically created and integrated in the App class:

```typescript
// In App.ts
export class App {
  public debug: DebugManager;

  constructor(options: AppOptions = {}) {
    // ...
    this.debug = new DebugManager(this.scene, this.renderer);

    if (options.debug) {
      this.debug.enable();  // Enable keyboard shortcuts
    }
  }

  private animate(time: number): void {
    // Update debug stats every frame
    this.debug.update();

    // ... render ...
  }
}
```

**Key Points:**
- DebugManager.update() called every frame (updates stats)
- Keyboard shortcuts enabled with `debug: true` option
- Always available via `app.debug` even if shortcuts disabled

## Demo

See `demos/debug-demo.ts` for a complete example showing:
- Stats panel with real-time updates
- All keyboard shortcuts
- Performance profiling
- Scene inspection
- Memory logging
- Multiple objects with varying complexity to test debug tools

## Best Practices

1. **Always enable debug during development**
   ```typescript
   const app = new App({ debug: true });
   ```

2. **Show stats to monitor performance**
   ```typescript
   app.debug.showStats(true);
   ```

3. **Profile expensive operations**
   ```typescript
   app.debug.profile('Operation Name', () => { ... });
   ```

4. **Check scene graph regularly**
   ```typescript
   app.debug.printSceneGraph();
   ```

5. **Monitor memory for leaks**
   ```typescript
   app.debug.logMemoryUsage();  // Before and after operations
   ```

6. **Disable for production**
   ```typescript
   const app = new App({ debug: false });
   // Or don't enable it at all
   ```

7. **Use keyboard shortcuts for quick debugging**
   - Press **N** to check normals
   - Press **B** to check bounds
   - Press **W** to see geometry structure

## Troubleshooting

**Stats panel not updating:**
- Make sure App is calling `debug.update()` every frame
- Check that stats panel is actually visible (press D or call `showStats(true)`)

**Keyboard shortcuts not working:**
- Enable with `new App({ debug: true })` or `app.debug.enable()`
- Make sure you're not typing in an input field
- Check browser console for key events

**Normal helpers not showing:**
- Only meshes with normals get helpers
- Custom geometries need `geometry.computeVertexNormals()`
- Check that geometry has `attributes.normal`

**Memory keeps increasing:**
- Geometries/textures not being disposed
- Add `geometry.dispose()` and `material.dispose()` when removing objects
- Use `app.debug.logMemoryUsage()` to track the leak

**FPS drops with debug helpers:**
- Normal helpers and bounding boxes add draw calls
- This is expected - they're just for debugging
- Disable them for production builds
