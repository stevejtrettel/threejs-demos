import * as THREE from 'three';
import { Params } from '../Params';

export interface ConeVectorOptions {
  origin?: THREE.Vector3 | [number, number, number];
  direction?: THREE.Vector3 | [number, number, number];
  magnitude?: number;
  color?: number;
  baseRadius?: number;
  lengthScale?: number;
}

/**
 * Simple cone-based vector for clean vector field visualizations
 *
 * The cone's length and radius scale with magnitude for intuitive visualization.
 * Simpler than Arrow class - better for dense vector fields.
 *
 * @example
 *   const vec = new ConeVector({
 *     origin: [0, 0, 0],
 *     direction: [1, 0, 0],
 *     magnitude: 2,
 *     color: 0xff0000
 *   });
 */
export class ConeVector {
  mesh: THREE.Group;
  params: Params;

  private cone: THREE.Mesh;

  origin!: THREE.Vector3;
  direction!: THREE.Vector3;
  magnitude!: number;
  color!: number;
  baseRadius!: number;
  lengthScale!: number;

  constructor(options: ConeVectorOptions = {}) {
    this.params = new Params(this);

    // Parse origin and direction
    const origin = options.origin
      ? Array.isArray(options.origin)
        ? new THREE.Vector3(...options.origin)
        : options.origin.clone()
      : new THREE.Vector3(0, 0, 0);

    const direction = options.direction
      ? Array.isArray(options.direction)
        ? new THREE.Vector3(...options.direction).normalize()
        : options.direction.clone().normalize()
      : new THREE.Vector3(1, 0, 0);

    // Define parameters
    this.params.define('magnitude', options.magnitude ?? 1, {
      min: 0.1,
      max: 10,
      step: 0.1,
      label: 'Magnitude',
      onChange: () => this.updateGeometry()
    });

    this.params.define('color', options.color ?? 0xff0000, {
      type: 'color',
      label: 'Color',
      onChange: () => this.updateColor()
    });

    this.params.define('baseRadius', options.baseRadius ?? 0.05, {
      min: 0.01,
      max: 0.5,
      step: 0.01,
      label: 'Base Radius',
      onChange: () => this.updateGeometry()
    });

    this.params.define('lengthScale', options.lengthScale ?? 1, {
      min: 0.1,
      max: 5,
      step: 0.1,
      label: 'Length Scale',
      onChange: () => this.updateGeometry()
    });

    this.params.define('origin', origin, {
      onChange: () => this.updatePosition()
    });

    this.params.define('direction', direction, {
      onChange: () => this.updatePosition()
    });

    // Create geometry
    const length = this.magnitude * this.lengthScale;
    const radius = this.baseRadius * Math.sqrt(this.magnitude);
    const material = new THREE.MeshStandardMaterial({ color: this.color });

    const geometry = new THREE.ConeGeometry(radius, length, 16);
    this.cone = new THREE.Mesh(geometry, material);

    // Cone points up by default, we'll orient it with quaternions
    this.mesh = new THREE.Group();
    this.mesh.add(this.cone);

    // Initial positioning
    this.updatePosition();
  }

  /**
   * Set the vector's origin
   */
  setOrigin(x: number, y: number, z: number): void {
    this.origin.set(x, y, z);
    this.updatePosition();
  }

  /**
   * Set the vector's direction (will be normalized)
   */
  setDirection(x: number, y: number, z: number): void {
    this.direction.set(x, y, z).normalize();
    this.updatePosition();
  }

  /**
   * Update vector position and orientation
   */
  private updatePosition(): void {
    // Position group at origin
    this.mesh.position.copy(this.origin);

    // Orient cone to point in direction
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, this.direction);
    this.mesh.setRotationFromQuaternion(quaternion);

    // Position cone so base is at origin and tip points in direction
    const length = this.magnitude * this.lengthScale;
    this.cone.position.set(0, length / 2, 0);
  }

  /**
   * Update vector geometry (when magnitude or size changes)
   */
  private updateGeometry(): void {
    const length = this.magnitude * this.lengthScale;
    const radius = this.baseRadius * Math.sqrt(this.magnitude);

    const oldGeometry = this.cone.geometry;
    this.cone.geometry = new THREE.ConeGeometry(radius, length, 16);
    oldGeometry.dispose();

    this.updatePosition();
  }

  /**
   * Update vector color
   */
  private updateColor(): void {
    (this.cone.material as THREE.Material & { color: THREE.Color }).color.setHex(this.color);
  }

  dispose(): void {
    this.cone.geometry.dispose();
    (this.cone.material as THREE.Material).dispose();
  }
}
