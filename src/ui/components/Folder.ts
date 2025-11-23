import { Component } from '../core/Component';

export class Folder extends Component {
    private content: HTMLDivElement;
    private header: HTMLDivElement;
    private isOpen: boolean = true;

    constructor(title: string) {
        super('div', 'cr-folder');

        this.domElement.style.marginBottom = 'var(--cr-space-s, 8px)';
        this.domElement.style.backgroundColor = 'var(--cr-bg-secondary, #252525)';
        this.domElement.style.borderRadius = '4px';
        this.domElement.style.overflow = 'hidden';

        // Header
        this.header = document.createElement('div');
        this.header.className = 'cr-folder-header';
        this.header.style.padding = '6px 8px';
        this.header.style.cursor = 'pointer';
        this.header.style.userSelect = 'none';
        this.header.style.display = 'flex';
        this.header.style.alignItems = 'center';
        this.header.style.fontSize = 'var(--cr-font-size-s, 11px)';
        this.header.style.fontWeight = '600';
        this.header.style.color = 'var(--cr-text-secondary, #aaa)';
        this.header.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';

        // Icon
        const icon = document.createElement('span');
        icon.textContent = '▼';
        icon.style.fontSize = '8px';
        icon.style.marginRight = '6px';
        icon.style.transition = 'transform 0.2s';

        const label = document.createElement('span');
        label.textContent = title;

        this.header.appendChild(icon);
        this.header.appendChild(label);
        this.domElement.appendChild(this.header);

        // Content
        this.content = document.createElement('div');
        this.content.className = 'cr-folder-content';
        this.content.style.padding = 'var(--cr-space-s, 8px)';
        this.domElement.appendChild(this.content);

        // Toggle logic
        this.header.addEventListener('click', () => {
            this.isOpen = !this.isOpen;
            this.content.style.display = this.isOpen ? 'block' : 'none';
            icon.style.transform = this.isOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
        });
    }

    /**
     * Add a child component to the folder content
     */
    add(component: Component): void {
        component.mount(this.content);
    }
}
