import * as THREE from 'three';

/**
 * SelectionManager
 *
 * Handles object picking, selection, and interaction in the 3D scene.
 *
 * Features:
 * - Raycasting for click and hover detection
 * - Visual highlighting of selected objects
 * - Click and hover callbacks
 * - Access to intersection points and object data
 *
 * Usage:
 *   const selection = new SelectionManager(scene, camera, renderer.domElement);
 *   selection.enable();
 *   selection.onObjectClick((object, point) => { ... });
 */

export interface IntersectionResult {
  object: THREE.Object3D;
  point: THREE.Vector3;
  distance: number;
  face: THREE.Face | null;
  faceIndex: number | null;
}

export class SelectionManager {
  private scene: THREE.Scene;
  private camera: THREE.Camera;
  private domElement: HTMLElement;
  private raycaster: THREE.Raycaster;
  private mouse: THREE.Vector2;

  private enabled: boolean = false;
  private selectedObject: THREE.Object3D | null = null;
  private hoveredObject: THREE.Object3D | null = null;

  // Highlight visualization
  private highlightWireframe: THREE.LineSegments | null = null;

  // Event callbacks
  private clickCallbacks: Array<(result: IntersectionResult | null) => void> = [];
  private hoverCallbacks: Array<(result: IntersectionResult | null) => void> = [];
  private selectCallbacks: Array<(object: THREE.Object3D | null) => void> = [];

  // Filtering
  private pickableObjects: Set<THREE.Object3D> = new Set();
  private ignoreObjects: Set<THREE.Object3D> = new Set();

  constructor(scene: THREE.Scene, camera: THREE.Camera, domElement: HTMLElement) {
    this.scene = scene;
    this.camera = camera;
    this.domElement = domElement;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    // Bind event handlers
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  /**
   * Enable picking and selection
   */
  enable(): void {
    if (this.enabled) return;

    this.domElement.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('click', this.onClick);
    this.enabled = true;
  }

  /**
   * Disable picking and selection
   */
  disable(): void {
    if (!this.enabled) return;

    this.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('click', this.onClick);
    this.enabled = false;
  }

  /**
   * Add object to pickable set (optional - if empty, all scene objects are pickable)
   */
  addPickable(object: THREE.Object3D): void {
    this.pickableObjects.add(object);
  }

  /**
   * Remove object from pickable set
   */
  removePickable(object: THREE.Object3D): void {
    this.pickableObjects.delete(object);
  }

  /**
   * Ignore object during picking (e.g., helpers, UI elements)
   */
  addIgnored(object: THREE.Object3D): void {
    this.ignoreObjects.add(object);
  }

  /**
   * Stop ignoring object
   */
  removeIgnored(object: THREE.Object3D): void {
    this.ignoreObjects.delete(object);
  }

  /**
   * Register callback for click events
   */
  onObjectClick(callback: (result: IntersectionResult | null) => void): void {
    this.clickCallbacks.push(callback);
  }

  /**
   * Register callback for hover events
   */
  onObjectHover(callback: (result: IntersectionResult | null) => void): void {
    this.hoverCallbacks.push(callback);
  }

  /**
   * Register callback for selection changes
   */
  onSelectionChange(callback: (object: THREE.Object3D | null) => void): void {
    this.selectCallbacks.push(callback);
  }

  /**
   * Get currently selected object
   */
  getSelected(): THREE.Object3D | null {
    return this.selectedObject;
  }

  /**
   * Programmatically select an object
   */
  select(object: THREE.Object3D | null): void {
    if (this.selectedObject === object) return;

    // Deselect previous
    if (this.selectedObject) {
      this.removeHighlight();
    }

    this.selectedObject = object;

    // Highlight new selection
    if (this.selectedObject) {
      this.addHighlight(this.selectedObject);
    }

    // Notify callbacks
    this.selectCallbacks.forEach(cb => cb(this.selectedObject));
  }

  /**
   * Deselect current object
   */
  deselect(): void {
    this.select(null);
  }

  /**
   * Perform raycast and return intersection
   */
  private raycast(mouseX: number, mouseY: number): IntersectionResult | null {
    // Update raycaster
    this.raycaster.setFromCamera(this.mouse, this.camera);

    // Determine what to raycast against
    let targets: THREE.Object3D[];
    if (this.pickableObjects.size > 0) {
      targets = Array.from(this.pickableObjects);
    } else {
      targets = this.scene.children;
    }

    // Perform raycast
    const intersects = this.raycaster.intersectObjects(targets, true);

    // Find first non-ignored intersection
    for (const intersect of intersects) {
      // Check if this object or any ancestor is ignored
      let obj: THREE.Object3D | null = intersect.object;
      let isIgnored = false;

      while (obj) {
        if (this.ignoreObjects.has(obj)) {
          isIgnored = true;
          break;
        }
        obj = obj.parent;
      }

      if (isIgnored) continue;

      // Found valid intersection
      return {
        object: intersect.object,
        point: intersect.point.clone(),
        distance: intersect.distance,
        face: intersect.face || null,
        faceIndex: intersect.faceIndex !== undefined ? intersect.faceIndex : null
      };
    }

    return null;
  }

  /**
   * Handle mouse move (hover detection)
   */
  private onMouseMove(event: MouseEvent): void {
    // Calculate mouse position in normalized device coordinates (-1 to +1)
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Perform raycast
    const result = this.raycast(this.mouse.x, this.mouse.y);

    // Check if hovered object changed
    const newHovered = result ? result.object : null;

    if (this.hoveredObject !== newHovered) {
      this.hoveredObject = newHovered;

      // Notify global hover callbacks
      this.hoverCallbacks.forEach(cb => cb(result));

      // Call per-object onHover callback if it exists
      if (result && (result.object as any).onHover) {
        (result.object as any).onHover(result);
      }

      // Update cursor
      this.domElement.style.cursor = this.hoveredObject ? 'pointer' : 'default';
    }
  }

  /**
   * Handle click (selection)
   */
  private onClick(event: MouseEvent): void {
    // Calculate mouse position
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Perform raycast
    const result = this.raycast(this.mouse.x, this.mouse.y);

    // Update selection
    if (result) {
      this.select(result.object);
    } else {
      this.deselect();
    }

    // Notify global click callbacks
    this.clickCallbacks.forEach(cb => cb(result));

    // Call per-object onClick callback if it exists
    if (result && (result.object as any).onClick) {
      (result.object as any).onClick(result);
    }
  }

  /**
   * Add wireframe highlight to selected object
   */
  private addHighlight(object: THREE.Object3D): void {
    // Only highlight meshes
    if (!(object instanceof THREE.Mesh)) return;

    // Create wireframe geometry
    const wireframeGeo = new THREE.WireframeGeometry(object.geometry);
    const wireframeMat = new THREE.LineBasicMaterial({
      color: 0xffff00,  // Yellow highlight
      linewidth: 2,
      transparent: true,
      opacity: 0.8
    });

    this.highlightWireframe = new THREE.LineSegments(wireframeGeo, wireframeMat);

    // Copy transform from original object
    this.highlightWireframe.position.copy(object.position);
    this.highlightWireframe.rotation.copy(object.rotation);
    this.highlightWireframe.scale.copy(object.scale);

    // Add to parent (or scene if no parent)
    if (object.parent) {
      object.parent.add(this.highlightWireframe);
    } else {
      this.scene.add(this.highlightWireframe);
    }

    // Store reference on the object for tracking
    (object as any).__selectionHighlight = this.highlightWireframe;
  }

  /**
   * Remove highlight from previously selected object
   */
  private removeHighlight(): void {
    if (this.highlightWireframe) {
      this.highlightWireframe.removeFromParent();
      this.highlightWireframe.geometry.dispose();
      (this.highlightWireframe.material as THREE.Material).dispose();
      this.highlightWireframe = null;
    }

    // Clean up reference
    if (this.selectedObject) {
      delete (this.selectedObject as any).__selectionHighlight;
    }
  }

  /**
   * Update highlight position (call if selected object moves)
   */
  updateHighlight(): void {
    if (!this.selectedObject || !this.highlightWireframe) return;

    if (this.selectedObject instanceof THREE.Mesh) {
      this.highlightWireframe.position.copy(this.selectedObject.position);
      this.highlightWireframe.rotation.copy(this.selectedObject.rotation);
      this.highlightWireframe.scale.copy(this.selectedObject.scale);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.disable();
    this.removeHighlight();
    this.clickCallbacks = [];
    this.hoverCallbacks = [];
    this.selectCallbacks = [];
    this.pickableObjects.clear();
    this.ignoreObjects.clear();
  }
}
