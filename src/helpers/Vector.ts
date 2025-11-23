import * as THREE from 'three';
import { Params } from '../Params';

export interface VectorOptions {
  origin?: THREE.Vector3 | [number, number, number];
  direction?: THREE.Vector3 | [number, number, number];
  length?: number;
  color?: number;
  headLength?: number;
  headWidth?: number;
}

/**
 * 3D vector visualization using an arrow
 *
 * Useful for displaying vectors, normals, tangents, forces, velocities, etc.
 *
 * @example
 *   const vec = new Vector({
 *     origin: [0, 0, 0],
 *     direction: [1, 0, 0],
 *     length: 2,
 *     color: 0xff0000
 *   });
 */
export class Vector {
  mesh: THREE.Group;
  params: Params;

  private arrow: THREE.ArrowHelper;

  origin!: THREE.Vector3;
  direction!: THREE.Vector3;
  length!: number;
  color!: number;

  constructor(options: VectorOptions = {}) {
    this.params = new Params(this);

    // Parse origin
    const origin = options.origin
      ? Array.isArray(options.origin)
        ? new THREE.Vector3(...options.origin)
        : options.origin.clone()
      : new THREE.Vector3(0, 0, 0);

    // Parse direction
    const direction = options.direction
      ? Array.isArray(options.direction)
        ? new THREE.Vector3(...options.direction).normalize()
        : options.direction.clone().normalize()
      : new THREE.Vector3(1, 0, 0);

    // Define parameters
    this.params.define('length', options.length ?? 1, {
      min: 0.1,
      max: 10,
      step: 0.1,
      label: 'Length',
      onChange: () => this.updateArrow()
    });

    this.params.define('color', options.color ?? 0xff0000, {
      type: 'color',
      label: 'Color',
      onChange: () => this.updateArrow()
    });

    // Store origin and direction (non-reactive for now)
    this.params.define('origin', origin, {
      onChange: () => this.updateArrow()
    });

    this.params.define('direction', direction, {
      onChange: () => this.updateArrow()
    });

    // Create arrow
    const headLength = options.headLength ?? this.length * 0.2;
    const headWidth = options.headWidth ?? this.length * 0.1;

    this.arrow = new THREE.ArrowHelper(
      this.direction,
      this.origin,
      this.length,
      this.color,
      headLength,
      headWidth
    );

    this.mesh = new THREE.Group();
    this.mesh.add(this.arrow);
  }

  /**
   * Set the vector's origin
   */
  setOrigin(x: number, y: number, z: number): void {
    this.origin.set(x, y, z);
    this.updateArrow();
  }

  /**
   * Set the vector's direction (will be normalized)
   */
  setDirection(x: number, y: number, z: number): void {
    this.direction.set(x, y, z).normalize();
    this.updateArrow();
  }

  /**
   * Update the arrow geometry
   */
  private updateArrow(): void {
    this.arrow.position.copy(this.origin);
    this.arrow.setDirection(this.direction);
    this.arrow.setLength(this.length, this.length * 0.2, this.length * 0.1);
    this.arrow.setColor(this.color);
  }

  dispose(): void {
    this.arrow.dispose();
  }
}
