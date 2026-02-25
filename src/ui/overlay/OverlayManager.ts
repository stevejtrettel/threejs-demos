import '../styles/theme.css';
import '../styles/overlay.css';
import { OverlaySlider, type OverlaySliderOptions } from './OverlaySlider';

export class OverlayManager {
    readonly container: HTMLDivElement;
    private controls: { dispose(): void }[] = [];

    constructor(parent: HTMLElement) {
        this.container = document.createElement('div');
        this.container.className = 'cr-overlay';
        parent.appendChild(this.container);
    }

    addSlider(options: OverlaySliderOptions): OverlaySlider {
        const slider = new OverlaySlider(options);
        slider.mount(this.container);
        this.controls.push(slider);
        return slider;
    }

    dispose(): void {
        for (const control of this.controls) {
            control.dispose();
        }
        this.controls = [];
        this.container.remove();
    }
}
