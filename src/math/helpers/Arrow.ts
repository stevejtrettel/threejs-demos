import * as THREE from 'three';
import { Params } from '../../Params';

export interface ArrowOptions {
  origin?: THREE.Vector3 | [number, number, number];
  direction?: THREE.Vector3 | [number, number, number];
  length?: number;
  color?: number;
  shaftRadius?: number;
  headLength?: number;
  headRadius?: number;
  baseRadius?: number;
}

/**
 * Professional arrow visualization with sphere base, cylinder shaft, and cone head
 *
 * Better for publication-quality vector field visualizations than the basic Vector class.
 *
 * @example
 *   const arrow = new Arrow({
 *     origin: [0, 0, 0],
 *     direction: [1, 0, 0],
 *     length: 2,
 *     color: 0xff0000
 *   });
 */
export class Arrow {
  mesh: THREE.Group;
  params: Params;

  private baseSphere: THREE.Mesh;
  private shaft: THREE.Mesh;
  private head: THREE.Mesh;

  origin!: THREE.Vector3;
  direction!: THREE.Vector3;
  length!: number;
  color!: number;

  constructor(options: ArrowOptions = {}) {
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
    this.params.define('length', options.length ?? 1, {
      min: 0.1,
      max: 10,
      step: 0.1,
      label: 'Length',
      onChange: () => this.updateGeometry()
    });

    this.params.define('color', options.color ?? 0xff0000, {
      type: 'color',
      label: 'Color',
      onChange: () => this.updateColor()
    });

    this.params.define('origin', origin, {
      onChange: () => this.updatePosition()
    });

    this.params.define('direction', direction, {
      onChange: () => this.updatePosition()
    });

    // Geometric parameters
    const shaftRadius = options.shaftRadius ?? 0.02;
    const headLength = options.headLength ?? this.length * 0.25;
    const headRadius = options.headRadius ?? shaftRadius * 2.5;
    const baseRadius = options.baseRadius ?? shaftRadius * 1.5;

    // Create geometries
    const material = new THREE.MeshStandardMaterial({ color: this.color });

    // Base sphere
    this.baseSphere = new THREE.Mesh(
      new THREE.SphereGeometry(baseRadius, 16, 16),
      material.clone()
    );

    // Shaft (cylinder)
    const shaftLength = this.length - headLength;
    const shaftGeom = new THREE.CylinderGeometry(
      shaftRadius,
      shaftRadius,
      shaftLength,
      16
    );
    this.shaft = new THREE.Mesh(shaftGeom, material.clone());

    // Head (cone)
    const headGeom = new THREE.ConeGeometry(headRadius, headLength, 16);
    this.head = new THREE.Mesh(headGeom, material.clone());

    // Create group
    this.mesh = new THREE.Group();
    this.mesh.add(this.baseSphere);
    this.mesh.add(this.shaft);
    this.mesh.add(this.head);

    // Initial positioning
    this.updatePosition();
  }

  /**
   * Set the arrow's origin
   */
  setOrigin(x: number, y: number, z: number): void {
    this.origin.set(x, y, z);
    this.updatePosition();
  }

  /**
   * Set the arrow's direction (will be normalized)
   */
  setDirection(x: number, y: number, z: number): void {
    this.direction.set(x, y, z).normalize();
    this.updatePosition();
  }

  /**
   * Update arrow position and orientation
   */
  private updatePosition(): void {
    // Position group at origin
    this.mesh.position.copy(this.origin);

    // Orient arrow to point in direction
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(up, this.direction);
    this.mesh.setRotationFromQuaternion(quaternion);

    // Position components along arrow
    this.baseSphere.position.set(0, 0, 0);

    const headLength = this.length * 0.25;
    const shaftLength = this.length - headLength;

    this.shaft.position.set(0, shaftLength / 2, 0);
    this.head.position.set(0, shaftLength + headLength / 2, 0);
  }

  /**
   * Update arrow geometry (when length changes)
   */
  private updateGeometry(): void {
    const headLength = this.length * 0.25;
    const shaftLength = this.length - headLength;
    const shaftRadius = 0.02;
    const headRadius = shaftRadius * 2.5;

    // Update shaft
    const oldShaftGeom = this.shaft.geometry;
    this.shaft.geometry = new THREE.CylinderGeometry(
      shaftRadius,
      shaftRadius,
      shaftLength,
      16
    );
    oldShaftGeom.dispose();

    // Update head
    const oldHeadGeom = this.head.geometry;
    this.head.geometry = new THREE.ConeGeometry(headRadius, headLength, 16);
    oldHeadGeom.dispose();

    this.updatePosition();
  }

  /**
   * Update arrow color
   */
  private updateColor(): void {
    (this.baseSphere.material as THREE.Material & { color: THREE.Color }).color.setHex(this.color);
    (this.shaft.material as THREE.Material & { color: THREE.Color }).color.setHex(this.color);
    (this.head.material as THREE.Material & { color: THREE.Color }).color.setHex(this.color);
  }

  dispose(): void {
    this.baseSphere.geometry.dispose();
    (this.baseSphere.material as THREE.Material).dispose();

    this.shaft.geometry.dispose();
    (this.shaft.material as THREE.Material).dispose();

    this.head.geometry.dispose();
    (this.head.material as THREE.Material).dispose();
  }
}
