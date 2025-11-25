/**
 * Scene helpers for orientation and debugging
 *
 * Simple factory functions for common visualization aids.
 *
 * Usage:
 *   import { Helpers } from '@/scene';
 *   scene.add(Helpers.axes(5));
 *   scene.add(Helpers.grid(10));
 *   scene.add(Helpers.originMarker());
 */

import * as THREE from 'three';

/**
 * Coordinate axes (RGB = XYZ)
 */
function axes(size: number = 5): THREE.AxesHelper {
  const helper = new THREE.AxesHelper(size);
  helper.name = 'axes-helper';
  return helper;
}

/**
 * Ground grid on XZ plane
 */
function grid(options: {
  size?: number;
  divisions?: number;
  color1?: number;
  color2?: number;
  plane?: 'xz' | 'xy' | 'yz';
} = {}): THREE.GridHelper {
  const size = options.size ?? 10;
  const divisions = options.divisions ?? 10;
  const color1 = options.color1 ?? 0x444444;
  const color2 = options.color2 ?? 0x222222;

  const helper = new THREE.GridHelper(size, divisions, color1, color2);
  helper.name = 'grid-helper';

  // Rotate for different planes
  if (options.plane === 'xy') {
    helper.rotation.x = Math.PI / 2;
  } else if (options.plane === 'yz') {
    helper.rotation.z = Math.PI / 2;
  }

  return helper;
}

/**
 * Sphere marker at origin (or specified position)
 */
function originMarker(options: {
  color?: number;
  size?: number;
  position?: THREE.Vector3;
} = {}): THREE.Mesh {
  const color = options.color ?? 0xffff00;
  const size = options.size ?? 0.1;

  const geometry = new THREE.SphereGeometry(size, 16, 16);
  const material = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'origin-marker';

  if (options.position) {
    mesh.position.copy(options.position);
  }

  return mesh;
}

/**
 * Point marker (sphere at position)
 */
function point(
  position: THREE.Vector3,
  options: { color?: number; size?: number } = {}
): THREE.Mesh {
  const color = options.color ?? 0xff0000;
  const size = options.size ?? 0.05;

  const geometry = new THREE.SphereGeometry(size, 12, 12);
  const material = new THREE.MeshBasicMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.name = 'point-marker';

  return mesh;
}

/**
 * Ground plane (for shadows or reference)
 */
function groundPlane(options: {
  size?: number;
  color?: number;
  opacity?: number;
  receiveShadow?: boolean;
} = {}): THREE.Mesh {
  const size = options.size ?? 20;
  const color = options.color ?? 0x808080;
  const opacity = options.opacity ?? 0.5;

  const geometry = new THREE.PlaneGeometry(size, size);
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2; // Lay flat on XZ
  mesh.receiveShadow = options.receiveShadow ?? true;
  mesh.name = 'ground-plane';

  return mesh;
}

/**
 * Bounding box wireframe for an object
 */
function boundingBox(object: THREE.Object3D, color: number = 0xffff00): THREE.BoxHelper {
  const helper = new THREE.BoxHelper(object, color);
  helper.name = 'bounding-box';
  return helper;
}

/**
 * Scene helper utilities
 */
export const Helpers = {
  axes,
  grid,
  originMarker,
  point,
  groundPlane,
  boundingBox,
};
