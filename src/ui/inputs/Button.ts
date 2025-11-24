import { Input } from './Input';

export class Button extends Input<void> {
    constructor(label: string, onClick: () => void) {
        super('button', 'cr-button');

        this.domElement.textContent = label;
        this.onChange = onClick;
        this.domElement.addEventListener('click', onClick);
    }

    setLabel(label: string): void {
        this.domElement.textContent = label;
    }

    setValue(_value: void): void {
        // Button has no value
    }

    getValue(): void {
        // Button has no value
        return undefined;
    }
}
