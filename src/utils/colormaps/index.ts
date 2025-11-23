/**
 * Colormap System
 *
 * Provides both JavaScript and GLSL colormap implementations for data visualization.
 *
 * ## JavaScript Colormaps
 * Use for CPU-side geometry coloring:
 *
 * ```typescript
 * import { viridis, applyColormap } from './colormaps';
 *
 * // Single value
 * const color = viridis(0.5);
 *
 * // Apply to geometry
 * const heights = [0, 0.5, 1.0, 1.5];
 * const colors = applyColormap(heights, viridis);
 * geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
 * ```
 *
 * ## GLSL Colormaps
 * Use for shader-based coloring:
 *
 * ```typescript
 * import { glslColormaps } from './colormaps';
 *
 * const fragmentShader = `
 *   ${glslColormaps.viridis}
 *
 *   void main() {
 *     float t = vUv.x;
 *     vec3 color = viridis(t);
 *     gl_FragColor = vec4(color, 1.0);
 *   }
 * `;
 * ```
 */

// JavaScript colormaps
export {
  viridis,
  plasma,
  inferno,
  coolwarm,
  rainbow,
  grayscale,
  map,
  applyColormap,
  colormaps
} from './colormaps';

// GLSL colormaps
export {
  glslColormaps,
  glslMapFunction,
  getAllColormaps,
  injectColormap
} from './glsl-colormaps';
