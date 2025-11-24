import { Container } from './Container';
import { Input } from '../inputs/Input';

export interface WindowOptions {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    resizable?: boolean;
    draggable?: boolean;
}

export class Window extends Container {
    private titleBar: HTMLDivElement;
    private contentArea: HTMLDivElement;
    private isDragging = false;
    private dragOffset = { x: 0, y: 0 };
    private currentZ = 1000;

    constructor(title: string, options: WindowOptions = {}) {
        super('div', 'cr-window');

        const width = options.width ?? 400;
        const height = options.height ?? 300;
        const x = options.x ?? (window.innerWidth - width) / 2;
        const y = options.y ?? (window.innerHeight - height) / 2;

        // Position and size (dynamic, keeps inline)
        this.domElement.style.left = `${x}px`;
        this.domElement.style.top = `${y}px`;
        this.domElement.style.width = `${width}px`;
        this.domElement.style.height = `${height}px`;
        this.domElement.style.zIndex = this.currentZ.toString();

        // Title bar
        this.titleBar = document.createElement('div');
        this.titleBar.className = 'cr-window-title';
        if (options.draggable === false) {
            this.titleBar.classList.add('non-draggable');
        }

        const titleText = document.createElement('span');
        titleText.textContent = title;
        this.titleBar.appendChild(titleText);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'cr-window-close';
        closeBtn.textContent = '×';
        closeBtn.addEventListener('click', () => this.close());
        this.titleBar.appendChild(closeBtn);

        this.domElement.appendChild(this.titleBar);

        // Content area
        this.contentArea = document.createElement('div');
        this.contentArea.className = 'cr-window-content';
        this.domElement.appendChild(this.contentArea);

        // Setup dragging
        if (options.draggable !== false) {
            this.setupDragging();
        }

        // Bring to front on click
        this.domElement.addEventListener('mousedown', () => this.bringToFront());
    }

    private setupDragging(): void {
        this.titleBar.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.dragOffset.x = e.clientX - this.domElement.offsetLeft;
            this.dragOffset.y = e.clientY - this.domElement.offsetTop;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            const x = e.clientX - this.dragOffset.x;
            const y = e.clientY - this.dragOffset.y;

            this.domElement.style.left = `${x}px`;
            this.domElement.style.top = `${y}px`;
        });

        document.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
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
        this.bringToFront();
    }

    close(): void {
        this.domElement.style.display = 'none';
        this.unmount();
    }

    bringToFront(): void {
        this.currentZ = Math.max(this.currentZ, 1000) + 1;
        this.domElement.style.zIndex = this.currentZ.toString();
    }
}
