/**
 * CurveTube.ts
 *
 * A THREE.js mesh that renders a curve as a tube.
 * Automatically updates when the curve changes.
 */

import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric, Rebuildable, Updatable } from '@/types';
import type { Curve } from './types';
import { buildTubeGeometry } from './buildTubeGeometry';

export interface CurveTubeOptions {
  curve: Curve;
  radius?: number;
  /**
   * Optional variable radius function. Takes t ∈ [0, 1] and returns radius.
   * When provided, takes priority over the fixed `radius` value.
   */
  radiusFn?: (t: number) => number;
  tubularSegments?: number;
  radialSegments?: number;
  showEndpoints?: boolean;
  /** Provide a custom material. Overrides color/roughness/metalness. */
  material?: THREE.Material;
  color?: THREE.ColorRepresentation;
  roughness?: number;
  metalness?: number;
}

/**
 * A tube mesh that wraps around a curve
 *
 * Renders any Curve as a 3D tube with optional endpoint spheres.
 * Automatically rebuilds when curve or parameters change.
 *
 * @example
 * const points = [new Vector3(0,0,0), new Vector3(1,1,1)];
 * const curve = new NumericalCurve({ points });
 * const tube = new CurveTube({ curve, radius: 0.1 });
 * scene.add(tube);
 *
 * // Later: update the curve
 * curve.updatePoints(newPoints);  // Tube auto-rebuilds!
 */
export class CurveTube extends THREE.Group implements Parametric, Rebuildable, Updatable {

  readonly params = new Params(this);

  declare curve: Curve;
  declare radius: number;
  declare radiusFn: ((t: number) => number) | undefined;
  declare tubularSegments: number;
  declare radialSegments: number;
  declare showEndpoints: boolean;
  declare color: THREE.ColorRepresentation;
  declare roughness: number;
  declare metalness: number;

  private tubeMesh: THREE.Mesh;
  private material: THREE.Material;
  private _ownsMaterial: boolean;
  private startSphere?: THREE.Mesh;
  private endSphere?: THREE.Mesh;

  constructor(options: CurveTubeOptions) {
    super();

    // Use provided material or create a default one
    if (options.material) {
      this.material = options.material;
      this._ownsMaterial = false;
    } else {
      this.material = new THREE.MeshPhysicalMaterial({
        color: options.color ?? 0xffffff,
        roughness: options.roughness ?? 0,
        metalness: options.metalness ?? 0,
        clearcoat: 1,
      });
      this._ownsMaterial = true;
    }

    // Create initial tube mesh
    this.tubeMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
    this.add(this.tubeMesh);

    // Define reactive parameters
    this.params
      .define('curve', options.curve, { triggers: 'rebuild' })
      .define('radius', options.radius ?? 0.1, { triggers: 'rebuild' })
      .define('radiusFn', options.radiusFn, { triggers: 'rebuild' })
      .define('tubularSegments', options.tubularSegments ?? 128, { triggers: 'rebuild' })
      .define('radialSegments', options.radialSegments ?? 8, { triggers: 'rebuild' })
      .define('showEndpoints', options.showEndpoints ?? true, { triggers: 'rebuild' })
      .define('color', options.color ?? 0xffffff, { triggers: 'update' })
      .define('roughness', options.roughness ?? 0, { triggers: 'update' })
      .define('metalness', options.metalness ?? 0, { triggers: 'update' });

    // Watch curve for changes
    if ('params' in options.curve) {
      this.params.dependOn(options.curve as Parametric);
    }

    this.rebuild();
  }

  rebuild(): void {
    // Dispose old geometry
    this.tubeMesh.geometry.dispose();

    // Build new tube geometry
    const domain = this.curve.getDomain();
    const closed = domain.tMin === 0 && domain.tMax === 1 &&
                   this.curve.evaluate(0).distanceTo(this.curve.evaluate(1)) < 0.001;

    this.tubeMesh.geometry = buildTubeGeometry(this.curve, {
      radius: this.radius,
      radiusFn: this.radiusFn,
      tubularSegments: this.tubularSegments,
      radialSegments: this.radialSegments,
      closed,
    });

    // Update endpoints
    this._updateEndpoints();
  }

  update(): void {
    // Update material properties (only for default material)
    if (this._ownsMaterial && this.material instanceof THREE.MeshPhysicalMaterial) {
      this.material.color.set(this.color);
      this.material.roughness = this.roughness;
      this.material.metalness = this.metalness;
      this.material.needsUpdate = true;
    }
  }

  private _updateEndpoints(): void {
    // Remove old endpoint spheres
    if (this.startSphere) {
      this.remove(this.startSphere);
      this.startSphere.geometry.dispose();
      this.startSphere = undefined;
    }
    if (this.endSphere) {
      this.remove(this.endSphere);
      this.endSphere.geometry.dispose();
      this.endSphere = undefined;
    }

    if (!this.showEndpoints) return;

    // Create new endpoint spheres (sized by radiusFn at endpoints if available)
    const domain = this.curve.getDomain();
    const startRadius = (this.radiusFn ? this.radiusFn(0) : this.radius) * 2;
    const endRadius = (this.radiusFn ? this.radiusFn(1) : this.radius) * 2;

    this.startSphere = new THREE.Mesh(
      new THREE.SphereGeometry(startRadius, 16, 16), this.material
    );
    this.startSphere.position.copy(this.curve.evaluate(domain.tMin));
    this.add(this.startSphere);

    this.endSphere = new THREE.Mesh(
      new THREE.SphereGeometry(endRadius, 16, 16), this.material
    );
    this.endSphere.position.copy(this.curve.evaluate(domain.tMax));
    this.add(this.endSphere);
  }

  /**
   * Set visibility of tube and endpoints
   */
  setVisibility(visible: boolean): void {
    this.visible = visible;
  }

  dispose(): void {
    this.tubeMesh.geometry.dispose();
    if (this._ownsMaterial) this.material.dispose();

    if (this.startSphere) {
      this.startSphere.geometry.dispose();
    }
    if (this.endSphere) {
      this.endSphere.geometry.dispose();
    }

    this.params.dispose();
  }
}
