/**
 * RollUpMesh — animates a flat plane rolling up into a parametric surface.
 *
 * Given a Surface, creates a THREE.Mesh that smoothly deforms from the
 * tangent plane at the domain center (τ=0) to the full surface (τ=1)
 * via the family:
 *
 *   g_τ(u,v) = [f(center + τu, center + τv) − f(center)] / τ
 *
 * Call setTau(tau) each frame to animate.
 */

import * as THREE from 'three';
import type { Surface, DifferentialSurface } from './types';
import { Materials } from '@/scene/Materials';

export interface RollUpMeshOptions {
  /** Segments in u direction (default: 64) */
  uSegments?: number;
  /** Segments in v direction (default: 64) */
  vSegments?: number;
  /**
   * Force square flat shape at τ=0 by rescaling tangent vectors.
   * Set false to preserve the natural parallelogram (e.g. Hopf torus).
   * Default: true
   */
  squareDomain?: boolean;

  // Grid material options (ignored if material is provided)
  gridCount?: number;
  lineWidth?: number;
  subCount?: number;
  subWidth?: number;
  gridColor?: number;
  subColor?: number;
  fillColor?: number;
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;

  /** Custom material — overrides the default grid material */
  material?: THREE.Material;
}

// Scratch vectors to avoid GC pressure in the hot loop
const _p = new THREE.Vector3();
const _du = new THREE.Vector3();
const _dv = new THREE.Vector3();

const TAU_MIN = 0.001;
const FD_H = 1e-4;

export class RollUpMesh extends THREE.Mesh {
  readonly uniforms: Record<string, { value: any }>;

  private surface: Surface;
  private uSeg: number;
  private vSeg: number;
  private squareDomain: boolean;

  // Domain center and half-widths
  private uCenter: number;
  private vCenter: number;
  private uHalf: number;
  private vHalf: number;

  // Tangent frame at domain center
  private origin: THREE.Vector3;
  private eu: THREE.Vector3;
  private ev: THREE.Vector3;
  private lu: number;
  private lv: number;

  // Whether surface has analytical normals
  private hasAnalyticalNormals: boolean;

  constructor(surface: Surface, options: RollUpMeshOptions = {}) {
    super();

    this.surface = surface;
    this.uSeg = options.uSegments ?? 64;
    this.vSeg = options.vSegments ?? 64;
    this.squareDomain = options.squareDomain ?? true;

    // Compute domain center and half-widths
    const domain = surface.getDomain();
    this.uCenter = (domain.uMin + domain.uMax) / 2;
    this.vCenter = (domain.vMin + domain.vMax) / 2;
    this.uHalf = (domain.uMax - domain.uMin) / 2;
    this.vHalf = (domain.vMax - domain.vMin) / 2;

    // Precompute tangent frame at center
    this.origin = surface.evaluate(this.uCenter, this.vCenter);

    const fu = surface.evaluate(this.uCenter + FD_H, this.vCenter)
      .sub(surface.evaluate(this.uCenter - FD_H, this.vCenter))
      .divideScalar(2 * FD_H);
    const fv = surface.evaluate(this.uCenter, this.vCenter + FD_H)
      .sub(surface.evaluate(this.uCenter, this.vCenter - FD_H))
      .divideScalar(2 * FD_H);

    this.lu = fu.length();
    this.lv = fv.length();
    this.eu = fu.normalize();
    this.ev = fv.normalize();

    this.hasAnalyticalNormals = 'computeNormal' in surface;

    // Build geometry (positions zeroed, UVs and indices filled)
    this.geometry = this.buildGeometry();

    // Material
    if (options.material) {
      this.material = options.material;
      this.uniforms = {};
    } else {
      const { material, uniforms } = Materials.gridSurface({
        gridCount: options.gridCount,
        lineWidth: options.lineWidth,
        subCount: options.subCount,
        subWidth: options.subWidth,
        gridColor: options.gridColor,
        subColor: options.subColor,
        fillColor: options.fillColor,
        roughness: options.roughness,
        metalness: options.metalness,
        clearcoat: options.clearcoat,
        clearcoatRoughness: options.clearcoatRoughness,
      });
      this.material = material;
      this.uniforms = uniforms;
    }

    // Initial state: flat plane
    this.setTau(0);
  }

  /**
   * Set τ ∈ [0, 1] and update geometry buffers.
   * τ = 0 → flat tangent plane, τ = 1 → full surface.
   */
  setTau(tau: number): void {
    const pos = this.geometry.attributes.position as THREE.BufferAttribute;
    const norm = this.geometry.attributes.normal as THREE.BufferAttribute;
    const t = Math.max(tau, TAU_MIN);

    // Rescaling factors for square domain
    const su = this.squareDomain ? (1 - t) / this.lu + t : 1;
    const sv = this.squareDomain ? (1 - t) / this.lv + t : 1;

    let idx = 0;
    for (let i = 0; i <= this.vSeg; i++) {
      const v = this.vHalf * (2 * (i / this.vSeg) - 1);  // [-vHalf, vHalf]
      for (let j = 0; j <= this.uSeg; j++) {
        const u = this.uHalf * (2 * (j / this.uSeg) - 1);  // [-uHalf, uHalf]

        // g_τ(u,v) = [f(center + τu, center + τv) − f(center)] / τ
        const su_ = this.uCenter + t * u;
        const sv_ = this.vCenter + t * v;
        _p.copy(this.surface.evaluate(su_, sv_)).sub(this.origin).divideScalar(t);

        // Apply tangent-frame rescaling for square domain
        if (this.squareDomain) {
          const cu = _p.dot(this.eu);
          const cv = _p.dot(this.ev);
          _p.addScaledVector(this.eu, (su - 1) * cu);
          _p.addScaledVector(this.ev, (sv - 1) * cv);
        }

        pos.setXYZ(idx, _p.x, _p.y, _p.z);

        // Normal
        if (this.hasAnalyticalNormals) {
          const n = (this.surface as DifferentialSurface).computeNormal(su_, sv_);
          norm.setXYZ(idx, n.x, n.y, n.z);
        } else {
          // Numerical normal via finite differences
          _du.copy(this.surface.evaluate(su_ + FD_H, sv_))
            .sub(this.surface.evaluate(su_ - FD_H, sv_));
          _dv.copy(this.surface.evaluate(su_, sv_ + FD_H))
            .sub(this.surface.evaluate(su_, sv_ - FD_H));
          _p.crossVectors(_du, _dv).normalize();
          norm.setXYZ(idx, _p.x, _p.y, _p.z);
        }

        idx++;
      }
    }

    pos.needsUpdate = true;
    norm.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  dispose(): void {
    this.geometry.dispose();
    if (this.material instanceof THREE.Material) {
      this.material.dispose();
    }
  }

  private buildGeometry(): THREE.BufferGeometry {
    const uSeg = this.uSeg;
    const vSeg = this.vSeg;
    const count = (uSeg + 1) * (vSeg + 1);

    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);

    let idx = 0;
    for (let i = 0; i <= vSeg; i++) {
      const vt = i / vSeg;
      for (let j = 0; j <= uSeg; j++) {
        const ut = j / uSeg;
        uvs[idx * 2] = ut;
        uvs[idx * 2 + 1] = vt;
        idx++;
      }
    }

    const indices: number[] = [];
    for (let i = 0; i < vSeg; i++) {
      for (let j = 0; j < uSeg; j++) {
        const a = i * (uSeg + 1) + j;
        const b = (i + 1) * (uSeg + 1) + j;
        const c = i * (uSeg + 1) + (j + 1);
        const d = (i + 1) * (uSeg + 1) + (j + 1);
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    return geo;
  }
}
