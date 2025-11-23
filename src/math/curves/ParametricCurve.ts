import * as THREE from 'three';
import { Params } from '../../Params';
import type { MathComponent } from '../../types';

export interface ParametricFunction {
  (t: number): { x: number; y: number; z: number };
}

export interface ParametricCurveOptions {
  tMin?: number;
  tMax?: number;
  segments?: number;
  color?: number;
  linewidth?: number;
}

/**
 * Parametric curve visualization
 *
 * Follows the component lifecycle pattern:
 * - rebuild(): Called when tMin, tMax, or segments change (expensive)
 * - update(): Called when color changes (cheap)
 */
export class ParametricCurve implements MathComponent {
  mesh: THREE.Line;
  params: Params;

  private fn: ParametricFunction;

  // Reactive properties
  tMin!: number;
  tMax!: number;
  segments!: number;
  colorHex!: number;

  constructor(fn: ParametricFunction, options: ParametricCurveOptions = {}) {
    this.fn = fn;
    this.params = new Params(this);

    // STRUCTURAL PARAMETERS → rebuild
    this.params.define('tMin', options.tMin ?? 0, {
      min: -10,
      max: 10,
      step: 0.1,
      label: 't Min',
      triggers: 'rebuild'  // Domain change requires new geometry
    });

    this.params.define('tMax', options.tMax ?? 2 * Math.PI, {
      min: -10,
      max: 10,
      step: 0.1,
      label: 't Max',
      triggers: 'rebuild'  // Domain change requires new geometry
    });

    this.params.define('segments', options.segments ?? 100, {
      min: 10,
      max: 500,
      step: 1,
      label: 'Segments',
      triggers: 'rebuild'  // Topology change requires new geometry
    });

    // VISUAL PARAMETERS → update
    this.params.define('colorHex', options.color ?? 0xff0000, {
      type: 'color',
      label: 'Color',
      triggers: 'update'  // Color change just updates material
    });

    // Build initial curve
    const geometry = this.buildGeometry();
    const material = new THREE.LineBasicMaterial({
      color: this.colorHex,
      linewidth: options.linewidth ?? 1
    });

    this.mesh = new THREE.Line(geometry, material);
  }

  /**
   * Rebuild geometry when structural parameters change (tMin, tMax, segments)
   * This is EXPENSIVE - allocates new BufferGeometry
   */
  rebuild(): void {
    const newGeometry = this.buildGeometry();
    const oldGeometry = this.mesh.geometry;
    this.mesh.geometry = newGeometry;
    oldGeometry.dispose();
  }

  /**
   * Update visual properties in place (color, etc.)
   * This is CHEAP - just updates material
   */
  update(): void {
    const material = this.mesh.material as THREE.LineBasicMaterial;
    material.color.setHex(this.colorHex);
    material.needsUpdate = true;
  }

  private buildGeometry(): THREE.BufferGeometry {
    const points: THREE.Vector3[] = [];
    const dt = (this.tMax - this.tMin) / this.segments;

    for (let i = 0; i <= this.segments; i++) {
      const t = this.tMin + i * dt;
      const p = this.fn(t);
      points.push(new THREE.Vector3(p.x, p.y, p.z));
    }

    return new THREE.BufferGeometry().setFromPoints(points);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
