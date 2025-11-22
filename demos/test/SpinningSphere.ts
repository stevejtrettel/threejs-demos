import * as THREE from 'three';

export class SpinningSphere {
  mesh: THREE.Mesh;
  private speed: number;

  constructor(speed = 1) {
    this.speed = speed;

    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const material = new THREE.MeshStandardMaterial({
      color: Math.random() * 0xffffff,
      roughness: 0.5,
      metalness: 0.5
    });

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5
    );
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
