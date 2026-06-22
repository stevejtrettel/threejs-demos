/**
 * TorusView — a three.js Group that renders one PaperTorus as
 *   faces (flat-shaded mesh) + edges (line segments) + vertices (instanced spheres).
 *
 * Faces are drawn from a non-indexed BufferGeometry (16 tris × 3 unique verts =
 * 48 positions). This lets `setFaceScalars` assign a distinct color per triangle
 * via per-vertex colors that happen to be uniform within each triangle —
 * combined with `flatShading: true`, this reads as a per-face tint.
 *
 * Colors are an orthogonal concern from positions. `sync(torus)` only touches
 * positions. `setVertexScalars` / `setFaceScalars` are the single coloring API.
 */

import * as THREE from 'three';
import type { Torus } from '../tori/defineTorus';
import { PaperTorus } from '../math/embedding';
import {
  DEFAULT_VERTEX_COLOR,
  DEFAULT_FACE_COLOR,
  DEFAULT_EDGE_COLOR,
  type ScalarPalette,
} from './palette';

export interface TorusViewOptions {
  vertexRadius?: number;
}

export class TorusView extends THREE.Group {
  private readonly torus: Torus;
  private readonly faceCount: number;       // = torus.triangles.length
  private readonly edgeCount: number;        // = torus.edges.length
  private readonly vertexCount: number;

  private readonly faceMesh: THREE.Mesh;
  private readonly faceGeom: THREE.BufferGeometry;
  private readonly facePositions: Float32Array;
  private readonly faceColors: Float32Array;

  private readonly edgeLines: THREE.LineSegments;
  private readonly edgeGeom: THREE.BufferGeometry;
  private readonly edgePositions: Float32Array;

  private readonly vertexMesh: THREE.InstancedMesh;
  private readonly vertexMat: THREE.MeshStandardMaterial;

  private readonly _dummy = new THREE.Object3D();

  constructor(torus: Torus, opts: TorusViewOptions = {}) {
    super();

    this.torus = torus;
    this.faceCount = torus.triangles.length;
    this.edgeCount = torus.edges.length;
    this.vertexCount = torus.vertexCount;
    const FACE_VERTS = this.faceCount * 3;
    const EDGE_VERTS = this.edgeCount * 2;

    const vertexRadius = opts.vertexRadius ?? 0.06;

    // ---- Faces ----
    this.facePositions = new Float32Array(FACE_VERTS * 3);
    this.faceColors = new Float32Array(FACE_VERTS * 3);
    fillRGB(this.faceColors, DEFAULT_FACE_COLOR);
    this.faceGeom = new THREE.BufferGeometry();
    this.faceGeom.setAttribute('position', new THREE.BufferAttribute(this.facePositions, 3));
    this.faceGeom.setAttribute('color', new THREE.BufferAttribute(this.faceColors, 3));
    const faceMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      side: THREE.DoubleSide,
      roughness: 0.55,
      metalness: 0.0,
    });
    this.faceMesh = new THREE.Mesh(this.faceGeom, faceMat);
    this.add(this.faceMesh);

    // ---- Edges ----
    this.edgePositions = new Float32Array(EDGE_VERTS * 3);
    this.edgeGeom = new THREE.BufferGeometry();
    this.edgeGeom.setAttribute('position', new THREE.BufferAttribute(this.edgePositions, 3));
    const edgeMat = new THREE.LineBasicMaterial({ color: DEFAULT_EDGE_COLOR });
    this.edgeLines = new THREE.LineSegments(this.edgeGeom, edgeMat);
    this.add(this.edgeLines);

    // ---- Vertices ----
    const sphereGeom = new THREE.SphereGeometry(vertexRadius, 16, 12);
    this.vertexMat = new THREE.MeshStandardMaterial({ roughness: 0.4 });
    this.vertexMesh = new THREE.InstancedMesh(sphereGeom, this.vertexMat, this.vertexCount);
    for (let i = 0; i < this.vertexCount; i++) {
      this.vertexMesh.setColorAt(i, DEFAULT_VERTEX_COLOR);
    }
    if (this.vertexMesh.instanceColor) {
      this.vertexMesh.instanceColor.needsUpdate = true;
    }
    this.add(this.vertexMesh);
  }

  sync(paper: PaperTorus): void {
    const p = paper.positions;

    // Faces: splat 3 vertex positions per triangle.
    for (let t = 0; t < this.faceCount; t++) {
      const [a, b, c] = this.torus.triangles[t];
      const base = t * 9;
      const oa = 3 * a, ob = 3 * b, oc = 3 * c;
      this.facePositions[base    ] = p[oa];
      this.facePositions[base + 1] = p[oa + 1];
      this.facePositions[base + 2] = p[oa + 2];
      this.facePositions[base + 3] = p[ob];
      this.facePositions[base + 4] = p[ob + 1];
      this.facePositions[base + 5] = p[ob + 2];
      this.facePositions[base + 6] = p[oc];
      this.facePositions[base + 7] = p[oc + 1];
      this.facePositions[base + 8] = p[oc + 2];
    }
    this.faceGeom.attributes.position.needsUpdate = true;
    this.faceGeom.computeVertexNormals();
    this.faceGeom.computeBoundingSphere();

    // Edges: endpoint pairs.
    for (let e = 0; e < this.edgeCount; e++) {
      const [i, j] = this.torus.edges[e];
      const base = e * 6;
      const oi = 3 * i, oj = 3 * j;
      this.edgePositions[base    ] = p[oi];
      this.edgePositions[base + 1] = p[oi + 1];
      this.edgePositions[base + 2] = p[oi + 2];
      this.edgePositions[base + 3] = p[oj];
      this.edgePositions[base + 4] = p[oj + 1];
      this.edgePositions[base + 5] = p[oj + 2];
    }
    this.edgeGeom.attributes.position.needsUpdate = true;
    this.edgeGeom.computeBoundingSphere();

    // Vertex sphere translations.
    for (let i = 0; i < this.vertexCount; i++) {
      this._dummy.position.set(p[3 * i], p[3 * i + 1], p[3 * i + 2]);
      this._dummy.updateMatrix();
      this.vertexMesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.vertexMesh.instanceMatrix.needsUpdate = true;
  }

  setVertexScalars(values: ArrayLike<number> | null, palette?: ScalarPalette): void {
    if (values === null) {
      for (let i = 0; i < this.vertexCount; i++) {
        this.vertexMesh.setColorAt(i, DEFAULT_VERTEX_COLOR);
      }
    } else {
      if (values.length !== this.vertexCount) {
        throw new Error(
          `setVertexScalars expects ${this.vertexCount} values, got ${values.length}`,
        );
      }
      if (!palette) {
        throw new Error('setVertexScalars: palette required when values is non-null');
      }
      const domain = resolveDomain(values, palette.domain);
      for (let i = 0; i < this.vertexCount; i++) {
        const c = palette.color(values[i], domain);
        this.vertexMesh.setColorAt(i, c);
      }
    }
    if (this.vertexMesh.instanceColor) {
      this.vertexMesh.instanceColor.needsUpdate = true;
    }
  }

  setFaceScalars(values: ArrayLike<number> | null, palette?: ScalarPalette): void {
    const c = this.faceColors;
    if (values === null) {
      fillRGB(c, DEFAULT_FACE_COLOR);
    } else {
      if (values.length !== this.faceCount) {
        throw new Error(
          `setFaceScalars expects ${this.faceCount} values, got ${values.length}`,
        );
      }
      if (!palette) {
        throw new Error('setFaceScalars: palette required when values is non-null');
      }
      const domain = resolveDomain(values, palette.domain);
      for (let t = 0; t < this.faceCount; t++) {
        const col = palette.color(values[t], domain);
        const base = t * 9;
        for (let k = 0; k < 3; k++) {
          c[base + 3 * k    ] = col.r;
          c[base + 3 * k + 1] = col.g;
          c[base + 3 * k + 2] = col.b;
        }
      }
    }
    this.faceGeom.attributes.color.needsUpdate = true;
  }

  dispose(): void {
    this.faceGeom.dispose();
    (this.faceMesh.material as THREE.Material).dispose();
    this.edgeGeom.dispose();
    (this.edgeLines.material as THREE.Material).dispose();
    this.vertexMesh.geometry.dispose();
    this.vertexMat.dispose();
  }
}

function fillRGB(buf: Float32Array, color: THREE.Color): void {
  const n = buf.length / 3;
  for (let i = 0; i < n; i++) {
    buf[3 * i    ] = color.r;
    buf[3 * i + 1] = color.g;
    buf[3 * i + 2] = color.b;
  }
}

function resolveDomain(
  values: ArrayLike<number>,
  hint?: [number, number],
): [number, number] {
  if (hint) return hint;
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (!isFinite(lo) || !isFinite(hi)) return [0, 1];
  return [lo, hi];
}
