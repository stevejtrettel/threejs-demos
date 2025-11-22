import * as THREE from 'three';

/**
 * Connect disconnected line segments into continuous paths
 *
 * Takes an array of line segments and traces them into connected paths.
 * Handles both closed loops and open curves.
 *
 * @param segments - Array of line segments, each defined by two endpoints
 * @param tolerance - Distance threshold for considering points connected (default: 1e-6)
 * @returns Array of paths, where each path is an array of connected points
 *
 * @example
 *   const segments = [
 *     [new Vector3(0,0,0), new Vector3(1,0,0)],
 *     [new Vector3(1,0,0), new Vector3(1,1,0)],
 *     [new Vector3(1,1,0), new Vector3(0,0,0)]  // Closes the loop
 *   ];
 *   const paths = connectLineSegments(segments);
 *   // Returns: [[Vector3(0,0,0), Vector3(1,0,0), Vector3(1,1,0), Vector3(0,0,0)]]
 */
export function connectLineSegments(
  segments: Array<[THREE.Vector3, THREE.Vector3]>,
  tolerance: number = 1e-6
): THREE.Vector3[][] {
  if (segments.length === 0) {
    return [];
  }

  // Build adjacency structure
  // Map from point (as string key) to segments that touch it
  const pointToSegments = new Map<string, number[]>();

  const getKey = (p: THREE.Vector3): string => {
    // Round to avoid floating point issues
    const x = Math.round(p.x / tolerance) * tolerance;
    const y = Math.round(p.y / tolerance) * tolerance;
    const z = Math.round(p.z / tolerance) * tolerance;
    return `${x},${y},${z}`;
  };

  // Build the graph
  segments.forEach((seg, idx) => {
    const key0 = getKey(seg[0]);
    const key1 = getKey(seg[1]);

    if (!pointToSegments.has(key0)) {
      pointToSegments.set(key0, []);
    }
    if (!pointToSegments.has(key1)) {
      pointToSegments.set(key1, []);
    }

    pointToSegments.get(key0)!.push(idx);
    pointToSegments.get(key1)!.push(idx);
  });

  // Track which segments have been used
  const used = new Set<number>();
  const paths: THREE.Vector3[][] = [];

  // Trace a path starting from a segment
  const tracePath = (startIdx: number): THREE.Vector3[] => {
    const path: THREE.Vector3[] = [];
    let currentIdx = startIdx;
    let currentPoint = segments[currentIdx][0];
    let prevPoint: THREE.Vector3 | null = null;

    while (currentIdx !== -1 && !used.has(currentIdx)) {
      used.add(currentIdx);
      const seg = segments[currentIdx];

      // Add the current segment to path
      if (path.length === 0) {
        path.push(seg[0].clone());
        path.push(seg[1].clone());
        currentPoint = seg[1];
        prevPoint = seg[0];
      } else {
        // Determine which end connects to our current point
        const key0 = getKey(seg[0]);
        const key1 = getKey(seg[1]);
        const keyCurrent = getKey(currentPoint);

        if (key0 === keyCurrent) {
          path.push(seg[1].clone());
          prevPoint = seg[0];
          currentPoint = seg[1];
        } else {
          path.push(seg[0].clone());
          prevPoint = seg[1];
          currentPoint = seg[0];
        }
      }

      // Find next segment
      const currentKey = getKey(currentPoint);
      const candidates = pointToSegments.get(currentKey) || [];
      let nextIdx = -1;

      for (const candIdx of candidates) {
        if (!used.has(candIdx) && candIdx !== currentIdx) {
          nextIdx = candIdx;
          break;
        }
      }

      currentIdx = nextIdx;
    }

    // Check if path is closed (first and last points are same)
    if (path.length > 2) {
      const first = path[0];
      const last = path[path.length - 1];
      if (first.distanceTo(last) < tolerance) {
        // It's a closed loop, remove duplicate endpoint
        path.pop();
      }
    }

    return path;
  };

  // Trace all paths
  for (let i = 0; i < segments.length; i++) {
    if (!used.has(i)) {
      const path = tracePath(i);
      if (path.length >= 2) {
        paths.push(path);
      }
    }
  }

  return paths;
}

/**
 * Determine if a path is closed (forms a loop)
 */
export function isPathClosed(path: THREE.Vector3[], tolerance: number = 1e-6): boolean {
  if (path.length < 3) {
    return false;
  }
  return path[0].distanceTo(path[path.length - 1]) < tolerance;
}
