import * as THREE from 'three';
import { AssetManager } from './AssetManager';
import { DebugManager } from './DebugManager';
import { BackgroundManager } from './BackgroundManager';
import { LightManager } from './LightManager';
import { ControlsManager } from './ControlsManager';
import { LayoutManager } from './LayoutManager';
import { ParameterManager } from './ParameterManager';
import { SelectionManager } from './SelectionManager';
import { Params } from '../Params';
import type { AnimateCallback, AppOptions, Animatable, Disposable, AddOptions, ParamOptions, ToneMappingType, ColorSpace, ShadowConfig } from '../types';

export class App {
  // Three.js core
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;

  // Managers
  assets: AssetManager;
  debug: DebugManager;
  backgrounds: BackgroundManager;
  lights: LightManager;
  controls: ControlsManager;
  layout: LayoutManager;
  params: ParameterManager;
  selection: SelectionManager;

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

    // Create and configure renderer
    this.renderer = this.createRenderer(options);

    // Initialize foundation managers first
    this.assets = new AssetManager();
    this.debug = new DebugManager(this.scene, this.renderer);

    // Initialize other managers
    this.backgrounds = new BackgroundManager(this.scene, this.renderer);
    this.lights = new LightManager(this.scene);
    this.controls = new ControlsManager(this.camera, this.renderer);
    this.layout = new LayoutManager(this.renderer, this.camera);
    this.params = new ParameterManager();
    this.selection = new SelectionManager(this.scene, this.camera, this.renderer.domElement);

    // Default fullscreen layout
    this.layout.setFullscreen();

    // Enable debug in development (can be disabled via options)
    if (options.debug !== false) {
      this.debug.enable();
    }
  }

  /**
   * Add an object to the app
   * Automatically detects and registers animate/dispose methods
   */
  add(obj: any, options?: AddOptions): this {
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

    // 4. Handle parameters
    if (obj.params instanceof Params) {
      this.handleParams(obj, options);
    }

    // 5. Set values without exposing
    if (options?.set) {
      Object.entries(options.set).forEach(([key, value]) => {
        if (obj.params) {
          obj.params.set(key, value);
        } else {
          obj[key] = value;
        }
      });
    }

    return this;
  }

  private handleParams(obj: any, options?: AddOptions): void {
    const paramConfig = options?.params;

    if (paramConfig === undefined || paramConfig === false) {
      return;
    }

    if (paramConfig === true) {
      this.params.exposeAll(obj.params);
      return;
    }

    if (Array.isArray(paramConfig)) {
      paramConfig.forEach(name => {
        this.params.expose(obj.params, name);
      });
      return;
    }

    if (typeof paramConfig === 'object') {
      Object.entries(paramConfig).forEach(([name, config]) => {
        if (config === true) {
          this.params.expose(obj.params, name);
        } else {
          this.params.expose(obj.params, name, config as ParamOptions);
        }
      });
    }
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

    // Update debug stats
    this.debug.update();

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
   * Create and configure WebGL renderer
   */
  private createRenderer(options: AppOptions): THREE.WebGLRenderer {
    // Create renderer with WebGL context options
    const renderer = new THREE.WebGLRenderer({
      antialias: options.antialias ?? true,
      alpha: options.alpha ?? false,
      powerPreference: options.powerPreference ?? 'default'
    });

    // Configure shadows
    this.configureShadows(renderer, options.shadows);

    // Configure tone mapping
    renderer.toneMapping = this.getToneMappingType(options.toneMapping ?? 'aces');
    renderer.toneMappingExposure = options.toneMappingExposure ?? 1;

    // Configure color space
    renderer.outputColorSpace = this.getColorSpace(options.colorSpace ?? 'srgb');

    // Physically correct lights (deprecated in newer Three.js but kept for compatibility)
    if (options.physicallyCorrectLights !== undefined) {
      (renderer as any).physicallyCorrectLights = options.physicallyCorrectLights;
    }

    return renderer;
  }

  /**
   * Configure shadow map settings
   */
  private configureShadows(renderer: THREE.WebGLRenderer, shadows?: boolean | ShadowConfig): void {
    if (shadows === undefined || shadows === false) {
      renderer.shadowMap.enabled = false;
      return;
    }

    if (shadows === true) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      return;
    }

    // Detailed shadow configuration
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = this.getShadowMapType(shadows.type ?? 'pcfsoft');

    if (shadows.autoUpdate !== undefined) {
      renderer.shadowMap.autoUpdate = shadows.autoUpdate;
    }
  }

  /**
   * Map shadow type string to Three.js constant
   */
  private getShadowMapType(type: 'basic' | 'pcf' | 'pcfsoft' | 'vsm'): THREE.ShadowMapType {
    const types = {
      'basic': THREE.BasicShadowMap,
      'pcf': THREE.PCFShadowMap,
      'pcfsoft': THREE.PCFSoftShadowMap,
      'vsm': THREE.VSMShadowMap
    };
    return types[type];
  }

  /**
   * Map tone mapping type string to Three.js constant
   */
  private getToneMappingType(type: ToneMappingType): THREE.ToneMapping {
    const types = {
      'none': THREE.NoToneMapping,
      'linear': THREE.LinearToneMapping,
      'reinhard': THREE.ReinhardToneMapping,
      'cineon': THREE.CineonToneMapping,
      'aces': THREE.ACESFilmicToneMapping,
      'neutral': THREE.NeutralToneMapping
    };
    return types[type];
  }

  /**
   * Map color space string to Three.js constant
   */
  private getColorSpace(space: ColorSpace): THREE.ColorSpace {
    const spaces: Record<ColorSpace, THREE.ColorSpace> = {
      'srgb': THREE.SRGBColorSpace,
      'linear': THREE.LinearSRGBColorSpace,
      // DisplayP3ColorSpace might not be available in all Three.js versions
      'display-p3': (THREE as any).DisplayP3ColorSpace || THREE.SRGBColorSpace
    };
    return spaces[space];
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Dispose foundation managers
    this.assets.dispose();
    this.debug.disable();

    // Dispose other managers
    this.selection.dispose();
    this.renderer.dispose();
    this.backgrounds.dispose();
    this.lights.dispose();
    this.controls.dispose();
    this.layout.dispose();
  }
}
