/**
 * FaceMesh — triangulated render of an `Embedding`'s faces.
 *
 * The position attribute is backed by `emb.positions` directly (no copy):
 * mutating the embedding's positions in place and then calling `sync()`
 * uploads the new positions to the GPU and recomputes vertex normals
 * + bounding sphere.
 *
 * Topology is baked in at construction (the index buffer fan-triangulates
 * every face once). If the underlying `HalfEdgeMesh` changes shape,
 * construct a new `FaceMesh` — `sync()` is for position updates only.
 */

import * as THREE from 'three';
import type { HalfEdgeMesh } from './HalfEdgeMesh';
import type { Embedding } from './Embedding';

export interface FaceMeshOptions {
  /** Diffuse color for the default material. Ignored if `material` is supplied. */
  color?: THREE.ColorRepresentation;
  /** Render side. Default `THREE.DoubleSide`. */
  side?: THREE.Side;
  /**
   * Flat-shade faces (each face uses its own normal). Default `true` —
   * mesh-embedding work usually wants the discrete structure visible.
   * Ignored if `material` is supplied.
   */
  flatShading?: boolean;
  /**
   * Custom material. When supplied, `FaceMesh` does not own or dispose it.
   * When omitted, a `MeshPhysicalMaterial` is created and disposed by `dispose()`.
   */
  material?: THREE.Material;
}

export class FaceMesh extends THREE.Mesh {
  private readonly _ownsMaterial: boolean;

  constructor(emb: Embedding, options: FaceMeshOptions = {}) {
    const indices = buildTriangleIndices(emb.mesh);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(emb.positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    let material: THREE.Material;
    let ownsMaterial: boolean;
    if (options.material) {
      material = options.material;
      ownsMaterial = false;
    } else {
      material = new THREE.MeshPhysicalMaterial({
        color: options.color ?? 0xffe9ad,
        side: options.side ?? THREE.DoubleSide,
        flatShading: options.flatShading ?? true,
        clearcoat: 0.4,
        roughness: 0.5,
      });
      ownsMaterial = true;
    }

    super(geometry, material);
    this._ownsMaterial = ownsMaterial;
  }

  /** Push position changes to the GPU and refresh normals + bounding sphere. */
  sync(): void {
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeVertexNormals();
    this.geometry.computeBoundingSphere();
  }

  dispose(): void {
    this.geometry.dispose();
    if (this._ownsMaterial && this.material instanceof THREE.Material) {
      this.material.dispose();
    }
  }
}

/**
 * Fan-triangulate every face of a half-edge mesh and return a flat index
 * buffer. For an `n`-sided face, emits `n − 2` triangles all sharing the
 * face's first vertex.
 */
function buildTriangleIndices(mesh: HalfEdgeMesh): Uint32Array {
  let triCount = 0;
  for (const face of mesh.faces) {
    triCount += mesh.faceSides(face) - 2;
  }

  const indices = new Uint32Array(3 * triCount);
  const verts: number[] = [];
  let k = 0;

  for (const face of mesh.faces) {
    verts.length = 0;
    for (const v of mesh.faceVertices(face)) verts.push(v.index);

    for (let i = 1; i < verts.length - 1; i++) {
      indices[k++] = verts[0];
      indices[k++] = verts[i];
      indices[k++] = verts[i + 1];
    }
  }

  return indices;
}
