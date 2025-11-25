/**
 * Quick-start utilities for rapid prototyping
 *
 * This module provides convenience factories for getting started quickly
 * without worrying about boilerplate setup.
 *
 * @example Minimal demo
 *   import { quick } from '@/app/quickStart';
 *   import { SurfaceMesh, Torus } from '@/math';
 *
 *   const app = quick();
 *   app.add(new SurfaceMesh(new Torus()));
 *
 * @example One-liner surface
 *   import { quickSurface } from '@/app/quickStart';
 *
 *   quickSurface((x, y) => Math.sin(x) * Math.cos(y));
 */

import * as THREE from 'three';
import { App } from './App';
import { Lights } from '../scene/Lights';

/**
 * Options for quick() factory
 */
export interface QuickOptions {
  /**
   * Lighting preset (default: 'studio')
   */
  lights?: 'studio' | 'threePoint' | 'dramatic' | 'ambient' | 'none';

  /**
   * Background color or preset (default: 'dark')
   */
  background?: number | 'sky' | 'dark' | 'light';

  /**
   * Camera position (default: [0, 3, 8])
   */
  cameraPosition?: [number, number, number];

  /**
   * Camera target / orbit center (default: [0, 0, 0])
   */
  cameraTarget?: [number, number, number];

  /**
   * Enable debug mode with keyboard shortcuts (default: true)
   */
  debug?: boolean;

  /**
   * Auto-start animation loop (default: true)
   */
  autoStart?: boolean;
}

/**
 * Quick-start factory for rapid prototyping
 *
 * Creates a fully configured App with sensible defaults:
 * - Studio lighting
 * - Dark background
 * - Camera positioned for typical math visualization
 * - Debug mode enabled
 * - Auto-started animation loop
 *
 * @example Minimal setup
 *   const app = quick();
 *   app.add(new SurfaceMesh(torus));
 *
 * @example With options
 *   const app = quick({
 *     lights: 'threePoint',
 *     background: 'sky',
 *     cameraPosition: [5, 5, 5]
 *   });
 *
 * @example Adding objects with params exposed
 *   const app = quick();
 *   app.add(mesh, { params: true });
 */
export function quick(options: QuickOptions = {}): App {
  const {
    lights = 'studio',
    background = 'dark',
    cameraPosition = [0, 3, 8],
    cameraTarget = [0, 0, 0],
    debug = true,
    autoStart = true
  } = options;

  // Create app with good defaults
  const app = new App({
    antialias: true,
    debug
  });

  // Position camera
  app.camera.position.set(cameraPosition[0], cameraPosition[1], cameraPosition[2]);
  app.controls.target.set(cameraTarget[0], cameraTarget[1], cameraTarget[2]);

  // Add lights
  if (lights !== 'none') {
    const lightPresets: Record<string, () => THREE.Object3D> = {
      studio: () => Lights.studio(),
      threePoint: () => Lights.threePoint(),
      dramatic: () => Lights.dramatic(),
      ambient: () => Lights.ambient()
    };
    const lightSetup = lightPresets[lights]?.();
    if (lightSetup) {
      app.scene.add(lightSetup);
    }
  }

  // Set background
  if (typeof background === 'number') {
    app.backgrounds.setColor(background);
  } else {
    const backgroundPresets: Record<string, () => void> = {
      dark: () => app.backgrounds.setColor(0x1a1a2e),
      light: () => app.backgrounds.setColor(0xf0f0f0),
      sky: () => app.backgrounds.setSky()
    };
    backgroundPresets[background]?.();
  }

  // Auto-start if requested
  if (autoStart) {
    app.start();
  }

  return app;
}

/**
 * Options for quickSurface()
 */
export interface QuickSurfaceOptions extends QuickOptions {
  /**
   * Domain bounds [xMin, xMax, yMin, yMax]
   * Default: [-2, 2, -2, 2]
   */
  domain?: [number, number, number, number];

  /**
   * Number of segments (default: 64)
   */
  segments?: number;

  /**
   * Surface color (default: 0x4488ff)
   */
  color?: number;

  /**
   * Expose params to UI (default: false)
   */
  params?: boolean;
}

/**
 * One-liner surface visualization
 *
 * Creates an app with a surface from z = f(x, y) function.
 * Returns the app for further customization.
 *
 * @example Simple surface
 *   quickSurface((x, y) => Math.sin(x) * Math.cos(y));
 *
 * @example With options
 *   quickSurface(
 *     (x, y) => x*x - y*y,
 *     { domain: [-3, 3, -3, 3], color: 0xff4444 }
 *   );
 *
 * @example Keep reference for animation
 *   const { app, mesh } = quickSurface((x, y) => Math.sin(x + time));
 */
export function quickSurface(
  fn: (x: number, y: number) => number,
  options: QuickSurfaceOptions = {}
): { app: App; mesh: THREE.Mesh } {
  const {
    domain = [-2, 2, -2, 2],
    segments = 64,
    color = 0x4488ff,
    params = false,
    ...appOptions
  } = options;

  // Import SurfaceMesh dynamically to avoid circular deps
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { SurfaceMesh } = require('../math/surfaces/SurfaceMesh');

  const app = quick(appOptions);

  const mesh = SurfaceMesh.fromFunction(fn, {
    domain,
    uSegments: segments,
    vSegments: segments,
    color
  });

  app.add(mesh, { params });

  return { app, mesh };
}
