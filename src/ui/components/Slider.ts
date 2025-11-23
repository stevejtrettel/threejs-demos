import { Component } from '../core/Component';

export interface SliderOptions {
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    onChange?: (value: number) => void;
}

export class Slider extends Component {
    private input: HTMLInputElement;
    private valueDisplay: HTMLSpanElement;
    private onChange?: (value: number) => void;

    constructor(initialValue: number, options: SliderOptions = {}) {
        super('div', 'cr-slider');

        this.onChange = options.onChange;
        const min = options.min ?? 0;
        const max = options.max ?? 100;
        const step = options.step ?? 1;

        // Layout
        this.domElement.style.display = 'flex';
        this.domElement.style.alignItems = 'center';
        this.domElement.style.marginBottom = '4px';
        this.domElement.style.fontSize = 'var(--cr-font-size-s, 11px)';

        // Label
        if (options.label) {
            const label = document.createElement('label');
            label.textContent = options.label;
            label.style.width = '80px';
            label.style.color = 'var(--cr-text-secondary, #aaa)';
            label.style.flexShrink = '0';
            this.domElement.appendChild(label);
        }

        // Input Container
        const container = document.createElement('div');
        container.style.flexGrow = '1';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        this.domElement.appendChild(container);

        // Range Input
        this.input = document.createElement('input');
        this.input.type = 'range';
        this.input.min = min.toString();
        this.input.max = max.toString();
        this.input.step = step.toString();
        this.input.value = initialValue.toString();
        this.input.style.flexGrow = '1';
        this.input.style.marginRight = '8px';
        this.input.style.cursor = 'pointer';
        container.appendChild(this.input);

        // Value Display
        this.valueDisplay = document.createElement('span');
        this.valueDisplay.textContent = initialValue.toFixed(2);
        this.valueDisplay.style.width = '40px';
        this.valueDisplay.style.textAlign = 'right';
        this.valueDisplay.style.fontFamily = 'var(--cr-font-mono, monospace)';
        this.valueDisplay.style.color = 'var(--cr-text-accent, #4da6ff)';
        container.appendChild(this.valueDisplay);

        // Event Listeners
        this.input.addEventListener('input', () => {
            const val = parseFloat(this.input.value);
            this.valueDisplay.textContent = val.toFixed(2);
            if (this.onChange) {
                this.onChange(val);
            }
        });
    }

    setValue(value: number): void {
        this.input.value = value.toString();
        this.valueDisplay.textContent = value.toFixed(2);
    }
}
