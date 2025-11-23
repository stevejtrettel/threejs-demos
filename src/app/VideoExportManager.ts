import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { TimelineManager } from './TimelineManager';
import { ScreenshotManager } from './ScreenshotManager';

export interface VideoExportOptions {
    duration: number;      // Seconds
    fps: number;          // Frames per second
    filename?: string;    // Output filename (without extension)
    onProgress?: (progress: number) => void;
}

/**
 * VideoExportManager
 * 
 * Orchestrates frame-by-frame rendering for high-quality video export.
 * Produces a ZIP file containing a sequence of PNG images.
 */
export class VideoExportManager {
    private timeline: TimelineManager;
    private screenshots: ScreenshotManager;
    private isExporting: boolean = false;

    constructor(timeline: TimelineManager, screenshots: ScreenshotManager) {
        this.timeline = timeline;
        this.screenshots = screenshots;
    }

    /**
     * Export a video sequence
     * 
     * 1. Pauses the timeline
     * 2. Steps through time frame-by-frame
     * 3. Captures each frame
     * 4. Zips them up
     * 5. Downloads the ZIP
     */
    async export(options: VideoExportOptions): Promise<void> {
        if (this.isExporting) {
            console.warn('Export already in progress');
            return;
        }

        this.isExporting = true;
        const { duration, fps, filename = 'video_sequence', onProgress } = options;

        // Save current state
        const wasPlaying = this.timeline.isPlaying;
        const originalTime = this.timeline.time;
        const originalSpeed = this.timeline.speed;

        // Prepare for export
        this.timeline.pause();
        this.timeline.setSpeed(1.0); // Ensure consistent stepping
        this.timeline.setTime(0); // Start from 0 (or we could add start time option)

        const totalFrames = Math.ceil(duration * fps);
        const dt = 1.0 / fps;
        const zip = new JSZip();

        console.log(`Starting export: ${totalFrames} frames at ${fps} FPS`);

        try {
            for (let i = 0; i < totalFrames; i++) {
                // 1. Set time
                const time = i * dt;
                this.timeline.setTime(time);

                // 2. Update simulation (manually trigger update if needed, 
                // but usually setting time is enough for stateless rendering.
                // For physics, we might need to step properly)

                // 3. Capture frame
                // We wait for a microtask to ensure any reactive updates happen
                await new Promise(r => setTimeout(r, 0));

                const blob = await this.screenshots.captureToBlob();
                if (blob) {
                    // Pad frame number: frame_001.png
                    const frameNum = String(i).padStart(4, '0');
                    zip.file(`${filename}_${frameNum}.png`, blob);
                }

                // 4. Report progress
                const progress = (i + 1) / totalFrames;
                if (onProgress) onProgress(progress);

                // Optional: Log every 10%
                if (i % Math.ceil(totalFrames / 10) === 0) {
                    console.log(`Exporting: ${Math.round(progress * 100)}%`);
                }
            }

            // 5. Generate ZIP
            console.log('Generating ZIP file...');
            const content = await zip.generateAsync({ type: 'blob' });
            saveAs(content, `${filename}.zip`);
            console.log('Export complete!');

        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            // Restore state
            this.isExporting = false;
            this.timeline.setTime(originalTime);
            this.timeline.setSpeed(originalSpeed);
            if (wasPlaying) this.timeline.play();
        }
    }

    dispose(): void {
        // Nothing to dispose
    }
}
