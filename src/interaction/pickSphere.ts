/**
 * pickSphere.ts
 *
 * Ray → sphere picking that always yields a point.
 *
 * A plain `Raycaster.intersectObject` on a sphere returns nothing once the
 * cursor leaves the silhouette, which makes dragging on a sphere feel broken:
 * a curve being traced stops dead the moment the pointer crosses the rim, and
 * a grabbed point is dropped. For interaction the useful answer is "the point
 * on the sphere the user is closest to indicating", which is defined
 * everywhere — on the silhouette when the ray misses.
 *
 * `hit` distinguishes the two cases, so a caller can still require a genuine
 * intersection to *start* an interaction while allowing the drag to continue
 * off the edge.
 */

import * as THREE from 'three';

export interface SpherePick {
  /** A point on the sphere: the near intersection, or the closest silhouette point. */
  point: THREE.Vector3;
  /** True when the ray genuinely intersects the sphere. */
  hit: boolean;
}

const toCenter = new THREE.Vector3();
const closest = new THREE.Vector3();

/**
 * Pick a point on a sphere from an aimed raycaster.
 *
 * @param raycaster - already configured via `setFromCamera`
 * @param center - sphere centre in world space
 * @param radius - sphere radius
 * @param out - optional vector to write the result into
 */
export function pickSphere(
  raycaster: THREE.Raycaster,
  center: THREE.Vector3,
  radius: number,
  out?: THREE.Vector3,
): SpherePick {
  const point = out ?? new THREE.Vector3();
  const origin = raycaster.ray.origin;
  const dir = raycaster.ray.direction; // Raycaster keeps this normalized

  toCenter.subVectors(center, origin);

  // Distance along the ray to the point nearest the centre. Clamped at 0 so a
  // sphere behind the camera still resolves to a sensible (front-facing) point
  // rather than a reflection through the origin.
  const along = Math.max(0, toCenter.dot(dir));

  closest.copy(dir).multiplyScalar(along).add(origin);
  const gap2 = closest.distanceToSquared(center);
  const r2 = radius * radius;

  if (gap2 <= r2 && along > 0) {
    // Genuine intersection: step back from the closest approach to the surface.
    const halfChord = Math.sqrt(r2 - gap2);
    const t = along - halfChord;
    // A camera inside the sphere sees the far wall instead.
    point.copy(dir).multiplyScalar(t > 0 ? t : along + halfChord).add(origin);
    return { point, hit: true };
  }

  // Miss: project the closest approach radially onto the sphere. This lands on
  // the silhouette as seen from the camera, so the picked point tracks the
  // cursor continuously across the rim.
  point.subVectors(closest, center);
  if (point.lengthSq() < 1e-20) {
    // Ray aimed exactly at the centre from inside — no meaningful direction.
    point.copy(dir).multiplyScalar(radius).add(center);
    return { point, hit: false };
  }
  point.setLength(radius).add(center);
  return { point, hit: false };
}
