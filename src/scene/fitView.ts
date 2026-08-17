/**
 * fitView.ts
 *
 * Keep a fixed piece of a scene inside the frame at any viewport shape.
 *
 * A demo laid out by hand is framed for whatever window it was written in. Drop
 * the same demo into a blog iframe half as wide and the camera does not care:
 * the vertical field of view is fixed, so a narrower viewport simply sees less
 * horizontally, and side-by-side panels walk off the edges. That is invisible
 * during development and obvious to a reader.
 *
 * This pulls the camera back — along its existing view direction, so the
 * composition is untouched — until a box of the given half-extents fits, and
 * redoes it whenever the viewport changes.
 *
 * It never moves *closer* than where the demo put it. A demo's own framing is a
 * deliberate choice, including its margins, so on a viewport wide enough to
 * honour it nothing happens at all; this only rescues the cases that would
 * otherwise be clipped.
 */

import * as THREE from 'three';

export interface FitViewOptions {
  /** Half-width of the region to keep visible, in world units about the target. */
  halfWidth: number;
  /** Half-height of the region to keep visible. */
  halfHeight: number;
  /**
   * Extra margin as a fraction of the extent (default 0.04). A little air stops
   * the outermost geometry from touching the frame edge.
   */
  padding?: number;
}

/**
 * Fit `camera` so the given extent stays visible, now and on every resize.
 *
 * @returns a function that removes the resize listener.
 */
export function fitView(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  options: FitViewOptions,
): () => void {
  const padding = options.padding ?? 0.04;
  const halfWidth = options.halfWidth * (1 + padding);
  const halfHeight = options.halfHeight * (1 + padding);

  // The distance the demo chose is the floor: it encodes the intended framing.
  const baseline = camera.position.distanceTo(target);
  const direction = new THREE.Vector3().subVectors(camera.position, target).normalize();

  const apply = (): void => {
    const halfFov = (camera.fov * Math.PI) / 360;
    const tan = Math.tan(halfFov);
    // Vertical is the plain case; horizontal picks up the aspect ratio, which
    // is what shrinks as the viewport narrows.
    const needed = Math.max(halfHeight / tan, halfWidth / (tan * camera.aspect));
    camera.position.copy(target).addScaledVector(direction, Math.max(needed, baseline));
    camera.updateProjectionMatrix();
  };

  apply();
  window.addEventListener('resize', apply);
  return () => window.removeEventListener('resize', apply);
}
