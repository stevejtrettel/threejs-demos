import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';

export interface PathTracerOptions {
    bounces?: number;
    samples?: number;
    tiles?: { x: number; y: number };
}

export interface RenderManagerOptions {
    antialias?: boolean;
    alpha?: boolean;
    pathTracerDefaults?: PathTracerOptions;
}

/**
 * RenderManager
 *
 * Manages rendering with runtime-switchable modes:
 * - WebGL: Fast, interactive preview (default)
 * - Path Tracing: High-quality, photorealistic rendering
 *
 * ## Path Tracer Synchronization
 *
 * The pathtracer needs to be kept in sync with scene changes:
 *
 * ### Automatic (handled for you):
 * - **Environment changes**: Automatically detected on every render
 *   - Loading HDRI via BackgroundManager.loadHDR()
 *   - Creating cubemap via BackgroundManager.createEnvironmentFromScene()
 *   - Any change to scene.environment
 *
 * ### Manual (you must notify):
 * - **Material changes**: Call app.notifyMaterialsChanged() after:
 *   - Loading textures into materials (diffuse, normal, roughness maps, etc.)
 *   - Changing material properties that affect pathtracing
 *   - Adding/removing materials from the scene
 *
 * @example
 * // Environment - automatic sync
 * app.backgrounds.loadHDR('/assets/studio.hdr');  // No callback needed!
 * app.backgrounds.createEnvironmentFromScene(skyScene);  // Works automatically!
 *
 * @example
 * // Materials - manual notify
 * const texture = await app.assets.loadTexture('diffuse.png');
 * material.map = texture;
 * material.needsUpdate = true;
 * app.notifyMaterialsChanged();  // Tell pathtracer to update
 */
export class RenderManager {
    readonly renderer: THREE.WebGLRenderer;
    readonly domElement: HTMLCanvasElement;

    private pathTracer?: WebGLPathTracer;
    private mode: 'webgl' | 'pathtracing' = 'webgl';
    private defaultPTOptions: PathTracerOptions;

    // Track scene/camera for PT updates
    private currentScene?: THREE.Scene;
    private currentCamera?: THREE.Camera;

    // Auto-sync tracking
    private lastEnvironment?: THREE.Texture | null;
    private materialsNeedUpdate = false;

    constructor(options: RenderManagerOptions = {}) {
        // Create single WebGL renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: options.antialias ?? true,
            alpha: options.alpha ?? false
        });

        this.domElement = this.renderer.domElement;

        // Store PT defaults
        this.defaultPTOptions = {
            bounces: 10,
            samples: 1,
            tiles: { x: 2, y: 2 },
            ...options.pathTracerDefaults
        };
    }

    /**
     * Render the scene
     */
    render(scene: THREE.Scene, camera: THREE.Camera): void {
        // Track for PT scene updates
        this.currentScene = scene;
        this.currentCamera = camera;

        if (this.mode === 'pathtracing' && this.pathTracer) {
            // Auto-sync: detect environment changes
            if (this.lastEnvironment !== scene.environment) {
                // Only update if we have an environment (pathtracer crashes on null/undefined)
                if (scene.environment) {
                    this.pathTracer.updateEnvironment();
                    this.resetAccumulation();
                }
                this.lastEnvironment = scene.environment;
            }

            // Manual sync: materials changed (called via notifyMaterialsChanged)
            if (this.materialsNeedUpdate) {
                this.pathTracer.updateMaterials();
                this.materialsNeedUpdate = false;
                this.resetAccumulation();
            }

            this.pathTracer.renderSample();
        } else {
            this.renderer.render(scene, camera);
        }
    }

    /**
     * Switch to path tracing mode
     * @param options - Path tracer configuration options
     */
    switchToPathTracing(options?: PathTracerOptions): void {
        if (!this.pathTracer) {
            // Lazy initialization: wrap our existing renderer
            this.pathTracer = new WebGLPathTracer(this.renderer);

            const opts = { ...this.defaultPTOptions, ...options };
            this.pathTracer.bounces = opts.bounces!;

            if (opts.tiles) {
                this.pathTracer.tiles.set(opts.tiles.x, opts.tiles.y);
            }
        } else if (options) {
            // Update existing PT settings
            if (options.bounces !== undefined) {
                this.pathTracer.bounces = options.bounces;
            }
            if (options.tiles) {
                this.pathTracer.tiles.set(options.tiles.x, options.tiles.y);
            }
        }

        this.mode = 'pathtracing';

        // Update scene if available
        if (this.currentScene && this.currentCamera) {
            this.pathTracer.setScene(this.currentScene, this.currentCamera);
            // Initial sync of materials
            this.pathTracer.updateMaterials();
            // Initial sync of environment (only if one exists)
            if (this.currentScene.environment) {
                this.pathTracer.updateEnvironment();
            }
            // Track current environment for auto-sync
            this.lastEnvironment = this.currentScene.environment;
        }
    }

    /**
     * Switch to standard WebGL rendering
     */
    switchToWebGL(): void {
        this.mode = 'webgl';
    }

    /**
     * Check if currently path tracing
     */
    isPathTracing(): boolean {
        return this.mode === 'pathtracing';
    }

    /**
     * Set number of light bounces (PT only)
     */
    setBounces(bounces: number): void {
        if (this.pathTracer) {
            this.pathTracer.bounces = bounces;
            this.resetAccumulation();
        }
    }

    /**
     * Reset path tracer accumulation
     */
    resetAccumulation(): void {
        if (this.pathTracer) {
            this.pathTracer.reset();
        }
    }

    /**
     * Notify that materials have changed (e.g., textures loaded)
     * This will trigger updateMaterials() on the next render
     */
    notifyMaterialsChanged(): void {
        this.materialsNeedUpdate = true;
    }

    /**
     * Force immediate update of pathtracer (for migration/legacy code)
     * Generally not needed - environment updates are automatic,
     * and material updates should use notifyMaterialsChanged()
     */
    updatePathTracer(): void {
        if (this.pathTracer && this.currentScene && this.currentCamera) {
            this.pathTracer.updateMaterials();
            // Only update environment if one exists (avoid crash on null/undefined)
            if (this.currentScene.environment) {
                this.pathTracer.updateEnvironment();
            }
            this.lastEnvironment = this.currentScene.environment;
            this.materialsNeedUpdate = false;
            this.resetAccumulation();
        }
    }

    /**
     * Set render size
     */
    setSize(width: number, height: number): void {
        this.renderer.setSize(width, height);
    }

    /**
     * Set pixel ratio
     */
    setPixelRatio(ratio: number): void {
        this.renderer.setPixelRatio(ratio);
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        if (this.pathTracer) {
            this.pathTracer.dispose();
        }
        this.renderer.dispose();
    }
}
