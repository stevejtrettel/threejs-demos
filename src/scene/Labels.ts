/**
 * Labels - Simple 3D text labels for scenes
 *
 * Billboard sprites that always face the camera.
 *
 * Usage:
 *   const labels = new Labels(scene);
 *   labels.add('origin', new THREE.Vector3(0,0,0), 'Origin');
 *   labels.add('peak', position, 'Maximum', { color: 0xff0000, size: 0.5 });
 *   labels.remove('origin');
 *   labels.clear();
 */

import * as THREE from 'three';

export interface LabelOptions {
  color?: number;          // Text color (default: 0xffffff)
  size?: number;           // Label size (default: 0.5)
  backgroundColor?: number; // Background color (default: 0x000000)
  backgroundOpacity?: number; // Background opacity (default: 0.6)
  offset?: THREE.Vector3;  // Offset from position (default: (0, 0, 0))
}

export class Labels {
  private scene: THREE.Scene;
  private labels = new Map<string, THREE.Sprite>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * Add a label at a 3D position
   */
  add(name: string, position: THREE.Vector3, text: string, options: LabelOptions = {}): THREE.Sprite {
    // Remove existing label with same name
    if (this.labels.has(name)) {
      this.remove(name);
    }

    const color = options.color ?? 0xffffff;
    const size = options.size ?? 0.5;
    const backgroundColor = options.backgroundColor ?? 0x000000;
    const backgroundOpacity = options.backgroundOpacity ?? 0.6;
    const offset = options.offset ?? new THREE.Vector3(0, 0, 0);

    const sprite = this.createSprite(text, color, size, backgroundColor, backgroundOpacity);
    sprite.position.copy(position).add(offset);
    sprite.name = name;

    this.scene.add(sprite);
    this.labels.set(name, sprite);

    return sprite;
  }

  /**
   * Remove a label by name
   */
  remove(name: string): boolean {
    const label = this.labels.get(name);
    if (!label) return false;

    this.scene.remove(label);
    label.material.dispose();
    if (label.material.map) {
      label.material.map.dispose();
    }

    this.labels.delete(name);
    return true;
  }

  /**
   * Get a label by name
   */
  get(name: string): THREE.Sprite | undefined {
    return this.labels.get(name);
  }

  /**
   * Check if a label exists
   */
  has(name: string): boolean {
    return this.labels.has(name);
  }

  /**
   * Update label position
   */
  setPosition(name: string, position: THREE.Vector3): void {
    const label = this.labels.get(name);
    if (label) {
      label.position.copy(position);
    }
  }

  /**
   * Update label text
   */
  setText(name: string, text: string, options: LabelOptions = {}): void {
    const label = this.labels.get(name);
    if (!label) return;

    const position = label.position.clone();
    this.remove(name);
    this.add(name, position, text, options);
  }

  /**
   * Clear all labels
   */
  clear(): void {
    for (const name of this.labels.keys()) {
      this.remove(name);
    }
  }

  /**
   * Get all label names
   */
  list(): string[] {
    return Array.from(this.labels.keys());
  }

  /**
   * Dispose all labels
   */
  dispose(): void {
    this.clear();
  }

  private createSprite(
    text: string,
    color: number,
    size: number,
    backgroundColor: number,
    backgroundOpacity: number
  ): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 512;
    canvas.height = 128;

    // Draw background
    const bgColor = new THREE.Color(backgroundColor);
    context.fillStyle = `rgba(${Math.floor(bgColor.r * 255)}, ${Math.floor(bgColor.g * 255)}, ${Math.floor(bgColor.b * 255)}, ${backgroundOpacity})`;
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    const textColor = new THREE.Color(color);
    context.fillStyle = `#${textColor.getHexString()}`;
    context.font = 'bold 48px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(size * 2, size * 0.5, 1);

    return sprite;
  }
}
