import * as THREE from 'three';
import { ComponentParams } from '../../components/ComponentParams';

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

export class ParametricCurve {
  mesh: THREE.Line;
  params: ComponentParams;

  private fn: ParametricFunction;

  tMin!: number;
  tMax!: number;
  segments!: number;

  constructor(fn: ParametricFunction, options: ParametricCurveOptions = {}) {
    this.fn = fn;
    this.params = new ComponentParams(this);

    // Define parameters
    this.params.define('tMin', options.tMin ?? 0, {
      min: -10,
      max: 10,
      step: 0.1,
      label: 't Min',
      onChange: () => this.rebuild()
    });

    this.params.define('tMax', options.tMax ?? 2 * Math.PI, {
      min: -10,
      max: 10,
      step: 0.1,
      label: 't Max',
      onChange: () => this.rebuild()
    });

    this.params.define('segments', options.segments ?? 100, {
      min: 10,
      max: 500,
      step: 1,
      label: 'Segments',
      onChange: () => this.rebuild()
    });

    // Build initial curve
    const geometry = this.buildGeometry();
    const material = new THREE.LineBasicMaterial({
      color: options.color ?? 0xff0000,
      linewidth: options.linewidth ?? 1
    });

    this.mesh = new THREE.Line(geometry, material);
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

  private rebuild(): void {
    const newGeometry = this.buildGeometry();
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
