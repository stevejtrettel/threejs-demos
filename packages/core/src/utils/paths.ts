import * as THREE from 'three';

/**
 * Path manipulation utilities for working with arrays of Vector3 points
 */

/**
 * Resample a path to have a specific number of evenly-spaced points
 *
 * @param path - Original path points
 * @param numPoints - Desired number of output points
 * @returns New path with evenly spaced points along original curve
 *
 * @example
 *   const smoothPath = resamplePath(roughPath, 100);
 */
export function resamplePath(path: THREE.Vector3[], numPoints: number): THREE.Vector3[] {
  if (path.length < 2 || numPoints < 2) {
    return path;
  }

  // Compute cumulative arc length
  const lengths = [0];
  let totalLength = 0;

  for (let i = 1; i < path.length; i++) {
    totalLength += path[i].distanceTo(path[i - 1]);
    lengths.push(totalLength);
  }

  if (totalLength === 0) {
    return [path[0].clone()];
  }

  // Sample at even intervals along arc length
  const resampled: THREE.Vector3[] = [];
  const targetLength = totalLength / (numPoints - 1);

  for (let i = 0; i < numPoints; i++) {
    const targetDist = i * targetLength;

    // Find segment containing this distance
    let segIdx = 0;
    for (let j = 0; j < lengths.length - 1; j++) {
      if (targetDist >= lengths[j] && targetDist <= lengths[j + 1]) {
        segIdx = j;
        break;
      }
    }

    // Interpolate within segment
    const segStart = lengths[segIdx];
    const segEnd = lengths[segIdx + 1];
    const segLength = segEnd - segStart;

    if (segLength === 0) {
      resampled.push(path[segIdx].clone());
    } else {
      const t = (targetDist - segStart) / segLength;
      const p1 = path[segIdx];
      const p2 = path[segIdx + 1];
      resampled.push(new THREE.Vector3().lerpVectors(p1, p2, t));
    }
  }

  return resampled;
}

/**
 * Subdivide a path by adding points when segments are too long
 *
 * @param path - Original path
 * @param maxSegmentLength - Maximum allowed segment length
 * @returns Path with additional points inserted
 */
export function subdividePath(path: THREE.Vector3[], maxSegmentLength: number): THREE.Vector3[] {
  if (path.length < 2) {
    return path;
  }

  const result: THREE.Vector3[] = [path[0].clone()];

  for (let i = 1; i < path.length; i++) {
    const p1 = path[i - 1];
    const p2 = path[i];
    const dist = p1.distanceTo(p2);

    if (dist > maxSegmentLength) {
      // Insert intermediate points
      const numDivisions = Math.ceil(dist / maxSegmentLength);
      for (let j = 1; j < numDivisions; j++) {
        const t = j / numDivisions;
        result.push(new THREE.Vector3().lerpVectors(p1, p2, t));
      }
    }

    result.push(p2.clone());
  }

  return result;
}

/**
 * Compute total arc length of a path
 */
export function computePathLength(path: THREE.Vector3[]): number {
  if (path.length < 2) return 0;

  let length = 0;
  for (let i = 1; i < path.length; i++) {
    length += path[i].distanceTo(path[i - 1]);
  }
  return length;
}

/**
 * Close a path by connecting last point to first (if not already closed)
 *
 * @param path - Path to close
 * @param tolerance - Distance threshold for considering path already closed
 * @returns Closed path
 */
export function closePath(path: THREE.Vector3[], tolerance: number = 1e-6): THREE.Vector3[] {
  if (path.length < 2) return path;

  const first = path[0];
  const last = path[path.length - 1];

  if (first.distanceTo(last) < tolerance) {
    // Already closed
    return path;
  }

  // Add first point at end
  return [...path, first.clone()];
}

/**
 * Reverse the direction of a path
 */
export function reversePath(path: THREE.Vector3[]): THREE.Vector3[] {
  return path.map(p => p.clone()).reverse();
}

/**
 * Remove duplicate consecutive points from a path
 *
 * @param path - Path to clean
 * @param tolerance - Distance threshold for considering points duplicates
 */
export function removeDuplicates(path: THREE.Vector3[], tolerance: number = 1e-6): THREE.Vector3[] {
  if (path.length < 2) return path;

  const cleaned: THREE.Vector3[] = [path[0].clone()];

  for (let i = 1; i < path.length; i++) {
    const prev = cleaned[cleaned.length - 1];
    const curr = path[i];

    if (prev.distanceTo(curr) > tolerance) {
      cleaned.push(curr.clone());
    }
  }

  return cleaned;
}

/**
 * Apply a transformation matrix to all points in a path
 */
export function transformPath(path: THREE.Vector3[], matrix: THREE.Matrix4): THREE.Vector3[] {
  return path.map(p => p.clone().applyMatrix4(matrix));
}

/**
 * Smooth a path using moving average
 *
 * @param path - Path to smooth
 * @param windowSize - Number of points to average (must be odd)
 */
export function smoothPath(path: THREE.Vector3[], windowSize: number = 3): THREE.Vector3[] {
  if (path.length < windowSize || windowSize < 3) {
    return path;
  }

  if (windowSize % 2 === 0) {
    windowSize += 1; // Ensure odd window size
  }

  const halfWindow = Math.floor(windowSize / 2);
  const smoothed: THREE.Vector3[] = [];

  for (let i = 0; i < path.length; i++) {
    const sum = new THREE.Vector3();
    let count = 0;

    for (let j = -halfWindow; j <= halfWindow; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < path.length) {
        sum.add(path[idx]);
        count++;
      }
    }

    smoothed.push(sum.divideScalar(count));
  }

  return smoothed;
}

/**
 * Get a point at a specific arc length along the path
 *
 * @param path - Path to sample
 * @param distance - Arc length distance from start
 * @returns Point at that distance, or null if distance is out of range
 */
export function getPointAtDistance(path: THREE.Vector3[], distance: number): THREE.Vector3 | null {
  if (path.length < 2 || distance < 0) return null;

  let accumulated = 0;

  for (let i = 1; i < path.length; i++) {
    const segmentLength = path[i].distanceTo(path[i - 1]);

    if (accumulated + segmentLength >= distance) {
      // Found the segment
      const t = (distance - accumulated) / segmentLength;
      return new THREE.Vector3().lerpVectors(path[i - 1], path[i], t);
    }

    accumulated += segmentLength;
  }

  // Distance is beyond path end
  return null;
}
