import * as THREE from 'three';
import { AssetManager } from './AssetManager';
import { DebugManager } from './DebugManager';
import { BackgroundManager } from './BackgroundManager';
import { ControlsManager } from './ControlsManager';
import { LayoutManager } from './LayoutManager';
import { ParameterManager } from './ParameterManager';
import { SelectionManager } from './SelectionManager';
import { TimelineManager } from './TimelineManager';
import { CameraManager } from './CameraManager';
import { ExportManager } from './ExportManager';
import { RenderManager } from './RenderManager';
import { Params } from '../Params';
import type { AnimateCallback, AppOptions, Animatable, Disposable, AddOptions, ParamOptions, ToneMappingType, ColorSpace, ShadowConfig } from '../types';

export class App {
  // Three.js core
  scene: THREE.Scene;
  renderManager: RenderManager;

  // Managers
  assets: AssetManager;
  debug: DebugManager;
  backgrounds: BackgroundManager;
  controls: ControlsManager;
  layout: LayoutManager;
  params: ParameterManager;
  selection: SelectionManager;
  timeline: TimelineManager;
  cameraManager: CameraManager;

  // Export (unified API for screenshots, video, geometry)
  export: ExportManager;

  // Object tracking
  private animatables: Animatable[] = [];
  private disposables: Disposable[] = [];
  private animateCallbacks: AnimateCallback[] = [];

  constructor(options: AppOptions = {}) {
    // Create Three.js core
    this.scene = new THREE.Scene();

    // Initialize Camera Manager
    this.cameraManager = new CameraManager({
      fov: options.fov,
      near: options.near,
      far: options.far
    });

    // Create render manager
    this.renderManager = new RenderManager({
      antialias: options.antialias ?? true,
      alpha: options.alpha ?? false,
      pathTracerDefaults: options.pathTracerDefaults
    });

    // Configure renderer
    this.configureRenderer(options);

    // Initialize foundation managers first
    this.assets = new AssetManager();
    this.debug = new DebugManager(this.scene, this.renderManager.renderer);
    this.timeline = new TimelineManager();

    // Initialize other managers
    this.backgrounds = new BackgroundManager(this.scene, this.renderManager.renderer);
    this.controls = new ControlsManager(this.cameraManager.camera, this.renderManager.renderer);
    this.layout = new LayoutManager(this.renderManager.renderer, this.cameraManager.camera);
    this.params = new ParameterManager();
    this.selection = new SelectionManager(this.scene, this.cameraManager.camera, this.renderManager.renderer.domElement);

    // Initialize export manager (unified API)
    this.export = new ExportManager(
      this.renderManager.renderer,
      this.scene,
      this.cameraManager.camera,
      this.timeline
    );

    // Default fullscreen layout
    this.layout.setFullscreen();

    // Enable debug in development (can be disabled via options)
    if (options.debug !== false) {
      this.debug.enable();
    }
  }

  /**
   * Get the main camera
   */
  get camera(): THREE.PerspectiveCamera {
    return this.cameraManager.camera;
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
    } else if (options?.animate) {
      // Allow attaching animation callback via options
      // We wrap the object to conform to Animatable interface
      const wrapper = {
        animate: options.animate
      };
      this.animatables.push(wrapper);
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
    } else if (Array.isArray(paramConfig)) {
      paramConfig.forEach(name => {
        this.params.expose(obj.params, name);
      });
    } else if (typeof paramConfig === 'object') {
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
    this.timeline.reset();

    // Clear parameters and sync UI
    this.params.clear();
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
   * Enable path tracing mode
   */
  enablePathTracing(options?: { bounces?: number; samples?: number }): void {
    // Swap to equirectangular textures for pathtracer
    const equirect = this.backgrounds.getEquirectEnvironment();
    if (equirect) {
      this.scene.environment = equirect;  // Pathtracer needs equirect for IBL
      this.scene.background = equirect;   // Pathtracer needs equirect for background
    }

    this.renderManager.switchToPathTracing(options);
  }

  /**
   * Disable path tracing mode (switch back to WebGL)
   */
  disablePathTracing(): void {
    // Swap back to PMREM textures for WebGL
    const pmrem = this.backgrounds.getPMREMEnvironment();
    if (pmrem) {
      this.scene.environment = pmrem;  // WebGL needs PMREM for IBL
      this.scene.background = pmrem;   // WebGL uses PMREM for background too
    }

    this.renderManager.switchToWebGL();
  }

  /**
   * Toggle path tracing on/off
   */
  togglePathTracing(): void {
    if (this.renderManager.isPathTracing()) {
      this.disablePathTracing();
    } else {
      this.enablePathTracing();
    }
  }

  /**
   * Notify that materials have changed while pathtracing is active
   *
   * NOTE: You usually DON'T need to call this!
   * Materials are automatically synced when you call enablePathTracing().
   *
   * Only use this if you change materials WHILE pathtracing is running (rare).
   *
   * @example
   * // Common workflow (no manual call needed!):
   * const texture = await app.assets.loadTexture('diffuse.png');
   * material.map = texture;
   * material.needsUpdate = true;
   * // Later...
   * app.enablePathTracing();  // ← Materials auto-synced!
   *
   * @example
   * // Rare case - changing materials during PT:
   * material.roughness = 0.5;
   * material.needsUpdate = true;
   * app.notifyMaterialsChanged();  // Only needed if PT is already active
   */
  notifyMaterialsChanged(): void {
    this.renderManager.notifyMaterialsChanged();
  }

  /**
   * Main animation loop
   */
  private animate = (timestamp: number) => {
    requestAnimationFrame(this.animate);

    // Update global time
    this.timeline.update(timestamp);
    const { time, delta } = this.timeline;

    // Update debug stats
    this.debug.update();

    // Update controls
    this.controls.update();

    // Animate all registered objects
    this.animatables.forEach((m: Animatable) => m.animate(time, delta));

    // Execute callbacks
    this.animateCallbacks.forEach(fn => fn(time, delta));

    // Render
    this.renderManager.render(this.scene, this.cameraManager.camera);
  }

  /**
   * Configure renderer settings
   */
  private configureRenderer(options: AppOptions): void {
    // Configure shadows
    this.configureShadows(this.renderManager.renderer, options.shadows);

    // Configure tone mapping
    this.renderManager.renderer.toneMapping = this.getToneMappingType(options.toneMapping ?? 'aces');
    this.renderManager.renderer.toneMappingExposure = options.toneMappingExposure ?? 1;

    // Configure color space
    this.renderManager.renderer.outputColorSpace = this.getColorSpace(options.colorSpace ?? 'srgb');

    // Physically correct lights (deprecated in newer Three.js but kept for compatibility)
    if (options.physicallyCorrectLights !== undefined) {
      (this.renderManager.renderer as any).physicallyCorrectLights = options.physicallyCorrectLights;
    }
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
   * Convenience method for quick screenshot
   *
   * @example
   *   app.screenshot();  // Downloads screenshot.png
   *   app.screenshot('my-render.png');
   */
  screenshot(filename?: string): void {
    this.export.screenshot({ filename });
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    // Dispose foundation managers
    this.assets.dispose();
    this.debug.disable();
    this.timeline.dispose();
    this.cameraManager.dispose();

    // Dispose export manager
    this.export.dispose();

    // Dispose other managers
    this.selection.dispose();
    this.renderManager.dispose();
    this.backgrounds.dispose();
    this.controls.dispose();
    this.layout.dispose();
  }
}
