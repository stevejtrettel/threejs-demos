import * as THREE from 'three';
import { Params } from '@/Params';

// =====================================================
// Elliptic curve surface via Weierstrass ℘ function
// =====================================================
//
// Creates a mesh of the elliptic curve (℘(z), ℘'(z)) ⊂ ℂ² ≅ ℝ⁴
// projected to ℝ³, parameterized by z in the fundamental
// parallelogram of the lattice Λ = ℤ + τℤ.

// === Complex number type ===
type Complex = [number, number];

// === Complex arithmetic ===

function cmul(a: Complex, b: Complex): Complex {
  return [
    a[0] * b[0] - a[1] * b[1],
    a[0] * b[1] + a[1] * b[0]
  ];
}

function cinv(z: Complex): Complex {
  const norm = z[0] * z[0] + z[1] * z[1];
  return [z[0] / norm, -z[1] / norm];
}

function cadd(a: Complex, b: Complex): Complex {
  return [a[0] + b[0], a[1] + b[1]];
}

function csub(a: Complex, b: Complex): Complex {
  return [a[0] - b[0], a[1] - b[1]];
}

function cscale(s: number, z: Complex): Complex {
  return [s * z[0], s * z[1]];
}

// === Weierstrass ℘ and ℘' ===

interface WeierstrassResult {
  p: Complex;
  dp: Complex;
}

function weierstrass(z: Complex, tau: Complex, N: number = 10): WeierstrassResult {
  //
  // Compute ℘(z; τ) and ℘'(z; τ) via lattice summation.
  //
  // Returns { p: [re, im], dp: [re, im] }
  //

  const z2 = cmul(z, z);
  const z3 = cmul(z2, z);

  let p = cinv(z2);           // 1/z²
  let dp = cscale(-2, cinv(z3));  // -2/z³

  for (let n = -N; n <= N; n++) {
    for (let m = -N; m <= N; m++) {
      if (m === 0 && n === 0) continue;

      // ω = m + n*τ
      const omega: Complex = [m + n * tau[0], n * tau[1]];

      const diff = csub(z, omega);
      const diff2 = cmul(diff, diff);
      const diff3 = cmul(diff2, diff);
      const omega2 = cmul(omega, omega);

      // ℘: add 1/(z-ω)² - 1/ω²
      p = cadd(p, csub(cinv(diff2), cinv(omega2)));

      // ℘': add -2/(z-ω)³
      dp = cadd(dp, cscale(-2, cinv(diff3)));
    }
  }

  return { p, dp };
}

// === Projection from ℂ² to ℝ³ ===

function projectToR3(p: Complex, dp: Complex, mode: number = 0): THREE.Vector3 {
  //
  // Project (℘, ℘') ∈ ℂ² ≅ ℝ⁴ down to ℝ³.
  //
  // Modes:
  //   0: (Re ℘, Im ℘, Re ℘')  — drop Im ℘'
  //   1: (Re ℘, Im ℘, Im ℘')  — drop Re ℘'
  //   2: (Re ℘, Re ℘', Im ℘') — drop Im ℘
  //   3: (Im ℘, Re ℘', Im ℘') — drop Re ℘
  //

  switch (mode) {
    case 0: return new THREE.Vector3(p[0], p[1], dp[0]);
    case 1: return new THREE.Vector3(p[0], p[1], dp[1]);
    case 2: return new THREE.Vector3(p[0], dp[0], dp[1]);
    case 3: return new THREE.Vector3(p[1], dp[0], dp[1]);
    default: return new THREE.Vector3(p[0], p[1], dp[0]);
  }
}

// === Bounding check ===

function inBoundingSphere(v: THREE.Vector3, radius: number): boolean {
  return v.lengthSq() <= radius * radius;
}

// === Options interface ===

export interface EllipticCurveMeshOptions {
  /** Real part of lattice parameter τ (default: 0.5) */
  tauRe?: number;
  /** Imaginary part of lattice parameter τ (default: 0.866 ≈ √3/2) */
  tauIm?: number;
  /** Grid resolution (default: 80) */
  resolution?: number;
  /** Radius of hole at origin/poles (default: 0.06) */
  holeRadius?: number;
  /** Number of terms in lattice summation (default: 10) */
  latticeTerms?: number;
  /** Projection mode 0-3: which ℝ⁴ coordinate to drop (default: 0) */
  projectionMode?: number;
  /** Bounding sphere radius for clipping (default: 5) */
  boundingSize?: number;
  /** Scale factor for output geometry (default: 0.1) */
  outputScale?: number;
  /** Surface color (default: 0x4488ff) */
  color?: number;
  /** Surface roughness 0-1 (default: 0.7) */
  roughness?: number;
  /** Surface metalness 0-1 (default: 0.3) */
  metalness?: number;
}

/**
 * EllipticCurveMesh
 *
 * Visualizes an elliptic curve as a surface in ℝ³ via the Weierstrass ℘ function.
 *
 * The elliptic curve lives naturally as (℘(z), ℘'(z)) in ℂ² ≅ ℝ⁴, parameterized
 * by z in the fundamental parallelogram of the lattice Λ = ℤ + τℤ. We project
 * to ℝ³ by dropping one coordinate.
 *
 * @example
 *   const curve = new EllipticCurveMesh({
 *     tauRe: 0.5,
 *     tauIm: 0.866,
 *     resolution: 100
 *   });
 *   app.add(curve, { params: true });
 *
 *   // Change lattice parameter reactively
 *   curve.params.set('tauIm', 1.2);
 */
export class EllipticCurveMesh extends THREE.Mesh {
  readonly params = new Params(this);

  /** Real part of lattice parameter τ */
  declare tauRe: number;

  /** Imaginary part of lattice parameter τ */
  declare tauIm: number;

  /** Grid resolution for sampling the fundamental domain */
  declare resolution: number;

  /** Radius of hole punched at the origin (where ℘ has a pole) */
  declare holeRadius: number;

  /** Number of terms in lattice summation for ℘ */
  declare latticeTerms: number;

  /** Projection mode: which coordinate of ℝ⁴ to drop (0-3) */
  declare projectionMode: number;

  /** Bounding sphere radius for clipping */
  declare boundingSize: number;

  /** Scale factor applied to output geometry */
  declare outputScale: number;

  /** Surface color */
  declare color: number;

  /** Surface roughness (0 = smooth, 1 = rough) */
  declare roughness: number;

  /** Surface metalness (0 = dielectric, 1 = metal) */
  declare metalness: number;

  constructor(options: EllipticCurveMeshOptions = {}) {
    super();

    // Define parameters
    this.params
      // Geometry parameters (trigger rebuild)
      .define('tauRe', options.tauRe ?? 0.5, { triggers: 'rebuild' })
      .define('tauIm', options.tauIm ?? 0.866, { triggers: 'rebuild' })
      .define('resolution', options.resolution ?? 80, { triggers: 'rebuild' })
      .define('holeRadius', options.holeRadius ?? 0.06, { triggers: 'rebuild' })
      .define('latticeTerms', options.latticeTerms ?? 10, { triggers: 'rebuild' })
      .define('projectionMode', options.projectionMode ?? 0, { triggers: 'rebuild' })
      .define('boundingSize', options.boundingSize ?? 5, { triggers: 'rebuild' })
      .define('outputScale', options.outputScale ?? 0.1, { triggers: 'rebuild' })
      // Material parameters (trigger update)
      .define('color', options.color ?? 0x4488ff, { triggers: 'update' })
      .define('roughness', options.roughness ?? 0.7, { triggers: 'update' })
      .define('metalness', options.metalness ?? 0.3, { triggers: 'update' });

    // Create material
    this.material = new THREE.MeshPhysicalMaterial({
      side: THREE.DoubleSide,
      flatShading: false
    });

    // Initial build
    this.rebuild();
    this.update();
  }

  /**
   * Rebuild geometry from current parameters.
   *
   * Called when lattice, resolution, or projection parameters change.
   * This is EXPENSIVE - regenerates entire geometry.
   */
  rebuild(): void {
    // Dispose old geometry
    if (this.geometry) {
      this.geometry.dispose();
    }

    this.geometry = this.buildGeometry();
  }

  /**
   * Update material properties.
   *
   * Called when color, roughness, or metalness change.
   * This is CHEAP - just updates material uniforms.
   */
  update(): void {
    const mat = this.material as THREE.MeshPhysicalMaterial;

    mat.color.set(this.color);
    mat.roughness = this.roughness;
    mat.metalness = this.metalness;
    mat.needsUpdate = true;
  }

  /**
   * Dispose of geometry and material resources.
   */
  dispose(): void {
    if (this.geometry) {
      this.geometry.dispose();
    }
    if (this.material) {
      (this.material as THREE.Material).dispose();
    }
    this.params.dispose();
  }

  /**
   * Build the elliptic curve geometry.
   */
  private buildGeometry(): THREE.BufferGeometry {
    const tau: Complex = [this.tauRe, this.tauIm];
    const res = this.resolution;
    const holeRadius = this.holeRadius;
    const latticeTerms = this.latticeTerms;
    const projectionMode = this.projectionMode;
    const boundingSize = this.boundingSize;
    const outputScale = this.outputScale;

    // Compute vertex positions on a grid in (a, b) ∈ [-0.5, 0.5]²
    const vertices: (THREE.Vector3 | null)[] = [];
    const uvs: [number, number][] = [];

    for (let j = 0; j <= res; j++) {
      for (let i = 0; i <= res; i++) {
        const a = i / res - 0.5;
        const b = j / res - 0.5;

        // Check if in hole around origin
        const r2 = a * a + b * b;
        if (r2 < holeRadius * holeRadius) {
          vertices.push(null);
          uvs.push([a + 0.5, b + 0.5]);
          continue;
        }

        // z = a + b*τ
        const z: Complex = [a + b * tau[0], b * tau[1]];

        // Compute ℘ and ℘'
        const { p, dp } = weierstrass(z, tau, latticeTerms);

        // Project to R³
        const v = projectToR3(p, dp, projectionMode);
        v.multiplyScalar(outputScale);

        // Check bounds (sphere only)
        if (inBoundingSphere(v, boundingSize)) {
          vertices.push(v);
        } else {
          vertices.push(null);
        }

        uvs.push([a + 0.5, b + 0.5]);
      }
    }

    // Build triangles, skipping any with null vertices
    const positions: number[] = [];
    const uvArray: number[] = [];
    const indices: number[] = [];

    // Create a mapping from grid index to actual vertex index
    const vertexMap = new Map<number, number>();
    let vertexIndex = 0;

    for (let j = 0; j <= res; j++) {
      for (let i = 0; i <= res; i++) {
        const gridIndex = j * (res + 1) + i;
        const v = vertices[gridIndex];

        if (v !== null) {
          positions.push(v.x, v.y, v.z);
          uvArray.push(uvs[gridIndex][0], uvs[gridIndex][1]);
          vertexMap.set(gridIndex, vertexIndex);
          vertexIndex++;
        }
      }
    }

    // Build triangle indices
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const g00 = j * (res + 1) + i;
        const g10 = j * (res + 1) + (i + 1);
        const g01 = (j + 1) * (res + 1) + i;
        const g11 = (j + 1) * (res + 1) + (i + 1);

        const v00 = vertexMap.get(g00);
        const v10 = vertexMap.get(g10);
        const v01 = vertexMap.get(g01);
        const v11 = vertexMap.get(g11);

        // First triangle: (00, 10, 01)
        if (v00 !== undefined && v10 !== undefined && v01 !== undefined) {
          indices.push(v00, v10, v01);
        }

        // Second triangle: (10, 11, 01)
        if (v10 !== undefined && v11 !== undefined && v01 !== undefined) {
          indices.push(v10, v11, v01);
        }
      }
    }

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvArray, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }
}
