import { Component } from '../core/Component';

export class Panel extends Component {
    constructor(title?: string) {
        super('div', 'cr-panel');

        // Apply basic styles inline for now, or rely on CSS
        this.domElement.style.position = 'fixed';
        this.domElement.style.top = '0';
        this.domElement.style.right = '0';
        this.domElement.style.width = 'var(--cr-sidebar-width, 300px)';
        this.domElement.style.height = '100vh';
        this.domElement.style.backgroundColor = 'var(--cr-bg-primary, #1a1a1a)';
        this.domElement.style.borderLeft = '1px solid var(--cr-border, #333)';
        this.domElement.style.overflowY = 'auto';
        this.domElement.style.zIndex = '1000';
        this.domElement.style.padding = 'var(--cr-space-s, 8px)';

        if (title) {
            const header = document.createElement('div');
            header.textContent = title;
            header.style.padding = 'var(--cr-space-s, 8px)';
            header.style.fontWeight = 'bold';
            header.style.borderBottom = '1px solid var(--cr-border, #333)';
            header.style.marginBottom = 'var(--cr-space-s, 8px)';
            header.style.color = 'var(--cr-text-accent, #4da6ff)';
            this.domElement.appendChild(header);
        }
    }
}
