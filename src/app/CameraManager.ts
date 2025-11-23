import * as THREE from 'three';

export interface CameraOptions {
    fov?: number;
    near?: number;
    far?: number;
    position?: THREE.Vector3;
}

export interface FlyToOptions {
    duration?: number; // seconds
    easing?: (t: number) => number;
}

/**
 * CameraManager
 * 
 * Manages the main scene camera, including positioning,
 * transitions, and view presets.
 */
export class CameraManager {
    public camera: THREE.PerspectiveCamera;

    // Animation state
    private isAnimating: boolean = false;
    private animationStart: number = 0;
    private animationDuration: number = 0;

    private startPos = new THREE.Vector3();
    private startTarget = new THREE.Vector3(); // Not fully tracked yet without OrbitControls integration
    private endPos = new THREE.Vector3();
    private endTarget = new THREE.Vector3();

    constructor(options: CameraOptions = {}) {
        this.camera = new THREE.PerspectiveCamera(
            options.fov || 75,
            window.innerWidth / window.innerHeight,
            options.near || 0.1,
            options.far || 1000
        );

        if (options.position) {
            this.camera.position.copy(options.position);
        } else {
            this.camera.position.z = 5;
        }
    }

    /**
     * Set camera position directly
     */
    setPosition(x: number, y: number, z: number): void {
        this.camera.position.set(x, y, z);
    }

    /**
     * Look at a specific point
     */
    lookAt(x: number, y: number, z: number): void {
        this.camera.lookAt(x, y, z);
    }

    /**
     * Smoothly fly camera to a new position
     * Note: This is a basic implementation. For full orbit control integration,
     * we would need to coordinate with ControlsManager.
     */
    flyTo(position: THREE.Vector3, target: THREE.Vector3, options: FlyToOptions = {}): Promise<void> {
        return new Promise((resolve) => {
            this.startPos.copy(this.camera.position);
            this.endPos.copy(position);

            // We'll just interpolate position for now, assuming lookAt is handled by controls or manual update
            // In a full implementation, we'd interpolate the target too

            this.animationDuration = options.duration || 1.0;
            this.animationStart = performance.now() / 1000;
            this.isAnimating = true;

            // Simple animation loop for this specific transition
            const animate = () => {
                if (!this.isAnimating) return;

                const now = performance.now() / 1000;
                const progress = Math.min(1, (now - this.animationStart) / this.animationDuration);

                // Ease in-out cubic
                const t = progress < 0.5
                    ? 4 * progress * progress * progress
                    : 1 - Math.pow(-2 * progress + 2, 3) / 2;

                this.camera.position.lerpVectors(this.startPos, this.endPos, t);
                this.camera.lookAt(target); // Force lookAt for now

                if (progress >= 1) {
                    this.isAnimating = false;
                    resolve();
                } else {
                    requestAnimationFrame(animate);
                }
            };

            animate();
        });
    }

    /**
     * Handle window resize
     */
    resize(width: number, height: number): void {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    dispose(): void {
        // Nothing to dispose currently
    }
}
