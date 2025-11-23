import * as THREE from 'three';
import { saveAs } from 'file-saver';

export interface ScreenshotOptions {
    width?: number;
    height?: number;
    mimeType?: string;
    quality?: number;
    filename?: string;
}

/**
 * ScreenshotManager
 * 
 * Handles capturing screenshots of the scene.
 * Supports:
 * - Current view capture
 * - High-resolution capture (off-screen)
 * - Blob generation for video export
 */
export class ScreenshotManager {
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private camera: THREE.Camera;

    constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
    }

    /**
     * Capture current view and download
     */
    capture(filename: string = 'screenshot.png'): void {
        this.renderer.render(this.scene, this.camera);
        this.renderer.domElement.toBlob((blob) => {
            if (blob) {
                saveAs(blob, filename);
            }
        });
    }

    /**
     * Capture high-resolution screenshot
     * Renders to an off-screen buffer at specified resolution
     */
    captureHighRes(width: number, height: number, filename: string = 'hires_screenshot.png'): void {
        // Save current size
        const originalSize = new THREE.Vector2();
        this.renderer.getSize(originalSize);
        const originalPixelRatio = this.renderer.getPixelRatio();

        // Resize renderer (temporarily)
        this.renderer.setSize(width, height, false);
        this.renderer.setPixelRatio(1); // Force 1:1 for exact output size

        // Update camera aspect
        if (this.camera instanceof THREE.PerspectiveCamera) {
            const originalAspect = this.camera.aspect;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();

            // Render
            this.renderer.render(this.scene, this.camera);

            // Save
            this.renderer.domElement.toBlob((blob) => {
                if (blob) {
                    saveAs(blob, filename);
                }

                // Restore state
                this.renderer.setSize(originalSize.x, originalSize.y, false);
                this.renderer.setPixelRatio(originalPixelRatio);
                this.camera.aspect = originalAspect;
                this.camera.updateProjectionMatrix();

                // Re-render to restore view
                this.renderer.render(this.scene, this.camera);
            });
        } else {
            // Orthographic or other camera handling could go here
            this.renderer.setSize(originalSize.x, originalSize.y, false);
            this.renderer.setPixelRatio(originalPixelRatio);
        }
    }

    /**
     * Capture current frame as Blob (for video export)
     * Returns a Promise that resolves with the Blob
     */
    captureToBlob(mimeType: string = 'image/png', quality: number = 1.0): Promise<Blob | null> {
        return new Promise((resolve) => {
            this.renderer.render(this.scene, this.camera);
            this.renderer.domElement.toBlob((blob) => {
                resolve(blob);
            }, mimeType, quality);
        });
    }

    dispose(): void {
        // Nothing to dispose
    }
}
