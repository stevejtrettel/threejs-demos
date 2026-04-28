/**
 * MeshView — composite scene-graph view of an `Embedding`.
 *
 * Currently wraps a single `FaceMesh`. Future passes will add edge and
 * vertex sub-views to expose more of the mesh's structure.
 *
 * Per-frame convention: call `meshView.sync()` from the demo's animate
 * loop *after* the evolver has stepped. That pushes the new positions
 * to the GPU and refreshes normals + bounding sphere.
 *
 * The buffer reference of `emb.positions` is shared with the inner
 * geometry — element-level mutations show up after `sync()`.
 */

import * as THREE from 'three';
import type { Embedding } from './Embedding';
import { FaceMesh, type FaceMeshOptions } from './FaceMesh';

export interface MeshViewOptions {
  /** Show triangulated faces. Default `true`. */
  showFaces?: boolean;
  /** Options passed to the inner `FaceMesh`. */
  face?: FaceMeshOptions;
}

export class MeshView extends THREE.Group {
  readonly emb: Embedding;
  readonly faces?: FaceMesh;

  constructor(emb: Embedding, options: MeshViewOptions = {}) {
    super();
    this.emb = emb;

    if (options.showFaces ?? true) {
      this.faces = new FaceMesh(emb, options.face);
      this.add(this.faces);
    }
  }

  sync(): void {
    this.faces?.sync();
  }

  dispose(): void {
    this.faces?.dispose();
  }
}
