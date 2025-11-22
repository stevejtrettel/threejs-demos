import * as THREE from 'three';
import { ComponentParams } from '../../components/ComponentParams';
import { TubedLevelCurve } from './TubedLevelCurve';
import type { LevelFunction, LevelCurveOptions } from './LevelCurve';
import type { TubedLevelCurveOptions } from './TubedLevelCurve';

export interface TubedLevelCurvesOptions extends Omit<TubedLevelCurveOptions, 'level'> {
  levels?: number[];
  numLevels?: number;
  minLevel?: number;
  maxLevel?: number;
  colormap?: (level: number, index: number, total: number) => number;
}

/**
 * Multiple tubed level curves at different heights
 *
 * Like LevelCurves but with 3D tube geometry for better depth perception.
 *
 * @example
 *   const contours = new TubedLevelCurves(
 *     (x, y) => x*x + y*y,
 *     { numLevels: 5, minLevel: 0.5, maxLevel: 4, tubeRadius: 0.02 }
 *   );
 */
export class TubedLevelCurves {
  mesh: THREE.Group;
  params: ComponentParams;

  private fn: LevelFunction;
  private curves: TubedLevelCurve[];
  private options: TubedLevelCurvesOptions;

  constructor(fn: LevelFunction, options: TubedLevelCurvesOptions = {}) {
    this.fn = fn;
    this.options = options;
    this.params = new ComponentParams(this);

    this.mesh = new THREE.Group();
    this.curves = [];

    // Determine levels to display
    const levels = this.computeLevels();

    // Create individual tubed level curves
    for (let i = 0; i < levels.length; i++) {
      const level = levels[i];
      const color = options.colormap
        ? options.colormap(level, i, levels.length)
        : this.defaultColormap(level, i, levels.length);

      const material = new THREE.MeshStandardMaterial({ color });

      const curve = new TubedLevelCurve(fn, {
        ...options,
        level: level,
        material: material
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
   * Update all curves
   */
  rebuild(): void {
    this.curves.forEach(curve => {
      (curve as any).rebuild();
    });
  }

  dispose(): void {
    this.curves.forEach(curve => curve.dispose());
    this.curves = [];
  }
}
