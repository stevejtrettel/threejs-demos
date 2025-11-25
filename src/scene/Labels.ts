/**
 * Label factory utilities for creating text labels in 3D space
 *
 * Returns actual Three.js objects (sprites), not wrappers.
 * Add them to your scene directly.
 *
 * Usage:
 *   import { Labels } from '@/scene';
 *   scene.add(Labels.text('Origin', new THREE.Vector3(0, 0, 0)));
 *   scene.add(Labels.text('Peak', position, { color: 0xff0000, size: 0.5 }));
 */

import * as THREE from 'three';

export interface LabelOptions {
  /** Text color (default: 0xffffff) */
  color?: number;
  /** Label size (default: 0.5) */
  size?: number;
  /** Background color (default: 0x000000) */
  backgroundColor?: number;
  /** Background opacity 0-1 (default: 0.6) */
  backgroundOpacity?: number;
  /** Offset from position (default: (0, 0, 0)) */
  offset?: THREE.Vector3 | [number, number, number];
  /** Font family (default: 'Arial') */
  fontFamily?: string;
  /** Font weight (default: 'bold') */
  fontWeight?: string;
  /** Padding around text in pixels (default: 20) */
  padding?: number;
}

/**
 * Create a text label sprite at a position
 * Billboard sprite that always faces the camera
 */
function text(
  content: string,
  position: THREE.Vector3 | [number, number, number],
  options: LabelOptions = {}
): THREE.Sprite {
  const {
    color = 0xffffff,
    size = 0.5,
    backgroundColor = 0x000000,
    backgroundOpacity = 0.6,
    offset,
    fontFamily = 'Arial',
    fontWeight = 'bold',
    padding = 20
  } = options;

  // Create canvas for text rendering
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  // Measure text to size canvas appropriately
  const fontSize = 48;
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const metrics = context.measureText(content);

  // Size canvas to fit text with padding
  const textWidth = metrics.width;
  const textHeight = fontSize * 1.2;
  canvas.width = Math.ceil(textWidth + padding * 2);
  canvas.height = Math.ceil(textHeight + padding * 2);

  // Re-set font after canvas resize (resets context)
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  // Draw background
  const bgColor = new THREE.Color(backgroundColor);
  context.fillStyle = `rgba(${Math.floor(bgColor.r * 255)}, ${Math.floor(bgColor.g * 255)}, ${Math.floor(bgColor.b * 255)}, ${backgroundOpacity})`;

  // Rounded rectangle background
  const radius = 8;
  roundRect(context, 0, 0, canvas.width, canvas.height, radius);
  context.fill();

  // Draw text
  const textColor = new THREE.Color(color);
  context.fillStyle = `#${textColor.getHexString()}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(content, canvas.width / 2, canvas.height / 2);

  // Create sprite
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;  // Prevent mipmap blur

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false  // Always render on top
  });

  const sprite = new THREE.Sprite(material);

  // Scale based on canvas aspect ratio
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(size * aspect, size, 1);

  // Set position
  const pos = Array.isArray(position)
    ? new THREE.Vector3(position[0], position[1], position[2])
    : position.clone();

  if (offset) {
    const off = Array.isArray(offset)
      ? new THREE.Vector3(offset[0], offset[1], offset[2])
      : offset;
    pos.add(off);
  }

  sprite.position.copy(pos);
  sprite.name = `label-${content}`;

  return sprite;
}

/**
 * Create a text label that renders in world space (not billboard)
 * Useful when you want labels to have consistent orientation
 */
function textPlane(
  content: string,
  position: THREE.Vector3 | [number, number, number],
  options: LabelOptions & {
    /** Rotation in radians [x, y, z] */
    rotation?: [number, number, number];
  } = {}
): THREE.Mesh {
  const {
    color = 0xffffff,
    size = 0.5,
    backgroundColor = 0x000000,
    backgroundOpacity = 0.6,
    offset,
    fontFamily = 'Arial',
    fontWeight = 'bold',
    padding = 20,
    rotation
  } = options;

  // Create canvas (same as text())
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  const fontSize = 48;
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const metrics = context.measureText(content);

  const textWidth = metrics.width;
  const textHeight = fontSize * 1.2;
  canvas.width = Math.ceil(textWidth + padding * 2);
  canvas.height = Math.ceil(textHeight + padding * 2);

  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  const bgColor = new THREE.Color(backgroundColor);
  context.fillStyle = `rgba(${Math.floor(bgColor.r * 255)}, ${Math.floor(bgColor.g * 255)}, ${Math.floor(bgColor.b * 255)}, ${backgroundOpacity})`;

  const radius = 8;
  roundRect(context, 0, 0, canvas.width, canvas.height, radius);
  context.fill();

  const textColor = new THREE.Color(color);
  context.fillStyle = `#${textColor.getHexString()}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(content, canvas.width / 2, canvas.height / 2);

  // Create plane geometry instead of sprite
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;

  const aspect = canvas.width / canvas.height;
  const geometry = new THREE.PlaneGeometry(size * aspect, size);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthTest: false
  });

  const mesh = new THREE.Mesh(geometry, material);

  // Set position
  const pos = Array.isArray(position)
    ? new THREE.Vector3(position[0], position[1], position[2])
    : position.clone();

  if (offset) {
    const off = Array.isArray(offset)
      ? new THREE.Vector3(offset[0], offset[1], offset[2])
      : offset;
    pos.add(off);
  }

  mesh.position.copy(pos);

  if (rotation) {
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  }

  mesh.name = `label-plane-${content}`;

  return mesh;
}

/**
 * Create an axis label (text + line pointing to origin direction)
 */
function axisLabel(
  axis: 'x' | 'y' | 'z',
  length: number = 5,
  options: LabelOptions = {}
): THREE.Group {
  const group = new THREE.Group();
  group.name = `axis-label-${axis}`;

  const axisColors = { x: 0xff4444, y: 0x44ff44, z: 0x4444ff };
  const axisPositions = {
    x: new THREE.Vector3(length, 0, 0),
    y: new THREE.Vector3(0, length, 0),
    z: new THREE.Vector3(0, 0, length)
  };

  const color = options.color ?? axisColors[axis];
  const label = text(axis.toUpperCase(), axisPositions[axis], {
    ...options,
    color,
    size: options.size ?? 0.3,
    backgroundColor: options.backgroundColor ?? 0x222222
  });

  group.add(label);

  return group;
}

/**
 * Create coordinate axis labels (X, Y, Z)
 */
function axisLabels(
  length: number = 5,
  options: LabelOptions = {}
): THREE.Group {
  const group = new THREE.Group();
  group.name = 'axis-labels';

  group.add(axisLabel('x', length, options));
  group.add(axisLabel('y', length, options));
  group.add(axisLabel('z', length, options));

  return group;
}

/**
 * Create a value label (number formatted nicely)
 */
function value(
  val: number,
  position: THREE.Vector3 | [number, number, number],
  options: LabelOptions & {
    /** Number of decimal places (default: 2) */
    decimals?: number;
    /** Prefix string (e.g., 'x = ') */
    prefix?: string;
    /** Suffix string (e.g., ' m') */
    suffix?: string;
  } = {}
): THREE.Sprite {
  const { decimals = 2, prefix = '', suffix = '', ...labelOptions } = options;
  const formatted = `${prefix}${val.toFixed(decimals)}${suffix}`;
  return text(formatted, position, labelOptions);
}

/**
 * Create a coordinate label showing (x, y, z) values
 */
function coordinate(
  position: THREE.Vector3 | [number, number, number],
  options: LabelOptions & {
    /** Number of decimal places (default: 1) */
    decimals?: number;
  } = {}
): THREE.Sprite {
  const { decimals = 1, ...labelOptions } = options;
  const pos = Array.isArray(position)
    ? position
    : [position.x, position.y, position.z];

  const formatted = `(${pos[0].toFixed(decimals)}, ${pos[1].toFixed(decimals)}, ${pos[2].toFixed(decimals)})`;

  return text(formatted, position, {
    size: 0.3,
    ...labelOptions
  });
}

// Helper function for rounded rectangles
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Label factory utilities
 *
 * Creates text labels as Three.js objects (sprites or meshes).
 * Add to scene directly: scene.add(Labels.text('Hello', position))
 */
export const Labels = {
  /** Billboard text label (always faces camera) */
  text,
  /** Fixed-orientation text on a plane */
  textPlane,
  /** Single axis label (X, Y, or Z) */
  axisLabel,
  /** All three axis labels */
  axisLabels,
  /** Formatted number label */
  value,
  /** Coordinate (x, y, z) label */
  coordinate,
};

// Also export the options type
export type { LabelOptions };
