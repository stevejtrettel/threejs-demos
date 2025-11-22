import * as THREE from 'three';
import { BackgroundManager } from './managers/BackgroundManager';
import { LightManager } from './managers/LightManager';
import { ControlsManager } from './managers/ControlsManager';
import { LayoutManager } from './managers/LayoutManager';
import type { AnimateCallback, AppOptions, Animatable, Disposable } from './types';

export class App {
  // Three.js core
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;

  // Managers
  backgrounds: BackgroundManager;
  lights: LightManager;
  controls: ControlsManager;
  layout: LayoutManager;

  // Object tracking
  private animatables: Animatable[] = [];
  private disposables: Disposable[] = [];
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
    this.backgrounds = new BackgroundManager(this.scene, this.renderer);
    this.lights = new LightManager(this.scene);
    this.controls = new ControlsManager(this.camera, this.renderer);
    this.layout = new LayoutManager(this.renderer, this.camera);

    // Default fullscreen layout
    this.layout.setFullscreen();
  }

  /**
   * Add an object to the app
   * Automatically detects and registers animate/dispose methods
   */
  add(obj: any): this {
    // 1. Add to scene if renderable
    if (obj.mesh || obj instanceof THREE.Object3D) {
      this.scene.add(obj.mesh || obj);
    }

    // 2. Add to animation if animatable
    if (obj.animate && typeof obj.animate === 'function') {
      this.animatables.push(obj);
    }

    // 3. Track for disposal
    if (obj.dispose || obj.geometry || obj.material) {
      this.disposables.push(obj);
    }

    return this;
  }

  /**
   * Remove an object from the app
   */
  remove(obj: any): void {
    // Remove from scene
    if (obj.mesh) {
      this.scene.remove(obj.mesh);
    } else if (obj instanceof THREE.Object3D) {
      this.scene.remove(obj);
    }

    // Remove from animation
    const animateIndex = this.animatables.indexOf(obj);
    if (animateIndex > -1) {
      this.animatables.splice(animateIndex, 1);
    }

    // Dispose resources
    this.disposeObject(obj);

    // Remove from tracking
    const dispIndex = this.disposables.indexOf(obj);
    if (dispIndex > -1) {
      this.disposables.splice(dispIndex, 1);
    }
  }

  /**
   * Remove and dispose all objects
   */
  clear(): void {
    // Dispose all tracked objects
    [...this.disposables].forEach(obj => this.remove(obj));

    // Clear scene
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }

    this.animatables = [];
    this.disposables = [];
    this.animateCallbacks = [];
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

  private disposeObject(obj: any): void {
    // Custom dispose method
    if (obj.dispose && typeof obj.dispose === 'function') {
      obj.dispose();
      return;
    }

    // Auto-dispose Three.js objects
    if (obj.geometry) {
      obj.geometry.dispose();
    }

    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
      } else {
        obj.material.dispose();
      }
    }

    // Recursively dispose mesh
    if (obj.mesh) {
      this.disposeObject(obj.mesh);
    }
  }

  /**
   * Main animation loop (private)
   */
  private animate = (time: number) => {
    requestAnimationFrame(this.animate);

    const delta = time - this.lastTime;
    this.lastTime = time;

    // Update controls
    this.controls.update();

    // Animate all registered objects
    this.animatables.forEach(obj => obj.animate(time, delta));

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
    this.backgrounds.dispose();
    this.lights.dispose();
    this.controls.dispose();
    this.layout.dispose();
  }
}
