/**
 * Base Component class for all UI elements
 */
export abstract class Component {
    public domElement: HTMLElement;
    protected parent?: Component | HTMLElement;

    constructor(tagName: string = 'div', className?: string) {
        this.domElement = document.createElement(tagName);
        if (className) {
            this.domElement.className = className;
        }
    }

    /**
     * Mount this component to a parent
     */
    mount(parent: Component | HTMLElement): void {
        this.parent = parent;

        if (parent instanceof Component) {
            parent.domElement.appendChild(this.domElement);
        } else {
            parent.appendChild(this.domElement);
        }
    }

    /**
     * Unmount this component
     */
    unmount(): void {
        if (this.domElement.parentElement) {
            this.domElement.parentElement.removeChild(this.domElement);
        }
        this.parent = undefined;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.unmount();
    }

    /**
     * Update loop (optional)
     */
    update(): void {
        // Override in subclasses
    }
}
