/**
 * Base class for UI containers that can hold other components
 */
export abstract class Container {
    domElement: HTMLElement;
    protected parent?: Container | HTMLElement;

    constructor(tagName: string = 'div', className?: string) {
        this.domElement = document.createElement(tagName);
        if (className) {
            this.domElement.className = className;
        }
    }

    /**
     * Add a child component to this container
     */
    abstract add(component: Container | Input): void;

    mount(parent: Container | HTMLElement): void {
        this.parent = parent;

        if (parent instanceof Container) {
            parent.domElement.appendChild(this.domElement);
        } else {
            parent.appendChild(this.domElement);
        }
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

// Import Input for type checking
import { Input } from '../inputs/Input';
