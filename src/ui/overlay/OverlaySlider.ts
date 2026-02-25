import { Input } from '../inputs/Input';

export interface OverlaySliderOptions {
    min?: number;
    max?: number;
    step?: number;
    value: number;
    label?: string;
    format?: (value: number) => string;
    onChange?: (value: number) => void;
}

export class OverlaySlider extends Input<number> {
    private input: HTMLInputElement;
    private labelEl: HTMLSpanElement;
    private format: (value: number) => string;

    constructor(options: OverlaySliderOptions) {
        super('div', 'cr-overlay-slider');
        this.onChange = options.onChange;

        const label = options.label ?? '';
        this.format = options.format ?? ((v) => `${label} = ${v.toFixed(2)}`);

        const min = options.min ?? 0;
        const max = options.max ?? 1;
        const step = options.step ?? 0.01;

        // Label
        this.labelEl = document.createElement('span');
        this.labelEl.className = 'cr-overlay-slider-label';
        this.labelEl.textContent = this.format(options.value);
        this.domElement.appendChild(this.labelEl);

        // Range input
        this.input = document.createElement('input');
        this.input.type = 'range';
        this.input.min = min.toString();
        this.input.max = max.toString();
        this.input.step = step.toString();
        this.input.value = options.value.toString();
        this.input.className = 'cr-overlay-slider-input';
        this.domElement.appendChild(this.input);

        // Events
        this.input.addEventListener('input', () => {
            const value = parseFloat(this.input.value);
            this.labelEl.textContent = this.format(value);
            if (this.onChange) {
                this.onChange(value);
            }
        });
    }

    setValue(value: number): void {
        this.input.value = value.toString();
        this.labelEl.textContent = this.format(value);
    }

    getValue(): number {
        return parseFloat(this.input.value);
    }
}
