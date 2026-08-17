/**
 * DragBehavior.ts
 *
 * The pointer-drag idiom that demos across this repo were each rewriting by
 * hand: convert the pointer to NDC, raycast, decide whether the press grabbed
 * anything, and — if it did — suppress the orbit controls and capture the
 * pointer until release.
 *
 * The awkward part of that idiom is not the raycasting, it's the arbitration
 * with OrbitControls: a press that hits nothing must fall through to the camera,
 * a press that grabs something must not. `onDragStart` expresses exactly that
 * by returning a handle or `null` — return `null` and the camera gets the drag.
 *
 * The handle is whatever identifies the thing being dragged (an index, a string
 * tag, an object); it is handed back to every subsequent `onDrag` call, so a
 * drag needs no module-level mutable state to remember what it grabbed.
 *
 * @example
 *   const drag = new DragBehavior<number>({
 *     camera: app.camera,
 *     domElement: app.renderManager.renderer.domElement,
 *     controls: app.controls.controls,
 *     onDragStart: ({ raycaster }) => {
 *       const i = nearestHandleTo(raycaster);
 *       return i >= 0 ? i : null;      // null → orbit the camera instead
 *     },
 *     onDrag: (i, { raycaster }) => movePoint(i, raycaster),
 *   });
 */

import * as THREE from 'three';

/** Pointer state for one event, with the raycaster already aimed. */
export interface DragContext {
  /** Pointer position in normalized device coordinates, both in [-1, 1]. */
  ndc: THREE.Vector2;
  /** Raycaster already configured from `ndc` and the camera. */
  raycaster: THREE.Raycaster;
  /** The originating pointer event. */
  event: PointerEvent;
}

/** Anything with an `enabled` flag — OrbitControls, in practice. */
export interface Suppressible {
  enabled: boolean;
}

export interface DragBehaviorOptions<T> {
  camera: THREE.Camera;
  domElement: HTMLElement;

  /**
   * Controls to suppress while a drag is active. Typically
   * `app.controls.controls`. Omit to leave camera control alone.
   */
  controls?: Suppressible;

  /**
   * Decide what this press grabbed. Return a handle to begin a drag, or `null`
   * to let the event through to the camera controls.
   */
  onDragStart: (ctx: DragContext) => T | null;

  /** Called on each pointer move while a drag is active. */
  onDrag: (handle: T, ctx: DragContext) => void;

  /** Called once when the drag ends, whether by release or cancellation. */
  onDragEnd?: (handle: T, ctx: DragContext) => void;

  /** Called on pointer moves when no drag is active. */
  onHover?: (ctx: DragContext) => void;

  /**
   * Called on a press that grabbed something but was released without moving
   * past `clickSlop` pixels — the natural place to hang "click to add".
   */
  onClick?: (handle: T, ctx: DragContext) => void;

  /** Movement in pixels below which a release counts as a click (default 4). */
  clickSlop?: number;
}

export class DragBehavior<T> {
  private readonly camera: THREE.Camera;
  private readonly domElement: HTMLElement;
  private readonly controls?: Suppressible;
  private readonly options: DragBehaviorOptions<T>;
  private readonly clickSlop: number;

  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();

  private handle: T | null = null;
  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private moved = false;

  constructor(options: DragBehaviorOptions<T>) {
    this.options = options;
    this.camera = options.camera;
    this.domElement = options.domElement;
    this.controls = options.controls;
    this.clickSlop = options.clickSlop ?? 4;

    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.domElement.addEventListener('pointermove', this.onPointerMove);
    this.domElement.addEventListener('pointerup', this.onPointerUp);
    this.domElement.addEventListener('pointercancel', this.onPointerCancel);
  }

  /** True while a drag is in progress. */
  get dragging(): boolean {
    return this.handle !== null;
  }

  /**
   * Aim the shared raycaster at a pointer event and return the context. Public
   * so a caller can reuse the same NDC conversion outside a drag.
   */
  contextFor(event: PointerEvent): DragContext {
    const rect = this.domElement.getBoundingClientRect();
    this.ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    return { ndc: this.ndc, raycaster: this.raycaster, event };
  }

  private onPointerDown = (event: PointerEvent): void => {
    if (this.handle !== null) return; // ignore a second finger mid-drag

    const handle = this.options.onDragStart(this.contextFor(event));
    if (handle === null) return; // nothing grabbed — the camera keeps the drag

    this.handle = handle;
    this.pointerId = event.pointerId;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.moved = false;

    if (this.controls) this.controls.enabled = false;
    this.domElement.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (this.handle === null) {
      this.options.onHover?.(this.contextFor(event));
      return;
    }
    if (event.pointerId !== this.pointerId) return;

    if (!this.moved && Math.hypot(event.clientX - this.startX, event.clientY - this.startY) > this.clickSlop) {
      this.moved = true;
    }

    this.options.onDrag(this.handle, this.contextFor(event));
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (this.handle === null || event.pointerId !== this.pointerId) return;

    const handle = this.handle;
    const ctx = this.contextFor(event);
    this.release(event);

    // A press that never moved is a click. Report it after releasing, so a
    // handler is free to start its own drag-free interaction.
    if (!this.moved) this.options.onClick?.(handle, ctx);
    this.options.onDragEnd?.(handle, ctx);
  };

  private onPointerCancel = (event: PointerEvent): void => {
    if (this.handle === null || event.pointerId !== this.pointerId) return;
    const handle = this.handle;
    const ctx = this.contextFor(event);
    this.release(event);
    this.options.onDragEnd?.(handle, ctx);
  };

  private release(event: PointerEvent): void {
    this.handle = null;
    this.pointerId = null;
    if (this.controls) this.controls.enabled = true;
    if (this.domElement.hasPointerCapture(event.pointerId)) {
      this.domElement.releasePointerCapture(event.pointerId);
    }
  }

  dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('pointercancel', this.onPointerCancel);
    if (this.controls) this.controls.enabled = true;
  }
}
