# GPU Path Tracer Integration

This document describes the complete integration of [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) into the demo system, including architecture decisions, features, and usage patterns.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Material Updates](#material-updates)
- [Background Management](#background-management)
- [Light Cloning](#light-cloning)
- [HDR Preservation](#hdr-preservation)
- [API Reference](#api-reference)
- [Technical Details](#technical-details)

---

## Overview

The system supports **dual rendering modes** that can be switched at runtime:

1. **WebGL Mode** - Standard Three.js WebGLRenderer with PMREM-based IBL
2. **Path Tracing Mode** - GPU-accelerated unbiased path tracer with physically accurate lighting

Key design goals:
- Seamless switching between modes without code changes
- Automatic texture format management (PMREM vs equirectangular)
- HDR preservation throughout the pipeline
- Simple API that handles complexity internally

---

## Architecture

### Dual-Format Texture System

The pathtracer and WebGL renderer require different environment map formats:

| Renderer | Format | Usage |
|----------|--------|-------|
| WebGL | **PMREM Cubemap** | Image-based lighting (IBL) with pre-filtered reflections |
| Pathtracer | **Equirectangular** | Importance sampling for physically accurate global illumination |

**Solution**: Store both formats simultaneously and swap automatically when switching modes.

```typescript
// Internal structure in BackgroundManager
private pmremEnvMap?: THREE.Texture;      // For WebGL IBL
private equirectEnvMap?: THREE.Texture;   // For pathtracer

// Automatic swapping when enabling pathtracer
app.enablePathTracing();  // Internally swaps to equirect
app.disablePathTracing(); // Internally swaps back to PMREM
```

### Automatic Environment Synchronization

The RenderManager monitors `scene.environment` changes and automatically updates the pathtracer:

```typescript
// In render loop
if (this.lastEnvironment !== scene.environment) {
    this.pathTracer.updateEnvironment();
    this.lastEnvironment = scene.environment;
}
```

**Benefits**:
- No manual sync calls needed
- Works with any background type
- Handles runtime environment changes automatically

---

## Material Updates

### Simplified Workflow

The material update API has been designed to minimize boilerplate:

#### Auto-sync on Mode Switch

When enabling path tracing, materials are **automatically synchronized**:

```typescript
app.enablePathTracing();
// ✅ All materials automatically synced
// ✅ Environment automatically synced
// No manual calls needed!
```

#### Manual Updates (Only When Needed)

You **only** need to call `notifyMaterialsChanged()` when:
- Modifying materials **while pathtracer is active**
- Adding/removing objects from the scene
- Changing material properties at runtime

```typescript
// ✅ Path tracer already enabled
chromeSphere.material.roughness = 0.1;  // Change roughness
app.renderManager.notifyMaterialsChanged();  // Notify pathtracer
app.renderManager.resetAccumulation();       // Restart sampling
```

#### Common Patterns

```typescript
// Pattern 1: Setup then enable (no manual sync needed)
const sphere = new THREE.Mesh(geo, material);
app.scene.add(sphere);
app.enablePathTracing();  // Auto-syncs everything ✅

// Pattern 2: Modify while active (manual sync required)
app.enablePathTracing();
// ... later ...
sphere.material.color.set(0xff0000);  // Runtime change
app.renderManager.notifyMaterialsChanged();  // Required ✅

// Pattern 3: Modify while disabled (no manual sync needed)
app.disablePathTracing();
sphere.material.roughness = 0.5;
app.enablePathTracing();  // Auto-syncs on switch ✅
```

---

## Background Management

The system supports **three background types**, all compatible with both rendering modes:

### 1. HDRI Images

Load pre-made HDR environment maps:

```typescript
app.backgrounds.loadHDR('/assets/hdri/studio.hdr', {
    asEnvironment: true,  // Use for reflections/IBL
    asBackground: true,   // Display as visible background
    intensity: 1.0
});
```

**Implementation**: Already equirectangular, works directly with pathtracer.

### 2. Procedural Scenes

Create custom environments from Three.js geometry:

```typescript
// Create environment scene
const envScene = new THREE.Scene();

// Add room geometry
const room = new THREE.Mesh(
    new THREE.BoxGeometry(10, 10, 10),
    new THREE.MeshStandardMaterial({
        color: 0x334455,
        side: THREE.BackSide,
        emissive: 0x112233,
        emissiveIntensity: 0.4
    })
);
envScene.add(room);

// Add lights
const light = new THREE.PointLight(0xffffff, 150);
light.position.set(0, 4, 0);
envScene.add(light);

// Render to environment maps (creates BOTH formats!)
app.backgrounds.createEnvironmentFromScene(envScene, {
    resolution: 512,       // Cubemap face resolution
    asEnvironment: true,
    asBackground: true,
    intensity: 1.0,
    includeLights: true    // Clone lights to main scene (optional)
});
```

**Implementation**:
1. Renders scene to HDR cubemap using `THREE.CubeCamera`
2. Converts cubemap → equirectangular via GPU shader
3. Generates PMREM from cubemap for WebGL
4. Stores both formats for automatic switching

See [Technical Details](#cubemap-to-equirectangular-conversion) for conversion algorithm.

### 3. Shader-Based Backgrounds

Generate backgrounds from shader code:

#### Gradient Sky

```typescript
app.backgrounds.setSky({
    topColor: 0x0077ff,
    bottomColor: 0xffeedd,
    offset: 33,      // Horizon position
    exponent: 0.6    // Gradient falloff
});
```

#### Atmospheric Sky

Physical sky model with sun simulation:

```typescript
app.backgrounds.setAtmosphericSky({
    turbidity: 10,      // Atmospheric haze
    rayleigh: 3,        // Sky color intensity
    elevation: 15,      // Sun angle (degrees)
    azimuth: 180,       // Sun direction
    exposure: 0.5
});
```

**Implementation**:
1. Renders shader to cubemap faces via `CubeCamera`
2. Same conversion pipeline as procedural scenes
3. Preserves HDR values from shader (e.g., bright sun disk)

**Key difference from previous approach**: Instead of creating a background mesh in the scene, shaders are rendered to environment maps. This provides proper IBL and pathtracer support.

---

## Light Cloning

When creating procedural environments, you often include lights in the environment scene. The `includeLights` option clones these lights to your main scene automatically.

### Basic Usage

```typescript
const envScene = new THREE.Scene();

// Add lights to environment
const pointLight = new THREE.PointLight(0xffffff, 100);
pointLight.position.set(0, 5, 0);
envScene.add(pointLight);

const directionalLight = new THREE.DirectionalLight(0xffaa88, 2);
directionalLight.position.set(1, 1, 1);
envScene.add(directionalLight);

// Clone lights to main scene
app.backgrounds.createEnvironmentFromScene(envScene, {
    resolution: 512,
    asEnvironment: true,
    asBackground: true,
    includeLights: true  // ✅ Lights will be cloned to app.scene
});
```

### Behavior

- **Deep cloning**: Lights are cloned via `light.clone()`, preserving all properties
- **Automatic cleanup**: Previous environment lights are removed when setting a new background
- **Optional**: Defaults to `false` - you opt-in per call
- **Tracked separately**: Cloned lights are stored internally and can be queried

### Advanced Control

```typescript
// Get cloned lights for manipulation
const clonedLights = app.backgrounds.getEnvironmentLights();
clonedLights.forEach(light => {
    light.intensity *= 0.5;  // Dim all environment lights
});

// Manual cleanup if needed
app.backgrounds.clearEnvironmentLights();

// Selective cloning
app.backgrounds.createEnvironmentFromScene(envScene1, {
    includeLights: true  // Clone lights from first environment
});

app.backgrounds.createEnvironmentFromScene(envScene2, {
    includeLights: false  // Don't clone lights from second environment
});
```

### Why Clone Lights?

**Without light cloning**:
- Environment map provides indirect lighting (reflections, ambient)
- No direct illumination from environment lights
- Scene may appear flat or under-lit

**With light cloning**:
- Environment map provides indirect lighting
- Cloned lights provide direct illumination
- Matches the lighting used to create the environment
- Consistent appearance between WebGL and pathtracer modes

**Example**: If your environment scene has a bright point light at the ceiling, cloning ensures your main scene objects receive the same direct lighting, not just reflections.

---

## HDR Preservation

High Dynamic Range (HDR) values (brightness > 1.0) are critical for physically accurate lighting. The entire pipeline preserves HDR:

### Pipeline Overview

```
Source (HDRI/Scene/Shader)
    ↓ FloatType Render Target
Cubemap (HDR preserved)
    ↓ FloatType shader conversion
Equirectangular (HDR preserved)
    ↓ DataTexture with FloatType
Pathtracer (HDR importance sampling)
```

### Key Components

#### 1. FloatType Render Targets

All intermediate rendering uses floating-point textures:

```typescript
const renderTarget = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.FloatType,        // ✅ Allows values > 1.0
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter
});
```

#### 2. PMREM HDR Support

Three.js `PMREMGenerator` preserves HDR in cubemaps:

```typescript
const pmremGenerator = new THREE.PMREMGenerator(renderer);
const pmremTarget = pmremGenerator.fromCubemap(hdrCubemap);  // ✅ HDR preserved
```

#### 3. Equirect Conversion HDR

The cubemap-to-equirect conversion maintains floating-point precision:

```typescript
// Fragment shader samples cubemap directly (no clamping)
gl_FragColor = textureCube(tCube, dir);  // ✅ HDR values preserved

// Output texture uses FloatType
const dataTexture = new THREE.DataTexture(
    pixelBuffer,
    width, height,
    THREE.RGBAFormat,
    THREE.FloatType  // ✅ HDR preserved in final texture
);
```

### Verification

To verify HDR preservation, check pixel values in the console:

```typescript
const equirect = app.backgrounds.getEquirectEnvironment();
if (equirect.image?.data) {
    const pixels = equirect.image.data;
    const maxValue = Math.max(...pixels);
    console.log(`Max HDR value: ${maxValue}`);  // Should be > 1.0 for HDR content
}
```

---

## API Reference

### App Class

#### `enablePathTracing(options?: PathTracerOptions): void`

Switches from WebGL to path tracing mode.

```typescript
app.enablePathTracing({
    bounces: 10,  // Max light bounces
    samples: 1    // Samples per frame
});
```

- Auto-swaps to equirectangular textures
- Auto-syncs materials and environment
- Resets accumulation buffer

#### `disablePathTracing(): void`

Switches back to WebGL mode.

```typescript
app.disablePathTracing();
```

- Swaps back to PMREM textures
- Resumes standard rendering

### RenderManager Class

#### `switchToPathTracing(options?: PathTracerOptions): void`

Low-level pathtracer activation (usually called via `App`).

#### `notifyMaterialsChanged(): void`

Manually notify pathtracer of material changes.

```typescript
// Only needed when modifying materials while pathtracer is active
sphere.material.roughness = 0.2;
app.renderManager.notifyMaterialsChanged();
```

#### `resetAccumulation(): void`

Restart pathtracer sampling (e.g., after camera move or scene change).

```typescript
app.renderManager.resetAccumulation();
```

### BackgroundManager Class

#### `loadHDR(url: string, options?: HDROptions): Promise<void>`

Load HDRI image as environment.

```typescript
await app.backgrounds.loadHDR('/assets/hdri/studio.hdr', {
    asEnvironment: true,
    asBackground: true,
    intensity: 1.0
});
```

#### `createEnvironmentFromScene(scene: THREE.Scene, options?: SceneEnvironmentOptions): THREE.Texture`

Render scene to environment maps.

```typescript
const envMap = app.backgrounds.createEnvironmentFromScene(envScene, {
    resolution: 512,       // Cubemap face size (default: 256)
    asEnvironment: true,   // Set as scene.environment (default: true)
    asBackground: true,    // Set as scene.background (default: false)
    intensity: 1.0,        // Environment intensity (default: 1.0)
    includeLights: true    // Clone lights to main scene (default: false)
});
```

#### `setSky(options: SkyOptions): void`

Create gradient sky background.

```typescript
app.backgrounds.setSky({
    topColor: 0x0077ff,
    bottomColor: 0xffeedd,
    offset: 33,
    exponent: 0.6
});
```

#### `setAtmosphericSky(options: AtmosphericSkyOptions): void`

Create physical sky with sun.

```typescript
app.backgrounds.setAtmosphericSky({
    turbidity: 10,
    rayleigh: 3,
    elevation: 15,
    azimuth: 180,
    exposure: 0.5
});
```

#### `getEquirectEnvironment(): THREE.Texture | undefined`

Get current equirectangular environment (for pathtracer).

```typescript
const equirect = app.backgrounds.getEquirectEnvironment();
if (equirect) {
    app.scene.environment = equirect;
}
```

#### `getPMREMEnvironment(): THREE.Texture | undefined`

Get current PMREM environment (for WebGL).

```typescript
const pmrem = app.backgrounds.getPMREMEnvironment();
```

#### `getEnvironmentLights(): THREE.Light[]`

Get lights cloned from environment scene.

```typescript
const lights = app.backgrounds.getEnvironmentLights();
lights.forEach(light => {
    console.log(`Light: ${light.type}, intensity: ${light.intensity}`);
});
```

#### `clearEnvironmentLights(): void`

Manually remove all cloned environment lights.

```typescript
app.backgrounds.clearEnvironmentLights();
```

---

## Technical Details

### Cubemap to Equirectangular Conversion

The conversion from cubemap to equirectangular format is handled by `cubemapToEquirect()` in `src/utils/cubemapToEquirect.ts`.

#### Why Conversion is Needed

- **Pathtracer requirement**: `three-gpu-pathtracer` uses importance sampling, which requires equirectangular format
- **PMREM output**: Three.js `CubeCamera` and `PMREMGenerator` output cubemaps
- **Format mismatch**: Need to convert cubemap → equirect for pathtracer compatibility

#### Algorithm

1. **Create HDR render target** (FloatType, 2:1 aspect ratio)
2. **Render fullscreen quad** with custom shader
3. **Fragment shader**:
   - Convert UV → spherical coordinates (phi, theta)
   - Convert spherical → Cartesian direction vector
   - Sample cubemap using direction
4. **Read back pixels** via `readRenderTargetPixels()` for CPU access
5. **Create DataTexture** with pixel data for pathtracer

#### Coordinate System Corrections

The shader includes three critical transformations to match Three.js conventions:

```glsl
// 1. Vertical flip (origin at top)
float theta = (1.0 - vUv.y) * PI;

// 2. 90° clockwise rotation
float phi = vUv.x * 2.0 * PI + PI * 0.5;

// 3. Horizontal mirror (negated X)
vec3 dir = vec3(
    -sin(theta) * sin(phi),  // X negated
    cos(theta),              // Y
    sin(theta) * cos(phi)    // Z
);
```

**Without these corrections**: Background appears upside down, backwards, and rotated.

#### HDR Preservation

```typescript
// Render target uses FloatType
const renderTarget = new THREE.WebGLRenderTarget(width, height, {
    type: THREE.FloatType,  // ✅ No clamping to [0,1]
    format: THREE.RGBAFormat
});

// Shader samples directly (no tone mapping)
gl_FragColor = textureCube(tCube, dir);  // ✅ Preserves HDR

// Output DataTexture also FloatType
const dataTexture = new THREE.DataTexture(
    pixelBuffer,
    width, height,
    THREE.RGBAFormat,
    THREE.FloatType  // ✅ HDR preserved
);
```

#### Pixel Data for Importance Sampling

The pathtracer needs CPU-accessible pixel data for importance sampling:

```typescript
// Read pixels from GPU
const pixelBuffer = new Float32Array(width * height * 4);
renderer.readRenderTargetPixels(
    renderTarget,
    0, 0, width, height,
    pixelBuffer
);

// Create DataTexture (has .image.data property)
const dataTexture = new THREE.DataTexture(pixelBuffer, width, height, ...);
```

**Why this matters**: Regular `THREE.Texture` from render targets don't have accessible pixel data. `DataTexture` provides the `image.data` property that `three-gpu-pathtracer` requires for building importance sampling distributions.

### Performance Considerations

#### Resolution vs Quality

Equirectangular resolution affects both quality and performance:

```typescript
// Lower resolution (faster, less memory)
app.backgrounds.createEnvironmentFromScene(envScene, {
    resolution: 256  // 512×256 equirect
});

// Higher resolution (slower, more memory, better quality)
app.backgrounds.createEnvironmentFromScene(envScene, {
    resolution: 1024  // 2048×1024 equirect
});
```

**Recommendations**:
- **256-512**: Good for real-time demos, simple environments
- **1024**: Better quality, still reasonable performance
- **2048+**: Production quality, offline rendering

#### One-Time Conversion

Conversion happens once when setting background:

```typescript
// Conversion happens here (one-time cost)
app.backgrounds.createEnvironmentFromScene(envScene, {...});

// Switching modes is free (just swaps texture references)
app.enablePathTracing();   // Fast ✅
app.disablePathTracing();  // Fast ✅
```

---

## Complete Example

Putting it all together:

```typescript
import { App } from './src/app/App';
import * as THREE from 'three';

// Create app with pathtracer defaults
const app = new App({
    debug: true,
    antialias: true,
    pathTracerDefaults: {
        bounces: 10,
        samples: 1
    }
});

// Create procedural environment
const envScene = new THREE.Scene();

// Add room
const room = new THREE.Mesh(
    new THREE.BoxGeometry(10, 10, 10),
    new THREE.MeshStandardMaterial({
        color: 0x334455,
        side: THREE.BackSide,
        emissive: 0x112233,
        emissiveIntensity: 0.4
    })
);
envScene.add(room);

// Add light
const light = new THREE.PointLight(0xffffff, 150);
light.position.set(0, 4, 0);
envScene.add(light);

// Render to environment maps (BOTH PMREM + equirect!)
app.backgrounds.createEnvironmentFromScene(envScene, {
    resolution: 512,
    asEnvironment: true,
    asBackground: true,
    intensity: 1.0,
    includeLights: true  // Clone light to main scene
});

// Add reflective object
const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 64),
    new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 1.0,
        roughness: 0.05
    })
);
app.scene.add(sphere);

// Setup camera
app.camera.position.set(4, 3, 6);
app.camera.lookAt(0, 1, 0);

// Enable pathtracer (auto-swaps to equirect + syncs materials)
app.enablePathTracing();

// Start rendering
app.start();

// Later: modify material while pathtracer is active
sphere.material.roughness = 0.2;
app.renderManager.notifyMaterialsChanged();  // Required!
app.renderManager.resetAccumulation();       // Restart sampling
```

---

## Demos

See `demos/test/` for working examples:

- **pathtracer-hdri-bkg.ts** - HDRI environment loading
- **pathtracer-scene-bkg.ts** - Procedural scene with light cloning
- **pathtracer-shader-bkg.ts** - Gradient and atmospheric sky
- **pathtracer-backgrounds.ts** - All background types in one demo

---

## Troubleshooting

### Background appears upside down or backwards

**Cause**: Coordinate system mismatch in custom conversion code.

**Solution**: Use the provided `cubemapToEquirect()` utility which includes correct transformations.

### Pathtracer crashes with "Cannot read properties of undefined"

**Cause**: Environment texture lacks pixel data for importance sampling.

**Solution**: Ensure environment was created via `BackgroundManager` methods, which automatically use `DataTexture` with pixel buffers.

### HDR values appear clamped

**Cause**: Non-float texture formats in pipeline.

**Solution**: Verify all render targets use `THREE.FloatType`. Check with:

```typescript
const equirect = app.backgrounds.getEquirectEnvironment();
console.log('Type:', equirect.type);  // Should be THREE.FloatType (1015)
```

### Materials not updating in pathtracer

**Cause**: Forgot to call `notifyMaterialsChanged()` after runtime modifications.

**Solution**: Call notify when changing materials while pathtracer is active:

```typescript
app.enablePathTracing();
sphere.material.color.set(0xff0000);
app.renderManager.notifyMaterialsChanged();  // ✅ Required
```

### Environment lights not appearing

**Cause**: `includeLights: true` not specified in options.

**Solution**: Explicitly enable light cloning:

```typescript
app.backgrounds.createEnvironmentFromScene(envScene, {
    includeLights: true  // ✅ Clone lights
});
```

---

## Future Enhancements

Potential improvements:

- **Animated environments**: Update equirect each frame for dynamic backgrounds
- **Multiple environment layers**: Blend multiple environments with different intensities
- **Environment proxies**: Correct parallax for box-projected environments
- **Adaptive sampling**: Increase samples/frame when camera is still
- **Denoising**: AI-based denoising for faster convergence

---

## References

- [three-gpu-pathtracer](https://github.com/gkjohnson/three-gpu-pathtracer) - GPU pathtracer library
- [Three.js PMREMGenerator](https://threejs.org/docs/#api/en/extras/PMREMGenerator) - PMREM generation
- [Equirectangular Mapping](https://en.wikipedia.org/wiki/Equirectangular_projection) - Coordinate system reference
- [IBL in Three.js](https://threejs.org/examples/#webgl_materials_envmaps_hdr) - Image-based lighting examples
