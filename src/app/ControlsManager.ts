import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class ControlsManager {
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private currentControls: OrbitControls;

  constructor(camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this.camera = camera;
    this.domElement = renderer.domElement;

    // Initialize OrbitControls by default
    this.currentControls = new OrbitControls(this.camera, this.domElement);
  }

  /**
   * Get the current controls instance (for direct access)
   */
  get controls(): OrbitControls {
    return this.currentControls;
  }

  /**
   * Get the target (lookAt point) of the controls
   */
  get target(): THREE.Vector3 {
    return this.currentControls.target;
  }

  setOrbit(options?: Partial<OrbitControls>): void {
    // Don't dispose if it's already orbit controls, just update options
    if (options) {
      Object.assign(this.currentControls, options);
    }
  }

  update(): void {
    this.currentControls.update();
  }

  dispose(): void {
    this.currentControls.dispose();
  }
}
