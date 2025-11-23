# Colormap System

Utilities for mapping data values to colors, with both JavaScript and GLSL implementations.

## Overview

The colormap system provides perceptually uniform colormaps for scientific visualization and data-driven rendering. All colormaps map normalized values `[0, 1]` to colors.

**Location**: `src/utils/colormaps/`

## JavaScript API

### Basic Usage

```typescript
import { viridis, plasma, map, applyColormap } from '../src/utils/colormaps';

// Map single value
const color = viridis(0.5); // Returns THREE.Color

// Map from custom range
const t = map(temperature, 0, 100); // Normalize to [0,1]
const color = viridis(t);

// Apply to array of values
const heights = [0, 0.5, 1.0, 1.5];
const colors = applyColormap(heights, viridis);
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
```

### Available Colormaps

#### Perceptually Uniform (Recommended)

**`viridis(t: number): THREE.Color`**
- Blue → Green → Yellow
- Colorblind-friendly, excellent for scientific data
- Smooth luminance gradient

**`plasma(t: number): THREE.Color`**
- Purple → Pink → Orange → Yellow
- High contrast, perceptually uniform
- Great for highlighting features

**`inferno(t: number): THREE.Color`**
- Black → Purple → Orange → Yellow
- Dark background friendly
- Good for heat maps

#### Diverging

**`coolwarm(t: number): THREE.Color`**
- Blue → White → Red
- Shows deviation from center (0.5)
- Use for data centered around zero

#### Other

**`rainbow(t: number): THREE.Color`**
- Full HSV rainbow spectrum
- ⚠️ Not perceptually uniform
- Use viridis/plasma for scientific visualization

**`grayscale(t: number): THREE.Color`**
- Black → White
- Simple linear grayscale

### Utility Functions

**`map(value: number, min: number, max: number): number`**

Normalize value from arbitrary range to `[0, 1]`.

```typescript
const t = map(50, 0, 100); // Returns 0.5
const color = viridis(t);
```

**`applyColormap(values: number[], colormap: Function, min?: number, max?: number): Float32Array`**

Apply colormap to array of values. Auto-computes range if not provided.

```typescript
const heights = [0.1, 0.5, 0.8, 1.2];
const colors = applyColormap(heights, viridis);
// Returns Float32Array of RGB values [r,g,b, r,g,b, ...]

// With explicit range
const colors = applyColormap(heights, viridis, 0, 2);
```

## GLSL API

### Basic Usage

```typescript
import { glslColormaps } from '../src/utils/colormaps';

const material = new THREE.ShaderMaterial({
  vertexShader: `
    varying vec3 vPosition;
    void main() {
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vPosition;

    ${glslColormaps.viridis}

    void main() {
      float t = (vPosition.y + 1.0) * 0.5; // Map -1..1 to 0..1
      vec3 color = viridis(t);
      gl_FragColor = vec4(color, 1.0);
    }
  `
});
```

### Available GLSL Colormaps

All GLSL functions have signature: `vec3 colormap_name(float t)`

- `viridis(float t)`
- `plasma(float t)`
- `inferno(float t)`
- `rainbow(float t)`

### GLSL Utilities

**Import all colormaps:**
```typescript
import { getAllColormaps } from '../src/utils/colormaps';

const fragmentShader = `
  ${getAllColormaps()}

  void main() {
    // All colormaps available
  }
`;
```

**Inject colormap into shader:**
```typescript
import { injectColormap } from '../src/utils/colormaps';

const shaderTemplate = `
  {{colormap}}
  void main() {
    gl_FragColor = vec4(viridis(vUv.x), 1.0);
  }
`;

const shader = injectColormap(shaderTemplate, 'viridis');
```

**Map function in GLSL:**
```typescript
import { glslMapFunction } from '../src/utils/colormaps';

const fragmentShader = `
  ${glslMapFunction}
  ${glslColormaps.plasma}

  void main() {
    float t = mapToRange(vHeight, -1.0, 1.0);
    gl_FragColor = vec4(plasma(t), 1.0);
  }
`;
```

## Examples

### Vertex Colors on Geometry

```typescript
import { applyColormap, viridis } from '../src/utils/colormaps';
import * as THREE from 'three';

// Create geometry
const geometry = new THREE.SphereGeometry(1, 64, 64);
const positions = geometry.attributes.position;

// Calculate heights
const heights: number[] = [];
for (let i = 0; i < positions.count; i++) {
  heights.push(positions.getY(i));
}

// Apply colormap
const colors = applyColormap(heights, viridis);
geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// Create mesh with vertex colors
const material = new THREE.MeshBasicMaterial({ vertexColors: true });
const mesh = new THREE.Mesh(geometry, material);
```

### Shader-Based Coloring

```typescript
import { glslColormaps } from '../src/utils/colormaps';
import * as THREE from 'three';

const material = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 }
  },
  vertexShader: `
    varying vec3 vPosition;
    void main() {
      vPosition = position;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    varying vec3 vPosition;

    ${glslColormaps.plasma}

    void main() {
      float t = (vPosition.y + 1.0) * 0.5 + sin(time) * 0.2;
      t = clamp(t, 0.0, 1.0);
      vec3 color = plasma(t);
      gl_FragColor = vec4(color, 1.0);
    }
  `
});

// Animate
app.addAnimateCallback((time) => {
  material.uniforms.time.value = time * 0.001;
});
```

## Best Practices

### Choosing a Colormap

✅ **Use perceptually uniform colormaps** (viridis, plasma, inferno) for:
- Scientific visualization
- Heatmaps
- Data where accurate perception matters
- Publications

⚠️ **Avoid rainbow** for:
- Scientific data (not perceptually uniform)
- Colorblind accessibility
- Use only for aesthetic purposes

✅ **Use diverging colormaps** (coolwarm) for:
- Data centered around zero
- Showing positive/negative deviation
- Temperature anomalies

### Performance

- **JS colormaps**: Use for static geometry, pre-computed colors
- **GLSL colormaps**: Use for dynamic/animated coloring, large datasets
- GLSL is much faster for real-time updates

### Accessibility

Viridis, plasma, and inferno are designed to be:
- Colorblind-friendly
- Print-friendly (grayscale conversion)
- Perceptually uniform (equal steps in data = equal perceptual change)

## Demo

See `demos/colormap-demo.ts` for a complete example showing both JS and GLSL usage.

## Implementation Notes

### Color Accuracy

All colormaps use polynomial approximations of matplotlib's reference implementations. The coefficients provide smooth, artifact-free interpolation across the full [0,1] range.

### GLSL Precision

GLSL colormaps use `float` precision which is sufficient for visual accuracy. For extremely high-precision requirements, vertex colors (JS implementation) may be preferred.
