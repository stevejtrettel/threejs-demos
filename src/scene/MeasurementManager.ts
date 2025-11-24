/**
 * MeasurementManager - Measurement and annotation tools
 *
 * Provides interactive measurement and annotation for 3D scenes:
 * - Coordinate display on hover
 * - Distance measurement between points
 * - 3D text labels (billboard)
 * - Measurement mode toggle
 *
 * Usage:
 *   app.measurements.enable();
 *   app.measurements.showCoordinates(true);
 *   const dist = app.measurements.distance(point1, point2);
 *   app.measurements.addLabel('Origin', new THREE.Vector3(0,0,0));
 */

import * as THREE from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';

export interface LabelOptions {
  color?: number;          // Text color (default: 0xffffff)
  size?: number;           // Text size (default: 0.5)
  billboard?: boolean;     // Always face camera (default: true)
  offset?: THREE.Vector3;  // Offset from position (default: (0, 0.5, 0))
}

export interface MeasurementPoint {
  position: THREE.Vector3;
  marker: THREE.Mesh;
}

export class MeasurementManager {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private domElement: HTMLElement;

  // Measurement state
  private enabled: boolean = false;
  private showingCoordinates: boolean = false;
  private coordinateOverlay: HTMLDivElement | null = null;

  // Measurement mode
  private measurementMode: 'none' | 'distance' = 'none';
  private measurementPoints: MeasurementPoint[] = [];
  private distanceLines = new Map<string, THREE.Line>();
  private distanceLabels = new Map<string, THREE.Sprite>();

  // Labels
  private labels = new Map<string, THREE.Sprite | THREE.Mesh>();
  private billboardLabels: THREE.Sprite[] = [];

  // Font for 3D text labels
  private font: any = null;
  private fontLoaded: boolean = false;

  constructor(scene: THREE.Scene, camera: THREE.Camera, domElement: HTMLElement) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;

    // Bind event handlers
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  // ===== Enable/Disable =====

  /**
   * Enable measurement tools
   */
  enable(): void {
    if (this.enabled) return;

    this.domElement.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('click', this.onClick);
    this.enabled = true;

    console.log('MeasurementManager: Enabled');
  }

  /**
   * Disable measurement tools
   */
  disable(): void {
    if (!this.enabled) return;

    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('click', this.onClick);
    this.enabled = false;

    this.showCoordinates(false);
    this.exitMeasurementMode();

    console.log('MeasurementManager: Disabled');
  }

  // ===== Coordinate Display =====

  /**
   * Show or hide coordinate overlay
   */
  showCoordinates(show: boolean): void {
    if (show && !this.coordinateOverlay) {
      this.createCoordinateOverlay();
    } else if (!show && this.coordinateOverlay) {
      this.coordinateOverlay.remove();
      this.coordinateOverlay = null;
    }

    this.showingCoordinates = show;
  }

  private createCoordinateOverlay(): void {
    this.coordinateOverlay = document.createElement('div');
    this.coordinateOverlay.id = 'coordinate-overlay';
    this.coordinateOverlay.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 16px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      border-radius: 4px;
      z-index: 10000;
      pointer-events: none;
      user-select: none;
      min-width: 200px;
    `;

    this.coordinateOverlay.innerHTML = `
      <div style="color: #8bb4e8; margin-bottom: 6px; font-weight: bold;">Cursor Position</div>
      <div><strong>X:</strong> <span class="coord-x">--</span></div>
      <div><strong>Y:</strong> <span class="coord-y">--</span></div>
      <div><strong>Z:</strong> <span class="coord-z">--</span></div>
    `;

    document.body.appendChild(this.coordinateOverlay);
  }

  private updateCoordinateDisplay(point: THREE.Vector3): void {
    if (!this.coordinateOverlay) return;

    const xSpan = this.coordinateOverlay.querySelector('.coord-x');
    const ySpan = this.coordinateOverlay.querySelector('.coord-y');
    const zSpan = this.coordinateOverlay.querySelector('.coord-z');

    if (xSpan) xSpan.textContent = point.x.toFixed(3);
    if (ySpan) ySpan.textContent = point.y.toFixed(3);
    if (zSpan) zSpan.textContent = point.z.toFixed(3);
  }

  // ===== Distance Measurement =====

  /**
   * Calculate distance between two points
   */
  distance(point1: THREE.Vector3, point2: THREE.Vector3): number {
    return point1.distanceTo(point2);
  }

  /**
   * Enter distance measurement mode
   * Click two points to measure distance
   */
  enterDistanceMeasurementMode(): void {
    this.measurementMode = 'distance';
    this.measurementPoints = [];
    console.log('MeasurementManager: Enter distance measurement mode (click two points)');
  }

  /**
   * Exit measurement mode and clear measurements
   */
  exitMeasurementMode(): void {
    this.measurementMode = 'none';

    // Remove markers
    for (const point of this.measurementPoints) {
      this.scene.remove(point.marker);
      point.marker.geometry.dispose();
      (point.marker.material as THREE.Material).dispose();
    }
    this.measurementPoints = [];

    // Remove distance lines
    for (const line of this.distanceLines.values()) {
      this.scene.remove(line);
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    }
    this.distanceLines.clear();

    // Remove distance labels
    for (const label of this.distanceLabels.values()) {
      this.scene.remove(label);
      label.material.dispose();
    }
    this.distanceLabels.clear();

    console.log('MeasurementManager: Exited measurement mode');
  }

  /**
   * Clear all measurements (but stay in measurement mode)
   */
  clearMeasurements(): void {
    this.exitMeasurementMode();
    if (this.measurementMode !== 'none') {
      this.enterDistanceMeasurementMode();
    }
  }

  private addMeasurementPoint(point: THREE.Vector3): void {
    // Create marker sphere
    const markerGeometry = new THREE.SphereGeometry(0.05);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(point);
    this.scene.add(marker);

    this.measurementPoints.push({ position: point.clone(), marker });

    // If two points, draw line and show distance
    if (this.measurementPoints.length === 2) {
      const p1 = this.measurementPoints[0].position;
      const p2 = this.measurementPoints[1].position;

      this.drawDistanceLine(p1, p2);
      this.measurementPoints = [];  // Reset for next measurement
    }
  }

  private drawDistanceLine(p1: THREE.Vector3, p2: THREE.Vector3): void {
    // Create line
    const points = [p1, p2];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);

    const id = `${Date.now()}`;
    this.distanceLines.set(id, line);

    // Calculate distance
    const dist = this.distance(p1, p2);

    // Create label at midpoint
    const midpoint = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
    const label = this.createDistanceLabel(`${dist.toFixed(3)}`, midpoint);
    this.scene.add(label);
    this.distanceLabels.set(id, label);

    console.log(`Distance: ${dist.toFixed(3)}`);
  }

  private createDistanceLabel(text: string, position: THREE.Vector3): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 256;
    canvas.height = 64;

    // Draw background
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    context.fillStyle = '#ffff00';
    context.font = 'bold 32px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(material);
    sprite.position.copy(position);
    sprite.scale.set(0.5, 0.125, 1);

    return sprite;
  }

  // ===== 3D Labels =====

  /**
   * Add a text label at a 3D position
   */
  addLabel(name: string, position: THREE.Vector3, text: string, options: LabelOptions = {}): void {
    const color = options.color ?? 0xffffff;
    const size = options.size ?? 0.5;
    const billboard = options.billboard ?? true;
    const offset = options.offset ?? new THREE.Vector3(0, 0.5, 0);

    if (billboard) {
      // Create billboard sprite label
      const label = this.createSpriteLabel(text, color, size);
      label.position.copy(position).add(offset);
      this.scene.add(label);
      this.labels.set(name, label);
      this.billboardLabels.push(label);
    } else {
      // Create 3D text label (requires font)
      if (this.fontLoaded && this.font) {
        const label = this.create3DTextLabel(text, color, size);
        label.position.copy(position).add(offset);
        this.scene.add(label);
        this.labels.set(name, label);
      } else {
        console.warn('MeasurementManager: 3D text requires font to be loaded. Using sprite label instead.');
        const label = this.createSpriteLabel(text, color, size);
        label.position.copy(position).add(offset);
        this.scene.add(label);
        this.labels.set(name, label);
        this.billboardLabels.push(label);
      }
    }

    console.log(`MeasurementManager: Added label '${name}' at (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
  }

  /**
   * Remove a label by name
   */
  removeLabel(name: string): void {
    const label = this.labels.get(name);
    if (label) {
      this.scene.remove(label);

      // Dispose material
      if (label instanceof THREE.Sprite) {
        label.material.dispose();
        if (label.material.map) {
          label.material.map.dispose();
        }

        // Remove from billboard list
        const index = this.billboardLabels.indexOf(label);
        if (index !== -1) {
          this.billboardLabels.splice(index, 1);
        }
      } else if (label instanceof THREE.Mesh) {
        label.geometry.dispose();
        (label.material as THREE.Material).dispose();
      }

      this.labels.delete(name);
      console.log(`MeasurementManager: Removed label '${name}'`);
    }
  }

  /**
   * Clear all labels
   */
  clearLabels(): void {
    const labelNames = Array.from(this.labels.keys());
    for (const name of labelNames) {
      this.removeLabel(name);
    }
    console.log('MeasurementManager: Cleared all labels');
  }

  private createSpriteLabel(text: string, color: number, size: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    canvas.width = 512;
    canvas.height = 128;

    // Draw background
    context.fillStyle = 'rgba(0, 0, 0, 0.6)';
    context.fillRect(0, 0, canvas.width, canvas.height);

    // Draw text
    const colorObj = new THREE.Color(color);
    context.fillStyle = `#${colorObj.getHexString()}`;
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

  private create3DTextLabel(text: string, color: number, size: number): THREE.Mesh {
    const geometry = new TextGeometry(text, {
      font: this.font,
      size: size,
      height: size * 0.1,
    });
    geometry.center();

    const material = new THREE.MeshBasicMaterial({ color });
    return new THREE.Mesh(geometry, material);
  }

  // ===== Update (for billboards) =====

  /**
   * Update billboard labels to face camera
   * Call this in your animation loop
   */
  update(): void {
    // Billboard labels automatically face camera (Sprite behavior)
    // This method is here for future per-frame updates if needed
  }

  // ===== Event Handlers =====

  private onMouseMove(event: MouseEvent): void {
    if (!this.enabled) return;

    // Update coordinate display if active
    if (this.showingCoordinates) {
      // Simple raycasting to ground plane for now
      // In production, you'd want to raycast to actual scene objects
      const rect = this.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, this.camera);

      // Raycast to XZ plane (y=0)
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const point = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, point);

      if (point) {
        this.updateCoordinateDisplay(point);
      }
    }
  }

  private onClick(event: MouseEvent): void {
    if (!this.enabled) return;

    // Handle distance measurement mode
    if (this.measurementMode === 'distance') {
      const rect = this.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, this.camera);

      // Raycast to XZ plane (y=0) for now
      // In production, you'd want to raycast to actual scene objects
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const point = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, point);

      if (point) {
        this.addMeasurementPoint(point);
      }
    }
  }

  // ===== Cleanup =====

  /**
   * Clean up resources
   */
  dispose(): void {
    this.disable();
    this.clearLabels();
    this.clearMeasurements();
    console.log('MeasurementManager: Disposed');
  }
}
