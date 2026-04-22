/**
 * LinkageMesh — renders a Linkage as rod cylinders + joint spheres.
 *
 * Topology-agnostic: works for chains, four-bars, scissor mechanisms, etc.
 * One THREE.Mesh per rod, one per joint. Pinned joints use a distinct material.
 *
 * rebuild() — called when joints or rods change (dispose + recreate meshes).
 * update()  — called when positions change (just re-pose existing meshes).
 *
 * The per-frame update path allocates nothing: cheap for smooth animation.
 */

import * as THREE from 'three';
import { Params } from '@/Params';
import type { Parametric, Rebuildable, Updatable } from '@/types';
import { Linkage } from './Linkage';

export interface LinkageMeshOptions {
  /** Rod (cylinder) radius. Default 0.04. */
  rodRadius?: number;
  /** Joint sphere radius. Default 1.6 × rodRadius. */
  jointRadius?: number;
  /** Radial segments for rod cylinders. Default 12. */
  rodSegments?: number;
  /** Widthwise + heightwise segments for joint spheres. Default 16. */
  jointSegments?: number;

  /** Custom rod material. When supplied, LinkageMesh does not own or dispose it. */
  rodMaterial?: THREE.Material;
  /** Custom material for free (unpinned) joints. When supplied, LinkageMesh does not own or dispose it. */
  freeJointMaterial?: THREE.Material;
  /** Custom material for pinned joints. When supplied, LinkageMesh does not own or dispose it. */
  pinnedJointMaterial?: THREE.Material;

  /** Rod color (only used if no rodMaterial supplied). Default white. */
  rodColor?: THREE.ColorRepresentation;
  /** Free-joint color (only used if no freeJointMaterial supplied). Default white. */
  freeJointColor?: THREE.ColorRepresentation;
  /** Pinned-joint color (only used if no pinnedJointMaterial supplied). Default red-orange. */
  pinnedJointColor?: THREE.ColorRepresentation;
}

export class LinkageMesh extends THREE.Group implements Parametric, Rebuildable, Updatable {
  readonly params = new Params(this);

  private linkage: Linkage;

  declare rodRadius: number;
  declare jointRadius: number;
  declare rodSegments: number;
  declare jointSegments: number;

  private rodMaterial: THREE.Material;
  private freeJointMaterial: THREE.Material;
  private pinnedJointMaterial: THREE.Material;
  private _ownsRodMaterial: boolean;
  private _ownsFreeJointMaterial: boolean;
  private _ownsPinnedJointMaterial: boolean;

  private rodMeshes: THREE.Mesh[] = [];
  private jointMeshes: THREE.Mesh[] = [];
  private rodGeometry?: THREE.CylinderGeometry;
  private jointGeometry?: THREE.SphereGeometry;

  private static readonly UP = new THREE.Vector3(0, 1, 0);

  constructor(linkage: Linkage, options: LinkageMeshOptions = {}) {
    super();

    this.linkage = linkage;

    const rodRadius = options.rodRadius ?? 0.04;
    const jointRadius = options.jointRadius ?? rodRadius * 1.6;

    this.params
      .define('rodRadius', rodRadius, { triggers: 'rebuild' })
      .define('jointRadius', jointRadius, { triggers: 'rebuild' })
      .define('rodSegments', options.rodSegments ?? 12, { triggers: 'rebuild' })
      .define('jointSegments', options.jointSegments ?? 16, { triggers: 'rebuild' })
      .dependOn(linkage);

    if (options.rodMaterial) {
      this.rodMaterial = options.rodMaterial;
      this._ownsRodMaterial = false;
    } else {
      this.rodMaterial = new THREE.MeshPhysicalMaterial({
        color: options.rodColor ?? 0xffffff,
        roughness: 0.3,
        metalness: 0.2,
      });
      this._ownsRodMaterial = true;
    }

    if (options.freeJointMaterial) {
      this.freeJointMaterial = options.freeJointMaterial;
      this._ownsFreeJointMaterial = false;
    } else {
      this.freeJointMaterial = new THREE.MeshPhysicalMaterial({
        color: options.freeJointColor ?? 0xffffff,
        roughness: 0.2,
        metalness: 0.1,
      });
      this._ownsFreeJointMaterial = true;
    }

    if (options.pinnedJointMaterial) {
      this.pinnedJointMaterial = options.pinnedJointMaterial;
      this._ownsPinnedJointMaterial = false;
    } else {
      this.pinnedJointMaterial = new THREE.MeshPhysicalMaterial({
        color: options.pinnedJointColor ?? 0xff5522,
        roughness: 0.25,
        metalness: 0.1,
      });
      this._ownsPinnedJointMaterial = true;
    }

    this.rebuild();
  }

  rebuild(): void {
    this._disposeMeshes();

    this.rodGeometry = new THREE.CylinderGeometry(
      this.rodRadius,
      this.rodRadius,
      1, // unit length, scaled per-rod
      this.rodSegments,
      1
    );
    this.jointGeometry = new THREE.SphereGeometry(
      this.jointRadius,
      this.jointSegments,
      this.jointSegments
    );

    for (let i = 0; i < this.linkage.rods.length; i++) {
      const mesh = new THREE.Mesh(this.rodGeometry, this.rodMaterial);
      this.rodMeshes.push(mesh);
      this.add(mesh);
    }

    const pinned = this.linkage.pinnedJoints();
    for (const joint of this.linkage.joints) {
      const mat = pinned.has(joint.id) ? this.pinnedJointMaterial : this.freeJointMaterial;
      const mesh = new THREE.Mesh(this.jointGeometry, mat);
      this.jointMeshes.push(mesh);
      this.add(mesh);
    }

    this.update();
  }

  update(): void {
    const d = this.linkage.dim;
    const pos = this.linkage.positions;

    // Joint spheres: position each at its joint coordinates.
    for (let i = 0; i < this.linkage.joints.length; i++) {
      const mesh = this.jointMeshes[i];
      if (!mesh) continue;
      const base = this.linkage.joints[i].id * d;
      mesh.position.set(
        pos[base] ?? 0,
        pos[base + 1] ?? 0,
        d >= 3 ? (pos[base + 2] ?? 0) : 0
      );
    }

    // Rods: position midpoint, rotate +Y to rod direction, scale Y by rod length.
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const mid = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const quat = new THREE.Quaternion();

    for (let i = 0; i < this.linkage.rods.length; i++) {
      const mesh = this.rodMeshes[i];
      if (!mesh) continue;
      const rod = this.linkage.rods[i];
      const baseA = rod.a * d;
      const baseB = rod.b * d;
      a.set(pos[baseA] ?? 0, pos[baseA + 1] ?? 0, d >= 3 ? (pos[baseA + 2] ?? 0) : 0);
      b.set(pos[baseB] ?? 0, pos[baseB + 1] ?? 0, d >= 3 ? (pos[baseB + 2] ?? 0) : 0);

      mid.addVectors(a, b).multiplyScalar(0.5);
      dir.subVectors(b, a);
      const len = dir.length();
      if (len > 0) dir.multiplyScalar(1 / len);
      else dir.set(0, 1, 0);

      quat.setFromUnitVectors(LinkageMesh.UP, dir);

      mesh.position.copy(mid);
      mesh.quaternion.copy(quat);
      mesh.scale.set(1, len, 1);
    }
  }

  dispose(): void {
    this._disposeMeshes();
    if (this._ownsRodMaterial) this.rodMaterial.dispose();
    if (this._ownsFreeJointMaterial) this.freeJointMaterial.dispose();
    if (this._ownsPinnedJointMaterial) this.pinnedJointMaterial.dispose();
    this.params.dispose();
  }

  private _disposeMeshes(): void {
    for (const m of this.rodMeshes) this.remove(m);
    for (const m of this.jointMeshes) this.remove(m);
    this.rodMeshes.length = 0;
    this.jointMeshes.length = 0;

    if (this.rodGeometry) {
      this.rodGeometry.dispose();
      this.rodGeometry = undefined;
    }
    if (this.jointGeometry) {
      this.jointGeometry.dispose();
      this.jointGeometry = undefined;
    }
  }
}
