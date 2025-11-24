import { Container } from './Container';
import { Input } from '../inputs/Input';

export class Folder extends Container {
    private content: HTMLDivElement;
    private header: HTMLDivElement;
    private isOpen: boolean = true;

    constructor(title: string) {
        super('div', 'cr-folder');

        // Header
        this.header = document.createElement('div');
        this.header.className = 'cr-folder-header';

        // Icon
        const icon = document.createElement('span');
        icon.className = 'cr-folder-icon';
        icon.textContent = '▼';

        const label = document.createElement('span');
        label.textContent = title;

        this.header.appendChild(icon);
        this.header.appendChild(label);
        this.domElement.appendChild(this.header);

        // Content
        this.content = document.createElement('div');
        this.content.className = 'cr-folder-content';
        this.domElement.appendChild(this.content);

        // Toggle logic
        this.header.addEventListener('click', () => {
            this.isOpen = !this.isOpen;
            this.content.style.display = this.isOpen ? 'block' : 'none';
            if (this.isOpen) {
                icon.classList.remove('closed');
            } else {
                icon.classList.add('closed');
            }
        });
    }

    add(component: Container | Input): void {
        if (component instanceof Container) {
            component.domElement.style.display = 'block';
            this.content.appendChild(component.domElement);
        } else {
            component.mount(this.content);
        }
    }

    open(): void {
        this.isOpen = true;
        this.content.style.display = 'block';
    }

    close(): void {
        this.isOpen = false;
        this.content.style.display = 'none';
    }
}
