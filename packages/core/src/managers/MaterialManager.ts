import * as THREE from 'three';

/**
 * Material manager for creating materials with sensible defaults
 *
 * IMPORTANT: Returns actual Three.js materials, not wrappers.
 * You can always fall back to `new THREE.MeshPhysicalMaterial()` directly.
 */
export class MaterialManager {
  /**
   * Create MeshPhysicalMaterial with sensible defaults for math visualizations
   * All options can be overridden
   */
  physical(options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
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
  plastic(color: number = 0xff0000, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
    return this.physical({
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
  metal(color: number = 0xcccccc, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
    return this.physical({
      color,
      roughness: 0.2,
      metalness: 1.0,
      ...options
    });
  }

  /**
   * Quick glass material preset
   */
  glass(color: number = 0xffffff, opacity: number = 0.5, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
    return this.physical({
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
  matte(color: number = 0xffffff, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
    return this.physical({
      color,
      roughness: 1.0,
      metalness: 0.0,
      ...options
    });
  }

  /**
   * Glossy material (for smooth, shiny surfaces)
   */
  glossy(color: number = 0xffffff, options: Partial<THREE.MeshPhysicalMaterialParameters> = {}): THREE.MeshPhysicalMaterial {
    return this.physical({
      color,
      roughness: 0.1,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      ...options
    });
  }

  /**
   * Create MeshStandardMaterial (simpler, more performant than Physical)
   */
  standard(options: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0.0,
      ...options
    });
  }

  /**
   * Create MeshBasicMaterial (unlit, flat shading)
   */
  basic(options: Partial<THREE.MeshBasicMaterialParameters> = {}): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({
      ...options
    });
  }

  /**
   * Create MeshNormalMaterial (useful for debugging)
   */
  normal(options: Partial<THREE.MeshNormalMaterialParameters> = {}): THREE.MeshNormalMaterial {
    return new THREE.MeshNormalMaterial({
      ...options
    });
  }

  /**
   * Create LineBasicMaterial
   */
  line(options: Partial<THREE.LineBasicMaterialParameters> = {}): THREE.LineBasicMaterial {
    return new THREE.LineBasicMaterial({
      ...options
    });
  }

  /**
   * Create PointsMaterial
   */
  points(options: Partial<THREE.PointsMaterialParameters> = {}): THREE.PointsMaterial {
    return new THREE.PointsMaterial({
      size: 0.05,
      ...options
    });
  }
}
