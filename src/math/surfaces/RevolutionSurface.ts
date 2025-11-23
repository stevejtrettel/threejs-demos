import * as THREE from 'three';
import { Params } from '../../Params';
import type { MathComponent } from '../../types';
import type { DifferentialSurface, FirstFundamentalForm, ChristoffelSymbols } from '../diffgeo/types';

export interface RevolutionFunction {
  (u: number): number;
}

export interface RevolutionDerivatives {
  r: RevolutionFunction;    // Radius function r(u)
  h: RevolutionFunction;    // Height function h(u)
  ru?: RevolutionFunction;  // dr/du
  ruu?: RevolutionFunction; // d²r/du²
  hu?: RevolutionFunction;  // dh/du
  huu?: RevolutionFunction; // d²h/du²
}

export interface RevolutionSurfaceOptions {
  uMin?: number;
  uMax?: number;
  uSegments?: number;
  tSegments?: number;  // Angular segments (t from 0 to 2π)
  material?: THREE.Material;
  color?: number;
  wireframe?: boolean;
}

/**
 * Optimized surface of revolution
 *
 * Parameterization: (u, t) → (r(u)cos(t), r(u)sin(t), h(u))
 * - r(u) is the radius function
 * - h(u) is the height function
 * - t ∈ [0, 2π] is the angle around the axis
 *
 * Uses direct formulas for geodesics - ~10x faster than general ParametricSurface
 * Ported from reference/geodesic-boards/diffgeo/RevolutionGeometry.js
 *
 * @example
 *   // Create a torus
 *   const torus = new RevolutionSurface({
 *     r: (u) => 2 + 0.5 * Math.cos(u),
 *     h: (u) => 0.5 * Math.sin(u),
 *     ru: (u) => -0.5 * Math.sin(u),
 *     hu: (u) => 0.5 * Math.cos(u),
 *     // ruu, huu optional - uses finite differences if not provided
 *   }, { uMin: 0, uMax: 2*Math.PI });
 */
export class RevolutionSurface implements MathComponent, DifferentialSurface {
  mesh: THREE.Mesh;
  params: Params;

  private derivatives: RevolutionDerivatives;
  private geometry!: THREE.BufferGeometry;
  private material!: THREE.Material;

  // Scratch vector to avoid GC churn during integration
  private scratch = new THREE.Vector2();

  uMin!: number;
  uMax!: number;
  uSegments!: number;
  tSegments!: number;
  colorHex!: number;
  wireframe!: boolean;

  constructor(derivatives: RevolutionDerivatives, options: RevolutionSurfaceOptions = {}) {
    this.derivatives = this.setupDerivatives(derivatives);
    this.params = new Params(this);

    // STRUCTURAL PARAMETERS → rebuild
    this.params.define('uMin', options.uMin ?? 0, {
      min: -20, max: 20, step: 0.1,
      label: 'U Min',
      triggers: 'rebuild'
    });

    this.params.define('uMax', options.uMax ?? 2 * Math.PI, {
      min: -20, max: 20, step: 0.1,
      label: 'U Max',
      triggers: 'rebuild'
    });

    this.params.define('uSegments', options.uSegments ?? 64, {
      min: 4, max: 256, step: 1,
      label: 'U Segments',
      triggers: 'rebuild'
    });

    this.params.define('tSegments', options.tSegments ?? 64, {
      min: 4, max: 256, step: 1,
      label: 'T Segments (Angular)',
      triggers: 'rebuild'
    });

    // VISUAL PARAMETERS → update
    this.params.define('colorHex', options.color ?? 0xaa6600, {
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
   * From RevolutionGeometry.js - uses single variable u
   */
  private setupDerivatives(input: RevolutionDerivatives): RevolutionDerivatives {
    const h = 1e-5;
    const r = input.r;
    const hFunc = input.h;

    return {
      r,
      h: hFunc,
      ru: input.ru ?? ((u) => (r(u + h) - r(u - h)) / (2 * h)),
      ruu: input.ruu ?? ((u) => (r(u + h) + r(u - h) - 2 * r(u)) / (h * h)),
      hu: input.hu ?? ((u) => (hFunc(u + h) - hFunc(u - h)) / (2 * h)),
      huu: input.huu ?? ((u) => (hFunc(u + h) + hFunc(u - h) - 2 * hFunc(u)) / (h * h))
    };
  }

  private buildGeometry(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const uSegments = Math.floor(this.uSegments);
    const tSegments = Math.floor(this.tSegments);

    // Generate vertices
    for (let i = 0; i <= uSegments; i++) {
      const u = this.uMin + (i / uSegments) * (this.uMax - this.uMin);
      const rVal = this.derivatives.r(u);
      const hVal = this.derivatives.h(u);

      for (let j = 0; j <= tSegments; j++) {
        const t = (j / tSegments) * 2 * Math.PI;

        // Position: (r(u)cos(t), r(u)sin(t), h(u))
        const x = rVal * Math.cos(t);
        const y = rVal * Math.sin(t);
        const z = hVal;

        positions.push(x, y, z);

        // UV coordinates
        uvs.push(i / uSegments, j / tSegments);

        // Normal: (-h'(u)cos(t), -h'(u)sin(t), r'(u))
        const ru = this.derivatives.ru!(u);
        const hu = this.derivatives.hu!(u);
        const normal = new THREE.Vector3(-hu * Math.cos(t), -hu * Math.sin(t), ru).normalize();
        normals.push(normal.x, normal.y, normal.z);
      }
    }

    // Generate indices
    for (let i = 0; i < uSegments; i++) {
      for (let j = 0; j < tSegments; j++) {
        const a = i * (tSegments + 1) + j;
        const b = a + tSegments + 1;
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
   * Parameterization: (u, t) → (r(u)cos(t), r(u)sin(t), h(u))
   * From RevolutionGeometry.js lines 171-175
   */
  parameterization(u: number, t: number): THREE.Vector3 {
    const r = this.derivatives.r(u);
    const h = this.derivatives.h(u);
    return new THREE.Vector3(r * Math.cos(t), r * Math.sin(t), h);
  }

  /**
   * Surface normal: N = (-h'(u)cos(t), -h'(u)sin(t), r'(u))
   * From RevolutionGeometry.js lines 177-182
   */
  surfaceNormal(u: number, t: number): THREE.Vector3 {
    const ru = this.derivatives.ru!(u);
    const hu = this.derivatives.hu!(u);
    return new THREE.Vector3(-hu * Math.cos(t), -hu * Math.sin(t), ru).normalize();
  }

  /**
   * First fundamental form for surfaces of revolution
   * E = r'² + h'², F = 0, G = r²
   */
  firstFundamentalForm(u: number, t: number): FirstFundamentalForm {
    const r = this.derivatives.r(u);
    const ru = this.derivatives.ru!(u);
    const hu = this.derivatives.hu!(u);

    return {
      E: ru * ru + hu * hu,
      F: 0,  // No cross term for revolution surfaces
      G: r * r
    };
  }

  /**
   * Optimized Christoffel symbols for surfaces of revolution
   * From RevolutionGeometry.js lines 70-77
   *
   * These are MUCH faster than the general formulas!
   */
  christoffelSymbols(u: number, t: number): ChristoffelSymbols {
    const r = this.derivatives.r(u);
    const ru = this.derivatives.ru!(u);
    const ruu = this.derivatives.ruu!(u);
    const hu = this.derivatives.hu!(u);
    const huu = this.derivatives.huu!(u);

    const denom = 1 + ru * ru + hu * hu;

    // Christoffel symbols from your code (u = first coord, t = second coord)
    const Γuuu = (hu * huu + ru * ruu) / denom;
    const Γuut = 0;
    const Γutt = ru / r;
    const Γtuu = -r * ru / denom;
    const Γtut = 0;
    const Γttt = 0;

    return {
      u: {
        u: { u: Γuuu, v: Γuut },
        v: { u: Γuut, v: Γutt }
      },
      v: {
        u: { u: Γtuu, v: Γtut },
        v: { u: Γtut, v: Γttt }
      }
    };
  }

  /**
   * Check if point (u, t) is outside the domain
   * From RevolutionGeometry.js lines 26-27
   */
  isOutsideDomain(u: number, t: number): boolean {
    return u < this.uMin || u > this.uMax;
    // Note: t is periodic [0, 2π], so no bounds check needed
  }

  // ===== Additional Differential Geometry =====

  /**
   * Gaussian curvature for surfaces of revolution
   * TODO: Need optimized formula from user
   */
  gaussianCurvature(u: number, t: number): number {
    throw new Error('gaussianCurvature not yet implemented - awaiting optimized formula');
  }

  /**
   * Mean curvature for surfaces of revolution
   * TODO: Need optimized formula from user
   */
  meanCurvature(u: number, t: number): number {
    throw new Error('meanCurvature not yet implemented - awaiting optimized formula');
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
