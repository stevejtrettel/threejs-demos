/**
 * DebugManager - Performance monitoring and debug visualization
 *
 * Provides FPS/frame time tracking, debug helpers (wireframe, grid, axes),
 * and keyboard shortcuts for development.
 *
 * This is SEPARATE from the main UI (ParameterManager) - it's purely for development.
 *
 * Keyboard shortcuts:
 *   D - Toggle debug stats overlay (FPS, draw calls, triangles, memory)
 *   W - Toggle wireframe mode
 *   G - Toggle grid helper
 *   A - Toggle axes helper
 *   N - Toggle normal helpers
 *   B - Toggle bounding boxes
 */

import * as THREE from 'three';

export class DebugManager {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;

  // Stats panel
  private statsPanel: HTMLDivElement | null = null;
  private statsEnabled = false;

  // Performance tracking
  private frameTimes: number[] = [];
  private lastFrameTime = 0;
  private readonly MAX_FRAME_HISTORY = 120; // 2 seconds at 60fps

  // Stats displays (references to DOM elements)
  private fpsDisplay: HTMLElement | null = null;
  private frameTimeDisplay: HTMLElement | null = null;
  private minFpsDisplay: HTMLElement | null = null;
  private maxFpsDisplay: HTMLElement | null = null;
  private avgFpsDisplay: HTMLElement | null = null;
  private drawCallsDisplay: HTMLElement | null = null;
  private trianglesDisplay: HTMLElement | null = null;
  private geometriesDisplay: HTMLElement | null = null;
  private texturesDisplay: HTMLElement | null = null;

  // Debug helpers
  private gridHelper: THREE.GridHelper | null = null;
  private axesHelper: THREE.AxesHelper | null = null;
  private normalHelpers = new Map<THREE.Mesh, THREE.VertexNormalsHelper>();
  private boundingBoxHelpers = new Map<THREE.Object3D, THREE.BoxHelper>();

  // Wireframe mode
  private wireframeEnabled = false;
  private originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();

  // Keyboard handler
  private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;
  private enabled = false;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;

    // Initialize last frame time
    this.lastFrameTime = performance.now();
  }

  // ===== Stats Panel =====

  /**
   * Show or hide stats panel
   */
  showStats(show: boolean): void {
    if (show && !this.statsPanel) {
      this.createStatsPanel();
    } else if (!show && this.statsPanel) {
      this.statsPanel.remove();
      this.statsPanel = null;
      this.fpsDisplay = null;
      this.frameTimeDisplay = null;
      this.minFpsDisplay = null;
      this.maxFpsDisplay = null;
      this.avgFpsDisplay = null;
      this.drawCallsDisplay = null;
      this.trianglesDisplay = null;
      this.geometriesDisplay = null;
      this.texturesDisplay = null;
    }

    this.statsEnabled = show;
  }

  private createStatsPanel(): void {
    this.statsPanel = document.createElement('div');
    this.statsPanel.id = 'debug-stats-panel';
    this.statsPanel.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 16px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      border-radius: 4px;
      z-index: 10000;
      pointer-events: none;
      user-select: none;
      min-width: 180px;
    `;

    this.statsPanel.innerHTML = `
      <div style="color: #8bb4e8; margin-bottom: 6px; font-weight: bold;">Performance</div>
      <div><strong>FPS:</strong> <span class="fps-display">--</span></div>
      <div><strong>Frame:</strong> <span class="frame-time-display">-- ms</span></div>
      <div><strong>Min FPS:</strong> <span class="min-fps-display">--</span></div>
      <div><strong>Max FPS:</strong> <span class="max-fps-display">--</span></div>
      <div><strong>Avg FPS:</strong> <span class="avg-fps-display">--</span></div>
      <div style="color: #8bb4e8; margin-top: 10px; margin-bottom: 6px; font-weight: bold;">Render Info</div>
      <div><strong>Calls:</strong> <span class="draw-calls-display">--</span></div>
      <div><strong>Triangles:</strong> <span class="triangles-display">--</span></div>
      <div style="color: #8bb4e8; margin-top: 10px; margin-bottom: 6px; font-weight: bold;">Memory</div>
      <div><strong>Geometries:</strong> <span class="geometries-display">--</span></div>
      <div><strong>Textures:</strong> <span class="textures-display">--</span></div>
    `;

    document.body.appendChild(this.statsPanel);

    // Get references to display elements
    this.fpsDisplay = this.statsPanel.querySelector('.fps-display');
    this.frameTimeDisplay = this.statsPanel.querySelector('.frame-time-display');
    this.minFpsDisplay = this.statsPanel.querySelector('.min-fps-display');
    this.maxFpsDisplay = this.statsPanel.querySelector('.max-fps-display');
    this.avgFpsDisplay = this.statsPanel.querySelector('.avg-fps-display');
    this.drawCallsDisplay = this.statsPanel.querySelector('.draw-calls-display');
    this.trianglesDisplay = this.statsPanel.querySelector('.triangles-display');
    this.geometriesDisplay = this.statsPanel.querySelector('.geometries-display');
    this.texturesDisplay = this.statsPanel.querySelector('.textures-display');
  }

  /**
   * Update stats (call this every frame)
   */
  update(): void {
    if (!this.statsEnabled) return;

    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Store frame time
    this.frameTimes.push(deltaTime);
    if (this.frameTimes.length > this.MAX_FRAME_HISTORY) {
      this.frameTimes.shift();
    }

    // Calculate stats
    const fps = deltaTime > 0 ? 1000 / deltaTime : 60;
    const frameTime = deltaTime;

    // Update displays
    if (this.fpsDisplay) {
      this.fpsDisplay.textContent = fps.toFixed(1);
    }
    if (this.frameTimeDisplay) {
      this.frameTimeDisplay.textContent = frameTime.toFixed(2) + ' ms';
    }

    // Calculate min/max/avg (from recent history)
    if (this.frameTimes.length > 10) {
      const fpsValues = this.frameTimes.map((dt) => (dt > 0 ? 1000 / dt : 60));
      const minFps = Math.min(...fpsValues);
      const maxFps = Math.max(...fpsValues);
      const avgFps = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;

      if (this.minFpsDisplay) {
        this.minFpsDisplay.textContent = minFps.toFixed(1);
      }
      if (this.maxFpsDisplay) {
        this.maxFpsDisplay.textContent = maxFps.toFixed(1);
      }
      if (this.avgFpsDisplay) {
        this.avgFpsDisplay.textContent = avgFps.toFixed(1);
      }
    }

    // Update render info from renderer
    const info = this.renderer.info;
    if (this.drawCallsDisplay) {
      this.drawCallsDisplay.textContent = info.render.calls.toString();
    }
    if (this.trianglesDisplay) {
      this.trianglesDisplay.textContent = info.render.triangles.toLocaleString();
    }
    if (this.geometriesDisplay) {
      this.geometriesDisplay.textContent = info.memory.geometries.toString();
    }
    if (this.texturesDisplay) {
      this.texturesDisplay.textContent = info.memory.textures.toString();
    }
  }

  /**
   * Get current stats (useful for external access)
   */
  getStats(): { fps: number; frameTime: number; minFps: number; maxFps: number; avgFps: number } {
    if (this.frameTimes.length === 0) {
      return { fps: 0, frameTime: 0, minFps: 0, maxFps: 0, avgFps: 0 };
    }

    const lastDelta = this.frameTimes[this.frameTimes.length - 1];
    const fps = lastDelta > 0 ? 1000 / lastDelta : 60;

    const fpsValues = this.frameTimes.map((dt) => (dt > 0 ? 1000 / dt : 60));
    const minFps = Math.min(...fpsValues);
    const maxFps = Math.max(...fpsValues);
    const avgFps = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length;

    return {
      fps,
      frameTime: lastDelta,
      minFps,
      maxFps,
      avgFps
    };
  }

  // ===== Debug Helpers =====

  /**
   * Toggle wireframe mode on all meshes
   */
  toggleWireframe(): void {
    this.wireframeEnabled = !this.wireframeEnabled;

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        if (this.wireframeEnabled) {
          // Store original material
          this.originalMaterials.set(obj, obj.material);

          // Replace with wireframe material
          const wireframeMat = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            wireframe: true
          });
          obj.material = wireframeMat;
        } else {
          // Restore original material
          const original = this.originalMaterials.get(obj);
          if (original) {
            obj.material = original;
            this.originalMaterials.delete(obj);
          }
        }
      }
    });

    console.log(`Wireframe mode: ${this.wireframeEnabled ? 'ON' : 'OFF'}`);
  }

  /**
   * Toggle grid helper
   */
  toggleGrid(size = 10, divisions = 10): void {
    if (this.gridHelper) {
      // Remove existing grid
      this.scene.remove(this.gridHelper);
      this.gridHelper.dispose();
      this.gridHelper = null;
      console.log('Grid: OFF');
    } else {
      // Add grid
      this.gridHelper = new THREE.GridHelper(size, divisions);
      this.scene.add(this.gridHelper);
      console.log('Grid: ON');
    }
  }

  /**
   * Toggle axes helper
   */
  toggleAxes(size = 5): void {
    if (this.axesHelper) {
      // Remove existing axes
      this.scene.remove(this.axesHelper);
      this.axesHelper.dispose();
      this.axesHelper = null;
      console.log('Axes: OFF');
    } else {
      // Add axes
      this.axesHelper = new THREE.AxesHelper(size);
      this.scene.add(this.axesHelper);
      console.log('Axes: ON');
    }
  }

  /**
   * Toggle normal helpers for all meshes
   */
  toggleNormals(size = 0.1): void {
    if (this.normalHelpers.size > 0) {
      // Remove existing normal helpers
      this.normalHelpers.forEach((helper, mesh) => {
        this.scene.remove(helper);
        helper.dispose();
      });
      this.normalHelpers.clear();
      console.log('Normal helpers: OFF');
    } else {
      // Add normal helpers to all meshes
      this.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.geometry) {
          // Only add if geometry has normals
          if (obj.geometry.attributes.normal) {
            const helper = new THREE.VertexNormalsHelper(obj, size, 0x00ff00);
            this.scene.add(helper);
            this.normalHelpers.set(obj, helper);
          }
        }
      });
      console.log(`Normal helpers: ON (${this.normalHelpers.size} meshes)`);
    }
  }

  /**
   * Toggle bounding boxes for all objects
   */
  toggleBoundingBoxes(): void {
    if (this.boundingBoxHelpers.size > 0) {
      // Remove existing bounding box helpers
      this.boundingBoxHelpers.forEach((helper, obj) => {
        this.scene.remove(helper);
        helper.dispose();
      });
      this.boundingBoxHelpers.clear();
      console.log('Bounding boxes: OFF');
    } else {
      // Add bounding box helpers to all objects with geometry
      this.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points) {
          const helper = new THREE.BoxHelper(obj, 0xffff00);
          this.scene.add(helper);
          this.boundingBoxHelpers.set(obj, helper);
        }
      });
      console.log(`Bounding boxes: ON (${this.boundingBoxHelpers.size} objects)`);
    }
  }

  // ===== Performance Profiling =====

  /**
   * Profile a function call
   *
   * @param name - Profile name (for logging)
   * @param fn - Function to profile
   * @returns Duration in milliseconds
   */
  profile(name: string, fn: () => void): number {
    const start = performance.now();
    fn();
    const end = performance.now();
    const duration = end - start;
    console.log(`[Profile] ${name}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  /**
   * Start a named profile timer
   */
  private profileTimers = new Map<string, number>();

  startProfile(name: string): void {
    this.profileTimers.set(name, performance.now());
  }

  /**
   * End a named profile timer and log the duration
   *
   * @returns Duration in milliseconds
   */
  endProfile(name: string): number {
    const start = this.profileTimers.get(name);
    if (start === undefined) {
      console.warn(`[Profile] No start time for '${name}'`);
      return 0;
    }

    const end = performance.now();
    const duration = end - start;
    console.log(`[Profile] ${name}: ${duration.toFixed(2)}ms`);
    this.profileTimers.delete(name);
    return duration;
  }

  // ===== Scene Inspection =====

  /**
   * Print scene graph hierarchy to console
   */
  printSceneGraph(): void {
    console.log('Scene Graph:');
    this.printObject(this.scene, 0);
  }

  private printObject(obj: THREE.Object3D, indent: number): void {
    const prefix = '  '.repeat(indent);
    const type = obj.type;
    const name = obj.name || '(unnamed)';

    let info = `${prefix}${type}: ${name}`;

    // Add extra info for meshes
    if (obj instanceof THREE.Mesh) {
      const geom = obj.geometry;
      const vertexCount = geom.attributes.position?.count || 0;
      info += ` [${vertexCount} vertices]`;
    }

    console.log(info);

    // Recurse
    for (const child of obj.children) {
      this.printObject(child, indent + 1);
    }
  }

  /**
   * Log memory usage (geometries, textures)
   */
  logMemoryUsage(): void {
    const info = this.renderer.info;

    console.log('Memory Usage:');
    console.log(`  Geometries: ${info.memory.geometries}`);
    console.log(`  Textures: ${info.memory.textures}`);
    console.log('Render Info:');
    console.log(`  Calls: ${info.render.calls}`);
    console.log(`  Triangles: ${info.render.triangles}`);
    console.log(`  Points: ${info.render.points}`);
    console.log(`  Lines: ${info.render.lines}`);
  }

  // ===== Keyboard Shortcuts =====

  /**
   * Enable keyboard shortcuts
   */
  enable(): void {
    if (this.enabled) return;

    this.keyboardHandler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'd':
          this.showStats(!this.statsEnabled);
          break;
        case 'w':
          this.toggleWireframe();
          break;
        case 'g':
          this.toggleGrid();
          break;
        case 'a':
          this.toggleAxes();
          break;
        case 'n':
          this.toggleNormals();
          break;
        case 'b':
          this.toggleBoundingBoxes();
          break;
      }
    };

    window.addEventListener('keydown', this.keyboardHandler);
    this.enabled = true;

    console.log('DebugManager: Keyboard shortcuts enabled (D/W/G/A/N/B)');
  }

  /**
   * Disable keyboard shortcuts
   */
  disable(): void {
    if (!this.enabled || !this.keyboardHandler) return;

    window.removeEventListener('keydown', this.keyboardHandler);
    this.keyboardHandler = null;
    this.enabled = false;

    // Clean up
    this.showStats(false);
    if (this.wireframeEnabled) {
      this.toggleWireframe();
    }
    if (this.gridHelper) {
      this.toggleGrid();
    }
    if (this.axesHelper) {
      this.toggleAxes();
    }
    if (this.normalHelpers.size > 0) {
      this.toggleNormals();
    }
    if (this.boundingBoxHelpers.size > 0) {
      this.toggleBoundingBoxes();
    }

    console.log('DebugManager: Disabled');
  }
}
