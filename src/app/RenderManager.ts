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
            this.pathTracer.renderSample();
        } else {
            this.renderer.render(scene, camera);
        }
    }

    /**
     * Switch to path tracing mode
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
            // Update materials and environment after setting the scene
            this.pathTracer.updateMaterials();
            this.pathTracer.updateEnvironment();
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
