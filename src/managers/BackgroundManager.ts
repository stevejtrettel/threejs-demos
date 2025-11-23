import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

export interface StarfieldOptions {
  count?: number;
  size?: number;
}

export class BackgroundManager {
  private scene: THREE.Scene;
  private renderer: THREE.WebGLRenderer;
  private pmremGenerator: THREE.PMREMGenerator;
  private rgbeLoader: RGBELoader;
  private currentEnvMap?: THREE.Texture;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.pmremGenerator = new THREE.PMREMGenerator(renderer);
    this.rgbeLoader = new RGBELoader();
  }

  setColor(color: number): void {
    this.scene.background = new THREE.Color(color);
  }

  setGradient(color1: string, color2: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;

    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 0, 512);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);

    const texture = new THREE.CanvasTexture(canvas);
    this.scene.background = texture;
  }

  setStarfield(options: StarfieldOptions = {}): void {
    const { count = 2000, size = 2 } = options;

    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 2048;

    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 2048, 2048);

    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 2048;
      const y = Math.random() * 2048;
      const radius = Math.random() * size;

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    this.scene.background = texture;
  }

  loadHDR(url: string, asEnvironment = true, asBackground = true): void {
    this.rgbeLoader.load(url, (texture) => {
      const envMap = this.pmremGenerator.fromEquirectangular(texture).texture;

      if (asEnvironment) {
        this.scene.environment = envMap;
      }
      if (asBackground) {
        this.scene.background = envMap;
      }

      this.currentEnvMap = envMap;
      texture.dispose();
    });
  }

  async loadHDRAsync(url: string, asEnvironment = true, asBackground = true): Promise<THREE.Texture> {
    const texture = await this.rgbeLoader.loadAsync(url);
    const envMap = this.pmremGenerator.fromEquirectangular(texture).texture;

    if (asEnvironment) {
      this.scene.environment = envMap;
    }
    if (asBackground) {
      this.scene.background = envMap;
    }

    this.currentEnvMap = envMap;
    texture.dispose();

    return envMap;
  }

  dispose(): void {
    this.currentEnvMap?.dispose();
    this.pmremGenerator.dispose();
  }
}
