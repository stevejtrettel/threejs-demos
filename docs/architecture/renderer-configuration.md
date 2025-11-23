# Renderer Configuration

## Overview

The framework provides declarative renderer configuration through `AppOptions`. This lets you configure shadows, tone mapping, color space, and more at construction time without touching `app.renderer` directly.

---

## Quick Start

### Default (Sensible for Math Viz)

```typescript
const app = new App();
```

**Defaults:**
- ✅ Antialiasing enabled
- ✅ ACES Filmic tone mapping (looks good out of the box)
- ✅ sRGB color space (correct for displays)
- ✅ Shadows disabled (opt-in for performance)
- ✅ Tone mapping exposure: 1.0

### Custom Configuration

```typescript
const app = new App({
  // Shadow configuration
  shadows: true,

  // Tone mapping
  toneMapping: 'aces',
  toneMappingExposure: 1.2,

  // Color space
  colorSpace: 'srgb'
});
```

---

## Configuration Options

### Camera Options

```typescript
interface AppOptions {
  fov?: number;          // Field of view (default: 75)
  near?: number;         // Near clipping plane (default: 0.1)
  far?: number;          // Far clipping plane (default: 1000)
}
```

**Example:**
```typescript
const app = new App({
  fov: 60,
  near: 0.1,
  far: 2000
});
```

---

### WebGL Context Options

```typescript
interface AppOptions {
  antialias?: boolean;                                    // Default: true
  alpha?: boolean;                                        // Default: false
  powerPreference?: 'default' | 'high-performance' | 'low-power';  // Default: 'default'
}
```

**Example:**
```typescript
const app = new App({
  antialias: true,
  alpha: true,  // Transparent background
  powerPreference: 'high-performance'  // Use dedicated GPU
});
```

---

### Shadow Configuration

#### Simple (Boolean)

```typescript
const app = new App({
  shadows: true  // Enables PCFSoft shadows with good defaults
});
```

#### Advanced (Object)

```typescript
interface ShadowConfig {
  type?: 'basic' | 'pcf' | 'pcfsoft' | 'vsm';
  mapSize?: number;
  autoUpdate?: boolean;
}

const app = new App({
  shadows: {
    type: 'pcfsoft',      // Soft shadows
    mapSize: 2048,        // High quality shadow map
    autoUpdate: true      // Update every frame
  }
});
```

**Shadow Types:**
- `'basic'` - Hard shadows, best performance
- `'pcf'` - Percentage Closer Filtering, soft edges
- `'pcfsoft'` - Softer PCF, better quality (default)
- `'vsm'` - Variance Shadow Maps, very soft

**Note:** You still need to enable shadows on lights and objects:

```typescript
// On lights
light.castShadow = true;

// On objects
mesh.castShadow = true;
mesh.receiveShadow = true;
```

---

### Tone Mapping

```typescript
type ToneMappingType = 'none' | 'linear' | 'reinhard' | 'cineon' | 'aces' | 'neutral';

const app = new App({
  toneMapping: 'aces',           // Type of tone mapping
  toneMappingExposure: 1.2       // Brightness adjustment
});
```

**Tone Mapping Types:**
- `'none'` - No tone mapping, raw linear values
- `'linear'` - Simple linear mapping
- `'reinhard'` - Classic tone mapping
- `'cineon'` - Film-like response
- `'aces'` - Academy Color Encoding System (default, looks great)
- `'neutral'` - AgX-style neutral tone mapping

**When to adjust exposure:**
- Too dark? Increase: `toneMappingExposure: 1.5`
- Too bright? Decrease: `toneMappingExposure: 0.7`
- Default is `1.0`

---

### Color Space

```typescript
type ColorSpace = 'srgb' | 'linear' | 'display-p3';

const app = new App({
  colorSpace: 'srgb'  // Default, correct for most displays
});
```

**Color Spaces:**
- `'srgb'` - Standard RGB (default, use this)
- `'linear'` - Linear color space (for advanced workflows)
- `'display-p3'` - Wide gamut displays (falls back to sRGB if unavailable)

**When to use:**
- **99% of the time**: Use `'srgb'` (default)
- **Linear workflow**: Use `'linear'` if you know what you're doing
- **Wide gamut**: Use `'display-p3'` for newer displays

---

### Physically Correct Lights

```typescript
const app = new App({
  physicallyCorrectLights: true
});
```

**Note:** This is deprecated in newer Three.js versions but kept for compatibility. It makes light intensity physically accurate (falloff with distance squared).

---

## Complete Example

```typescript
const app = new App({
  // Camera
  fov: 60,
  near: 0.1,
  far: 2000,

  // Renderer
  antialias: true,
  powerPreference: 'high-performance',

  // Shadows
  shadows: {
    type: 'pcfsoft',
    mapSize: 2048
  },

  // Tone mapping
  toneMapping: 'aces',
  toneMappingExposure: 1.2,

  // Color space
  colorSpace: 'srgb',

  // Lighting
  physicallyCorrectLights: true
});
```

---

## Escape Hatch

If you need direct access to the renderer (for advanced features not covered by AppOptions):

```typescript
const app = new App();

// Direct Three.js access
app.renderer.shadowMap.autoUpdate = false;
app.renderer.info.autoReset = false;
// ... any Three.js renderer property
```

**This is always available** - AppOptions doesn't limit you.

---

## Common Configurations

### High Quality (Photorealistic)

```typescript
const app = new App({
  antialias: true,
  shadows: {
    type: 'pcfsoft',
    mapSize: 4096
  },
  toneMapping: 'aces',
  toneMappingExposure: 1.0,
  colorSpace: 'srgb',
  physicallyCorrectLights: true
});
```

### Performance (Fast Rendering)

```typescript
const app = new App({
  antialias: false,
  shadows: false,
  toneMapping: 'linear',
  powerPreference: 'low-power'
});
```

### Scientific Visualization (Accurate Colors)

```typescript
const app = new App({
  antialias: true,
  shadows: false,
  toneMapping: 'linear',
  toneMappingExposure: 1.0,
  colorSpace: 'linear'
});
```

---

## Implementation Details

### How It Works

1. **AppOptions** are passed to App constructor
2. **createRenderer()** creates WebGLRenderer with context options
3. **Helper methods** map strings to Three.js constants:
   - `getShadowMapType()` - 'pcfsoft' → `THREE.PCFSoftShadowMap`
   - `getToneMappingType()` - 'aces' → `THREE.ACESFilmicToneMapping`
   - `getColorSpace()` - 'srgb' → `THREE.SRGBColorSpace`
4. **Renderer is configured** before managers initialize

### Why This Design?

**Declarative Configuration:**
- See all options at construction time
- TypeScript autocomplete shows what's available
- Self-documenting code

**Sensible Defaults:**
- Works great without configuration
- Optimized for math visualization
- ACES tone mapping looks good immediately

**Not Limiting:**
- Direct `app.renderer.*` access still works
- Can override anything at runtime
- No wrapper, no abstraction layer

**Consistent with Framework:**
- Follows AppOptions pattern
- Similar to layout, background, lights, controls options
- One place for all configuration

---

## Troubleshooting

### Shadows not appearing

1. Enable shadows in AppOptions: `shadows: true`
2. Enable on light: `light.castShadow = true`
3. Enable on objects: `mesh.castShadow = true` and `mesh.receiveShadow = true`
4. Configure shadow camera bounds (for directional lights):
   ```typescript
   light.shadow.camera.left = -10;
   light.shadow.camera.right = 10;
   light.shadow.camera.top = 10;
   light.shadow.camera.bottom = -10;
   ```

### Scene too dark/bright

Adjust tone mapping exposure:
```typescript
const app = new App({
  toneMappingExposure: 1.5  // Increase for brighter
});
```

Or at runtime:
```typescript
app.renderer.toneMappingExposure = 1.5;
```

### Colors look wrong

Make sure you're using sRGB color space (default):
```typescript
const app = new App({
  colorSpace: 'srgb'
});
```

And set material colors correctly:
```typescript
material.color.set(0xff0000);  // ✓ Correct
material.color.setRGB(1, 0, 0);  // ✓ Correct (linear RGB)
```

---

## See Also

- **App.ts** - Implementation
- **types.ts** - Full AppOptions interface
- **demos/test/renderer-config-demo.ts** - Working example with shadows
