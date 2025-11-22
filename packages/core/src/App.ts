import * as THREE from 'three';
import { LayoutManager } from './managers/LayoutManager';
import type { AnimateCallback, AppOptions } from './types';

export class App {
  // Three.js core
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;

  // Managers
  layout: LayoutManager;

  // Animation tracking
  private animateCallbacks: AnimateCallback[] = [];
  private lastTime = 0;

  constructor(options: AppOptions = {}) {
    // Create Three.js core
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      options.fov || 75,
      window.innerWidth / window.innerHeight,
      options.near || 0.1,
      options.far || 1000
    );
    this.camera.position.z = 5;

    this.renderer = new THREE.WebGLRenderer({
      antialias: options.antialias ?? true,
      alpha: options.alpha ?? false
    });

    // Initialize managers
    this.layout = new LayoutManager(this.renderer, this.camera);

    // Default fullscreen layout
    this.layout.setFullscreen();
  }

  /**
   * Add a callback to be called every frame
   */
  addAnimateCallback(fn: AnimateCallback): void {
    this.animateCallbacks.push(fn);
  }

  /**
   * Start the animation loop
   */
  start(): void {
    this.animate(0);
  }

  /**
   * Main animation loop (private)
   */
  private animate = (time: number) => {
    requestAnimationFrame(this.animate);

    const delta = time - this.lastTime;
    this.lastTime = time;

    // Execute callbacks
    this.animateCallbacks.forEach(fn => fn(time, delta));

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.renderer.dispose();
    this.layout.dispose();
  }
}
