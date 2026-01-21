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
 * - **Environment changes**: Detected every frame
 *   - Loading HDRI, creating cubemaps, changing scene.environment
 * - **Material changes on PT switch**: Synced when enabling pathtracing
 *   - Load all your textures/materials in WebGL mode
 *   - Then call app.enablePathTracing() - materials auto-synced!
 *
 * ### Manual (only if needed):
 * - **Changing materials WHILE pathtracing is active**:
 *   - Call app.renderManager.resetAccumulation() to see changes
 *   - Or toggle PT off and on (will re-sync everything)
 *
 * @example
 * // Common workflow (no manual sync needed!):
 * const texture = await app.assets.loadTexture('diffuse.png');
 * material.map = texture;
 * material.needsUpdate = true;
 * // Later...
 * app.enablePathTracing();  // ← Materials automatically synced!
 *
 * @example
 * // Changing materials while PT is active (rare):
 * material.roughness = 0.8;
 * material.needsUpdate = true;
 * app.renderManager.resetAccumulation();  // Restart with new material
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

    // Cached DOF settings (applied to PhysicalCamera when path tracing)
    // Note: focal length is derived from PhysicalCamera's FOV, not stored here
    private dofSettings = {
        enabled: false,
        focusDistance: 5,
        fStop: 2.8,
        apertureBlades: 0
    };

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
                this.pathTracer.updateEnvironment();
                this.lastEnvironment = scene.environment;
                this.resetAccumulation();
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
        const isNewPathTracer = !this.pathTracer;

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

            // Apply cached DOF settings (must be after setScene)
            if (isNewPathTracer) {
                this.applyDOFSettings();
            }

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
     * Apply DOF settings.
     *
     * DOF requires a PhysicalCamera from three-gpu-pathtracer because the
     * path tracer's internal updateFrom(camera) checks instanceof PhysicalCamera.
     * If it's a regular camera, DOF is disabled (bokehSize reset to 0).
     *
     * This method syncs our DOF settings to the camera's properties, which
     * the path tracer then reads during rendering.
     */
    private applyDOFSettings(): void {
        if (!this.pathTracer || !this.currentCamera) return;

        const cam = this.currentCamera as any;
        const focalLength = cam.getFocalLength?.() || 35;

        // Calculate bokehSize: larger = more blur
        // We need very large values because shader multiplies by 0.5 * 1e-3
        let bokehSize: number;
        let focusDistance: number;
        let apertureBlades: number;
        let cameraFStop: number;

        if (this.dofSettings.enabled) {
            // bokehSize = focalLength / fStop, but we need much larger values
            // Multiply by 10 to get visible blur
            bokehSize = (focalLength / this.dofSettings.fStop) * 10;
            focusDistance = this.dofSettings.focusDistance;
            apertureBlades = this.dofSettings.apertureBlades;
            // Camera fStop needed to produce our boosted bokehSize
            // (since cam.bokehSize is a getter: focalLength / fStop)
            cameraFStop = this.dofSettings.fStop / 10;
        } else {
            bokehSize = 0;
            focusDistance = 10;
            apertureBlades = 0;
            cameraFStop = 10000;
        }

        // Set camera properties so updateFrom(camera) reads correct values
        // This prevents the path tracer from overwriting our settings
        if (typeof cam.fStop !== 'undefined') {
            cam.fStop = cameraFStop;
            cam.focusDistance = focusDistance;
            cam.apertureBlades = apertureBlades;
        }

        // ALSO directly set the path tracer's internal uniforms as backup
        // See docs/FIX-DOF.md for details on this temporary hack
        const pt = this.pathTracer as any;
        const uniforms = pt._pathTracer?.material?.uniforms?.physicalCamera?.value;

        if (uniforms) {
            uniforms.bokehSize = bokehSize;
            uniforms.focusDistance = focusDistance;
            uniforms.apertureBlades = apertureBlades;
        }
    }

    /**
     * Enable/disable depth of field (PT only)
     */
    setDOFEnabled(enabled: boolean): void {
        this.dofSettings.enabled = enabled;
        if (this.pathTracer) {
            this.applyDOFSettings();
            this.resetAccumulation();
        }
    }

    /**
     * Check if DOF is enabled
     */
    isDOFEnabled(): boolean {
        return this.dofSettings.enabled;
    }

    /**
     * Set focus distance for DOF (PT only)
     */
    setFocusDistance(distance: number): void {
        this.dofSettings.focusDistance = distance;
        if (this.pathTracer) {
            this.applyDOFSettings();
            this.resetAccumulation();
        }
    }

    /**
     * Get current focus distance
     */
    getFocusDistance(): number {
        return this.dofSettings.focusDistance;
    }

    /**
     * Set f-stop (aperture) for DOF (PT only)
     * Lower values = more blur, higher values = sharper
     */
    setFStop(fStop: number): void {
        this.dofSettings.fStop = fStop;
        if (this.pathTracer) {
            this.applyDOFSettings();
            this.resetAccumulation();
        }
    }

    /**
     * Get current f-stop
     */
    getFStop(): number {
        return this.dofSettings.fStop;
    }

    /**
     * Set aperture blade count for bokeh shape (PT only)
     * 0 = circular, 5-8 = typical polygon shapes
     */
    setApertureBlades(blades: number): void {
        this.dofSettings.apertureBlades = blades;
        if (this.pathTracer) {
            this.applyDOFSettings();
            this.resetAccumulation();
        }
    }

    /**
     * Get current aperture blade count
     */
    getApertureBlades(): number {
        return this.dofSettings.apertureBlades;
    }

    /**
     * Notify that materials have changed while pathtracing is active
     *
     * NOTE: You usually DON'T need to call this!
     * - Materials are automatically synced when switching to PT mode
     * - Only call this if you change materials WHILE pathtracing is running
     *
     * Common workflow (no manual call needed):
     *   1. Load textures/modify materials in WebGL mode
     *   2. Call app.enablePathTracing()
     *   3. Materials are automatically synced ✓
     *
     * Only use this method for the rare case of changing materials
     * during active pathtracing.
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
     * Notify that scene geometry has changed (objects added/removed).
     * This rebuilds the BVH acceleration structure for path tracing.
     * Call this after adding or removing meshes from the scene during active PT.
     */
    notifySceneChanged(): void {
        if (this.pathTracer && this.currentScene && this.currentCamera) {
            this.pathTracer.setScene(this.currentScene, this.currentCamera);
            this.pathTracer.updateMaterials();
            if (this.currentScene.environment) {
                this.pathTracer.updateEnvironment();
            }
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
