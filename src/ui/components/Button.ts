import { Component } from '../core/Component';

export class Button extends Component {
    constructor(label: string, onClick: () => void) {
        super('button', 'cr-button');

        this.domElement.textContent = label;

        // Styles
        const s = this.domElement.style;
        s.width = '100%';
        s.padding = '6px 12px';
        s.backgroundColor = 'var(--cr-bg-hover, #333)';
        s.color = 'var(--cr-text-primary, #e0e0e0)';
        s.border = '1px solid var(--cr-border, #333)';
        s.borderRadius = '3px';
        s.cursor = 'pointer';
        s.fontSize = 'var(--cr-font-size-s, 11px)';
        s.fontFamily = 'inherit';
        s.marginBottom = '4px';
        s.transition = 'background-color 0.1s';

        // Hover effects
        this.domElement.addEventListener('mouseenter', () => {
            s.backgroundColor = 'var(--cr-bg-active, #404040)';
        });
        this.domElement.addEventListener('mouseleave', () => {
            s.backgroundColor = 'var(--cr-bg-hover, #333)';
        });

        this.domElement.addEventListener('click', onClick);
    }

    setLabel(label: string): void {
        this.domElement.textContent = label;
    }
}
