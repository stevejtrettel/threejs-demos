import { Input } from './Input';

export interface ToggleOptions {
    label?: string;
    onChange?: (value: boolean) => void;
}

export class Toggle extends Input<boolean> {
    private input: HTMLInputElement;

    constructor(initialValue: boolean, options: ToggleOptions = {}) {
        super('div', 'cr-toggle');
        this.onChange = options.onChange;

        if (options.label) {
            const label = document.createElement('label');
            label.className = 'cr-toggle-label';
            label.textContent = options.label;
            this.domElement.appendChild(label);
        }

        this.input = document.createElement('input');
        this.input.type = 'checkbox';
        this.input.checked = initialValue;
        this.input.className = 'cr-toggle-checkbox';

        this.input.addEventListener('change', () => {
            if (this.onChange) {
                this.onChange(this.input.checked);
            }
        });

        this.domElement.appendChild(this.input);
    }

    setValue(value: boolean): void {
        this.input.checked = value;
    }

    getValue(): boolean {
        return this.input.checked;
    }
}
