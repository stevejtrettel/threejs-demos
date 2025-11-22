import * as THREE from 'three';
import { ComponentParams } from '@core/components/ComponentParams';

export class SpinningSphere {
  mesh: THREE.Mesh;
  params: ComponentParams;

  // These will be created by params.define()
  speed!: number;
  size!: number;
  color!: number;

  constructor() {
    this.params = new ComponentParams(this);

    // Define parameters
    this.params.define('speed', 1, {
      min: 0,
      max: 5,
      step: 0.1,
      onChange: (value) => {
        console.log('Speed changed to:', value);
      }
    });

    this.params.define('size', 1, {
      min: 0.5,
      max: 3,
      step: 0.1,
      onChange: (value) => {
        console.log('Size changed to:', value);
        this.mesh.scale.setScalar(value);
      }
    });

    this.params.define('color', 0xff0000, {
      type: 'color',
      onChange: (value) => {
        console.log('Color changed to:', value.toString(16));
        (this.mesh.material as THREE.MeshStandardMaterial).color.setHex(value);
      }
    });

    // Create mesh
    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.5,
      metalness: 0.5
    });

    this.mesh = new THREE.Mesh(geometry, material);
  }

  animate(time: number, delta: number): void {
    this.mesh.rotation.x += delta * 0.001 * this.speed;
    this.mesh.rotation.y += delta * 0.001 * this.speed;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
