# Math Demo Framework - Incremental Build Plan

This document provides a step-by-step implementation guide for building the framework from scratch. Each phase is independently testable and adds real value.

## Table of Contents
1. [Phase 0: Project Setup](#phase-0-project-setup)
2. [Phase 1: Minimal Viable App](#phase-1-minimal-viable-app)
3. [Phase 2: Scene Setup Managers](#phase-2-scene-setup-managers)
4. [Phase 3: Object Lifecycle](#phase-3-object-lifecycle)
5. [Phase 4: Parameter System Foundation](#phase-4-parameter-system-foundation)
6. [Phase 5: Parameter Helpers](#phase-5-parameter-helpers)
7. [Phase 6: Layout Variants](#phase-6-layout-variants)
8. [Phase 7: First Real Component](#phase-7-first-real-component)
9. [Phase 8: Build Reusable Library](#phase-8-build-reusable-library)

---

## Phase 0: Project Setup

**Goal:** Get the project structure and tooling in place.

### Files to Create

```
math-demos/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── packages/
│   └── core/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── (empty for now)
└── demos/
    └── test/
        ├── main.ts
        └── index.html
```

### Root package.json

```json
{
  "name": "math-demos",
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "devDependencies": {
    "@types/three": "^0.160.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0"
  },
  "dependencies": {
    "three": "^0.160.0"
  }
}
```

### Root tsconfig.json

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

### vite.config.ts

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
        manualChunks: undefined
      }
    }
  },
  assetsInclude: ['**/*.hdr', '**/*.exr']
});
```

### packages/core/package.json

```json
{
  "name": "@core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./App": "./src/App.ts",
    "./types": "./src/types.ts"
  }
}
```

### Root index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Math Demo</title>
  <style>
    body { margin: 0; overflow: hidden; }
  </style>
</head>
<body>
  <!-- Change this path to switch demos -->
  <script type="module" src="/demos/test/main.ts"></script>
</body>
</html>
```

### Installation

```bash
npm install
```

### Success Criteria

- ✅ `npm install` completes without errors
- ✅ TypeScript paths resolve correctly
- ✅ Workspace setup works

---

## Phase 1: Minimal Viable App

**Goal:** Get a spinning cube on screen to prove the entire pipeline works.

**Dependencies:** Phase 0

### Files to Create

```
packages/core/src/
├── App.ts
├── types.ts
├── index.ts
└── managers/
    └── LayoutManager.ts
```

### packages/core/src/types.ts

```typescript
import * as THREE from 'three';

export interface Animatable {
  animate(time: number, delta: number): void;
}

export interface Disposable {
  dispose(): void;
}

export interface Renderable {
  mesh?: THREE.Object3D;
}

export type AnimateCallback = (time: number, delta: number) => void;

export interface AppOptions {
  fov?: number;
  near?: number;
  far?: number;
  antialias?: boolean;
  alpha?: boolean;
}
```

### packages/core/src/managers/LayoutManager.ts

```typescript
import * as THREE from 'three';

export class LayoutManager {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private resizeListener?: () => void;
  
  constructor(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.camera = camera;
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
  
  dispose(): void {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = undefined;
    }
  }
}
```

### packages/core/src/App.ts

```typescript
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
```

### packages/core/src/index.ts

```typescript
export { App } from './App';
export * from './types';
```

### demos/test/main.ts

```typescript
import * as THREE from 'three';
import { App } from '@/App';

const app = new App();

// Create a spinning cube
const geometry = new THREE.BoxGeometry();
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const cube = new THREE.Mesh(geometry, material);

app.scene.add(cube);

// Animate it
app.addAnimateCallback((time, delta) => {
  cube.rotation.x += delta * 0.001;
  cube.rotation.y += delta * 0.001;
});

app.start();
```

### Test It

```bash
npm run dev
```

Open browser to `http://localhost:5173`

### Success Criteria

- ✅ Red cube appears on screen
- ✅ Cube spins smoothly
- ✅ Window resize works (cube stays centered)
- ✅ No console errors

### Troubleshooting

**Problem:** "Cannot find module '@core/App'"
- Check tsconfig.json paths
- Check vite.config.ts alias
- Restart Vite dev server

**Problem:** Black screen
- Check browser console for errors
- Verify camera position (z > 0)
- Check renderer is appended to DOM

---

## Phase 2: Scene Setup Managers

**Goal:** Make scene setup frictionless with preset managers.

**Dependencies:** Phase 1

### Files to Create

```
packages/core/src/managers/
├── BackgroundManager.ts
├── LightManager.ts
└── ControlsManager.ts
```

### packages/core/src/managers/BackgroundManager.ts

```typescript
import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';

export interface StarfieldOptions {
  count?: number;
  size?: number;
}

export class BackgroundManager {
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
  
  setColor(color: number): void {
    this.scene.background = new THREE.Color(color);
  }
  
  setGradient(color1: string, color2: string): void {
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
    this.scene.background = texture;
  }
  
  setStarfield(options: StarfieldOptions = {}): void {
    const { count = 2000, size = 2 } = options;
    
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;
    
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 2048, 2048);
    
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 2048;
      const y = Math.random() * 2048;
      const radius = Math.random() * size;
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    this.scene.background = texture;
  }
  
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
  
  dispose(): void {
    this.currentEnvMap?.dispose();
    this.pmremGenerator.dispose();
  }
}
```

### packages/core/src/managers/LightManager.ts

```typescript
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
```

### packages/core/src/managers/ControlsManager.ts

```typescript
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

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
  
  update(delta: number): void {
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
```

### Update App.ts

Add managers to App class:

```typescript
import { BackgroundManager } from './managers/BackgroundManager';
import { LightManager } from './managers/LightManager';
import { ControlsManager } from './managers/ControlsManager';

export class App {
  // ... existing properties
  
  backgrounds: BackgroundManager;
  lights: LightManager;
  controls: ControlsManager;
  
  constructor(options: AppOptions = {}) {
    // ... existing Three.js setup
    
    // Initialize managers
    this.backgrounds = new BackgroundManager(this.scene, this.renderer);
    this.lights = new LightManager(this.scene);
    this.controls = new ControlsManager(this.camera, this.renderer);
    this.layout = new LayoutManager(this.renderer, this.camera);
    
    this.layout.setFullscreen();
  }
  
  private animate = (time: number) => {
    requestAnimationFrame(this.animate);
    
    const delta = time - this.lastTime;
    this.lastTime = time;
    
    // Update controls
    this.controls.update(delta);
    
    // Execute callbacks
    this.animateCallbacks.forEach(fn => fn(time, delta));
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
  
  dispose(): void {
    this.renderer.dispose();
    this.backgrounds.dispose();
    this.lights.dispose();
    this.controls.dispose();
    this.layout.dispose();
  }
}
```

### Update demos/test/main.ts

```typescript
import * as THREE from 'three';
import { App } from '@/App';

const app = new App();

// Setup scene
app.backgrounds.setGradient('#1a1a2e', '#16213e');
app.lights.set('three-point');
app.controls.setOrbit();

// Create geometry with proper material
const geometry = new THREE.SphereGeometry(1, 32, 32);
const material = new THREE.MeshStandardMaterial({ 
  color: 0xff0000,
  roughness: 0.5,
  metalness: 0.5
});
const sphere = new THREE.Mesh(geometry, material);

app.scene.add(sphere);

app.addAnimateCallback((time, delta) => {
  sphere.rotation.y += delta * 0.001;
});

app.start();
```

### Test It

```bash
npm run dev
```

### Success Criteria

- ✅ Gradient background appears
- ✅ Sphere is properly lit (not black)
- ✅ Orbit controls work (drag to rotate, scroll to zoom)
- ✅ Can switch background: `app.backgrounds.setColor(0x000000)`
- ✅ Can switch lights: `app.lights.set('ambient')`

---

## Phase 3: Object Lifecycle

**Goal:** Smart object management with `add()`, `remove()`, and automatic disposal.

**Dependencies:** Phase 2

### Update types.ts

Add interfaces for object lifecycle:

```typescript
export interface MathComponent extends 
  Partial<Animatable>, 
  Partial<Disposable>, 
  Partial<Renderable> {
}
```

### Update App.ts

Add object tracking and lifecycle methods:

```typescript
export class App {
  // ... existing properties
  
  private animatables: Animatable[] = [];
  private disposables: Disposable[] = [];
  
  // ... existing methods
  
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
  
  private animate = (time: number) => {
    requestAnimationFrame(this.animate);
    
    const delta = time - this.lastTime;
    this.lastTime = time;
    
    // Update controls
    this.controls.update(delta);
    
    // Animate all registered objects
    this.animatables.forEach(obj => obj.animate(time, delta));
    
    // Execute callbacks
    this.animateCallbacks.forEach(fn => fn(time, delta));
    
    // Render
    this.renderer.render(this.scene, this.camera);
  }
}
```

### Create Test Component

Create `demos/test/TestComponent.ts`:

```typescript
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
```

### Update demos/test/main.ts

```typescript
import { App } from '@/App';
import { SpinningSphere } from './TestComponent';

const app = new App();

app.backgrounds.setColor(0x1a1a2e);
app.lights.set('three-point');
app.controls.setOrbit();

// Add multiple spheres using app.add()
const spheres: SpinningSphere[] = [];
for (let i = 0; i < 5; i++) {
  const sphere = new SpinningSphere(Math.random() + 0.5);
  app.add(sphere);  // Automatically adds to scene and animation!
  spheres.push(sphere);
}

app.start();

// Test removal after 3 seconds
setTimeout(() => {
  console.log('Removing first sphere...');
  app.remove(spheres[0]);
}, 3000);

// Test clear after 6 seconds
setTimeout(() => {
  console.log('Clearing all...');
  app.clear();
}, 6000);
```

### Test It

```bash
npm run dev
```

### Success Criteria

- ✅ 5 colored spheres appear and spin
- ✅ After 3 seconds, first sphere disappears
- ✅ After 6 seconds, all spheres disappear
- ✅ No console errors
- ✅ No memory leaks (check browser dev tools memory)

---

## Phase 4: Parameter System Foundation

**Goal:** Build the reactive parameter system without UI.

**Dependencies:** Phase 3

### Files to Create

```
packages/core/src/
├── components/
│   └── ComponentParams.ts
└── managers/
    └── ParameterManager.ts
```

### packages/core/src/types.ts

Add parameter types:

```typescript
export interface ParamOptions {
  min?: number;
  max?: number;
  step?: number;
  type?: 'number' | 'boolean' | 'color' | 'string';
  label?: string;
  folder?: string;
  onChange?: (value: any) => void;
}

export interface ParamDefinition {
  name: string;
  defaultValue: any;
  options: ParamOptions;
}

export interface AddOptions {
  params?: boolean | string[] | Record<string, boolean | ParamOptions>;
  set?: Record<string, any>;
}
```

### packages/core/src/components/ComponentParams.ts

```typescript
import type { ParamOptions, ParamDefinition } from '../types';

export class ComponentParams {
  private owner: any;
  private params = new Map<string, ParamDefinition>();
  
  constructor(owner: any) {
    this.owner = owner;
  }
  
  define(name: string, defaultValue: any, options: ParamOptions): void {
    // Create reactive property on owner
    let currentValue = defaultValue;
    
    Object.defineProperty(this.owner, name, {
      get() { 
        return currentValue; 
      },
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
    
    // Store definition
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
    this.owner[name] = value;
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
```

### packages/core/src/managers/ParameterManager.ts

```typescript
import type { ParamOptions, ParamDefinition } from '../types';
import type { ComponentParams } from '../components/ComponentParams';

interface RegisteredParam {
  object: any;
  property: string;
  options: ParamOptions;
  type: 'adhoc' | 'component';
}

export class ParameterManager {
  private registeredParams: RegisteredParam[] = [];
  
  /**
   * Register an ad-hoc parameter
   */
  add(object: any, property: string, options: ParamOptions): void {
    const originalValue = object[property];
    let currentValue = originalValue;
    
    // Create reactive property
    Object.defineProperty(object, property, {
      get() { 
        return currentValue; 
      },
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
    
    // Register
    this.registeredParams.push({
      object,
      property,
      options,
      type: 'adhoc'
    });
  }
  
  /**
   * Expose a component parameter
   */
  expose(componentParams: ComponentParams, paramName: string, overrideOptions?: Partial<ParamOptions>): void {
    const definition = componentParams.getDefinition(paramName);
    if (!definition) {
      console.warn(`Parameter ${paramName} not found in component`);
      return;
    }
    
    // Merge options
    const finalOptions = {
      ...definition.options,
      ...overrideOptions
    };
    
    // Register
    this.registeredParams.push({
      object: (componentParams as any).owner,
      property: paramName,
      options: finalOptions,
      type: 'component'
    });
  }
  
  /**
   * Expose all component parameters
   */
  exposeAll(componentParams: ComponentParams): void {
    componentParams.getAllDefinitions().forEach((def, name) => {
      this.expose(componentParams, name);
    });
  }
  
  /**
   * Get all registered parameters
   */
  getAll(): RegisteredParam[] {
    return this.registeredParams;
  }
  
  /**
   * Clear all parameters
   */
  clear(): void {
    this.registeredParams = [];
  }
}
```

### Update App.ts

Add ParameterManager and handle params in add():

```typescript
import { ParameterManager } from './managers/ParameterManager';
import { ComponentParams } from './components/ComponentParams';
import type { AddOptions } from './types';

export class App {
  // ... existing properties
  
  params: ParameterManager;
  
  constructor(options: AppOptions = {}) {
    // ... existing setup
    
    this.params = new ParameterManager();
  }
  
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
  
  private handleComponentParams(obj: any, options?: AddOptions): void {
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
}
```

### Update demos/test/TestComponent.ts

Add parameters:

```typescript
import * as THREE from 'three';
import { ComponentParams } from '@/components/ComponentParams';

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
```

### Update demos/test/main.ts

Test parameters:

```typescript
import { App } from '@/App';
import { SpinningSphere } from './TestComponent';

const app = new App();

app.backgrounds.setColor(0x1a1a2e);
app.lights.set('three-point');
app.controls.setOrbit();

// Add sphere with parameter exposure
const sphere = new SpinningSphere();
app.add(sphere, { 
  params: true  // Expose all parameters
});

app.start();

// Test parameter changes via console
console.log('Test changing parameters:');
console.log('sphere.speed = 3');
console.log('sphere.size = 2');
console.log('sphere.color = 0x00ff00');

// Auto-test after 2 seconds
setTimeout(() => {
  console.log('Auto-testing parameters...');
  sphere.speed = 3;
  sphere.size = 2;
  sphere.color = 0x00ff00;
}, 2000);
```

### Test It

```bash
npm run dev
```

Open browser console.

### Success Criteria

- ✅ Sphere appears and spins
- ✅ After 2 seconds, sphere speeds up, grows, and turns green
- ✅ Console shows: "Speed changed to: 3", etc.
- ✅ Can manually change params in console: `sphere.size = 1.5`
- ✅ onChange fires every time

---

## Phase 5: Parameter Helpers

**Goal:** Add convenience methods for common parameter patterns.

**Dependencies:** Phase 4

### Update ParameterManager.ts

Add helper methods:

```typescript
export class ParameterManager {
  // ... existing methods
  
  /**
   * Add position parameters (x, y, z)
   */
  addPosition(object: THREE.Object3D, options?: Partial<ParamOptions>): void {
    const defaults = { min: -10, max: 10, ...options };
    
    this.add(object.position, 'x', { ...defaults, label: 'Position X' });
    this.add(object.position, 'y', { ...defaults, label: 'Position Y' });
    this.add(object.position, 'z', { ...defaults, label: 'Position Z' });
  }
  
  /**
   * Add rotation parameters (x, y, z)
   */
  addRotation(object: THREE.Object3D, options?: Partial<ParamOptions>): void {
    const defaults = { min: 0, max: Math.PI * 2, ...options };
    
    this.add(object.rotation, 'x', { ...defaults, label: 'Rotation X' });
    this.add(object.rotation, 'y', { ...defaults, label: 'Rotation Y' });
    this.add(object.rotation, 'z', { ...defaults, label: 'Rotation Z' });
  }
  
  /**
   * Add scale parameters (x, y, z)
   */
  addScale(object: THREE.Object3D, options?: Partial<ParamOptions>): void {
    const defaults = { min: 0.1, max: 5, ...options };
    
    this.add(object.scale, 'x', { ...defaults, label: 'Scale X' });
    this.add(object.scale, 'y', { ...defaults, label: 'Scale Y' });
    this.add(object.scale, 'z', { ...defaults, label: 'Scale Z' });
  }
  
  /**
   * Add color parameter for material
   */
  addColor(material: THREE.Material, options?: Partial<ParamOptions>): void {
    this.add(material, 'color', {
      type: 'color',
      onChange: (v) => (material as any).color.setHex(v),
      label: 'Color',
      ...options
    });
  }
}
```

### Test Ad-hoc Parameters

Update `demos/test/main.ts`:

```typescript
import * as THREE from 'three';
import { App } from '@/App';
import { SpinningSphere } from './TestComponent';

const app = new App();

app.backgrounds.setColor(0x1a1a2e);
app.lights.set('three-point');
app.controls.setOrbit();

// Component with internal params
const sphere = new SpinningSphere();
app.add(sphere, { params: ['speed', 'color'] });

// Ad-hoc Three.js object with helper params
const cube = new THREE.Mesh(
  new THREE.BoxGeometry(),
  new THREE.MeshStandardMaterial({ color: 0x00ff00 })
);
cube.position.set(3, 0, 0);
app.scene.add(cube);

// Add parameters using helpers
app.params.addPosition(cube);
app.params.addRotation(cube);
app.params.addColor(cube.material);

app.start();

// Test in console
console.log('Try: cube.position.x = 5');
console.log('Try: cube.rotation.y = Math.PI');
console.log('Try: sphere.speed = 5');
```

### Test It

```bash
npm run dev
```

### Success Criteria

- ✅ Both sphere and cube appear
- ✅ Can change cube position in console
- ✅ Can change cube rotation in console
- ✅ Can change sphere speed in console
- ✅ onChange fires for all parameters

---

## Phase 6: Layout Variants

**Goal:** Support fixed and custom layouts.

**Dependencies:** Phase 5

### Update LayoutManager.ts

Add fixed and custom layout support:

```typescript
export interface CustomLayoutConfig {
  container: HTMLElement | string;
  onResize?: (width: number, height: number) => void;
}

export class LayoutManager {
  // ... existing properties
  
  private resizeObserver?: ResizeObserver;
  
  setFixed(width: number, height: number, container: HTMLElement | string): void {
    this.dispose();
    
    const containerEl = typeof container === 'string'
      ? document.querySelector(container) as HTMLElement
      : container;
      
    if (!containerEl) {
      throw new Error('Container not found');
    }
    
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    
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
    
    container.appendChild(this.renderer.domElement);
    
    this.resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      
      this.camera.aspect = rect.width / rect.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(rect.width, rect.height);
      
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
```

### Test Fixed Layout

Create `demos/test/fixed-layout.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Fixed Layout Test</title>
  <style>
    body {
      margin: 20px;
      font-family: Arial, sans-serif;
    }
    #container {
      border: 2px solid #333;
      display: inline-block;
    }
  </style>
</head>
<body>
  <h1>Fixed Layout (800x600)</h1>
  <div id="container"></div>
  <script type="module" src="./fixed-layout.ts"></script>
</body>
</html>
```

Create `demos/test/fixed-layout.ts`:

```typescript
import { App } from '@/App';
import { SpinningSphere } from './TestComponent';

const app = new App();

// Use fixed layout instead of fullscreen
app.layout.setFixed(800, 600, '#container');

app.backgrounds.setColor(0x1a1a2e);
app.lights.set('three-point');
app.controls.setOrbit();

const sphere = new SpinningSphere();
app.add(sphere, { params: true });

app.start();
```

### Test It

Update root `index.html` to point to `fixed-layout.ts`, then:

```bash
npm run dev
```

### Success Criteria

- ✅ Canvas is 800x600 pixels
- ✅ Canvas has border
- ✅ Canvas doesn't resize with window
- ✅ Sphere renders correctly

---

## Phase 7: First Real Component

**Goal:** Build an actual math component and demo.

**Dependencies:** Phase 6

### Create ParametricCurve Component

Create `packages/core/src/math/curves/ParametricCurve.ts`:

```typescript
import * as THREE from 'three';
import { ComponentParams } from '../../components/ComponentParams';

export interface ParametricFunction {
  (t: number): { x: number; y: number; z: number };
}

export interface ParametricCurveOptions {
  tMin?: number;
  tMax?: number;
  segments?: number;
  color?: number;
  linewidth?: number;
}

export class ParametricCurve {
  mesh: THREE.Line;
  params: ComponentParams;
  
  private fn: ParametricFunction;
  
  tMin!: number;
  tMax!: number;
  segments!: number;
  
  constructor(fn: ParametricFunction, options: ParametricCurveOptions = {}) {
    this.fn = fn;
    this.params = new ComponentParams(this);
    
    // Define parameters
    this.params.define('tMin', options.tMin ?? 0, {
      min: -10,
      max: 10,
      onChange: () => this.rebuild()
    });
    
    this.params.define('tMax', options.tMax ?? 2 * Math.PI, {
      min: -10,
      max: 10,
      onChange: () => this.rebuild()
    });
    
    this.params.define('segments', options.segments ?? 100, {
      min: 10,
      max: 500,
      step: 1,
      onChange: () => this.rebuild()
    });
    
    // Build initial curve
    const geometry = this.buildGeometry();
    const material = new THREE.LineBasicMaterial({
      color: options.color ?? 0xff0000,
      linewidth: options.linewidth ?? 1
    });
    
    this.mesh = new THREE.Line(geometry, material);
  }
  
  private buildGeometry(): THREE.BufferGeometry {
    const points: THREE.Vector3[] = [];
    const dt = (this.tMax - this.tMin) / this.segments;
    
    for (let i = 0; i <= this.segments; i++) {
      const t = this.tMin + i * dt;
      const p = this.fn(t);
      points.push(new THREE.Vector3(p.x, p.y, p.z));
    }
    
    return new THREE.BufferGeometry().setFromPoints(points);
  }
  
  private rebuild(): void {
    const newGeometry = this.buildGeometry();
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;
  }
  
  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
```

### Create Demo

Create `demos/calculus/tangent-line/main.ts`:

```typescript
import { App } from '@/App';
import { ParametricCurve } from '@/math/curves/ParametricCurve';

const app = new App();

app.backgrounds.setGradient('#0a0a1a', '#1a1a3a');
app.lights.set('ambient');
app.controls.setOrbit({ enableDamping: true });

// Helix curve
const helix = new ParametricCurve(
  (t) => ({
    x: Math.cos(t),
    y: Math.sin(t),
    z: t / 5
  }),
  {
    tMin: 0,
    tMax: 10 * Math.PI,
    color: 0xff0000
  }
);

app.add(helix, {
  params: {
    tMax: { min: 0, max: 20 * Math.PI },
    segments: true
  }
});

app.start();

console.log('Try: helix.tMax = 5 * Math.PI');
console.log('Try: helix.segments = 300');
```

### Test It

Update root `index.html` to point to this demo:

```html
<script type="module" src="/demos/calculus/tangent-line/main.ts"></script>
```

```bash
npm run dev
```

### Success Criteria

- ✅ Red helix appears
- ✅ Can change `tMax` in console (curve grows/shrinks)
- ✅ Can change `segments` in console (curve smoothness changes)
- ✅ Curve rebuilds when parameters change

---

## Phase 8: Build Reusable Library

**Goal:** Create library components you'll use across demos.

**Dependencies:** Phase 7

### Components to Build

1. **ParametricSurface** - Similar to ParametricCurve but 2D
2. **CoordinateAxes** - X, Y, Z axes with labels
3. **Grid** - Ground plane grid
4. **VectorField** - Arrow field for visualizing gradients

### Example: CoordinateAxes

Create `packages/core/src/math/helpers/CoordinateAxes.ts`:

```typescript
import * as THREE from 'three';

export interface CoordinateAxesOptions {
  size?: number;
  colors?: {
    x?: number;
    y?: number;
    z?: number;
  };
}

export class CoordinateAxes {
  mesh: THREE.Group;
  
  constructor(options: CoordinateAxesOptions = {}) {
    const size = options.size ?? 5;
    const colors = {
      x: options.colors?.x ?? 0xff0000,
      y: options.colors?.y ?? 0x00ff00,
      z: options.colors?.z ?? 0x0000ff
    };
    
    this.mesh = new THREE.Group();
    
    // X axis
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(size, 0, 0)
    ]);
    const xMaterial = new THREE.LineBasicMaterial({ color: colors.x });
    this.mesh.add(new THREE.Line(xGeometry, xMaterial));
    
    // Y axis
    const yGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, size, 0)
    ]);
    const yMaterial = new THREE.LineBasicMaterial({ color: colors.y });
    this.mesh.add(new THREE.Line(yGeometry, yMaterial));
    
    // Z axis
    const zGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, size)
    ]);
    const zMaterial = new THREE.LineBasicMaterial({ color: colors.z });
    this.mesh.add(new THREE.Line(zGeometry, zMaterial));
  }
  
  dispose(): void {
    this.mesh.children.forEach(child => {
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }
}
```

### Update Core Index

Create `packages/core/src/math/index.ts`:

```typescript
export { ParametricCurve } from './curves/ParametricCurve';
export { CoordinateAxes } from './helpers/CoordinateAxes';
// ... other exports
```

Update `packages/core/src/index.ts`:

```typescript
export { App } from './App';
export * from './types';
export * from './components/ComponentParams';
export * from './math';
```

### Test It

```typescript
import { App, CoordinateAxes } from '@';

const app = new App();
app.backgrounds.setColor(0x000000);
app.lights.set('ambient');

const axes = new CoordinateAxes({ size: 10 });
app.add(axes);

app.start();
```

### Build More Components

Continue building:
- Grid helper
- ParametricSurface
- Vector field
- Whatever math components you use most

---

## Next Steps

### After Phase 8

1. **UI System** - Build actual parameter UI (lil-gui, custom, etc.)
2. **Asset Management** - Organize preset HDRs, textures
3. **Documentation** - JSDoc comments, usage examples
4. **Testing** - Unit tests for core components
5. **Port Existing Demos** - Migrate your 100+ demos to new framework

### Tips for Success

**Iterate on Each Phase:**
- Don't move to next phase until current phase works perfectly
- Write tests/demos for each phase
- Refactor as you discover better patterns

**Keep it Simple:**
- Don't add features you don't need yet
- Framework should stay lightweight
- Direct Three.js access is always an option

**Document as You Go:**
- Add JSDoc comments to public APIs
- Write usage examples in demos
- Keep README updated

**Version Control:**
- Commit after each phase
- Tag releases (v0.1.0, v0.2.0, etc.)
- Can always roll back if needed

---

## Troubleshooting

### TypeScript Errors

**"Cannot find module '@core'"**
- Restart TypeScript server
- Check tsconfig.json paths
- Check vite.config.ts alias

**Type errors in demos**
- Make sure you're importing types: `import type { ... }`
- Check that types are exported from index.ts

### Runtime Errors

**"Object doesn't have animate method"**
- Check that method is spelled correctly: `animate` not `tick` or `update`
- Verify object is being added: `app.add(obj)`

**Memory leaks**
- Make sure dispose() is implemented
- Check that objects are removed: `app.remove(obj)`
- Use browser dev tools memory profiler

### Performance Issues

**Low FPS**
- Check number of objects in scene
- Check geometry complexity (reduce segments)
- Enable renderer stats to identify bottleneck

**Slow parameter changes**
- Make sure onChange only rebuilds what's necessary
- Consider debouncing rapid parameter changes
- Profile with browser dev tools

---

## Summary

This build plan takes you from zero to a working framework in 8 phases:

0. ✅ Project setup
1. ✅ Minimal viable app (spinning cube)
2. ✅ Scene setup managers
3. ✅ Object lifecycle
4. ✅ Parameter system
5. ✅ Parameter helpers
6. ✅ Layout variants
7. ✅ First real component
8. ✅ Reusable library

Each phase is independently testable and adds real value. By Phase 7, you'll have a complete framework for building math demos!