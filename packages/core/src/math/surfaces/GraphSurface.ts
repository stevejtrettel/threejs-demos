import * as THREE from 'three';
import { ComponentParams } from '../../components/ComponentParams';
import type { MathComponent } from '../../types';
import type { DifferentialSurface, FirstFundamentalForm, ChristoffelSymbols } from '../diffgeo/types';

export interface GraphFunction {
  (x: number, y: number): number;
}

export interface GraphDerivatives {
  f: GraphFunction;
  fx?: GraphFunction;
  fy?: GraphFunction;
  fxx?: GraphFunction;
  fxy?: GraphFunction;
  fyy?: GraphFunction;
}

export interface GraphSurfaceOptions {
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
  xSegments?: number;
  ySegments?: number;
  material?: THREE.Material;
  color?: number;
  wireframe?: boolean;
}

/**
 * Optimized surface for graphs z = f(x,y)
 *
 * Uses direct formulas for geodesics - ~10x faster than general ParametricSurface
 * Ported from reference/geodesic-boards/diffgeo/GraphGeometry.js
 *
 * Geodesic acceleration: a = -(f_xx u'² + 2f_xy u'v' + f_yy v'²) / (1 + f_x² + f_y²) * (f_x, f_y)
 *
 * @example
 *   const graph = new GraphSurface({
 *     f: (x, y) => Math.sin(x) * Math.cos(y),
 *     fx: (x, y) => Math.cos(x) * Math.cos(y),
 *     fy: (x, y) => -Math.sin(x) * Math.sin(y),
 *     // fxx, fxy, fyy optional - uses finite differences if not provided
 *   }, { xMin: -3, xMax: 3, yMin: -3, yMax: 3 });
 */
export class GraphSurface implements MathComponent, DifferentialSurface {
  mesh: THREE.Mesh;
  params: ComponentParams;

  private derivatives: GraphDerivatives;
  private geometry!: THREE.BufferGeometry;
  private material!: THREE.Material;

  // Scratch vector to avoid GC churn during integration
  private scratch = new THREE.Vector2();

  xMin!: number;
  xMax!: number;
  yMin!: number;
  yMax!: number;
  xSegments!: number;
  ySegments!: number;
  colorHex!: number;
  wireframe!: boolean;

  constructor(derivatives: GraphDerivatives, options: GraphSurfaceOptions = {}) {
    this.derivatives = this.setupDerivatives(derivatives);
    this.params = new ComponentParams(this);

    // STRUCTURAL PARAMETERS → rebuild
    this.params.define('xMin', options.xMin ?? -5, {
      min: -20, max: 20, step: 0.1,
      label: 'X Min',
      triggers: 'rebuild'
    });

    this.params.define('xMax', options.xMax ?? 5, {
      min: -20, max: 20, step: 0.1,
      label: 'X Max',
      triggers: 'rebuild'
    });

    this.params.define('yMin', options.yMin ?? -5, {
      min: -20, max: 20, step: 0.1,
      label: 'Y Min',
      triggers: 'rebuild'
    });

    this.params.define('yMax', options.yMax ?? 5, {
      min: -20, max: 20, step: 0.1,
      label: 'Y Max',
      triggers: 'rebuild'
    });

    this.params.define('xSegments', options.xSegments ?? 64, {
      min: 4, max: 256, step: 1,
      label: 'X Segments',
      triggers: 'rebuild'
    });

    this.params.define('ySegments', options.ySegments ?? 64, {
      min: 4, max: 256, step: 1,
      label: 'Y Segments',
      triggers: 'rebuild'
    });

    // VISUAL PARAMETERS → update
    this.params.define('colorHex', options.color ?? 0x00aa88, {
      type: 'color',
      label: 'Color',
      triggers: 'update'
    });

    this.params.define('wireframe', options.wireframe ?? false, {
      type: 'boolean',
      label: 'Wireframe',
      triggers: 'update'
    });

    // Build initial geometry
    this.geometry = this.buildGeometry();
    this.material = options.material ?? new THREE.MeshStandardMaterial({
      color: this.colorHex,
      side: THREE.DoubleSide,
      flatShading: false,
      wireframe: this.wireframe
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
  }

  /**
   * Setup derivatives with finite difference fallbacks
   * Ported from GraphGeometry.js lines 160-169
   */
  private setupDerivatives(input: GraphDerivatives): GraphDerivatives {
    const h = 1e-5;
    const f = input.f;

    return {
      f,
      fx: input.fx ?? ((x, y) => (f(x + h, y) - f(x - h, y)) / (2 * h)),
      fy: input.fy ?? ((x, y) => (f(x, y + h) - f(x, y - h)) / (2 * h)),
      fxx: input.fxx ?? ((x, y) => (f(x + h, y) + f(x - h, y) - 2 * f(x, y)) / (h * h)),
      fyy: input.fyy ?? ((x, y) => (f(x, y + h) + f(x, y - h) - 2 * f(x, y)) / (h * h)),
      fxy: input.fxy ?? ((x, y) =>
        (f(x + h, y + h) + f(x - h, y - h) - f(x + h, y - h) - f(x - h, y + h)) / (4 * h * h)
      )
    };
  }

  private buildGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const xSegments = Math.floor(this.xSegments);
    const ySegments = Math.floor(this.ySegments);

    // Generate vertices
    for (let i = 0; i <= xSegments; i++) {
      const x = this.xMin + (i / xSegments) * (this.xMax - this.xMin);

      for (let j = 0; j <= ySegments; j++) {
        const y = this.yMin + (j / ySegments) * (this.yMax - this.yMin);
        const z = this.derivatives.f(x, y);

        positions.push(x, y, z);

        // UV coordinates
        uvs.push(i / xSegments, j / ySegments);

        // Compute normal
        const fx = this.derivatives.fx!(x, y);
        const fy = this.derivatives.fy!(x, y);
        const normal = new THREE.Vector3(-fx, -fy, 1).normalize();
        normals.push(normal.x, normal.y, normal.z);
      }
    }

    // Generate indices
    for (let i = 0; i < xSegments; i++) {
      for (let j = 0; j < ySegments; j++) {
        const a = i * (ySegments + 1) + j;
        const b = a + ySegments + 1;
        const c = a + 1;
        const d = b + 1;

        // Two triangles per quad
        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    return geometry;
  }

  // ===== DifferentialSurface Interface =====

  /**
   * Parameterization: (x,y) → (x,y,f(x,y))
   */
  parameterization(x: number, y: number): THREE.Vector3 {
    return new THREE.Vector3(x, y, this.derivatives.f(x, y));
  }

  /**
   * Surface normal: N = (-f_x, -f_y, 1) / |(-f_x, -f_y, 1)|
   * From GraphGeometry.js lines 195-199
   */
  surfaceNormal(x: number, y: number): THREE.Vector3 {
    const fx = this.derivatives.fx!(x, y);
    const fy = this.derivatives.fy!(x, y);
    return new THREE.Vector3(-fx, -fy, 1).normalize();
  }

  /**
   * First fundamental form for z = f(x,y)
   * E = 1 + f_x², F = f_x f_y, G = 1 + f_y²
   */
  firstFundamentalForm(x: number, y: number): FirstFundamentalForm {
    const fx = this.derivatives.fx!(x, y);
    const fy = this.derivatives.fy!(x, y);

    return {
      E: 1 + fx * fx,
      F: fx * fy,
      G: 1 + fy * fy
    };
  }

  /**
   * Optimized Christoffel symbols for graphs z = f(x,y)
   * Ported from GraphGeometry.js lines 65-71
   *
   * These are MUCH faster than the general formulas!
   */
  christoffelSymbols(x: number, y: number): ChristoffelSymbols {
    const fx = this.derivatives.fx!(x, y);
    const fy = this.derivatives.fy!(x, y);
    const fxx = this.derivatives.fxx!(x, y);
    const fxy = this.derivatives.fxy!(x, y);
    const fyy = this.derivatives.fyy!(x, y);

    const denom = 1 + fx * fx + fy * fy;

    // Your optimized formulas from GraphGeometry.js
    const Γxxx = fx * (fxx - fx * fy * fxy + fy * fy * fyy) / denom;
    const Γyyy = fy * (fyy - fx * fy * fxy + fx * fx * fxx) / denom;
    const Γxyx = fx * fxy / denom;
    const Γxxy = fx * fxx / denom;
    const Γxyy = fy * fxy / denom;
    const Γyyx = fx * fyy / denom;

    return {
      u: {
        u: { u: Γxxx, v: Γxyx },
        v: { u: Γxyx, v: Γyyx }
      },
      v: {
        u: { u: Γxxy, v: Γxyy },
        v: { u: Γxyy, v: Γyyy }
      }
    };
  }

  // ===== Additional Differential Geometry =====

  /**
   * Gaussian curvature K = (f_xx * f_yy - f_xy²) / (1 + f_x² + f_y²)²
   * From GraphGeometry.js lines 81-90
   */
  gaussianCurvature(x: number, y: number): number {
    const fx = this.derivatives.fx!(x, y);
    const fy = this.derivatives.fy!(x, y);
    const fxx = this.derivatives.fxx!(x, y);
    const fyy = this.derivatives.fyy!(x, y);
    const fxy = this.derivatives.fxy!(x, y);

    const denom = 1 + fx * fx + fy * fy;
    return (fxx * fyy - fxy * fxy) / (denom * denom);
  }

  /**
   * Mean curvature H
   * TODO: Need optimized formula from user for z = f(x,y) graphs
   */
  meanCurvature(x: number, y: number): number {
    throw new Error('meanCurvature not yet implemented - awaiting optimized formula');
  }

  /**
   * Second fundamental form
   * TODO: Need optimized formula from user for z = f(x,y) graphs
   */
  secondFundamentalForm(x: number, y: number): { L: number; M: number; N: number } {
    throw new Error('secondFundamentalForm not yet implemented - awaiting optimized formula');
  }

  /**
   * Check if point (x, y) is outside the domain
   * From GraphGeometry.js lines 25-26
   */
  isOutsideDomain(x: number, y: number): boolean {
    return x < this.xMin || x > this.xMax || y < this.yMin || y > this.yMax;
  }

  // ===== Component Lifecycle =====

  rebuild(): void {
    const newGeometry = this.buildGeometry();
    const oldGeometry = this.geometry;

    this.mesh.geometry = newGeometry;
    this.geometry = newGeometry;

    oldGeometry.dispose();
  }

  update(): void {
    const mat = this.material as THREE.MeshStandardMaterial;
    mat.color.setHex(this.colorHex);
    mat.wireframe = this.wireframe;
    mat.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
