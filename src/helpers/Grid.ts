import * as THREE from 'three';

export interface GridOptions {
  size?: number;
  divisions?: number;
  colorCenterLine?: number;
  colorGrid?: number;
  plane?: 'xy' | 'xz' | 'yz';
  opacity?: number;
  fadeDistance?: number;  // Distance at which grid fades out
}

/**
 * Grid helper for mathematical visualizations
 * More flexible than THREE.GridHelper - supports multiple planes
 */
export class Grid {
  mesh: THREE.Group;

  private size: number;
  private divisions: number;
  private plane: 'xy' | 'xz' | 'yz';

  constructor(options: GridOptions = {}) {
    this.size = options.size ?? 10;
    this.divisions = options.divisions ?? 10;
    this.plane = options.plane ?? 'xz';  // Default to floor plane

    const colorCenterLine = options.colorCenterLine ?? 0x444444;
    const colorGrid = options.colorGrid ?? 0x222222;
    const opacity = options.opacity ?? 1;

    this.mesh = new THREE.Group();
    this.mesh.name = 'Grid';

    // Create grid
    const step = this.size / this.divisions;
    const halfSize = this.size / 2;

    const positions: number[] = [];
    const colors: number[] = [];

    const centerLineColor = new THREE.Color(colorCenterLine);
    const gridColor = new THREE.Color(colorGrid);

    // Generate grid lines
    for (let i = 0; i <= this.divisions; i++) {
      const position = -halfSize + i * step;
      const isCenterLine = i === Math.floor(this.divisions / 2);
      const color = isCenterLine ? centerLineColor : gridColor;

      // Lines parallel to first axis
      this.addLine(
        position,
        -halfSize,
        position,
        halfSize,
        color,
        positions,
        colors
      );

      // Lines parallel to second axis
      this.addLine(
        -halfSize,
        position,
        halfSize,
        position,
        color,
        positions,
        colors
      );
    }

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3)
    );
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(colors, 3)
    );

    // Create material
    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      opacity: opacity,
      transparent: opacity < 1
    });

    // Create mesh
    const lineSegments = new THREE.LineSegments(geometry, material);

    // Rotate based on plane
    if (this.plane === 'xy') {
      // No rotation needed
    } else if (this.plane === 'xz') {
      lineSegments.rotation.x = -Math.PI / 2;
    } else if (this.plane === 'yz') {
      lineSegments.rotation.y = Math.PI / 2;
    }

    this.mesh.add(lineSegments);
  }

  /**
   * Add a line in the grid's local coordinate system
   */
  private addLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: THREE.Color,
    positions: number[],
    colors: number[]
  ): void {
    // First point
    positions.push(x1, y1, 0);
    colors.push(color.r, color.g, color.b);

    // Second point
    positions.push(x2, y2, 0);
    colors.push(color.r, color.g, color.b);
  }

  /**
   * Change grid opacity (useful for fading in/out)
   */
  setOpacity(opacity: number): void {
    this.mesh.children.forEach(child => {
      if (child instanceof THREE.LineSegments) {
        (child.material as THREE.LineBasicMaterial).opacity = opacity;
        (child.material as THREE.LineBasicMaterial).transparent = opacity < 1;
      }
    });
  }

  dispose(): void {
    this.mesh.children.forEach(child => {
      if (child instanceof THREE.LineSegments) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }
}
