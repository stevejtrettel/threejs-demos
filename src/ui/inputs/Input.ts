/**
 * Base class for UI input components that capture user values
 */
export abstract class Input<T = any> {
    domElement: HTMLElement;
    protected parent?: HTMLElement;
    protected onChange?: (value: T) => void;

    constructor(tagName: string = 'div', className?: string) {
        this.domElement = document.createElement(tagName);
        if (className) {
            this.domElement.className = className;
        }
    }

    /**
     * Update the displayed value without triggering onChange callback
     */
    abstract setValue(value: T): void;

    /**
     * Get the current value
     */
    abstract getValue(): T;

    mount(parent: HTMLElement): void {
        this.parent = parent;
        parent.appendChild(this.domElement);
    }

    unmount(): void {
        if (this.domElement.parentElement) {
            this.domElement.parentElement.removeChild(this.domElement);
        }
        this.parent = undefined;
    }

    dispose(): void {
        this.unmount();
    }
}
