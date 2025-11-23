import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class ControlsManager {
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private currentControls?: OrbitControls;

  constructor(camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this.camera = camera;
    this.domElement = renderer.domElement;
  }

  setOrbit(options?: Partial<OrbitControls>): void {
    this.dispose();
    this.currentControls = new OrbitControls(this.camera, this.domElement);

    if (options) {
      Object.assign(this.currentControls, options);
    }
  }

  update(): void {
    if (this.currentControls) {
      this.currentControls.update();
    }
  }

  dispose(): void {
    if (this.currentControls) {
      this.currentControls.dispose();
      this.currentControls = undefined;
    }
  }
}
