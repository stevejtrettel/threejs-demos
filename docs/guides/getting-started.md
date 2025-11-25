# Getting Started with the Framework

## Basic Setup

```typescript
import { App } from '@/app';
import { Lights } from '@/scene';

// Create app with default options
const app = new App();

// Or with custom options
const app = new App({
  antialias: true,      // Enable antialiasing (default: true)
  debug: true,          // Enable debug manager (default: true)
  fov: 75,              // Camera field of view (default: 75)
  toneMapping: 'aces',  // Tone mapping type (default: 'aces')
  shadows: true         // Enable shadows (default: false)
});

// Position camera
app.camera.position.set(5, 5, 8);
app.controls.target.set(0, 0, 0);

// Set background
app.backgrounds.setColor(0x2a2a2a);

// Add lights
app.scene.add(Lights.threePoint());

// Add objects
const sphere = new ParametricSurface(...);
app.add(sphere);

// Start rendering
app.start();
```

## App Managers

The App includes several built-in managers:

### AssetManager (`app.assets`)
Load and cache textures, HDRIs, shaders, and models.

```typescript
// Load texture
const texture = await app.assets.loadTexture('/path/to/texture.png');

// Load HDRI
const envMap = await app.assets.loadHDRI('/path/to/env.hdr');

// Load shader from strings
const shader = app.assets.loadShaderFromString(vertexCode, fragmentCode);

// Load GLTF model
const model = await app.assets.loadModel('/path/to/model.glb');
```

### DebugManager (`app.debug`)
Performance monitoring and debug visualization - **separate from main UI**.

**Keyboard Shortcuts** (enabled by default):
- **D** - Toggle stats panel (FPS, frame time)
- **W** - Toggle wireframe mode
- **G** - Toggle grid helper
- **A** - Toggle axes helper

**Programmatic Access**:
```typescript
// Get performance stats
const stats = app.debug.getStats();
console.log(`FPS: ${stats.fps}`);

// Profile code
app.debug.profile('Expensive operation', () => {
  // Your code here
});

// Scene inspection
app.debug.printSceneGraph();
app.debug.logMemoryUsage();
```

**Enable/Disable**:
```typescript
// Disable debug manager
const app = new App({ debug: false });

// Or disable at runtime
app.debug.disable();
```

### BackgroundManager (`app.backgrounds`)
Control scene background.

```typescript
// Solid color
app.backgrounds.setColor(0x2a2a2a);

// Gradient
app.backgrounds.setGradient('#1a1a2e', '#16213e');

// Starfield
app.backgrounds.setStarfield({ count: 2000, size: 2 });

// HDRI (also sets environment lighting)
app.backgrounds.loadHDR('/path/to/env.hdr', true, true);
```

### Lights Factory (`@/scene`)
Quick lighting presets via factory functions.

```typescript
import { Lights } from '@/scene';

app.scene.add(Lights.threePoint());   // Key, fill, back lights
app.scene.add(Lights.studio());       // Soft studio lighting
app.scene.add(Lights.ambient());      // Ambient light only
app.scene.add(Lights.directional());  // Single directional light
app.scene.add(Lights.dramatic());     // High contrast
app.scene.add(Lights.hemisphere());   // Sky/ground gradient

// Or add custom lights directly
app.scene.add(new THREE.DirectionalLight(0xffffff, 1));
```

### ControlsManager (`app.controls`)
Camera controls (OrbitControls by default).

```typescript
// Access controls
app.controls.target.set(0, 0, 0);
app.controls.controls.enableDamping = true;

// Controls update automatically in render loop
```

## Adding Objects

The `app.add()` method automatically:
- Adds mesh to scene (if object has `.mesh` or is a THREE.Object3D)
- Registers `.animate(time, delta)` method for animation loop
- Tracks for disposal
- Exposes parameters (optional)

```typescript
// Add object
app.add(myObject);

// Add with parameter exposure
app.add(myObject, { params: true });  // Expose all params
app.add(myObject, { params: ['radius', 'color'] });  // Expose specific params

// Add with initial values
app.add(myObject, { set: { radius: 2, color: 0xff0000 } });
```

## Animation Callbacks

```typescript
// Add custom animation callback
app.addAnimateCallback((time, delta) => {
  mesh.rotation.y = time * 0.001;
});
```

## Cleanup

```typescript
// Remove object
app.remove(myObject);

// Clear all objects
app.clear();

// Dispose entire app
app.dispose();
```
