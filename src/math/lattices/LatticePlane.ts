/**
 * LatticePlane
 *
 * A THREE.Mesh that visualizes a 2D lattice on a plane using a fragment shader.
 * Supports multiple visual layers: lattice points, parallelogram grid,
 * Voronoi cells, basis vectors, reduced basis, and fundamental domains.
 *
 * Usage:
 *   const plane = new LatticePlane({
 *     lattice: new Lattice2D([1, 0], [0.3, 1]),
 *     showPoints: true,
 *     showGrid: true,
 *     showVoronoi: true,
 *   });
 *   scene.add(plane);
 *
 *   // Update lattice (e.g. during animation)
 *   plane.setLattice(new Lattice2D([1, 0.1], [0.3, 1.2]));
 */

import * as THREE from 'three';
import { Lattice2D } from './Lattice2D';

import vertexShader from './lattice.vert.glsl?raw';
import fragmentShader from './lattice.frag.glsl?raw';

// ── Options ──────────────────────────────────────────────

export interface LatticePlaneOptions {
  /** The lattice to visualize */
  lattice: Lattice2D;
  /** Size of the plane in world units (default: 20) */
  size?: number;

  // Layer toggles (all default false except showPoints)
  showPoints?: boolean;
  showGrid?: boolean;
  showVoronoi?: boolean;
  showBasis?: boolean;
  showReducedBasis?: boolean;
  showFundDomain?: boolean;
  showReducedFundDomain?: boolean;

  // Visual parameters
  pointRadius?: number;
  lineWidth?: number;
  basisWidth?: number;
  pointColor?: THREE.ColorRepresentation;
  gridColor?: THREE.ColorRepresentation;
  voronoiColor?: THREE.ColorRepresentation;
  basisColor?: THREE.ColorRepresentation;
  reducedBasisColor?: THREE.ColorRepresentation;
  fundDomainColor?: THREE.ColorRepresentation;
  reducedFundDomainColor?: THREE.ColorRepresentation;
  fundDomainAlpha?: number;
  reducedFundDomainAlpha?: number;
  backgroundColor?: THREE.ColorRepresentation;
}

// ── Class ────────────────────────────────────────────────

export class LatticePlane extends THREE.Mesh {
  readonly uniforms: Record<string, THREE.IUniform>;
  private _lattice: Lattice2D;

  constructor(options: LatticePlaneOptions) {
    const size = options.size ?? 20;
    const geometry = new THREE.PlaneGeometry(size, size);

    const lattice = options.lattice;
    const reduced = lattice.reduce();

    const uniforms: Record<string, THREE.IUniform> = {
      uOmega1: { value: new THREE.Vector2(lattice.omega1[0], lattice.omega1[1]) },
      uOmega2: { value: new THREE.Vector2(lattice.omega2[0], lattice.omega2[1]) },
      uReducedOmega1: { value: new THREE.Vector2(reduced.omega1[0], reduced.omega1[1]) },
      uReducedOmega2: { value: new THREE.Vector2(reduced.omega2[0], reduced.omega2[1]) },

      uShowPoints: { value: options.showPoints ?? true },
      uShowGrid: { value: options.showGrid ?? false },
      uShowVoronoi: { value: options.showVoronoi ?? false },
      uShowBasis: { value: options.showBasis ?? false },
      uShowReducedBasis: { value: options.showReducedBasis ?? false },
      uShowFundDomain: { value: options.showFundDomain ?? false },
      uShowReducedFundDomain: { value: options.showReducedFundDomain ?? false },

      uPointRadius: { value: options.pointRadius ?? 0.06 },
      uLineWidth: { value: options.lineWidth ?? 0.03 },
      uBasisWidth: { value: options.basisWidth ?? 0.04 },

      uPointColor: { value: new THREE.Color(options.pointColor ?? 0xffffff) },
      uGridColor: { value: new THREE.Color(options.gridColor ?? 0x666666) },
      uVoronoiColor: { value: new THREE.Color(options.voronoiColor ?? 0x4488ff) },
      uBasisColor: { value: new THREE.Color(options.basisColor ?? 0xff4444) },
      uReducedBasisColor: { value: new THREE.Color(options.reducedBasisColor ?? 0x44ff44) },
      uFundDomainColor: { value: new THREE.Color(options.fundDomainColor ?? 0xff4444) },
      uReducedFundDomainColor: { value: new THREE.Color(options.reducedFundDomainColor ?? 0x44ff44) },
      uFundDomainAlpha: { value: options.fundDomainAlpha ?? 0.15 },
      uReducedFundDomainAlpha: { value: options.reducedFundDomainAlpha ?? 0.15 },
      uBackgroundColor: { value: new THREE.Color(options.backgroundColor ?? 0x111111) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      side: THREE.DoubleSide,
    });

    super(geometry, material);
    this.uniforms = uniforms;
    this._lattice = lattice;
  }

  /**
   * Update the lattice. Recomputes the reduced basis and updates all uniforms.
   */
  setLattice(lattice: Lattice2D): void {
    this._lattice = lattice;
    const reduced = lattice.reduce();

    this.uniforms.uOmega1.value.set(lattice.omega1[0], lattice.omega1[1]);
    this.uniforms.uOmega2.value.set(lattice.omega2[0], lattice.omega2[1]);
    this.uniforms.uReducedOmega1.value.set(reduced.omega1[0], reduced.omega1[1]);
    this.uniforms.uReducedOmega2.value.set(reduced.omega2[0], reduced.omega2[1]);
  }

  /**
   * Get the current lattice.
   */
  get lattice(): Lattice2D {
    return this._lattice;
  }

  /**
   * Toggle a layer on or off.
   */
  setLayer(layer: LatticeLayer, visible: boolean): void {
    const uniformName = layerUniformMap[layer];
    if (uniformName) {
      this.uniforms[uniformName].value = visible;
    }
  }

  /**
   * Dispose of geometry and material.
   */
  dispose(): void {
    this.geometry.dispose();
    (this.material as THREE.Material).dispose();
  }
}

// ── Layer mapping ────────────────────────────────────────

export type LatticeLayer =
  | 'points'
  | 'grid'
  | 'voronoi'
  | 'basis'
  | 'reducedBasis'
  | 'fundDomain'
  | 'reducedFundDomain';

const layerUniformMap: Record<LatticeLayer, string> = {
  points: 'uShowPoints',
  grid: 'uShowGrid',
  voronoi: 'uShowVoronoi',
  basis: 'uShowBasis',
  reducedBasis: 'uShowReducedBasis',
  fundDomain: 'uShowFundDomain',
  reducedFundDomain: 'uShowReducedFundDomain',
};
