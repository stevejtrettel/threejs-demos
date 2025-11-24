import './styles/index.css';
import { Panel } from './containers/Panel';
import { Window } from './containers/Window';
import { Modal } from './containers/Modal';
import { Folder } from './containers/Folder';
import { Button } from './inputs/Button';
import { Slider } from './inputs/Slider';
import { Toggle } from './inputs/Toggle';
import { ColorInput } from './inputs/ColorInput';
import { TextInput } from './inputs/TextInput';
import { ParameterManager } from '../app/ParameterManager';
import { TimelineManager } from '../app/TimelineManager';
import { CameraManager } from '../app/CameraManager';
import { ExportManager } from '../app/ExportManager';
import { ScreenshotManager } from '../app/ScreenshotManager';
import { VideoExportManager } from '../app/VideoExportManager';

interface Binding {
    component: any;
    object: any;
    property: string;
}

export class ControlRoom {
    // Main Panel
    private panel: Panel;
    private folders: {
        main: Folder;
        scene: Folder;
        studio: Folder;
        system: Folder;
    };

    // Windows & Modals
    private windows: Window[] = [];
    private activeModal?: Modal;

    // State
    private activeBindings: Binding[] = [];

    constructor(
        private timeline: TimelineManager,
        private camera: CameraManager,
        private params: ParameterManager,
        private screenshots: ScreenshotManager,
        private video: VideoExportManager,
        private exportManager: ExportManager
    ) {
        // Create main panel
        this.panel = new Panel('Control Room');
        document.body.appendChild(this.panel.domElement);

        // Create folders
        this.folders = {
            main: new Folder('Main'),
            scene: new Folder('Scene'),
            studio: new Folder('Studio'),
            system: new Folder('System')
        };

        this.panel.add(this.folders.main);
        this.panel.add(this.folders.scene);
        this.panel.add(this.folders.studio);
        this.panel.add(this.folders.system);

        // Initialize controls
        this.initMainControls();
        this.initSceneControls();
        this.initStudioControls();
        this.initSystemControls();
    }

    private initMainControls(): void {
        // Timeline controls
        const playBtn = new Button(
            this.timeline.isPlaying ? 'Pause' : 'Play',
            () => {
                if (this.timeline.isPlaying) {
                    this.timeline.pause();
                    playBtn.setLabel('Play');
                } else {
                    this.timeline.play();
                    playBtn.setLabel('Pause');
                }
            }
        );
        this.folders.main.add(playBtn);

        const speedSlider = new Slider(this.timeline.speed, {
            min: 0,
            max: 5,
            step: 0.1,
            label: 'Speed',
            onChange: (v) => this.timeline.setSpeed(v)
        });
        this.folders.main.add(speedSlider);

        // Camera controls
        const resetCameraBtn = new Button('Reset Camera', () => {
            this.camera.setPosition(0, 5, 10);
            this.camera.lookAt(0, 0, 0);
        });
        this.folders.main.add(resetCameraBtn);
    }

    private initSceneControls(): void {
        // Listen for parameter events
        this.params.on('param-added', (param: any) => {
            this.createControlForParam(param);
        });

        // Load existing parameters
        this.params.getAll().forEach((param) => {
            this.createControlForParam(param);
        });
    }

    private initStudioControls(): void {
        // Screenshot button - opens window
        this.folders.studio.add(
            new Button('Screenshot...', () => this.openScreenshotWindow())
        );

        // Video export button - opens modal
        this.folders.studio.add(
            new Button('Export Video...', () => this.openVideoExportModal())
        );

        // Quick screenshot
        this.folders.studio.add(
            new Button('Quick Screenshot', () => {
                this.screenshots.capture('screenshot.png');
            })
        );
    }

    private initSystemControls(): void {
        // Placeholder for system stats
    }

    private createControlForParam(param: any): void {
        const { object, property, options } = param;
        const initialValue = object[property];
        const folder = this.folders.scene;

        let component: any;

        // Type inference
        if (options.type === 'color' || (typeof initialValue === 'string' && initialValue.startsWith('#'))) {
            component = new ColorInput(initialValue, {
                label: options.label || property,
                onChange: (v) => {
                    object[property] = v;
                    if (options.onChange) options.onChange(v);
                }
            });
        } else if (typeof initialValue === 'boolean' || options.type === 'boolean') {
            component = new Toggle(initialValue, {
                label: options.label || property,
                onChange: (v) => {
                    object[property] = v;
                    if (options.onChange) options.onChange(v);
                }
            });
        } else if (typeof initialValue === 'number' || options.type === 'number') {
            component = new Slider(initialValue, {
                min: options.min,
                max: options.max,
                step: options.step,
                label: options.label || property,
                onChange: (v) => {
                    object[property] = v;
                    if (options.onChange) options.onChange(v);
                }
            });
        } else if (typeof initialValue === 'string') {
            component = new TextInput(initialValue, {
                label: options.label || property,
                onChange: (v) => {
                    object[property] = v;
                    if (options.onChange) options.onChange(v);
                }
            });
        }

        if (component) {
            folder.add(component);

            // Track binding for polling
            this.activeBindings.push({
                component,
                object,
                property
            });
        }
    }

    private openScreenshotWindow(): void {
        const win = new Window('Screenshot', { width: 300, height: 200 });

        const resolutionOptions = { width: 1920, height: 1080 };

        win.add(new Slider(resolutionOptions.width, {
            min: 640,
            max: 3840,
            step: 1,
            label: 'Width',
            onChange: (v) => (resolutionOptions.width = v)
        }));

        win.add(new Slider(resolutionOptions.height, {
            min: 480,
            max: 2160,
            step: 1,
            label: 'Height',
            onChange: (v) => (resolutionOptions.height = v)
        }));

        win.add(new Button('Capture', () => {
            this.screenshots.captureHighRes(
                resolutionOptions.width,
                resolutionOptions.height,
                'screenshot.png'
            );
            win.close();
        }));

        win.open();
        this.windows.push(win);
    }

    private openVideoExportModal(): void {
        const modal = new Modal('Video Export', { width: 500, height: 350 });

        const exportParams = { duration: 2, fps: 30 };

        modal.add(new Slider(exportParams.duration, {
            min: 1,
            max: 10,
            step: 1,
            label: 'Duration (s)',
            onChange: (v) => (exportParams.duration = v)
        }));

        modal.add(new Slider(exportParams.fps, {
            min: 24,
            max: 60,
            step: 1,
            label: 'FPS',
            onChange: (v) => (exportParams.fps = v)
        }));

        modal.add(new Button('Export', () => {
            this.video.exportVideo(exportParams.duration, exportParams.fps);
            modal.close();
        }));

        modal.add(new Button('Cancel', () => modal.close()));

        modal.open();
        this.activeModal = modal;
    }

    /**
     * Update loop - polls bindings for two-way sync
     */
    update(): void {
        for (const binding of this.activeBindings) {
            const currentValue = binding.object[binding.property];
            if (binding.component.setValue) {
                binding.component.setValue(currentValue);
            }
        }
    }
}
