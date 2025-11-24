import { Container } from './Container';
import { Input } from '../inputs/Input';

export interface ModalOptions {
    width?: number;
    height?: number;
    closeOnBackdrop?: boolean;
}

export class Modal extends Container {
    private backdrop: HTMLDivElement;
    private modalContent: HTMLDivElement;
    private contentArea: HTMLDivElement;
    private titleBar: HTMLDivElement;

    constructor(title: string, options: ModalOptions = {}) {
        super('div', 'cr-modal-container');

        const width = options.width ?? 600;
        const height = options.height ?? 400;

        // Backdrop
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'cr-modal-backdrop';
        if (options.closeOnBackdrop !== false) {
            this.backdrop.addEventListener('click', () => this.close());
        }
        this.domElement.appendChild(this.backdrop);

        // Modal content
        this.modalContent = document.createElement('div');
        this.modalContent.className = 'cr-modal-content';
        this.modalContent.style.width = `${width}px`;
        this.modalContent.style.maxHeight = `${height}px`;
        this.modalContent.addEventListener('click', (e) => e.stopPropagation());
        this.domElement.appendChild(this.modalContent);

        // Title bar
        this.titleBar = document.createElement('div');
        this.titleBar.className = 'cr-modal-title';

        const titleText = document.createElement('span');
        titleText.textContent = title;
        this.titleBar.appendChild(titleText);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'cr-modal-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => this.close());
        this.titleBar.appendChild(closeBtn);

        this.modalContent.appendChild(this.titleBar);

        // Content area
        this.contentArea = document.createElement('div');
        this.contentArea.className = 'cr-modal-body';
        this.modalContent.appendChild(this.contentArea);
    }

    add(component: Container | Input): void {
        if (component instanceof Container) {
            component.domElement.style.display = 'block';
            this.contentArea.appendChild(component.domElement);
        } else {
            component.mount(this.contentArea);
        }
    }

    open(): void {
        if (!this.domElement.parentElement) {
            document.body.appendChild(this.domElement);
        }
        this.domElement.style.display = 'flex';
    }

    close(): void {
        this.domElement.style.display = 'none';
        this.unmount();
    }
}
