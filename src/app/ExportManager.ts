import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { TimelineManager } from './TimelineManager';

/**
 * Options for screenshot export
 */
export interface ScreenshotOptions {
  /** Output filename (default: 'screenshot.png') */
  filename?: string;
  /** MIME type (default: 'image/png') */
  mimeType?: string;
  /** Quality for JPEG (0-1, default: 1.0) */
  quality?: number;
}

/**
 * Options for high-resolution screenshot
 */
export interface HiResScreenshotOptions extends ScreenshotOptions {
  /** Output width in pixels */
  width: number;
  /** Output height in pixels */
  height: number;
}

/**
 * Options for video sequence export
 */
export interface VideoSequenceOptions {
  /** Duration in seconds */
  duration: number;
  /** Frames per second (default: 30) */
  fps?: number;
  /** Output filename without extension (default: 'video_sequence') */
  filename?: string;
  /** Progress callback (0-1) */
  onProgress?: (progress: number) => void;
}

/**
 * Options for geometry export
 */
export interface GeometryExportOptions {
  /** Object to export (default: entire scene) */
  object?: THREE.Object3D;
  /** Output filename */
  filename?: string;
}

/**
 * ExportManager - Unified export API for screenshots, video, and geometry
 *
 * All export methods follow a consistent naming pattern:
 * - screenshot() / screenshotHiRes() - Image capture
 * - videoSequence() - Frame sequence as ZIP
 * - gltf() / obj() / stl() - Geometry export
 *
 * @example
 *   // Quick screenshot
 *   app.export.screenshot();
 *
 *   // High-resolution render
 *   app.export.screenshotHiRes({ width: 4096, height: 2160 });
 *
 *   // Video sequence
 *   await app.export.videoSequence({ duration: 5, fps: 60 });
 *
 *   // Geometry export
 *   app.export.gltf({ filename: 'model.glb' });
 */
export class ExportManager {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private timeline: TimelineManager;
  private isExporting = false;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    timeline: TimelineManager
  ) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.timeline = timeline;
  }

  // =========================================================================
  // Screenshot Export
  // =========================================================================

  /**
   * Capture current view as screenshot
   */
  screenshot(options: ScreenshotOptions = {}): void {
    const {
      filename = 'screenshot.png',
      mimeType = 'image/png',
      quality = 1.0
    } = options;

    this.renderer.render(this.scene, this.camera);
    this.renderer.domElement.toBlob(
      (blob) => {
        if (blob) {
          saveAs(blob, filename);
        }
      },
      mimeType,
      quality
    );
  }

  /**
   * Capture high-resolution screenshot (off-screen render)
   */
  screenshotHiRes(options: HiResScreenshotOptions): void {
    const {
      width,
      height,
      filename = 'screenshot_hires.png',
      mimeType = 'image/png',
      quality = 1.0
    } = options;

    // Save current state
    const originalSize = new THREE.Vector2();
    this.renderer.getSize(originalSize);
    const originalPixelRatio = this.renderer.getPixelRatio();

    // Resize renderer temporarily
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(1);

    // Update camera aspect if perspective
    let originalAspect: number | undefined;
    if (this.camera instanceof THREE.PerspectiveCamera) {
      originalAspect = this.camera.aspect;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }

    // Render and capture
    this.renderer.render(this.scene, this.camera);
    this.renderer.domElement.toBlob(
      (blob) => {
        if (blob) {
          saveAs(blob, filename);
        }

        // Restore state
        this.renderer.setSize(originalSize.x, originalSize.y, false);
        this.renderer.setPixelRatio(originalPixelRatio);

        if (this.camera instanceof THREE.PerspectiveCamera && originalAspect !== undefined) {
          this.camera.aspect = originalAspect;
          this.camera.updateProjectionMatrix();
        }

        // Re-render to restore view
        this.renderer.render(this.scene, this.camera);
      },
      mimeType,
      quality
    );
  }

  /**
   * Capture current frame as Blob (for programmatic use)
   */
  async screenshotToBlob(mimeType = 'image/png', quality = 1.0): Promise<Blob | null> {
    return new Promise((resolve) => {
      this.renderer.render(this.scene, this.camera);
      this.renderer.domElement.toBlob(
        (blob) => resolve(blob),
        mimeType,
        quality
      );
    });
  }

  // =========================================================================
  // Video Sequence Export
  // =========================================================================

  /**
   * Export video as image sequence (ZIP file)
   *
   * Steps through time frame-by-frame, captures each frame,
   * and packages them into a downloadable ZIP.
   *
   * Use with ffmpeg to create video:
   * `ffmpeg -framerate 30 -i video_%04d.png -c:v libx264 output.mp4`
   */
  async videoSequence(options: VideoSequenceOptions): Promise<void> {
    if (this.isExporting) {
      console.warn('Export already in progress');
      return;
    }

    this.isExporting = true;

    const {
      duration,
      fps = 30,
      filename = 'video_sequence',
      onProgress
    } = options;

    // Save current timeline state
    const wasPlaying = this.timeline.isPlaying;
    const originalTime = this.timeline.time;
    const originalSpeed = this.timeline.speed;

    // Prepare for export
    this.timeline.pause();
    this.timeline.setSpeed(1.0);
    this.timeline.setTime(0);

    const totalFrames = Math.ceil(duration * fps);
    const dt = 1.0 / fps;
    const zip = new JSZip();

    console.log(`Starting video export: ${totalFrames} frames at ${fps} FPS`);

    try {
      for (let i = 0; i < totalFrames; i++) {
        // Set time
        const time = i * dt;
        this.timeline.setTime(time);

        // Wait for reactive updates
        await new Promise(r => setTimeout(r, 0));

        // Capture frame
        const blob = await this.screenshotToBlob();
        if (blob) {
          const frameNum = String(i).padStart(4, '0');
          zip.file(`${filename}_${frameNum}.png`, blob);
        }

        // Report progress
        const progress = (i + 1) / totalFrames;
        if (onProgress) onProgress(progress);

        // Log every 10%
        if (i % Math.ceil(totalFrames / 10) === 0) {
          console.log(`Exporting: ${Math.round(progress * 100)}%`);
        }
      }

      // Generate and download ZIP
      console.log('Generating ZIP file...');
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${filename}.zip`);
      console.log('Video export complete!');

    } catch (error) {
      console.error('Video export failed:', error);
      throw error;
    } finally {
      // Restore timeline state
      this.isExporting = false;
      this.timeline.setTime(originalTime);
      this.timeline.setSpeed(originalSpeed);
      if (wasPlaying) this.timeline.play();
    }
  }

  // =========================================================================
  // Geometry Export
  // =========================================================================

  /**
   * Export to GLTF/GLB format
   *
   * @param options - Export options
   * @param options.object - Object to export (default: entire scene)
   * @param options.filename - Output filename (default: 'scene.glb')
   */
  gltf(options: GeometryExportOptions = {}): void {
    const {
      object = this.scene,
      filename = 'scene.glb'
    } = options;

    const exporter = new GLTFExporter();

    exporter.parse(
      object,
      (result) => {
        if (result instanceof ArrayBuffer) {
          saveAs(new Blob([result], { type: 'application/octet-stream' }), filename);
        } else {
          const output = JSON.stringify(result, null, 2);
          saveAs(new Blob([output], { type: 'text/plain' }), filename);
        }
      },
      (error) => {
        console.error('GLTF export failed:', error);
      },
      { binary: filename.endsWith('.glb') }
    );
  }

  /**
   * Export to OBJ format
   */
  obj(options: GeometryExportOptions = {}): void {
    const {
      object = this.scene,
      filename = 'scene.obj'
    } = options;

    const exporter = new OBJExporter();
    const result = exporter.parse(object);
    saveAs(new Blob([result], { type: 'text/plain' }), filename);
  }

  /**
   * Export to STL format (binary)
   * Useful for 3D printing
   */
  stl(options: GeometryExportOptions = {}): void {
    const {
      object = this.scene,
      filename = 'scene.stl'
    } = options;

    const exporter = new STLExporter();
    const result = exporter.parse(object, { binary: true });
    saveAs(new Blob([result], { type: 'application/octet-stream' }), filename);
  }

  dispose(): void {
    // Nothing to dispose
  }
}
