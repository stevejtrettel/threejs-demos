/**
 * Light factory utilities for creating common lighting setups
 *
 * Returns actual Three.js lights/groups, not wrappers.
 * Add them to your scene directly.
 *
 * Usage:
 *   import { Lights } from '@/scene';
 *   const lights = Lights.threePoint();
 *   scene.add(lights);
 */

import * as THREE from 'three';

/**
 * Three-point lighting setup (key, fill, back)
 * Classic cinematographic lighting
 */
function threePoint(options: {
  keyIntensity?: number;
  fillIntensity?: number;
  backIntensity?: number;
} = {}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'three-point-lights';

  const key = new THREE.DirectionalLight(0xffffff, options.keyIntensity ?? 1);
  key.name = 'key';
  key.position.set(5, 5, 5);

  const fill = new THREE.DirectionalLight(0xffffff, options.fillIntensity ?? 0.3);
  fill.name = 'fill';
  fill.position.set(-5, 0, -5);

  const back = new THREE.DirectionalLight(0xffffff, options.backIntensity ?? 0.5);
  back.name = 'back';
  back.position.set(0, 5, -5);

  group.add(key, fill, back);
  return group;
}

/**
 * Simple ambient light
 */
function ambient(color: number = 0xffffff, intensity: number = 0.6): THREE.AmbientLight {
  const light = new THREE.AmbientLight(color, intensity);
  light.name = 'ambient';
  return light;
}

/**
 * Single directional light (like sunlight)
 */
function directional(options: {
  color?: number;
  intensity?: number;
  position?: [number, number, number];
} = {}): THREE.DirectionalLight {
  const light = new THREE.DirectionalLight(
    options.color ?? 0xffffff,
    options.intensity ?? 1
  );
  light.name = 'directional';

  const pos = options.position ?? [5, 5, 5];
  light.position.set(pos[0], pos[1], pos[2]);

  return light;
}

/**
 * Studio lighting setup
 * Soft, even lighting good for showcasing objects
 */
function studio(options: {
  intensity?: number;
} = {}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'studio-lights';
  const intensity = options.intensity ?? 1;

  // Soft ambient base
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4 * intensity);
  ambientLight.name = 'studio-ambient';

  // Main light from above-front
  const main = new THREE.DirectionalLight(0xffffff, 0.8 * intensity);
  main.name = 'studio-main';
  main.position.set(2, 5, 3);

  // Softer fill from the side
  const fill = new THREE.DirectionalLight(0xffffff, 0.4 * intensity);
  fill.name = 'studio-fill';
  fill.position.set(-3, 2, 1);

  // Rim light from behind
  const rim = new THREE.DirectionalLight(0xffffff, 0.3 * intensity);
  rim.name = 'studio-rim';
  rim.position.set(0, 3, -4);

  group.add(ambientLight, main, fill, rim);
  return group;
}

/**
 * Dramatic lighting (high contrast, single source)
 */
function dramatic(options: {
  color?: number;
  intensity?: number;
  position?: [number, number, number];
} = {}): THREE.Group {
  const group = new THREE.Group();
  group.name = 'dramatic-lights';

  // Very dim ambient
  const ambientLight = new THREE.AmbientLight(0x111111, 0.2);
  ambientLight.name = 'dramatic-ambient';

  // Strong single directional
  const main = new THREE.DirectionalLight(
    options.color ?? 0xffffff,
    options.intensity ?? 1.5
  );
  main.name = 'dramatic-main';
  const pos = options.position ?? [5, 3, 2];
  main.position.set(pos[0], pos[1], pos[2]);

  group.add(ambientLight, main);
  return group;
}

/**
 * Point light (omnidirectional, like a light bulb)
 */
function point(options: {
  color?: number;
  intensity?: number;
  position?: [number, number, number];
  distance?: number;
  decay?: number;
} = {}): THREE.PointLight {
  const light = new THREE.PointLight(
    options.color ?? 0xffffff,
    options.intensity ?? 1,
    options.distance ?? 0,
    options.decay ?? 2
  );
  light.name = 'point';

  const pos = options.position ?? [0, 3, 0];
  light.position.set(pos[0], pos[1], pos[2]);

  return light;
}

/**
 * Hemisphere light (sky/ground gradient)
 * Good for outdoor scenes
 */
function hemisphere(options: {
  skyColor?: number;
  groundColor?: number;
  intensity?: number;
} = {}): THREE.HemisphereLight {
  const light = new THREE.HemisphereLight(
    options.skyColor ?? 0x87ceeb,   // sky blue
    options.groundColor ?? 0x362907, // brown
    options.intensity ?? 0.6
  );
  light.name = 'hemisphere';
  return light;
}

/**
 * Light factory utilities
 */
export const Lights = {
  threePoint,
  ambient,
  directional,
  studio,
  dramatic,
  point,
  hemisphere,
};
