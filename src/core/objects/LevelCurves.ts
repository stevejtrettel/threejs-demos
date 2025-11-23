import * as THREE from 'three';
import { Params } from '../../Params';
import { LevelCurve } from './LevelCurve';
import type { LevelFunction, LevelCurveOptions } from './LevelCurve';

export interface LevelCurvesOptions extends Omit<LevelCurveOptions, 'level'> {
  levels?: number[];
  numLevels?: number;
  minLevel?: number;
  maxLevel?: number;
  colormap?: (level: number, index: number, total: number) => number;
}

/**
 * Multiple level curves at different heights
 *
 * Like a topographic map showing multiple contour lines.
 *
 * @example
 *   // Paraboloid with 5 contours
 *   const contours = new LevelCurves(
 *     (x, y) => x*x + y*y,
 *     { numLevels: 5, minLevel: 0.5, maxLevel: 4 }
 *   );
 */
export class LevelCurves {
  mesh: THREE.Group;
  params: Params;

  private fn: LevelFunction;
  private curves: LevelCurve[];
  private options: LevelCurvesOptions;

  constructor(fn: LevelFunction, options: LevelCurvesOptions = {}) {
    this.fn = fn;
    this.options = options;
    this.params = new Params(this);

    this.mesh = new THREE.Group();
    this.curves = [];

    // Determine levels to display
    const levels = this.computeLevels();

    // Create individual level curves
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const color = options.colormap
        ? options.colormap(level, i, levels.length)
        : this.defaultColormap(level, i, levels.length);

      const curve = new LevelCurve(fn, {
        ...options,
        level: level,
        color: color
      });

      this.curves.push(curve);
      this.mesh.add(curve.mesh);
    }
  }

  /**
   * Compute the array of level values to display
   */
  private computeLevels(): number[] {
    if (this.options.levels) {
      return this.options.levels;
    }

    const numLevels = this.options.numLevels ?? 5;
    const minLevel = this.options.minLevel ?? 0;
    const maxLevel = this.options.maxLevel ?? 1;

    const levels: number[] = [];
    for (let i = 0; i < numLevels; i++) {
      const t = i / (numLevels - 1);
      levels.push(minLevel + t * (maxLevel - minLevel));
    }

    return levels;
  }

  /**
   * Default colormap: blue to red
   */
  private defaultColormap(level: number, index: number, total: number): number {
    const t = index / (total - 1);
    const r = Math.floor(t * 255);
    const g = 0;
    const b = Math.floor((1 - t) * 255);
    return (r << 16) | (g << 8) | b;
  }

  /**
   * Update all curves (useful if you modify the function)
   */
  rebuild(): void {
    this.curves.forEach(curve => {
      // Access private rebuild via casting
      (curve as any).rebuild();
    });
  }

  dispose(): void {
    this.curves.forEach(curve => curve.dispose());
    this.curves = [];
  }
}
