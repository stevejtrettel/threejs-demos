# Environment & Background System

Control scene backgrounds and image-based lighting (IBL) via the `BackgroundManager`.

**Location**: `src/app/BackgroundManager.ts`
**Access**: `app.backgrounds`

## Overview

The BackgroundManager provides:
- **Background Control**: Solid colors, gradients, starfields, HDRIs, procedural sky, atmospheric sky
- **Environment Mapping**: Image-based lighting (IBL) for realistic material rendering
- **Scene-Based Environments**: Create custom environments from THREE.Scene objects
- **Separation**: Independent control of background visuals and lighting environment
- **Intensity Control**: Adjust IBL strength globally or per-material
- **Procedural Options**: No HDRI files required - fully procedural workflows available

## Quick Start

```typescript
import { App } from '../src/app/App';

const app = new App();

// Simple solid color
app.backgrounds.setColor(0x2a2a2a);

// Procedural sky
app.backgrounds.setSky({
  topColor: 0x0077ff,
  bottomColor: 0xffffff
});

// HDRI environment (if you have an HDR file)
app.backgrounds.loadHDR('/assets/hdri/studio.hdr', {
  asEnvironment: true,  // Use for lighting
  asBackground: true,   // Show as background
  intensity: 1.5        // Boost IBL strength
});
```

## Background Methods

### Solid Color

**`setColor(color: number): void`**

Set solid color background.

```typescript
app.backgrounds.setColor(0x2a2a2a); // Dark gray
app.backgrounds.setColor(0x000000); // Black
app.backgrounds.setColor(0xffffff); // White
```

### Gradient

**`setGradient(color1: string, color2: string): void`**

Create vertical gradient background.

```typescript
app.backgrounds.setGradient('#1a1a2e', '#16213e');
app.backgrounds.setGradient('#87CEEB', '#ffffff'); // Sky blue to white
```

### Starfield

**`setStarfield(options?: StarfieldOptions): void`**

Generate procedural starfield texture.

```typescript
app.backgrounds.setStarfield({
  count: 2000,  // Number of stars (default: 2000)
  size: 2       // Star size (default: 2)
});
```

### Procedural Sky

**`setSky(options?: SkyOptions): void`**

Create gradient sky using shader (ground → sky).

```typescript
app.backgrounds.setSky({
  topColor: 0x0077ff,      // Sky color (default: 0x0077ff)
  bottomColor: 0xffffff,   // Horizon color (default: 0xffffff)
  offset: 33,              // Gradient offset (default: 33)
  exponent: 0.6            // Gradient falloff (default: 0.6)
});
```

**Note**: Creates a large sphere mesh in the scene. Good for daytime outdoor scenes without HDRI files.

### Atmospheric Sky

**`setAtmosphericSky(options?: AtmosphericSkyOptions): Sky`**

Create realistic atmospheric sky with physically-based scattering. Uses Three.js Sky for Rayleigh and Mie scattering simulation.

```typescript
const sky = app.backgrounds.setAtmosphericSky({
  turbidity: 10,          // Atmospheric haze (1-20, default: 10)
  rayleigh: 3,            // Blue sky scattering (0-4, default: 3)
  mieCoefficient: 0.005,  // Atmospheric particles (0-0.1, default: 0.005)
  mieDirectionalG: 0.7,   // Mie scattering direction (0-1, default: 0.7)
  elevation: 2,           // Sun elevation degrees (0-90, default: 2)
  azimuth: 180,           // Sun direction degrees (0-360, default: 180)
  exposure: 0.5           // Renderer exposure (default: 0.5)
});

// Returns Sky object for further customization
sky.material.uniforms['turbidity'].value = 15; // Adjust after creation
```

**Sun Position Examples:**
```typescript
// Sunrise
{ elevation: 5, azimuth: 90 }

// Noon
{ elevation: 85, azimuth: 180 }

// Sunset
{ elevation: 5, azimuth: 270 }

// Golden hour
{ elevation: 5, turbidity: 15 }
```

**Note**: Sets `scene.background = null` (sky mesh provides the background). Adjusts `renderer.toneMappingExposure`.

## Environment Mapping (IBL)

### Load HDRI

**`loadHDR(url: string, options?: HDROptions): void`**

Load HDR environment map for image-based lighting.

```typescript
// Basic usage - both lighting and background
app.backgrounds.loadHDR('/assets/hdri/studio.hdr');

// Advanced usage
app.backgrounds.loadHDR('/assets/hdri/outdoor.hdr', {
  asEnvironment: true,  // Use for IBL (default: true)
  asBackground: false,  // Don't show as background (default: true)
  intensity: 1.5,       // Boost lighting strength (default: 1)
  rotation: Math.PI/4   // Rotate environment (default: 0)
});
```

**Async version:**

**`async loadHDRAsync(url: string, options?: HDROptions): Promise<THREE.Texture>`**

```typescript
const envMap = await app.backgrounds.loadHDRAsync('/assets/hdri/studio.hdr', {
  asEnvironment: true,
  asBackground: false
});

// envMap is now available for custom usage
```

### Typical Patterns

**Pattern 1: HDRI for everything**
```typescript
// Use HDRI for both lighting and background
app.backgrounds.loadHDR('/assets/hdri/studio.hdr', {
  intensity: 1.2
});
```

**Pattern 2: HDRI lighting + solid background**
```typescript
// Use HDRI for realistic lighting, but solid color background
app.backgrounds.setColor(0x1a1a1a);
await app.backgrounds.loadHDRAsync('/assets/hdri/studio.hdr', {
  asEnvironment: true,
  asBackground: false,
  intensity: 1.5
});
```

**Pattern 3: HDRI lighting + procedural sky**
```typescript
// Use HDRI for lighting, procedural sky for background
app.backgrounds.setSky({
  topColor: 0x0077ff,
  bottomColor: 0xffffff
});

app.backgrounds.loadHDR('/assets/hdri/outdoor.hdr', {
  asEnvironment: true,
  asBackground: false
});
```

### Scene-Based Environment

**`createEnvironmentFromScene(environmentScene: THREE.Scene, options?: SceneEnvironmentOptions): THREE.Texture`**

Create custom procedural environments by rendering a THREE.Scene to a cubemap. This allows creating stylized environments without HDRI files.

**Use Cases:**
- Rooms with colored lights (studio lighting)
- Geometric patterns and abstract environments
- Procedurally generated environments
- Matching scene aesthetic with custom lighting
- Dynamic environments that change at runtime

```typescript
// Create a custom environment scene
const envScene = new THREE.Scene();

// Add a room (box viewed from inside)
const room = new THREE.Mesh(
  new THREE.BoxGeometry(20, 20, 20),
  new THREE.MeshBasicMaterial({
    color: 0x404040,
    side: THREE.BackSide  // View from inside
  })
);
envScene.add(room);

// Add colored lights
const redLight = new THREE.PointLight(0xff0000, 100);
redLight.position.set(-5, 5, -5);
envScene.add(redLight);

const blueLight = new THREE.PointLight(0x0000ff, 100);
blueLight.position.set(5, 5, 5);
envScene.add(blueLight);

// Render to cubemap and use as environment
const envMap = app.backgrounds.createEnvironmentFromScene(envScene, {
  resolution: 512,           // Cubemap resolution (256, 512, 1024)
  intensity: 1.2,            // Environment intensity
  asBackground: true,        // Use as background
  asEnvironment: true,       // Use for IBL
  backgroundBlurriness: 0.3, // Blur background 0-1 (keeps IBL sharp)
  position: new THREE.Vector3(0, 0, 0),  // Camera position
  near: 0.1,                 // Camera near plane
  far: 1000                  // Camera far plane
});

// Returns the generated cubemap for further use
```

**Pattern: Colored Light Room**
```typescript
// Similar to the classic "BoxWithLights" pattern
const envScene = new THREE.Scene();

// Room walls (use MeshBasicMaterial - doesn't need lighting)
const wallMaterial = new THREE.MeshBasicMaterial({
  color: 0x2a2a2a,
  side: THREE.BackSide
});

const room = new THREE.Mesh(
  new THREE.BoxGeometry(30, 30, 30),
  wallMaterial
);
envScene.add(room);

// Multiple colored point lights positioned around the room
const lights = [
  { color: 0xff3333, pos: [-10, 10, -10] },  // Red
  { color: 0x3333ff, pos: [10, 10, 10] },     // Blue
  { color: 0x33ff33, pos: [-10, 0, 10] },     // Green
  { color: 0xffff33, pos: [10, -5, -10] }     // Yellow
];

lights.forEach(({ color, pos }) => {
  const light = new THREE.PointLight(color, 100, 30);
  light.position.set(...pos);
  envScene.add(light);

  // Optional: Add visible sphere for the light
  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(1, 16, 16),
    new THREE.MeshBasicMaterial({ color })
  );
  sphere.position.copy(light.position);
  envScene.add(sphere);
});

envScene.add(new THREE.AmbientLight(0xffffff, 0.1));

app.backgrounds.createEnvironmentFromScene(envScene, {
  resolution: 512,
  intensity: 1.0
});
```

**Pattern: Geometric Environment**
```typescript
// Abstract floating shapes
const envScene = new THREE.Scene();
envScene.background = new THREE.Color(0x1a1a2e);

const shapes = [
  { geo: new THREE.IcosahedronGeometry(2), color: 0xff006e, pos: [-5, 3, -5] },
  { geo: new THREE.OctahedronGeometry(2), color: 0x06ffa5, pos: [5, 2, -3] },
  { geo: new THREE.BoxGeometry(3, 3, 3), color: 0x3a86ff, pos: [0, 4, 0] }
];

shapes.forEach(({ geo, color, pos }) => {
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({ color })
  );
  mesh.position.set(...pos);
  envScene.add(mesh);

  const light = new THREE.PointLight(color, 50, 30);
  light.position.copy(mesh.position);
  envScene.add(light);
});

app.backgrounds.createEnvironmentFromScene(envScene, { resolution: 512 });
```

**Benefits:**
- ✅ No HDRI files required
- ✅ Fully procedural and customizable
- ✅ Can be generated/modified at runtime
- ✅ Perfect for stylized/non-photorealistic looks
- ✅ Matches your scene aesthetic exactly
- ✅ Lightweight compared to large HDRI files

**See Also**: `demos/scene-environment-demo.ts`, `demos/procedural-environments-demo.ts`

## Environment Control

### Set Intensity

**`setEnvironmentIntensity(intensity: number): void`**

Control strength of image-based lighting.

```typescript
app.backgrounds.setEnvironmentIntensity(0.5);  // Dim IBL
app.backgrounds.setEnvironmentIntensity(1.0);  // Normal
app.backgrounds.setEnvironmentIntensity(2.0);  // Bright IBL
```

**Requires**: THREE.js r155+ for `scene.environmentIntensity`
**Fallback**: Set `material.envMapIntensity` on each material manually

### Set Rotation

**`setEnvironmentRotation(radians: number): void`**

Rotate environment map around Y axis.

```typescript
app.backgrounds.setEnvironmentRotation(Math.PI / 2);  // 90 degrees
app.backgrounds.setEnvironmentRotation(Math.PI);      // 180 degrees
```

**Note**: Currently stores rotation value. Full implementation requires shader support.
**Workaround**: Use a rotated skybox mesh for better compatibility.

### Set Background Blurriness

**`setBackgroundBlurriness(blurriness: number): void`**

Blur the background without affecting environment lighting quality. Uses GPU mipmaps for efficient blurring.

```typescript
app.backgrounds.setBackgroundBlurriness(0);    // Sharp (default)
app.backgrounds.setBackgroundBlurriness(0.3);  // Subtle blur
app.backgrounds.setBackgroundBlurriness(0.8);  // Heavy blur
app.backgrounds.setBackgroundBlurriness(1.0);  // Maximum blur
```

**Key Features:**
- Works with ANY background (HDRI, scene-based, sky, etc.)
- Zero performance cost - uses existing mipmaps
- Environment lighting stays sharp for realistic IBL
- Perfect for reducing visual distraction

**Use Cases:**
- Product visualization (blur environment, sharp reflections)
- Reduce background distraction while maintaining lighting quality
- Stylistic choice for depth separation

**Requires**: THREE.js r155+ for `scene.backgroundBlurriness`

### Environment Only

**`setEnvironmentOnly(envMap: THREE.Texture, intensity?: number): void`**

Set environment for lighting without changing background.

```typescript
const envMap = await app.assets.loadHDRI('/assets/hdri/studio.hdr');
app.backgrounds.setEnvironmentOnly(envMap, 1.5);
```

### Remove Environment

**`removeEnvironment(): void`**

Remove environment lighting but keep background.

```typescript
app.backgrounds.removeEnvironment();
```

### Remove Background

**`removeBackground(): void`**

Remove background but keep environment lighting.

```typescript
app.backgrounds.removeBackground(); // Transparent background
```

## Material Setup for IBL

Materials need proper settings to respond to environment lighting:

```typescript
const material = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  metalness: 1.0,        // High metalness = more reflective
  roughness: 0.1,        // Low roughness = sharp reflections
  envMapIntensity: 1.0   // Control per-material IBL strength
});
```

### Material Properties

| Property | Range | Effect |
|----------|-------|--------|
| `metalness` | 0-1 | 0 = dielectric (plastic), 1 = metal |
| `roughness` | 0-1 | 0 = mirror, 1 = diffuse |
| `envMapIntensity` | 0-∞ | Multiplier for environment map contribution |

### Typical Material Settings

**Chrome/Mirror:**
```typescript
{ metalness: 1.0, roughness: 0.0, envMapIntensity: 1.0 }
```

**Brushed Metal:**
```typescript
{ metalness: 1.0, roughness: 0.3, envMapIntensity: 1.0 }
```

**Glossy Plastic:**
```typescript
{ metalness: 0.0, roughness: 0.2, envMapIntensity: 0.8 }
```

**Matte Surface:**
```typescript
{ metalness: 0.0, roughness: 0.9, envMapIntensity: 0.3 }
```

## Examples

### Example 1: Studio Lighting Setup

```typescript
// Neutral studio environment
app.backgrounds.setColor(0x1a1a1a); // Dark background
await app.backgrounds.loadHDRAsync('/assets/hdri/studio.hdr', {
  asEnvironment: true,
  asBackground: false,
  intensity: 1.2
});

// Add fill light
const light = new THREE.DirectionalLight(0xffffff, 0.5);
light.position.set(-5, 5, -5);
app.scene.add(light);
```

### Example 2: Outdoor Scene

```typescript
// Blue sky background with HDRI lighting
app.backgrounds.setSky({
  topColor: 0x0077ff,
  bottomColor: 0xd4f1f4
});

await app.backgrounds.loadHDRAsync('/assets/hdri/outdoor.hdr', {
  asEnvironment: true,
  asBackground: false,
  intensity: 1.0
});
```

### Example 3: No HDRI Available

```typescript
// Use procedural options for decent results without HDRI files
app.backgrounds.setSky({
  topColor: 0x0077ff,
  bottomColor: 0xffffff
});

// Add lights to simulate environment
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(5, 10, 5);
app.scene.add(sun);

const ambient = new THREE.AmbientLight(0xffffff, 0.3);
app.scene.add(ambient);
```

### Example 4: Separate Background and Lighting

```typescript
// Solid background, HDRI for lighting only
app.backgrounds.setColor(0x2a2a2a);

const envMap = await app.assets.loadHDRI('/assets/hdri/studio.hdr');
app.backgrounds.setEnvironmentOnly(envMap, 1.5);
```

## Finding HDRI Files

### Free Resources

- **Poly Haven**: https://polyhaven.com/hdris (CC0, free)
- **HDRI Haven**: https://hdrihaven.com (CC0, free)
- **sIBL Archive**: http://www.hdrlabs.com/sibl/archive.html

### File Format

- Use `.hdr` files (Radiance HDR format)
- `.exr` also supported via EXRLoader
- Equirectangular projection (360° panoramic)
- Typical resolution: 2K-8K for good quality

### Recommended HDRIs for Different Scenes

- **Studio/Product**: Neutral lighting, soft shadows
- **Outdoor**: Sky, sun position variation
- **Interior**: Window lighting, soft ambient
- **Night**: Dark environment, artificial lights

## Performance Considerations

### PMREM (Prefiltered Mipmapped Radiance Environment Map)

The BackgroundManager automatically generates PMREM from HDRIs:
- Pre-computes different roughness levels
- Essential for physically-based rendering
- One-time cost during loading

### Optimization Tips

1. **Lower resolution HDRIs** for mobile (1K-2K)
2. **Reuse environment maps** across scenes when possible
3. **Dispose properly**: `app.backgrounds.dispose()` cleans up
4. **Limit envMapIntensity** on low-end devices

## Troubleshooting

### Materials Don't Reflect Environment

✅ Check:
1. Material is `MeshStandardMaterial` or `MeshPhysicalMaterial`
2. `scene.environment` is set
3. Material `metalness > 0` or `roughness < 1`
4. `envMapIntensity > 0` on material

### HDRI Not Loading

✅ Check:
1. File path is correct
2. File is `.hdr` or `.exr` format
3. File is equirectangular projection
4. Console for loading errors

### Environment Too Dark/Bright

```typescript
// Adjust intensity
app.backgrounds.setEnvironmentIntensity(1.5); // Global

// Or per-material
material.envMapIntensity = 2.0;
```

## API Reference

```typescript
interface HDROptions {
  asEnvironment?: boolean;  // Use for IBL (default: true)
  asBackground?: boolean;   // Show as background (default: true)
  intensity?: number;       // IBL strength (default: 1)
  rotation?: number;        // Y-axis rotation in radians (default: 0)
}

interface SkyOptions {
  topColor?: number;       // Sky color (default: 0x0077ff)
  bottomColor?: number;    // Horizon color (default: 0xffffff)
  offset?: number;         // Gradient offset (default: 33)
  exponent?: number;       // Gradient falloff (default: 0.6)
}

interface StarfieldOptions {
  count?: number;  // Star count (default: 2000)
  size?: number;   // Star size (default: 2)
}

interface AtmosphericSkyOptions {
  turbidity?: number;       // Atmospheric turbidity (1-20, default: 10)
  rayleigh?: number;        // Rayleigh scattering (0-4, default: 3)
  mieCoefficient?: number;  // Mie scattering (0-0.1, default: 0.005)
  mieDirectionalG?: number; // Mie scattering direction (0-1, default: 0.7)
  elevation?: number;       // Sun elevation in degrees (0-90, default: 2)
  azimuth?: number;         // Sun azimuth in degrees (0-360, default: 180)
  exposure?: number;        // Renderer exposure (default: 0.5)
}

interface SceneEnvironmentOptions {
  position?: THREE.Vector3;     // Camera position for rendering (default: 0,0,0)
  resolution?: number;          // Cubemap resolution (default: 256)
  near?: number;                // Camera near plane (default: 0.1)
  far?: number;                 // Camera far plane (default: 1000)
  intensity?: number;           // Environment intensity (default: 1)
  asBackground?: boolean;       // Use as background (default: true)
  asEnvironment?: boolean;      // Use for IBL (default: true)
  backgroundBlurriness?: number; // Background blur amount 0-1 (default: 0)
}
```

## Demos

- `demos/environment-demo.ts` - Basic backgrounds and IBL
- `demos/hdri-demo.ts` - HDRI loading patterns
- `demos/atmospheric-sky-demo.ts` - Physically-based sky
- `demos/scene-environment-demo.ts` - Scene-based environments (BoxWithLights pattern)
- `demos/procedural-environments-demo.ts` - Advanced procedural patterns
