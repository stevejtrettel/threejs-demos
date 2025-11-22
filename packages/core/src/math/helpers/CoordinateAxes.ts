import * as THREE from 'three';

export interface CoordinateAxesOptions {
  size?: number;
  lineWidth?: number;
  colors?: {
    x?: number;
    y?: number;
    z?: number;
  };
  showNegative?: boolean;
  labels?: boolean;  // Future: add text labels
}

/**
 * Coordinate axes helper for mathematical visualizations
 * Creates X (red), Y (green), Z (blue) axes
 */
export class CoordinateAxes {
  mesh: THREE.Group;

  private size: number;
  private colors: { x: number; y: number; z: number };

  constructor(options: CoordinateAxesOptions = {}) {
    this.size = options.size ?? 5;
    this.colors = {
      x: options.colors?.x ?? 0xff0000,
      y: options.colors?.y ?? 0x00ff00,
      z: options.colors?.z ?? 0x0000ff
    };

    this.mesh = new THREE.Group();
    this.mesh.name = 'CoordinateAxes';

    const showNegative = options.showNegative ?? false;
    const start = showNegative ? -this.size : 0;

    // X axis (red)
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(start, 0, 0),
      new THREE.Vector3(this.size, 0, 0)
    ]);
    const xMaterial = new THREE.LineBasicMaterial({
      color: this.colors.x,
      linewidth: options.lineWidth ?? 1
    });
    const xLine = new THREE.Line(xGeometry, xMaterial);
    xLine.name = 'X-axis';
    this.mesh.add(xLine);

    // Y axis (green)
    const yGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, start, 0),
      new THREE.Vector3(0, this.size, 0)
    ]);
    const yMaterial = new THREE.LineBasicMaterial({
      color: this.colors.y,
      linewidth: options.lineWidth ?? 1
    });
    const yLine = new THREE.Line(yGeometry, yMaterial);
    yLine.name = 'Y-axis';
    this.mesh.add(yLine);

    // Z axis (blue)
    const zGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, start),
      new THREE.Vector3(0, 0, this.size)
    ]);
    const zMaterial = new THREE.LineBasicMaterial({
      color: this.colors.z,
      linewidth: options.lineWidth ?? 1
    });
    const zLine = new THREE.Line(zGeometry, zMaterial);
    zLine.name = 'Z-axis';
    this.mesh.add(zLine);

    // Add small cones at endpoints to show direction
    this.addArrowheads();
  }

  private addArrowheads(): void {
    const coneHeight = this.size * 0.1;
    const coneRadius = this.size * 0.02;

    // X axis arrowhead (red)
    const xCone = new THREE.Mesh(
      new THREE.ConeGeometry(coneRadius, coneHeight, 8),
      new THREE.MeshBasicMaterial({ color: this.colors.x })
    );
    xCone.position.set(this.size, 0, 0);
    xCone.rotation.z = -Math.PI / 2;
    this.mesh.add(xCone);

    // Y axis arrowhead (green)
    const yCone = new THREE.Mesh(
      new THREE.ConeGeometry(coneRadius, coneHeight, 8),
      new THREE.MeshBasicMaterial({ color: this.colors.y })
    );
    yCone.position.set(0, this.size, 0);
    this.mesh.add(yCone);

    // Z axis arrowhead (blue)
    const zCone = new THREE.Mesh(
      new THREE.ConeGeometry(coneRadius, coneHeight, 8),
      new THREE.MeshBasicMaterial({ color: this.colors.z })
    );
    zCone.position.set(0, 0, this.size);
    zCone.rotation.x = Math.PI / 2;
    this.mesh.add(zCone);
  }

  dispose(): void {
    this.mesh.children.forEach(child => {
      if (child instanceof THREE.Line || child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }
}
