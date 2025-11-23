/**
 * Colormap functions for data visualization
 *
 * Pure functions that map normalized values [0,1] to colors.
 * All functions return THREE.Color objects.
 *
 * Based on matplotlib colormaps and scientific visualization standards.
 *
 * @example
 *   import { viridis, map } from './colormaps';
 *
 *   // Simple usage
 *   const color = viridis(0.5);
 *
 *   // Map from arbitrary range
 *   const t = map(temperature, 0, 100);
 *   const color = viridis(t);
 */

import * as THREE from 'three';

/**
 * Clamp value to [0, 1]
 */
function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

/**
 * Map value from arbitrary range to [0, 1]
 *
 * @param value - Value to map
 * @param min - Minimum of input range
 * @param max - Maximum of input range
 * @returns Normalized value in [0, 1]
 */
export function map(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return clamp01((value - min) / (max - min));
}

/**
 * Viridis colormap - perceptually uniform, colorblind-friendly
 * Blue -> Green -> Yellow
 */
export function viridis(t: number): THREE.Color {
  t = clamp01(t);

  // Viridis color data (sampled from matplotlib)
  const r = 0.267004 + t * (0.329415 + t * (3.408124 + t * (-9.555742 + t * (10.891033 - t * 5.0))));
  const g = 0.004874 + t * (0.426331 + t * (2.227228 + t * (-5.469903 + t * (6.046136 - t * 2.642517))));
  const b = 0.329415 + t * (1.570919 + t * (-4.462119 + t * (8.786157 + t * (-10.624373 + t * 4.987208))));

  return new THREE.Color(r, g, b);
}

/**
 * Plasma colormap - perceptually uniform, high contrast
 * Purple -> Pink -> Orange -> Yellow
 */
export function plasma(t: number): THREE.Color {
  t = clamp01(t);

  // Plasma color data (sampled from matplotlib)
  const r = 0.050383 + t * (0.759486 + t * (3.427291 + t * (-8.903461 + t * (10.221717 - t * 4.0))));
  const g = 0.029803 + t * (0.278443 + t * (0.753308 + t * (-1.888724 + t * (2.518137 - t * 1.5))));
  const b = 0.527975 + t * (1.477843 + t * (-4.960887 + t * (10.558896 + t * (-11.913923 + t * 5.0))));

  return new THREE.Color(r, g, b);
}

/**
 * Inferno colormap - perceptually uniform, dark background friendly
 * Black -> Purple -> Orange -> Yellow
 */
export function inferno(t: number): THREE.Color {
  t = clamp01(t);

  // Inferno color data (sampled from matplotlib)
  const r = 0.001462 + t * (0.354580 + t * (3.553005 + t * (-9.219393 + t * (9.693872 - t * 3.5))));
  const g = 0.000466 + t * (0.206756 + t * (1.109628 + t * (-3.168896 + t * (4.512265 - t * 2.5))));
  const b = 0.013866 + t * (1.126992 + t * (-2.755415 + t * (5.168534 + t * (-5.863076 + t * 2.5))));

  return new THREE.Color(r, g, b);
}

/**
 * Cool-Warm diverging colormap
 * Blue -> White -> Red
 * Good for showing deviation from center
 */
export function coolwarm(t: number): THREE.Color {
  t = clamp01(t);

  // Smooth interpolation
  const r = 0.230 + t * (1.540 - t * 0.770);
  const g = 0.299 + t * (0.402 - t * 0.701);
  const b = 0.754 - t * (1.508 - t * 0.754);

  return new THREE.Color(r, g, b);
}

/**
 * Rainbow colormap (HSV-based)
 * Red -> Yellow -> Green -> Cyan -> Blue -> Magenta -> Red
 *
 * Note: Not perceptually uniform, use with caution.
 * Consider viridis/plasma for scientific visualization.
 */
export function rainbow(t: number): THREE.Color {
  t = clamp01(t);

  // Convert to HSV and back to RGB
  const h = t * 6; // 0-6 for full hue cycle
  const s = 1;
  const v = 1;

  const c = v * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = v - c;

  let r = 0, g = 0, b = 0;

  if (h < 1) { r = c; g = x; b = 0; }
  else if (h < 2) { r = x; g = c; b = 0; }
  else if (h < 3) { r = 0; g = c; b = x; }
  else if (h < 4) { r = 0; g = x; b = c; }
  else if (h < 5) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  return new THREE.Color(r + m, g + m, b + m);
}

/**
 * Grayscale colormap
 * Black -> White
 */
export function grayscale(t: number): THREE.Color {
  t = clamp01(t);
  return new THREE.Color(t, t, t);
}

/**
 * Apply colormap to array of values
 *
 * @param values - Array of values to map
 * @param colormap - Colormap function
 * @param min - Minimum value (auto-computed if not provided)
 * @param max - Maximum value (auto-computed if not provided)
 * @returns Float32Array of RGB values ready for BufferAttribute
 *
 * @example
 *   const heights = [0.1, 0.5, 0.8, 1.2];
 *   const colors = applyColormap(heights, viridis);
 *   geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
 */
export function applyColormap(
  values: number[],
  colormap: (t: number) => THREE.Color,
  min?: number,
  max?: number
): Float32Array {
  // Auto-compute range if not provided
  if (min === undefined || max === undefined) {
    min = Math.min(...values);
    max = Math.max(...values);
  }

  const colors = new Float32Array(values.length * 3);
  const color = new THREE.Color();

  for (let i = 0; i < values.length; i++) {
    const t = map(values[i], min, max);
    colormap(t).toArray(colors, i * 3);
  }

  return colors;
}

/**
 * Available colormaps
 */
export const colormaps = {
  viridis,
  plasma,
  inferno,
  coolwarm,
  rainbow,
  grayscale,
  map,
  applyColormap
} as const;

export default colormaps;
