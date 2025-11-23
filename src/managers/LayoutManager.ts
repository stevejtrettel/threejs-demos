import * as THREE from 'three';
import layoutCSS from '../styles/layout.css?inline';

export interface CustomLayoutConfig {
  container: HTMLElement | string;
  onResize?: (width: number, height: number) => void;
}

export class LayoutManager {
  private renderer: THREE.WebGLRenderer;
  private camera: THREE.PerspectiveCamera;
  private resizeListener?: () => void;
  private resizeObserver?: ResizeObserver;
  private currentContainer?: HTMLElement;
  private styleElement?: HTMLStyleElement;

  constructor(renderer: THREE.WebGLRenderer, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.camera = camera;
  }

  private injectStyles(): void {
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.textContent = layoutCSS;
      document.head.appendChild(this.styleElement);
    }
  }

  setFullscreen(): void {
    this.dispose();

    // Set initial size
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    // Append to body
    document.body.appendChild(this.renderer.domElement);
    document.body.style.margin = '0';
    document.body.style.overflow = 'hidden';
    document.body.classList.remove('threejs-centered-layout');

    // Listen for resize
    this.resizeListener = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', this.resizeListener);
  }

  setFixed(width: number, height: number, container?: HTMLElement | string): void {
    this.dispose();

    const containerEl = container
      ? typeof container === 'string'
        ? document.querySelector(container) as HTMLElement
        : container
      : document.body;

    if (!containerEl) {
      throw new Error('Container not found');
    }

    // Set size
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    // Append to container
    containerEl.appendChild(this.renderer.domElement);
    this.currentContainer = containerEl;
  }

  setCustom(config: CustomLayoutConfig): void {
    this.dispose();

    const container = typeof config.container === 'string'
      ? document.querySelector(config.container) as HTMLElement
      : config.container;

    if (!container) {
      throw new Error('Container not found');
    }

    // Append to container
    container.appendChild(this.renderer.domElement);
    this.currentContainer = container;

    // Observe container size changes
    this.resizeObserver = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();

      this.camera.aspect = rect.width / rect.height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(rect.width, rect.height);

      // Call custom resize handler if provided
      if (config.onResize) {
        config.onResize(rect.width, rect.height);
      }
    });

    this.resizeObserver.observe(container);

    // Trigger initial resize
    const rect = container.getBoundingClientRect();
    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height);
  }

  setCentered(width?: number, height?: number): void {
    this.dispose();
    this.injectStyles();

    // Create centered container
    const container = document.createElement('div');
    container.className = 'threejs-centered-container';

    // Custom sizing if provided
    if (width) {
      container.style.width = `${width}px`;
      container.style.maxWidth = `${width}px`;
    }
    if (height) {
      container.style.height = `${height}px`;
      container.style.maxHeight = `${height}px`;
    }

    // Add to body
    document.body.appendChild(container);
    document.body.classList.add('threejs-centered-layout');

    // Use custom layout with ResizeObserver
    this.setCustom({ container });
    this.currentContainer = container;
  }

  dispose(): void {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = undefined;
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = undefined;
    }

    // Remove current container if it was created by us
    if (this.currentContainer?.className === 'threejs-centered-container') {
      this.currentContainer.remove();
      document.body.classList.remove('threejs-centered-layout');
      this.currentContainer = undefined;
    }
  }
}
