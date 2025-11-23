import * as THREE from 'three';

/**
 * Geometry computation utilities
 */

/**
 * Compute vertex normals for a triangle mesh from positions
 *
 * @param positions - Flat array of vertex positions [x,y,z, x,y,z, ...]
 * @returns Flat array of vertex normals (same format)
 */
export function computeNormals(positions: number[]): number[] {
  const normals = new Array(positions.length).fill(0);
  const vertexCount = positions.length / 3;

  // For each triangle
  for (let i = 0; i < vertexCount; i += 3) {
    const i0 = i * 3;
    const i1 = (i + 1) * 3;
    const i2 = (i + 2) * 3;

    // Get triangle vertices
    const v0 = new THREE.Vector3(positions[i0], positions[i0 + 1], positions[i0 + 2]);
    const v1 = new THREE.Vector3(positions[i1], positions[i1 + 1], positions[i1 + 2]);
    const v2 = new THREE.Vector3(positions[i2], positions[i2 + 1], positions[i2 + 2]);

    // Compute face normal
    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    const faceNormal = new THREE.Vector3().crossVectors(edge1, edge2);

    // Add to each vertex (will average later)
    normals[i0] += faceNormal.x;
    normals[i0 + 1] += faceNormal.y;
    normals[i0 + 2] += faceNormal.z;

    normals[i1] += faceNormal.x;
    normals[i1 + 1] += faceNormal.y;
    normals[i1 + 2] += faceNormal.z;

    normals[i2] += faceNormal.x;
    normals[i2 + 1] += faceNormal.y;
    normals[i2 + 2] += faceNormal.z;
  }

  // Normalize
  for (let i = 0; i < normals.length; i += 3) {
    const n = new THREE.Vector3(normals[i], normals[i + 1], normals[i + 2]);
    n.normalize();
    normals[i] = n.x;
    normals[i + 1] = n.y;
    normals[i + 2] = n.z;
  }

  return normals;
}

/**
 * Compute tangent vectors along a curve using finite differences
 *
 * @param points - Curve points
 * @param normalize - Whether to normalize tangent vectors
 * @returns Array of tangent vectors (one per point)
 */
export function computeTangents(points: THREE.Vector3[], normalize: boolean = true): THREE.Vector3[] {
  if (points.length < 2) {
    return points.map(() => new THREE.Vector3(1, 0, 0));
  }

  const tangents: THREE.Vector3[] = [];

  // First point: forward difference
  tangents.push(new THREE.Vector3().subVectors(points[1], points[0]));

  // Middle points: central difference
  for (let i = 1; i < points.length - 1; i++) {
    tangents.push(new THREE.Vector3().subVectors(points[i + 1], points[i - 1]));
  }

  // Last point: backward difference
  const last = points.length - 1;
  tangents.push(new THREE.Vector3().subVectors(points[last], points[last - 1]));

  // Normalize if requested
  if (normalize) {
    tangents.forEach(t => t.normalize());
  }

  return tangents;
}

/**
 * Project a 3D point onto a plane
 *
 * @param point - Point to project
 * @param planePoint - Point on the plane
 * @param planeNormal - Plane normal vector
 * @returns Projected point
 */
export function projectPointToPlane(
  point: THREE.Vector3,
  planePoint: THREE.Vector3,
  planeNormal: THREE.Vector3
): THREE.Vector3 {
  const normal = planeNormal.clone().normalize();
  const v = new THREE.Vector3().subVectors(point, planePoint);
  const dist = v.dot(normal);
  return point.clone().sub(normal.multiplyScalar(dist));
}

/**
 * Project multiple points onto a plane
 */
export function projectPointsToPlane(
  points: THREE.Vector3[],
  planePoint: THREE.Vector3,
  planeNormal: THREE.Vector3
): THREE.Vector3[] {
  return points.map(p => projectPointToPlane(p, planePoint, planeNormal));
}

/**
 * Compute the centroid (center of mass) of a set of points
 */
export function computeCentroid(points: THREE.Vector3[]): THREE.Vector3 {
  if (points.length === 0) {
    return new THREE.Vector3();
  }

  const sum = points.reduce(
    (acc, p) => acc.add(p),
    new THREE.Vector3()
  );

  return sum.divideScalar(points.length);
}

/**
 * Compute bounding box of points
 */
export function computeBoundingBox(points: THREE.Vector3[]): THREE.Box3 {
  const box = new THREE.Box3();

  if (points.length === 0) {
    return box;
  }

  box.setFromPoints(points);
  return box;
}

/**
 * Compute bounding sphere of points
 */
export function computeBoundingSphere(points: THREE.Vector3[]): THREE.Sphere {
  const sphere = new THREE.Sphere();

  if (points.length === 0) {
    return sphere;
  }

  const center = computeCentroid(points);
  let maxRadius = 0;

  for (const point of points) {
    const dist = point.distanceTo(center);
    if (dist > maxRadius) {
      maxRadius = dist;
    }
  }

  sphere.set(center, maxRadius);
  return sphere;
}

/**
 * Rotate points around an axis
 *
 * @param points - Points to rotate
 * @param axis - Rotation axis (will be normalized)
 * @param angle - Rotation angle in radians
 * @param center - Center of rotation (default: origin)
 */
export function rotatePoints(
  points: THREE.Vector3[],
  axis: THREE.Vector3,
  angle: number,
  center: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3[] {
  const quaternion = new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), angle);
  const matrix = new THREE.Matrix4().makeRotationFromQuaternion(quaternion);

  return points.map(p => {
    const centered = p.clone().sub(center);
    centered.applyMatrix4(matrix);
    return centered.add(center);
  });
}

/**
 * Scale points around a center
 *
 * @param points - Points to scale
 * @param scale - Scale factor (number or Vector3)
 * @param center - Center of scaling (default: origin)
 */
export function scalePoints(
  points: THREE.Vector3[],
  scale: number | THREE.Vector3,
  center: THREE.Vector3 = new THREE.Vector3()
): THREE.Vector3[] {
  const scaleVec = typeof scale === 'number'
    ? new THREE.Vector3(scale, scale, scale)
    : scale;

  return points.map(p => {
    const centered = p.clone().sub(center);
    centered.multiply(scaleVec);
    return centered.add(center);
  });
}

/**
 * Sample points on a sphere surface
 *
 * @param radius - Sphere radius
 * @param numPoints - Number of points to generate
 * @returns Array of points uniformly distributed on sphere
 */
export function sampleSphere(radius: number, numPoints: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];

  // Fibonacci sphere algorithm for uniform distribution
  const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

  for (let i = 0; i < numPoints; i++) {
    const y = 1 - (i / (numPoints - 1)) * 2; // y from 1 to -1
    const radiusAtY = Math.sqrt(1 - y * y);

    const theta = phi * i;

    const x = Math.cos(theta) * radiusAtY;
    const z = Math.sin(theta) * radiusAtY;

    points.push(new THREE.Vector3(x * radius, y * radius, z * radius));
  }

  return points;
}

/**
 * Compute surface area of a triangle mesh
 *
 * @param positions - Flat array of vertex positions
 * @returns Total surface area
 */
export function computeSurfaceArea(positions: number[]): number {
  let area = 0;
  const vertexCount = positions.length / 3;

  for (let i = 0; i < vertexCount; i += 3) {
    const i0 = i * 3;
    const i1 = (i + 1) * 3;
    const i2 = (i + 2) * 3;

    const v0 = new THREE.Vector3(positions[i0], positions[i0 + 1], positions[i0 + 2]);
    const v1 = new THREE.Vector3(positions[i1], positions[i1 + 1], positions[i1 + 2]);
    const v2 = new THREE.Vector3(positions[i2], positions[i2 + 1], positions[i2 + 2]);

    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    const cross = new THREE.Vector3().crossVectors(edge1, edge2);

    area += cross.length() / 2;
  }

  return area;
}
