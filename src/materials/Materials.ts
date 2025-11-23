import * as THREE from 'three';

/**
 * Material factory utilities for creating materials with sensible defaults
 *
 * IMPORTANT: Returns actual Three.js materials, not wrappers.
 * You can always fall back to `new THREE.MeshPhysicalMaterial()` directly.
 *
 * Usage:
 *   import { Materials } from '@/materials';
 *   const mat = Materials.plastic(0xff0000);
 */

/**
 * Create MeshPhysicalMaterial with sensible defaults for math visualizations
 * All options can be overridden
 */
function physical(options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    // Defaults optimized for math viz
    roughness: 0.3,
    metalness: 0.1,
    clearcoat: 0.0,
    clearcoatRoughness: 0.0,
    ...options  // User overrides everything
  });
}

/**
 * Quick plastic material preset
 */
function plastic(color: number = 0xff0000, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
  return physical({
    color,
    roughness: 0.4,
    metalness: 0.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
    ...options
  });
}

/**
 * Quick metal material preset
 */
function metal(color: number = 0xcccccc, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
  return physical({
    color,
    roughness: 0.2,
    metalness: 1.0,
    ...options
  });
}

/**
 * Quick glass material preset
 */
function glass(color: number = 0xffffff, opacity: number = 0.5, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
  return physical({
    color,
    transparent: true,
    opacity,
    roughness: 0.0,
    metalness: 0.0,
    transmission: 0.9,
    thickness: 0.5,
    ior: 1.5,
    ...options
  });
}

/**
 * Matte material (for non-reflective surfaces)
 */
function matte(color: number = 0xffffff, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
  return physical({
    color,
    roughness: 1.0,
    metalness: 0.0,
    ...options
  });
}

/**
 * Glossy material (for smooth, shiny surfaces)
 */
function glossy(color: number = 0xffffff, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
  return physical({
    color,
    roughness: 0.1,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    ...options
  });
}

/**
 * Ceramic material (smooth, glossy porcelain-like finish)
 */
function ceramic(color: number = 0xffffff, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
  return physical({
    color,
    roughness: 0.15,
    metalness: 0.0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.15,
    ...options
  });
}

/**
 * Rubber material (matte, soft appearance)
 */
function rubber(color: number = 0x333333, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
  return physical({
    color,
    roughness: 0.9,
    metalness: 0.0,
    clearcoat: 0.0,
    ...options
  });
}

/**
 * Create MeshStandardMaterial (simpler, more performant than Physical)
 */
function standard(options: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    roughness: 0.5,
    metalness: 0.0,
    ...options
  });
}

/**
 * Create MeshBasicMaterial (unlit, flat shading)
 */
function basic(options: Partial<THREE.MeshBasicMaterialParameters> = {}): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    ...options
  });
}

/**
 * Create MeshNormalMaterial (useful for debugging)
 */
function normal(options: Partial<THREE.MeshNormalMaterialParameters> = {}): THREE.MeshNormalMaterial {
  return new THREE.MeshNormalMaterial({
    ...options
  });
}

/**
 * Create LineBasicMaterial
 */
function line(options: Partial<THREE.LineBasicMaterialParameters> = {}): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({
    ...options
  });
}

/**
 * Create PointsMaterial
 */
function points(options: Partial<THREE.PointsMaterialParameters> = {}): THREE.PointsMaterial {
  return new THREE.PointsMaterial({
    size: 0.05,
    ...options
  });
}

/**
 * Clone a material with optional property overrides
 *
 * @example
 *   const base = Materials.plastic(0xff0000);
 *   const variant = Materials.clone(base, { color: 0x00ff00, roughness: 0.6 });
 */
function clone<T extends THREE.Material>(material: T, overrides: Partial<T> = {}): T {
  const cloned = material.clone() as T;
  Object.assign(cloned, overrides);
  return cloned;
}

/**
 * Material factory utilities
 *
 * Provides factory functions for creating common materials with sensible defaults.
 * All functions return actual Three.js materials (no wrappers).
 *
 * @example
 *   import { Materials } from '@/materials';
 *
 *   const plastic = Materials.plastic(0xff0000);
 *   const shiny = Materials.clone(plastic, { clearcoat: 1.0 });
 */
export const Materials = {
  // Physical material presets
  physical,
  plastic,
  metal,
  glass,
  matte,
  glossy,
  ceramic,
  rubber,

  // Other material types
  standard,
  basic,
  normal,
  line,
  points,

  // Utilities
  clone
};
