/**
 * GLSL Colormap utilities
 *
 * Provides GLSL colormap functions as strings that can be included in shaders.
 *
 * @example
 *   import { glslColormaps } from './glsl-colormaps';
 *
 *   const fragmentShader = `
 *     ${glslColormaps.viridis}
 *
 *     void main() {
 *       float value = vHeight; // Some varying
 *       vec3 color = viridis(value);
 *       gl_FragColor = vec4(color, 1.0);
 *     }
 *   `;
 */

import viridisGLSL from './glsl/viridis.glsl?raw';
import plasmaGLSL from './glsl/plasma.glsl?raw';
import infernoGLSL from './glsl/inferno.glsl?raw';
import rainbowGLSL from './glsl/rainbow.glsl?raw';

/**
 * GLSL colormap functions as strings
 */
export const glslColormaps = {
  viridis: viridisGLSL,
  plasma: plasmaGLSL,
  inferno: infernoGLSL,
  rainbow: rainbowGLSL,
} as const;

/**
 * Map value from arbitrary range to [0, 1] (GLSL)
 */
export const glslMapFunction = `
float mapToRange(float value, float min, float max) {
  return clamp((value - min) / (max - min), 0.0, 1.0);
}
`;

/**
 * Get all colormap functions as a single string
 * Useful for including multiple colormaps at once
 */
export function getAllColormaps(): string {
  return Object.values(glslColormaps).join('\n\n');
}

/**
 * Create a shader with colormap injected
 *
 * @param shaderCode - Shader code with {{colormap}} placeholder
 * @param colormapName - Name of colormap to inject
 * @returns Shader code with colormap function injected
 *
 * @example
 *   const shader = injectColormap(`
 *     {{colormap}}
 *     void main() {
 *       gl_FragColor = vec4(viridis(vUv.x), 1.0);
 *     }
 *   `, 'viridis');
 */
export function injectColormap(shaderCode: string, colormapName: keyof typeof glslColormaps): string {
  return shaderCode.replace('{{colormap}}', glslColormaps[colormapName]);
}

export default glslColormaps;
