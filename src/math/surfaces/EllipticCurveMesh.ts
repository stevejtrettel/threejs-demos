import * as THREE from 'three';
import { Params } from '@/Params';
import { type Complex } from '@/math/algebra/complex';
import { Lattice2D } from '@/math/lattices/Lattice2D';
import { weierstrassP } from '@/math/lattices/weierstrass';

// =====================================================
// Elliptic curve surface via Weierstrass ℘ function
// =====================================================
//
// Creates a mesh of the elliptic curve (℘(z), ℘'(z)) ⊂ ℂ² ≅ ℝ⁴
// projected to ℝ³, parameterized by z in the fundamental
// parallelogram of the lattice Λ = ω₁ℤ + ω₂ℤ.
//
// Uses the fast theta-function ℘ from math/lattices/weierstrass.ts
// (exponentially convergent in Im(τ)) instead of direct lattice summation.

// === Projection from ℂ² to ℝ³ ===

function projectToR3(
  p: Complex,
  dp: Complex,
  mode: number,
  dpScale: number,
): THREE.Vector3 {
  // Project (℘, ℘') ∈ ℂ² ≅ ℝ⁴ down to ℝ³.
  // dpScale controls relative scaling of ℘' vs ℘ (since |℘'| >> |℘| near poles)
  //
  // Modes:
  //   0: (Re ℘, Im ℘, Re ℘')  — drop Im ℘'
  //   1: (Re ℘, Im ℘, Im ℘')  — drop Re ℘'
  //   2: (Re ℘, Re ℘', Im ℘') — drop Im ℘
  //   3: (Im ℘, Re ℘', Im ℘') — drop Re ℘

  const sdp: Complex = [dp[0] * dpScale, dp[1] * dpScale];

  switch (mode) {
    case 0: return new THREE.Vector3(p[0], p[1], sdp[0]);
    case 1: return new THREE.Vector3(p[0], p[1], sdp[1]);
    case 2: return new THREE.Vector3(p[0], sdp[0], sdp[1]);
    case 3: return new THREE.Vector3(p[1], sdp[0], sdp[1]);
    default: return new THREE.Vector3(p[0], p[1], sdp[0]);
  }
}

// === Options interface ===

export interface EllipticCurveMeshOptions {
  /** Lattice to use (takes priority over tauRe/tauIm if provided) */
  lattice?: Lattice2D;
  /** Real part of lattice parameter τ (default: 0.5) */
  tauRe?: number;
  /** Imaginary part of lattice parameter τ (default: 0.866 ≈ √3/2) */
  tauIm?: number;
  /** Grid resolution (default: 80) */
  resolution?: number;
  /** Radius of hole at origin/poles in parameter space (default: 0.06) */
  holeRadius?: number;
  /** Number of terms in theta-function series (default: 20) */
  latticeTerms?: number;
  /** Projection mode 0-3: which ℝ⁴ coordinate to drop (default: 0) */
  projectionMode?: number;
  /** Bounding sphere radius — discard vertices with magnitude exceeding this (default: 10) */
  boundingSize?: number;
  /** Scale for ℘' relative to ℘, since |℘'| >> |℘| near poles (default: 0.05) */
  dpScale?: number;
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
 * by z in the fundamental parallelogram of the lattice Λ = ω₁ℤ + ω₂ℤ. We project
 * to ℝ³ by dropping one coordinate.
 *
 * Vertices near the pole (where ℘ diverges) are discarded if they exceed
 * `boundingSize` in magnitude, leaving a clean hole in the mesh.
 *
 * @example
 *   const curve = new EllipticCurveMesh({
 *     lattice: new Lattice2D([1, 0], [0.5, 0.866]),
 *     resolution: 100,
 *     boundingSize: 10,
 *   });
 *   scene.add(curve);
 *
 *   // Or with reactive tau parameters:
 *   curve.params.set('tauIm', 1.2);
 */
export class EllipticCurveMesh extends THREE.Mesh {
  readonly params = new Params(this);

  declare tauRe: number;
  declare tauIm: number;
  declare resolution: number;
  declare holeRadius: number;
  declare latticeTerms: number;
  declare projectionMode: number;
  declare boundingSize: number;
  declare dpScale: number;
  declare outputScale: number;
  declare color: number;
  declare roughness: number;
  declare metalness: number;

  constructor(options: EllipticCurveMeshOptions = {}) {
    super();

    // If a lattice is provided, extract tau from it
    const tau = options.lattice
      ? options.lattice.tau().tau
      : undefined;

    this.params
      // Geometry parameters (trigger rebuild)
      .define('tauRe', tau?.[0] ?? options.tauRe ?? 0.5, { triggers: 'rebuild' })
      .define('tauIm', tau?.[1] ?? options.tauIm ?? 0.866, { triggers: 'rebuild' })
      .define('resolution', options.resolution ?? 80, { triggers: 'rebuild' })
      .define('holeRadius', options.holeRadius ?? 0.06, { triggers: 'rebuild' })
      .define('latticeTerms', options.latticeTerms ?? 20, { triggers: 'rebuild' })
      .define('projectionMode', options.projectionMode ?? 0, { triggers: 'rebuild' })
      .define('boundingSize', options.boundingSize ?? 10, { triggers: 'rebuild' })
      .define('dpScale', options.dpScale ?? 0.05, { triggers: 'rebuild' })
      .define('outputScale', options.outputScale ?? 0.1, { triggers: 'rebuild' })
      // Material parameters (trigger update)
      .define('color', options.color ?? 0x4488ff, { triggers: 'update' })
      .define('roughness', options.roughness ?? 0.7, { triggers: 'update' })
      .define('metalness', options.metalness ?? 0.3, { triggers: 'update' });

    this.material = new THREE.MeshPhysicalMaterial({
      side: THREE.DoubleSide,
      flatShading: false,
    });

    this.rebuild();
    this.update();
  }

  /**
   * Set the lattice directly. Updates tauRe/tauIm which triggers a rebuild.
   */
  setLattice(lattice: Lattice2D): void {
    const { tau } = lattice.tau();
    this.params.set('tauRe', tau[0]);
    this.params.set('tauIm', tau[1]);
  }

  rebuild(): void {
    if (this.geometry) {
      this.geometry.dispose();
    }
    this.geometry = this.buildGeometry();
  }

  update(): void {
    const mat = this.material as THREE.MeshPhysicalMaterial;
    mat.color.set(this.color);
    mat.roughness = this.roughness;
    mat.metalness = this.metalness;
    mat.needsUpdate = true;
  }

  dispose(): void {
    if (this.geometry) this.geometry.dispose();
    if (this.material) (this.material as THREE.Material).dispose();
    this.params.dispose();
  }

  private buildGeometry(): THREE.BufferGeometry {
    const res = this.resolution;
    const holeRadius2 = this.holeRadius * this.holeRadius;
    const boundingSize2 = this.boundingSize * this.boundingSize;
    const projectionMode = this.projectionMode;
    const dpScale = this.dpScale;
    const outputScale = this.outputScale;
    const latticeTerms = this.latticeTerms;
    const tauRe = this.tauRe;
    const tauIm = this.tauIm;
    const stride = res + 1;

    // Build lattice from current tau: Λ = ℤ + τℤ (normalized, ω₁ = 1)
    const lattice = new Lattice2D([1, 0], [tauRe, tauIm]);

    // Evaluate the surface at parameter coords (a, b)
    const evalPoint = (a: number, b: number): THREE.Vector3 => {
      const z: Complex = [a + b * tauRe, b * tauIm];
      const { p, dp } = weierstrassP(z, lattice, latticeTerms);
      return projectToR3(p, dp, projectionMode, dpScale);
    };

    // Phase 1: Evaluate all grid points
    // Store parameter coords, position, and in/out classification.
    const gridA: Float64Array = new Float64Array(stride * stride);
    const gridB: Float64Array = new Float64Array(stride * stride);
    const gridPos: (THREE.Vector3 | null)[] = [];
    const gridInside: boolean[] = [];

    for (let j = 0; j <= res; j++) {
      for (let i = 0; i <= res; i++) {
        const idx = j * stride + i;
        const a = i / res - 0.5;
        const b = j / res - 0.5;
        gridA[idx] = a;
        gridB[idx] = b;

        if (a * a + b * b < holeRadius2) {
          gridPos.push(null);
          gridInside.push(false);
          continue;
        }

        const v = evalPoint(a, b);
        const inside = v.lengthSq() <= boundingSize2;
        gridPos.push(v);
        gridInside.push(inside);
      }
    }

    // Phase 2: Snap boundary vertices.
    // For each outside vertex with an *originally* inside neighbor, bisect
    // in parameter space to find where the surface crosses the bounding sphere.
    // Use a snapshot of the original classification to prevent cascading.
    const BISECT_ITERS = 10;
    const origInside = gridInside.slice();

    for (let j = 0; j <= res; j++) {
      for (let i = 0; i <= res; i++) {
        const idx = j * stride + i;
        if (origInside[idx] || gridPos[idx] === null) continue;

        // Find an *originally* inside neighbor (4-connected)
        let nIdx = -1;
        if (i > 0 && origInside[idx - 1]) nIdx = idx - 1;
        else if (i < res && origInside[idx + 1]) nIdx = idx + 1;
        else if (j > 0 && origInside[idx - stride]) nIdx = idx - stride;
        else if (j < res && origInside[idx + stride]) nIdx = idx + stride;

        if (nIdx === -1) continue; // deep in the hole — stays outside

        // Binary search: lo is inside, hi is outside
        let aLo = gridA[nIdx], bLo = gridB[nIdx];
        let aHi = gridA[idx], bHi = gridB[idx];

        for (let iter = 0; iter < BISECT_ITERS; iter++) {
          const aMid = (aLo + aHi) / 2;
          const bMid = (bLo + bHi) / 2;
          const mid = evalPoint(aMid, bMid);
          if (mid.lengthSq() <= boundingSize2) {
            aLo = aMid;
            bLo = bMid;
          } else {
            aHi = aMid;
            bHi = bMid;
          }
        }

        // Replace with the boundary point (last inside position)
        gridPos[idx] = evalPoint(aLo, bLo);
        gridInside[idx] = true;
      }
    }

    // Phase 3: Build indexed geometry
    const positions: number[] = [];
    const uvArray: number[] = [];
    const indices: number[] = [];

    const vertexMap = new Map<number, number>();
    let vertexIndex = 0;

    for (let j = 0; j <= res; j++) {
      for (let i = 0; i <= res; i++) {
        const idx = j * stride + i;
        const v = gridPos[idx];

        if (v !== null && gridInside[idx]) {
          positions.push(v.x * outputScale, v.y * outputScale, v.z * outputScale);
          uvArray.push(gridA[idx] + 0.5, gridB[idx] + 0.5);
          vertexMap.set(idx, vertexIndex);
          vertexIndex++;
        }
      }
    }

    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const g00 = j * stride + i;
        const g10 = j * stride + (i + 1);
        const g01 = (j + 1) * stride + i;
        const g11 = (j + 1) * stride + (i + 1);

        const v00 = vertexMap.get(g00);
        const v10 = vertexMap.get(g10);
        const v01 = vertexMap.get(g01);
        const v11 = vertexMap.get(g11);

        if (v00 !== undefined && v10 !== undefined && v01 !== undefined) {
          indices.push(v00, v10, v01);
        }
        if (v10 !== undefined && v11 !== undefined && v01 !== undefined) {
          indices.push(v10, v11, v01);
        }
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvArray, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
  }
}
