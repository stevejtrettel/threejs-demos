import { Input } from './Input';

export interface TextInputOptions {
    label?: string;
    onChange?: (value: string) => void;
}

export class TextInput extends Input<string> {
    private input: HTMLInputElement;

    constructor(initialValue: string, options: TextInputOptions = {}) {
        super('div', 'cr-text-input');
        this.onChange = options.onChange;

        if (options.label) {
            const label = document.createElement('label');
            label.className = 'cr-text-input-label';
            label.textContent = options.label;
            this.domElement.appendChild(label);
        }

        this.input = document.createElement('input');
        this.input.type = 'text';
        this.input.value = initialValue;
        this.input.className = 'cr-text-input-field';

        this.input.addEventListener('change', () => {
            if (this.onChange) {
                this.onChange(this.input.value);
            }
        });

        this.domElement.appendChild(this.input);
    }

    setValue(value: string): void {
        this.input.value = value;
    }

    getValue(): string {
        return this.input.value;
    }
}
