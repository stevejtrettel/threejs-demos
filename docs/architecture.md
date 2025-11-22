# Math Demo Framework - Architecture Specification

## Table of Contents
1. [Philosophy & Goals](#philosophy--goals)
2. [Architecture Overview](#architecture-overview)
3. [Core Components](#core-components)
4. [Manager Specifications](#manager-specifications)
5. [Parameter System](#parameter-system)
6. [Animation & Lifecycle](#animation--lifecycle)
7. [Asset Management](#asset-management)
8. [Usage Patterns](#usage-patterns)
9. [File Structure](#file-structure)
10. [Build System](#build-system)

---

## Philosophy & Goals

### Design Principles

**Forgettable Framework**: The framework should be strong and stable enough to fade into the background. You should be able to focus on the mathematics, not the plumbing.

**Explicit Over Magical**: Avoid surprising behavior. If something happens (like a rebuild), it should be because you explicitly asked for it.

**Terminology Note**: We use `animate(time, delta)` for per-frame animation, aligning with Three.js conventions where the main render loop is called `animate()`. This is more descriptive than `update()` which could ambiguously refer to parameter updates, state updates, or rebuilds. Parameter-driven rebuilds use explicit `onChange` callbacks instead.

**Sync by Default**: The app itself is always synchronous. Asset loading (textures, HDRs) happens asynchronously in the background via Three.js, but the framework doesn't force you to `await` anything unless you specifically need a resource loaded before starting.

**Escape Hatches Everywhere**: Direct access to Three.js scene, camera, renderer. The framework is glue code, not a cage.

**Component Encapsulation**: Math objects define their own parameters and behavior. Scenes decide what to expose.

### Target Use Cases

- **Quick prototypes** (5 minutes before lecture)
- **Teaching demos** (clean, focused visualizations)
- **Research simulations** (complex differential equations, GR geodesics)
- **Mathematical art** (production-quality archival pieces)
- **Range**: Calc 1 animations to charged black hole simulations

### Non-Goals

- Not a general-purpose game engine
- Not trying to abstract Three.js away (it's your engine)
- Not building a visual editor
- Not handling physics/collision (unless it's your math)

---

## Architecture Overview

### The Coordinator Pattern

**App** is a lightweight coordinator that owns the Three.js core and delegates specialized concerns to managers.

```
┌─────────────────────────────────────┐
│             App                     │
│  ┌────────────────────────────┐    │
│  │ THREE.Scene                │    │
│  │ THREE.Camera               │    │
│  │ THREE.WebGLRenderer        │    │
│  └────────────────────────────┘    │
│                                     │
│  Delegates to:                      │
│  ├─ BackgroundManager              │
│  ├─ LightManager                   │
│  ├─ ControlsManager                │
│  ├─ LayoutManager                  │
│  └─ ParameterManager               │
│                                     │
│  Tracks:                            │
│  ├─ tickables[]  (animation)       │
│  └─ disposables[] (cleanup)        │
└─────────────────────────────────────┘
```

### Manager Responsibilities

Each manager:
- Owns a specific domain
- Has preset configurations
- Exposes methods to App
- Handles its own cleanup
- Can be bypassed (direct Three.js access)

---

## Core Components

### App Class

**Responsibilities:**
- Create and own Three.js scene, camera, renderer
- Initialize all managers
- Run the animation loop
- Track objects for animation and disposal
- Provide lifecycle methods (add, remove, clear)

**Core API:**

```typescript
class App {
  // Three.js core (public, direct access)
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  
  // Managers (public interfaces)
  backgrounds: BackgroundManager;
  lights: LightManager;
  controls: ControlsManager;
  layout: LayoutManager;
  params: ParameterManager;
  
  // Lifecycle
  constructor(options?: AppOptions);
  add(object: any, options?: AddOptions): this;
  remove(object: any): void;
  clear(): void;
  dispose(): void;
  start(): void;
  
  // Utilities
  addAnimateCallback(fn: AnimateCallback): void;
}

interface AppOptions {
  // Camera options
  fov?: number;
  near?: number;
  far?: number;
  
  // Renderer options
  antialias?: boolean;
  alpha?: boolean;
  
  // Quick setup
  layout?: 'fullscreen' | LayoutConfig;
  background?: string;
  lights?: string;
  controls?: string;
}
```

**Constructor Implementation:**

```typescript
class App {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  
  backgrounds: BackgroundManager;
  lights: LightManager;
  controls: ControlsManager;
  layout: LayoutManager;
  params: ParameterManager;
  
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
    this.params = new ParameterManager();
    
    // Apply quick setup options
    if (options.layout) {
      if (typeof options.layout === 'string') {
        this.layout.set(options.layout);
      } else {
        this.layout.setCustom(options.layout);
      }
    } else {
      this.layout.setFullscreen();
    }
    
    if (options.background) {
      this.backgrounds.setColor(0x000000); // Default until loaded
    }
    
    if (options.lights) {
      this.lights.set(options.lights);
    }
    
    if (options.controls) {
      this.controls.set(options.controls);
    }
  }
}
```

**Add Method Implementation:**

```typescript
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
  if (obj.params instanceof ComponentParams) {
    this.handleComponentParams(obj, options);
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

private handleComponentParams(obj: any, options?: AddOptions) {
  const paramConfig = options?.params;
  
  // Default: don't auto-expose (opt-in)
  if (paramConfig === undefined || paramConfig === false) {
    return;
  }
  
  // Expose all: params: true
  if (paramConfig === true) {
    this.params.exposeAll(obj.params);
    return;
  }
  
  // Expose specific: params: ['radius', 'color']
  if (Array.isArray(paramConfig)) {
    paramConfig.forEach(name => {
      this.params.expose(obj.params, name);
    });
    return;
  }
  
  // Expose with overrides: params: { radius: { min: 0.05 }, color: true }
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
```

**Remove Method Implementation:**

```typescript
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
  
  // Dispose textures
  if (obj.material?.map) obj.material.map.dispose();
  if (obj.material?.normalMap) obj.material.normalMap.dispose();
  if (obj.material?.envMap) obj.material.envMap.dispose();
  
  // Recursively dispose mesh
  if (obj.mesh) {
    this.disposeObject(obj.mesh);
  }
}
```

**Animation Loop:**

```typescript
private animate = (time: number) => {
  requestAnimationFrame(this.animate);
  
  const delta = time - this.lastTime;
  this.lastTime = time;
  
  // Update controls
  this.controls.update(delta);
  
  // Tick all registered objects
  this.tickables.forEach(obj => obj.tick(time, delta));
  
  // Execute update callbacks
  this.updateCallbacks.forEach(fn => fn(time, delta));
  
  // Render
  this.renderer.render(this.scene, this.camera);
}

start(): void {
  this.animate(0);
}

addAnimateCallback(fn: AnimateCallback): void {
  this.animateCallbacks.push(fn);
}
```

**Clear and Dispose:**

```typescript
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

dispose(): void {
  this.clear();
  this.renderer.dispose();
  this.layout.dispose();
  this.controls.dispose();
  this.backgrounds.dispose();
  this.lights.dispose();
}
```

---

## Manager Specifications

### BackgroundManager

**Responsibilities:**
- Set solid color backgrounds (instant)
- Create procedural backgrounds (gradients, starfields)
- Load HDR/EXR environment maps
- Manage PMREMGenerator for IBL

**API:**

```typescript
class BackgroundManager {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private pmremGenerator: THREE.PMREMGenerator;
  private rgbeLoader: RGBELoader;
  private currentEnvMap?: THREE.Texture;
  
  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.rgbeLoader = new RGBELoader();
  }
  
  // Instant backgrounds
  setColor(color: number): void {
    this.scene.background = new THREE.Color(color);
  }
  
  setGradient(color1: string, color2: string): void {
    this.scene.background = this.createGradient(color1, color2);
  }
  
  setStarfield(options?: StarfieldOptions): void {
    this.scene.background = this.createStarfield(options);
  }
  
  // Async HDR loading (fire-and-forget)
  loadHDR(url: string, asEnvironment = true, asBackground = true): void {
    this.rgbeLoader.load(url, (texture) => {
      const envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
      
      if (asEnvironment) {
        this.scene.environment = envMap;
      }
      if (asBackground) {
        this.scene.background = envMap;
      }
      
      this.currentEnvMap = envMap;
      texture.dispose();
    });
  }
  
  // Await if needed
  async loadHDRAsync(url: string, asEnvironment = true, asBackground = true): Promise<THREE.Texture> {
    const texture = await this.rgbeLoader.loadAsync(url);
    const envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
    
    if (asEnvironment) {
      this.scene.environment = envMap;
    }
    if (asBackground) {
      this.scene.background = envMap;
    }
    
    this.currentEnvMap = envMap;
    texture.dispose();
    
    return envMap;
  }
  
  // Preset system
  set(preset: string): void {
    switch (preset) {
      case 'black':
        this.setColor(0x000000);
        break;
      case 'white':
        this.setColor(0xffffff);
        break;
      case 'gray':
        this.setColor(0x808080);
        break;
      case 'gradient':
        this.setGradient('#1a1a2e', '#16213e');
        break;
      case 'stars':
        this.setStarfield();
        break;
      default:
        console.warn(`Unknown background preset: ${preset}`);
    }
  }
  
  private createGradient(color1: string, color2: string): THREE.Texture {
    // Create canvas gradient
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }
  
  private createStarfield(options?: StarfieldOptions): THREE.Texture {
    const opts = {
      count: 2000,
      size: 2,
      ...options
    };
    
    // Create canvas with random stars
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 2048, 2048);
    
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < opts.count; i++) {
      const x = Math.random() * 2048;
      const y = Math.random() * 2048;
      const radius = Math.random() * opts.size;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }
  
  dispose(): void {
    this.currentEnvMap?.dispose();
    this.pmremGenerator.dispose();
  }
}

interface StarfieldOptions {
  count?: number;
  size?: number;
}
```

### LightManager

**Responsibilities:**
- Preset lighting rigs
- Add/remove custom lights
- Track lights for cleanup

**API:**

```typescript
class LightManager {
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
        // No lights
        break;
      default:
        console.warn(`Unknown light preset: ${preset}`);
    }
  }
  
  private setThreePoint(): void {
    // Key light
    const key = new THREE.DirectionalLight(0xffffff, 1);
    key.position.set(5, 5, 5);
    
    // Fill light
    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-5, 0, -5);
    
    // Back light
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
```

### ControlsManager

**Responsibilities:**
- Initialize controls (Orbit, Fly, etc.)
- Update controls in animation loop
- Dispose controls properly

**API:**

```typescript
class ControlsManager {
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private currentControls?: OrbitControls | FlyControls;
  
  constructor(camera: THREE.Camera, renderer: THREE.WebGLRenderer) {
    this.camera = camera;
    this.domElement = renderer.domElement;
  }
  
  set(preset: string, options?: any): void {
    switch (preset) {
      case 'orbit':
        this.setOrbit(options);
        break;
      case 'fly':
        this.setFly(options);
        break;
      case 'trackball':
        this.setTrackball(options);
        break;
      case 'none':
        this.dispose();
        break;
      default:
        console.warn(`Unknown controls preset: ${preset}`);
    }
  }
  
  setOrbit(options?: Partial<OrbitControls>): void {
    this.dispose();
    this.currentControls = new OrbitControls(this.camera, this.domElement);
    
    // Apply options
    if (options) {
      Object.assign(this.currentControls, options);
    }
  }
  
  setFly(options?: any): void {
    this.dispose();
    this.currentControls = new FlyControls(this.camera, this.domElement);
    
    if (options) {
      Object.assign(this.currentControls, options);
    }
  }
  
  setTrackball(options?: any): void {
    this.dispose();
    this.currentControls = new TrackballControls(this.camera, this.domElement);
    
    if (options) {
      Object.assign(this.currentControls, options);
    }
  }
  
  update(delta: number): void {
    if (this.currentControls) {
      // OrbitControls uses update(), FlyControls uses update(delta)
      if ('update' in this.currentControls) {
        (this.currentControls as any).update(delta);
      }
    }
  }
  
  dispose(): void {
    if (this.currentControls?.dispose) {
      this.currentControls.dispose();
      this.currentControls = undefined;
    }
  }
}
```

### LayoutManager

**Responsibilities:**
- Fullscreen mode with window resize
- Fixed size mode
- Custom CSS-driven layouts
- Handle camera aspect ratio updates

**API:**

```typescript
class LayoutManager {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private resizeObserver?: ResizeObserver;
  private resizeListener?: () => void;
  
  constructor(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.camera = camera;
  }
  
  set(preset: string): void {
    switch (preset) {
      case 'fullscreen':
        this.setFullscreen();
        break;
      case 'fixed':
        console.warn('Use setFixed(width, height, container) instead');
        break;
      case 'custom':
        console.warn('Use setCustom(config) instead');
        break;
      default:
        console.warn(`Unknown layout preset: ${preset}`);
    }
  }
  
  setFullscreen(): void {
    this.dispose();
    
    // Set initial size
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    
    // Append to body
    document.body.appendChild(this.renderer.domElement);
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    
    // Listen for resize
    this.resizeListener = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };
    
    window.addEventListener('resize', this.resizeListener);
  }
  
  setFixed(width: number, height: number, container: HTMLElement | string): void {
    this.dispose();
    
    const containerEl = typeof container === 'string'
      ? document.querySelector(container) as HTMLElement
      : container;
      
    if (!containerEl) {
      throw new Error('Container not found');
    }
    
    // Set size
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
    // Append to container
    containerEl.appendChild(this.renderer.domElement);
  }
  
  setCustom(config: CustomLayoutConfig): void {
    this.dispose();
    
    const container = typeof config.container === 'string'
      ? document.querySelector(config.container) as HTMLElement
      : config.container;
      
    if (!container) {
      throw new Error('Container not found');
    }
    
    // Append to container
    container.appendChild(this.renderer.domElement);
    
    // Observe container size changes
    this.resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      
      this.camera.aspect = rect.width / rect.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(rect.width, rect.height);
      
      // Call custom resize handler if provided
      if (config.onResize) {
        config.onResize(rect.width, rect.height);
      }
    });
    
    this.resizeObserver.observe(container);
    
    // Trigger initial resize
    const rect = container.getBoundingClientRect();
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height);
  }
  
  dispose(): void {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = undefined;
    }
    
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }
  }
}

interface CustomLayoutConfig {
  container: HTMLElement | string;
  onResize?: (width: number, height: number) => void;
}
```

---

## Parameter System

### ComponentParams Class

**Purpose:** Allow components to define their own parameters internally.

**API:**

```typescript
class ComponentParams {
  private owner: any;
  private params = new Map<string, ParamDefinition>();
  
  constructor(owner: any) {
    this.owner = owner;
  }
  
  define(name: string, defaultValue: any, options: ParamOptions): void {
    // Create reactive property on owner
    let currentValue = defaultValue;
    
    Object.defineProperty(this.owner, name, {
      get() { return currentValue; },
      set(value) {
        const oldValue = currentValue;
        currentValue = value;
        
        if (options.onChange && oldValue !== value) {
          options.onChange(value);
        }
      },
      enumerable: true,
      configurable: true
    });
    
    // Store definition for later exposure
    this.params.set(name, {
      name,
      defaultValue,
      options
    });
  }
  
  get(name: string): any {
    return this.owner[name];
  }
  
  set(name: string, value: any): void {
    this.owner[name] = value;  // Triggers onChange
  }
  
  has(name: string): boolean {
    return this.params.has(name);
  }
  
  getDefinition(name: string): ParamDefinition | undefined {
    return this.params.get(name);
  }
  
  getAllDefinitions(): Map<string, ParamDefinition> {
    return this.params;
  }
}

interface ParamDefinition {
  name: string;
  defaultValue: any;
  options: ParamOptions;
}
```

### ParameterManager Class

**Purpose:** Register parameters for UI generation and manage ad-hoc parameters.

**API:**

```typescript
class ParameterManager {
  private registeredParams: RegisteredParam[] = [];
  
  // Ad-hoc parameter registration
  add(object: any, property: string, options: ParamOptions): void {
    const originalValue = object[property];
    let currentValue = originalValue;
    
    // Create reactive property
    Object.defineProperty(object, property, {
      get() { return currentValue; },
      set(value) {
        const oldValue = currentValue;
        currentValue = value;
        
        if (options.onChange && oldValue !== value) {
          options.onChange(value);
        }
      },
      enumerable: true,
      configurable: true
    });
    
    // Register for UI
    this.registeredParams.push({
      object,
      property,
      options,
      type: 'adhoc'
    });
  }
  
  // Expose component parameter
  expose(componentParams: ComponentParams, paramName: string, overrideOptions?: Partial<ParamOptions>): void {
    const definition = componentParams.getDefinition(paramName);
    if (!definition) {
      console.warn(`Parameter ${paramName} not found in component`);
      return;
    }
    
    // Merge options (overrides take precedence)
    const finalOptions = {
      ...definition.options,
      ...overrideOptions
    };
    
    // Register for UI
    this.registeredParams.push({
      object: (componentParams as any).owner,
      property: paramName,
      options: finalOptions,
      type: 'component'
    });
  }
  
  // Expose all component parameters
  exposeAll(componentParams: ComponentParams, prefix?: string): void {
    componentParams.getAllDefinitions().forEach((def, name) => {
      this.expose(componentParams, name);
    });
  }
  
  // Expose multiple specific parameters
  exposeMultiple(componentParams: ComponentParams, paramNames: string[]): void {
    paramNames.forEach(name => this.expose(componentParams, name));
  }
  
  // Helper methods for common patterns
  addPosition(object: THREE.Object3D, options?: Partial<ParamOptions>): void {
    const defaults = { min: -10, max: 10, ...options };
    
    this.add(object.position, 'x', { ...defaults, label: 'Position X' });
    this.add(object.position, 'y', { ...defaults, label: 'Position Y' });
    this.add(object.position, 'z', { ...defaults, label: 'Position Z' });
  }
  
  addRotation(object: THREE.Object3D, options?: Partial<ParamOptions>): void {
    const defaults = { min: 0, max: Math.PI * 2, ...options };
    
    this.add(object.rotation, 'x', { ...defaults, label: 'Rotation X' });
    this.add(object.rotation, 'y', { ...defaults, label: 'Rotation Y' });
    this.add(object.rotation, 'z', { ...defaults, label: 'Rotation Z' });
  }
  
  addScale(object: THREE.Object3D, options?: Partial<ParamOptions>): void {
    const defaults = { min: 0.1, max: 5, ...options };
    
    this.add(object.scale, 'x', { ...defaults, label: 'Scale X' });
    this.add(object.scale, 'y', { ...defaults, label: 'Scale Y' });
    this.add(object.scale, 'z', { ...defaults, label: 'Scale Z' });
  }
  
  addColor(material: THREE.Material, options?: Partial<ParamOptions>): void {
    this.add(material, 'color', {
      type: 'color',
      onChange: (v) => (material as any).color.setHex(v),
      label: 'Color',
      ...options
    });
  }
  
  // Get all registered parameters (for UI generation)
  getAll(): RegisteredParam[] {
    return this.registeredParams;
  }
  
  // Clear all parameters
  clear(): void {
    this.registeredParams = [];
  }
}

interface RegisteredParam {
  object: any;
  property: string;
  options: ParamOptions;
  type: 'adhoc' | 'component';
}
```

---

## Animation & Lifecycle

### Animation Loop

The App runs a single `requestAnimationFrame` loop that:

1. Updates controls
2. Animates all registered objects
3. Executes animate callbacks
4. Renders the scene

```typescript
private animate = (time: number) => {
  requestAnimationFrame(this.animate);
  
  const delta = time - this.lastTime;
  this.lastTime = time;
  
  // 1. Update controls
  this.controls.update(delta);
  
  // 2. Animate all registered objects
  this.animatables.forEach(obj => obj.animate(time, delta));
  
  // 3. Execute callbacks
  this.animateCallbacks.forEach(fn => fn(time, delta));
  
  // 4. Render
  this.renderer.render(this.scene, this.camera);
}
```

### Object Lifecycle

**1. Creation:**
```typescript
const geo = new Geodesic(metric, initial);
```

**2. Registration:**
```typescript
app.add(geo, { params: ['radius', 'mass'] });
```

What happens:
- `geo.mesh` added to scene
- `geo.animate` registered for animation
- `geo.params.radius` and `geo.params.mass` exposed to UI
- `geo` tracked for disposal

**3. Animation:**
```typescript
geo.animate(time, delta) {
  // Called every frame
  this.particle.advance(delta);
}
```

**4. Parameter Changes:**
```typescript
// User changes radius in UI
geo.radius = 0.2;  // Triggers onChange
```

**5. Removal:**
```typescript
app.remove(geo);
```

What happens:
- `geo.mesh` removed from scene
- `geo.animate` unregistered
- `geo.dispose()` called (or auto-disposal)
- Removed from tracking arrays

### Component Pattern

**Typical component structure:**

```typescript
class MyComponent {
  mesh: THREE.Mesh;
  params: ComponentParams;
  
  constructor() {
    this.params = new ComponentParams(this);
    
    // Define parameters
    this.params.define('paramName', defaultValue, {
      min: 0,
      max: 10,
      onChange: (value) => this.handleChange(value)
    });
    
    // Create Three.js objects
    this.mesh = new THREE.Mesh(geometry, material);
  }
  
  animate(time: number, delta: number) {
    // Animation logic
  }
  
  dispose() {
    // Cleanup
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
```

---

## Asset Management

### The Two-Phase Loading Pattern

**Important:** Asset loading in this framework has two distinct phases:

1. **Vite Import (Synchronous)** - Gets you the asset URL as a string
2. **Three.js Loading (Asynchronous)** - Loads the actual texture/model into GPU memory

This means your app can start immediately, and resources appear as they load.

### Vite Import Pattern

Assets are imported at the top of files. Vite resolves them to URLs at build time.

```typescript
// Import gives you the URL as a string (SYNC)
import studioHDR from './assets/studio.hdr';
import texture from './assets/texture.jpg';
import model from './assets/model.glb';

// These are just strings at this point:
// - Dev: http://localhost:5173/demos/schwarzschild/assets/studio.hdr
// - Prod: /assets/studio-abc123.hdr (with hash)

console.log(typeof studioHDR); // "string"
```

**The import itself is synchronous** - you immediately have the URL. No `await` needed.

### Loading Pattern

**Fire-and-forget (recommended for most cases):**

```typescript
import studioHDR from './assets/studio.hdr';

const app = new App();

// This STARTS the load but doesn't wait
// Three.js loads in background, environment appears when ready
app.backgrounds.loadHDR(studioHDR);

// Start immediately - app runs while HDR loads
app.start();
```

**Await if you need the resource ready:**

```typescript
import studioHDR from './assets/studio.hdr';

const app = new App();

// Wait for HDR to fully load into GPU memory
await app.backgrounds.loadHDRAsync(studioHDR);

// Start with HDR already loaded and visible
app.start();
```

**Key insight:** 99% of the time, fire-and-forget is fine. The app starts immediately with a default background, then the HDR pops in when ready. This keeps everything feeling fast and responsive.

### Asset Organization

```
demos/
  schwarzschild/
    main.ts
    index.html
    assets/              # Demo-specific assets
      space.hdr
      star-texture.jpg
      
packages/
  core/
    assets/              # Shared preset assets
      environments/
        studio.hdr
        sunset.hdr
      textures/
        grid.png
```

**Importing shared assets:**

```typescript
import studioHDR from '@core/assets/environments/studio.hdr';
```

**Importing demo assets:**

```typescript
import spaceHDR from './assets/space.hdr';
```

---

## Usage Patterns

### Pattern 1: Quick Prototype

```typescript
import { App } from '@core/App';

const app = new App();
app.backgrounds.setColor(0x1a1a2e);
app.lights.set('ambient');
app.controls.setOrbit();
app.layout.setFullscreen();

const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(1),
  new THREE.MeshStandardMaterial({ color: 0xff0000 })
);
app.scene.add(sphere);

app.params.addPosition(sphere);

app.addAnimateCallback((time, delta) => {
  sphere.rotation.y += delta * 0.001;
});

app.start();
```

### Pattern 2: Component-Based

```typescript
import { App } from '@core/App';
import { Geodesic } from '../shared/Geodesic';
import studioHDR from './assets/studio.hdr';

const app = new App();
app.backgrounds.loadHDR(studioHDR);
app.lights.set('three-point');
app.controls.setOrbit({ enableDamping: true });
app.layout.setFullscreen();

const metric = { mass: 1, charge: 0 };

const geo = new Geodesic(metric, {
  position: [10, 0, 0],
  velocity: [0, 1, 0]
});

app.add(geo, {
  params: {
    mass: { min: 0.5, max: 5 },
    tubeRadius: true,
    pathColor: true
  }
});

app.start();
```

### Pattern 3: Multiple Components

```typescript
import { App } from '@core/App';
import { BlackHole } from '../shared/BlackHole';
import { Geodesic } from '../shared/Geodesic';

const app = new App();
app.backgrounds.setColor(0x000000);
app.lights.set('none');
app.controls.setOrbit();
app.layout.setFullscreen();

const blackHole = new BlackHole({ mass: 1 });
app.add(blackHole, { params: ['mass', 'glowIntensity'] });

// Create multiple geodesics
for (let i = 0; i < 10; i++) {
  const geo = new Geodesic(blackHole.metric, randomInitial());
  app.add(geo, { params: ['pathColor'] });
}

app.start();
```

### Pattern 4: Mixed Ad-hoc and Component

```typescript
const app = new App();

// Component parameters
const geo = new Geodesic(metric, initial);
app.add(geo, { params: ['tubeRadius'] });

// Ad-hoc parameters on same object
app.params.add(geo.mesh, 'visible', {
  type: 'boolean',
  label: 'Show Path',
  onChange: (v) => geo.mesh.visible = v
});

// External parameters
let timeScale = 1;
app.params.add({ timeScale }, 'timeScale', {
  min: 0, max: 5,
  label: 'Simulation Speed',
  onChange: (v) => timeScale = v
});

app.addAnimateCallback((time, delta) => {
  // Use timeScale in animation
  geo.advanceTime(delta * timeScale);
});

app.start();
```

### Pattern 5: Custom Layout

```typescript
const app = new App();

app.layout.setCustom({
  container: '#canvas-container',
  onResize: (width, height) => {
    console.log(`Canvas resized: ${width}x${height}`);
  }
});

// HTML:
// <div id="canvas-container" style="width: 800px; height: 600px;"></div>
```

---

## File Structure

```
math-demos/
├── packages/
│   └── core/                              # The framework
│       ├── src/
│       │   ├── App.ts                     # Main coordinator
│       │   ├── managers/
│       │   │   ├── BackgroundManager.ts
│       │   │   ├── LightManager.ts
│       │   │   ├── ControlsManager.ts
│       │   │   ├── LayoutManager.ts
│       │   │   └── ParameterManager.ts
│       │   ├── components/
│       │   │   └── ComponentParams.ts     # Internal parameter system
│       │   ├── math/                      # Reusable math utilities
│       │   │   ├── curves/
│       │   │   │   ├── ParametricCurve.ts
│       │   │   │   ├── BezierCurve.ts
│       │   │   │   └── index.ts
│       │   │   ├── surfaces/
│       │   │   │   ├── ParametricSurface.ts
│       │   │   │   └── index.ts
│       │   │   ├── integration/
│       │   │   │   ├── RungeKutta.ts
│       │   │   │   └── index.ts
│       │   │   └── shaders/
│       │   │       └── chunks/            # Reusable GLSL functions
│       │   │           ├── noise.glsl
│       │   │           └── math.glsl
│       │   ├── types.ts                   # TypeScript interfaces
│       │   └── index.ts                   # Public API
│       ├── assets/                        # Bundled preset assets
│       │   └── environments/
│       │       ├── studio.hdr
│       │       └── sunset.hdr
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts
│
├── demos/
│   ├── calculus/
│   │   ├── shared/                        # Shared by calculus demos
│   │   │   ├── DerivativeVisualizer.ts
│   │   │   ├── IntegralVisualizer.ts
│   │   │   └── index.ts
│   │   ├── tangent-line/
│   │   │   ├── main.ts
│   │   │   ├── index.html
│   │   │   └── assets/
│   │   ├── riemann-sums/
│   │   │   ├── main.ts
│   │   │   ├── index.html
│   │   │   └── assets/
│   │   └── ... (more calculus demos)
│   │
│   ├── general-relativity/
│   │   ├── shared/                        # Shared GR utilities
│   │   │   ├── Geodesic.ts
│   │   │   ├── BlackHole.ts
│   │   │   ├── metrics/
│   │   │   │   ├── Schwarzschild.ts
│   │   │   │   ├── Kerr.ts
│   │   │   │   ├── ReissnerNordstrom.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   ├── schwarzschild/
│   │   │   ├── main.ts
│   │   │   ├── index.html
│   │   │   └── assets/
│   │   │       └── space.hdr
│   │   ├── kerr/
│   │   │   ├── main.ts
│   │   │   ├── index.html
│   │   │   └── assets/
│   │   └── ... (more GR demos)
│   │
│   ├── differential-geometry/
│   │   ├── shared/
│   │   ├── geodesics-on-surfaces/
│   │   │   ├── main.ts
│   │   │   └── index.html
│   │   └── ... (more diff geo demos)
│   │
│   └── ... (more topic folders)
│
├── scripts/                               # Optional build helpers
│   ├── new-demo.js                        # Template generator
│   └── build-demo.js                      # Custom build script
│
├── index.html                             # Dev entry point
├── package.json                           # Root workspace
├── tsconfig.json                          # Shared TypeScript config
├── vite.config.ts                         # Shared Vite config
└── README.md
```

**Key organizational principles:**

1. **Framework** (`packages/core/`) is self-contained
2. **Demos** organized by mathematical topic
3. **Shared code** within topic folders (e.g., `demos/calculus/shared/`)
4. **Assets** colocated with demos that use them
5. **Preset assets** bundled with framework

---

## Build System

### Development Workflow

**1. Select a demo:**

Edit `index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Math Demo</title>
</head>
<body>
  <script type="module" src="/demos/schwarzschild/main.ts"></script>
</body>
</html>
```

**2. Start dev server:**

```bash
npm run dev
```

Vite serves with hot module reloading (full page reload).

**3. Make changes:**

Edit `demos/schwarzschild/main.ts` → Browser reloads automatically.

### Production Build

**1. Point to demo in `index.html`:**

```html
<script type="module" src="/demos/schwarzschild/main.ts"></script>
```

**2. Build:**

```bash
npm run build
```

**3. Output:**

```
dist/
  index.html
  main-abc123.js           # Bundled, tree-shaken
  assets/
    studio-def456.hdr      # With content hash
    texture-ghi789.jpg
```

**4. Deploy:**

Copy entire `dist/` folder to website. Each demo gets its own `dist/` build.

### Vite Configuration

**Root `vite.config.ts`:**

```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './packages/core/src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined // Single bundle
      }
    }
  },
  assetsInclude: ['**/*.hdr', '**/*.exr']
});
```

### Package.json Scripts

**Root `package.json`:**

```json
{
  "name": "math-demos",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  },
  "dependencies": {
    "three": "^0.160.0"
  },
  "workspaces": [
    "packages/*"
  ]
}
```

**Core package `packages/core/package.json`:**

```json
{
  "name": "@core",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./math/*": "./src/math/*/index.ts"
  }
}
```

### TypeScript Configuration

**Root `tsconfig.json`:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "paths": {
      "@core": ["./packages/core/src"],
      "@core/*": ["./packages/core/src/*"]
    }
  },
  "include": ["packages/**/*", "demos/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Summary

This framework provides:

✅ **Minimal boilerplate** - focus on math, not plumbing
✅ **Component reuse** - define once, use everywhere
✅ **Flexible parameters** - internal definitions, selective exposure
✅ **Clean lifecycle** - add, tick, remove, dispose
✅ **Direct Three.js access** - no abstractions blocking you
✅ **Fast development** - edit HTML, reload, done
✅ **Production builds** - single bundled file per demo
✅ **Asset management** - Vite handles imports and bundling
✅ **Type safety** - TypeScript throughout

The framework is designed to be "forgettable" - learn it once, use it forever without thinking about it.