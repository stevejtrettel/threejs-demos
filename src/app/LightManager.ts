import * as THREE from 'three';

export class LightManager {
  private scene: THREE.Scene;
  private currentLights: THREE.Light[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  set(preset: string): void {
    this.clear();

    switch (preset) {
      case 'three-point':
        this.setThreePoint();
        break;
      case 'ambient':
        this.setAmbient();
        break;
      case 'directional':
        this.setDirectional();
        break;
      case 'none':
        break;
      default:
        console.warn(`Unknown light preset: ${preset}`);
    }
  }

  private setThreePoint(): void {
    const key = new THREE.DirectionalLight(0xffffff, 1);
    key.position.set(5, 5, 5);

    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-5, 0, -5);

    const back = new THREE.DirectionalLight(0xffffff, 0.5);
    back.position.set(0, 5, -5);

    this.add(key);
    this.add(fill);
    this.add(back);
  }

  private setAmbient(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.add(ambient);
  }

  private setDirectional(): void {
    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(5, 5, 5);
    this.add(directional);
  }

  add(light: THREE.Light): void {
    this.currentLights.push(light);
    this.scene.add(light);
  }

  remove(light: THREE.Light): void {
    const index = this.currentLights.indexOf(light);
    if (index > -1) {
      this.currentLights.splice(index, 1);
      this.scene.remove(light);
    }
  }

  clear(): void {
    this.currentLights.forEach(light => this.scene.remove(light));
    this.currentLights = [];
  }

  dispose(): void {
    this.clear();
  }
}
