/**
 * LiveSurfaceMesh.ts
 *
 * A surface mesh built for continuous reshaping.
 *
 * `SurfaceMesh` rebuilds through `buildGeometry`, which allocates fresh JS
 * arrays and a new `BufferGeometry` every time — right for a surface whose
 * parameters change occasionally, wasteful for one being dragged, where the
 * same few thousand vertices are rewritten every frame. This class allocates
 * its buffers once at a fixed resolution and rewrites them in place.
 *
 * It keeps `buildGeometry`'s conventions so the two are interchangeable:
 * vertices in row-major (v, then u) order, `normal = ∂u × ∂v`, and a vertex
 * that evaluates non-finite marks a hole — every quad touching it is dropped.
 * That last rule is what lets a surface excise its own singularities simply by
 * returning `NaN`, with the hole appearing as clean missing geometry.
 *
 * Normals come from central differences across the sample grid rather than
 * `computeVertexNormals`, which would need the whole index buffer and produce
 * area-weighted faceting near degenerate rows. `wrapU` / `wrapV` make those
 * differences wrap, so a closed surface is shaded smoothly across its seam
 * instead of showing a crease.
 */

import * as THREE from 'three';
import type { Surface } from './types';

export interface LiveSurfaceMeshOptions {
  /** Samples in the u direction (default 128). Fixed for the mesh's lifetime. */
  uSegments?: number;
  /** Samples in the v direction (default 96). Fixed for the mesh's lifetime. */
  vSegments?: number;
  /** Material to render with. A default MeshPhysicalMaterial is used if omitted. */
  material?: THREE.Material;
  /** Treat the surface as closed in u when computing normals (default false). */
  wrapU?: boolean;
  /** Treat the surface as closed in v when computing normals (default false). */
  wrapV?: boolean;
}

export class LiveSurfaceMesh extends THREE.Mesh {
  private surface: Surface;
  private readonly uSegments: number;
  private readonly vSegments: number;
  private wrapU: boolean;
  private wrapV: boolean;

  private readonly positions: Float32Array;
  private readonly normals: Float32Array;
  private readonly indices: Uint32Array;
  private readonly valid: Uint8Array;

  private readonly point = new THREE.Vector3();
  private readonly du = new THREE.Vector3();
  private readonly dv = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();

  constructor(surface: Surface, options: LiveSurfaceMeshOptions = {}) {
    const uSegments = options.uSegments ?? 128;
    const vSegments = options.vSegments ?? 96;
    const cols = uSegments + 1;
    const rows = vSegments + 1;
    const vertexCount = cols * rows;

    const positions = new Float32Array(vertexCount * 3);
    const normals = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = new Uint32Array(uSegments * vSegments * 6);

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const k = (i * cols + j) * 2;
        uvs[k] = j / uSegments;
        uvs[k + 1] = i / vSegments;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    super(geometry, options.material ?? new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide }));

    this.surface = surface;
    this.uSegments = uSegments;
    this.vSegments = vSegments;
    this.wrapU = options.wrapU ?? false;
    this.wrapV = options.wrapV ?? false;
    this.positions = positions;
    this.normals = normals;
    this.indices = indices;
    this.valid = new Uint8Array(vertexCount);

    this.refresh();
  }

  /** Point the mesh at a different surface. Resolution is unchanged. */
  setSurface(surface: Surface, wrap?: { u?: boolean; v?: boolean }): void {
    this.surface = surface;
    if (wrap?.u !== undefined) this.wrapU = wrap.u;
    if (wrap?.v !== undefined) this.wrapV = wrap.v;
    this.refresh();
  }

  /** Resample the surface into the existing buffers. */
  refresh(): void {
    const { uSegments, vSegments, positions, valid } = this;
    const cols = uSegments + 1;
    const rows = vSegments + 1;

    const domain = this.surface.getDomain();
    const { uMin, uMax, vMin, vMax } = domain;

    for (let i = 0; i < rows; i++) {
      const v = vMin + (vMax - vMin) * (i / vSegments);
      for (let j = 0; j < cols; j++) {
        const u = uMin + (uMax - uMin) * (j / uSegments);
        const p = this.surface.evaluate(u, v);
        const index = i * cols + j;
        const ok = Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
        valid[index] = ok ? 1 : 0;
        const k = index * 3;
        // Invalid vertices still need finite coordinates: they belong to no
        // triangle, but the bounding sphere is computed over the whole buffer.
        positions[k] = ok ? p.x : 0;
        positions[k + 1] = ok ? p.y : 0;
        positions[k + 2] = ok ? p.z : 0;
      }
    }

    this.refreshNormals(cols, rows);
    this.refreshIndices(cols);

    const geometry = this.geometry as THREE.BufferGeometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.computeBoundingSphere();
  }

  private refreshNormals(cols: number, rows: number): void {
    const { positions, normals, valid, du, dv, normal, point } = this;

    const read = (i: number, j: number, out: THREE.Vector3): boolean => {
      const index = i * cols + j;
      if (!valid[index]) return false;
      const k = index * 3;
      out.set(positions[k], positions[k + 1], positions[k + 2]);
      return true;
    };

    // Neighbour index along an axis, wrapping onto the far side for a closed
    // direction. The last sample duplicates the first there, so step past it.
    const neighbour = (i: number, n: number, delta: number, wrap: boolean): number => {
      const last = n - 1;
      if (wrap) return ((i + delta) % last + last) % last;
      return Math.max(0, Math.min(i + delta, last));
    };

    const a = new THREE.Vector3();
    const b = new THREE.Vector3();

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const index = i * cols + j;
        const k = index * 3;

        if (!valid[index]) {
          normals[k] = 0; normals[k + 1] = 0; normals[k + 2] = 1;
          continue;
        }

        read(i, j, point);

        // Central difference where both neighbours exist, one-sided where a
        // neighbour is missing or invalid, so normals stay sane at hole edges.
        const jPrev = neighbour(j, cols, -1, this.wrapU);
        const jNext = neighbour(j, cols, +1, this.wrapU);
        const hasPrev = read(i, jPrev, a);
        const hasNext = read(i, jNext, b);
        if (hasPrev && hasNext) du.subVectors(b, a);
        else if (hasNext) du.subVectors(b, point);
        else if (hasPrev) du.subVectors(point, a);
        else du.set(0, 0, 0);

        const iPrev = neighbour(i, rows, -1, this.wrapV);
        const iNext = neighbour(i, rows, +1, this.wrapV);
        const hasUp = read(iPrev, j, a);
        const hasDown = read(iNext, j, b);
        if (hasUp && hasDown) dv.subVectors(b, a);
        else if (hasDown) dv.subVectors(b, point);
        else if (hasUp) dv.subVectors(point, a);
        else dv.set(0, 0, 0);

        normal.crossVectors(du, dv);
        const len = normal.length();
        if (len > 1e-12) normal.divideScalar(len);
        else normal.set(0, 0, 1);

        normals[k] = normal.x;
        normals[k + 1] = normal.y;
        normals[k + 2] = normal.z;
      }
    }
  }

  private refreshIndices(cols: number): void {
    const { uSegments, vSegments, indices, valid } = this;
    let n = 0;

    for (let i = 0; i < vSegments; i++) {
      for (let j = 0; j < uSegments; j++) {
        const v0 = i * cols + j;
        const v1 = (i + 1) * cols + j;
        const v2 = i * cols + (j + 1);
        const v3 = (i + 1) * cols + (j + 1);
        if (!(valid[v0] && valid[v1] && valid[v2] && valid[v3])) continue;

        // Winding matches buildGeometry: normal = ∂u × ∂v.
        indices[n++] = v0; indices[n++] = v2; indices[n++] = v1;
        indices[n++] = v1; indices[n++] = v2; indices[n++] = v3;
      }
    }

    const geometry = this.geometry as THREE.BufferGeometry;
    geometry.index!.needsUpdate = true;
    geometry.setDrawRange(0, n);
  }

  dispose(): void {
    this.geometry.dispose();
    const material = this.material;
    if (Array.isArray(material)) material.forEach((m) => m.dispose());
    else material.dispose();
  }
}
