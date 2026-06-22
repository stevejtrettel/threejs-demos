/**
 * TorusFarm — bake many 8-vertex polyhedral tori into a few STATIC merged
 * meshes suitable for `three-gpu-pathtracer`.
 *
 * Why not just add N `TorusView`s? The installed pathtracer (0.0.23/0.0.24)
 * does NOT support `InstancedMesh` (its scene generator collects `isMesh` and
 * bakes only `matrixWorld` — see its README: "Instanced geometry … not
 * supported") and silently drops `LineSegments` (not `isMesh`). So the
 * instanced spheres and the line-segment edges that `TorusView` uses for the
 * WebGL preview both vanish under path tracing.
 *
 * This builder therefore produces a pathtraceable representation:
 *   - edges  → real open CYLINDERS (tubes), not LineSegments
 *   - balls  → real merged SPHERES, not an InstancedMesh
 *   - faces  → merged flat-shaded triangles
 * everything pre-transformed into world space and merged. Per color class we
 * emit exactly two meshes (faces + struts), so the whole farm is `2 * #classes`
 * meshes regardless of how many tori it holds.
 *
 * Each torus contributes UNIQUE triangles (the tori are all different), so
 * faces must be merged. Balls and tubes are identical primitives but, with no
 * instancing available, they're merged too — fine for ~100 tori; the only knob
 * that matters for the triangle budget is `sphereDetail` (see notes below).
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Torus } from '@/tori/defineTorus';

/** One torus to place: its topology + the ℝ²⁴ point + an optional world transform. */
export interface FarmEntry {
  /** Combinatorial type — supplies `.triangles`, `.edges`, `.vertexCount`. */
  topology: Torus;
  /** Interleaved local coords `[x0,y0,z0, …, x7,y7,z7]`, length `3*vertexCount`. */
  positions: ArrayLike<number>;
  /** Local→world transform (grid placement, scale, recentering). Default: identity. */
  placement?: THREE.Matrix4;
  /** Color-class key; entries sharing a key share a material. Default: `'default'`. */
  classId?: string;
}

/** Appearance of one color class. */
export interface ClassStyle {
  faceColor: THREE.ColorRepresentation;
  /** Color for balls + tubes. Default: same as `faceColor`. */
  strutColor?: THREE.ColorRepresentation;
  faceRoughness?: number;
  faceMetalness?: number;
  strutRoughness?: number;
  strutMetalness?: number;
}

export interface TorusFarmOptions {
  /** Vertex-ball radius in world units. Default 0.05. */
  vertexRadius?: number;
  /** Edge-tube radius in world units. Default 0.022. */
  edgeRadius?: number;
  /**
   * Icosphere subdivisions for the vertex balls. This is the dominant triangle
   * cost: 20·4^detail triangles per ball. 1 → 80, 2 → 320. Default 2.
   */
  sphereDetail?: number;
  /** Radial segments of the edge tubes. Default 8 (→ 16 tris per tube). */
  tubeRadialSegments?: number;
  /** Per-class appearance. Missing classes fall back to `defaultStyle`. */
  styles?: Record<string, ClassStyle>;
  /** Style used for any class not present in `styles`. */
  defaultStyle?: ClassStyle;
}

export interface TorusFarmResult {
  /** Contains the per-class face + strut meshes. Add this to the scene. */
  group: THREE.Group;
  /** Total triangles in the baked scene (faces + balls + tubes). */
  triangleCount: number;
  dispose(): void;
}

const DEFAULT_STYLE: Required<Omit<ClassStyle, 'strutColor'>> & { strutColor?: THREE.ColorRepresentation } = {
  faceColor: 0x9aa7b4,
  strutColor: 0x2a2f36,
  faceRoughness: 0.55,
  faceMetalness: 0.0,
  strutRoughness: 0.4,
  strutMetalness: 0.1,
};

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Bake a list of tori into static merged meshes grouped by color class.
 */
export function buildTorusFarm(
  entries: readonly FarmEntry[],
  opts: TorusFarmOptions = {},
): TorusFarmResult {
  const vertexRadius = opts.vertexRadius ?? 0.05;
  const edgeRadius = opts.edgeRadius ?? 0.022;
  const sphereDetail = opts.sphereDetail ?? 2;
  const tubeRadialSegments = opts.tubeRadialSegments ?? 8;

  // Shared unit primitives. Both forced non-indexed so they can merge together
  // (mergeGeometries requires all-or-none indexed). Unit sphere: radius 1,
  // centered. Unit tube: radius 1, height 1, +Y axis, open-ended.
  const unitSphere = new THREE.IcosahedronGeometry(1, sphereDetail).toNonIndexed();
  const unitTube = new THREE.CylinderGeometry(1, 1, 1, tubeRadialSegments, 1, true).toNonIndexed();

  // Group entries by class, preserving first-seen order.
  const classOrder: string[] = [];
  const byClass = new Map<string, FarmEntry[]>();
  for (const e of entries) {
    const key = e.classId ?? 'default';
    let bucket = byClass.get(key);
    if (!bucket) {
      bucket = [];
      byClass.set(key, bucket);
      classOrder.push(key);
    }
    bucket.push(e);
  }

  const group = new THREE.Group();
  group.name = 'TorusFarm';
  const disposables: { dispose(): void }[] = [];
  let triangleCount = 0;

  // Scratch reused across the whole bake.
  const M = new THREE.Matrix4();
  const v3 = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  for (const key of classOrder) {
    const bucket = byClass.get(key)!;
    const style = { ...DEFAULT_STYLE, ...(opts.defaultStyle ?? {}), ...(opts.styles?.[key] ?? {}) };
    const strutColor = style.strutColor ?? style.faceColor;

    // ---- Pass 1: collect world-space vertex positions per entry ----
    // (computed once, reused by faces + balls + tubes)
    const worldVerts: THREE.Vector3[][] = [];
    for (const e of bucket) {
      const n = e.topology.vertexCount;
      const pm = e.placement ?? IDENTITY;
      const verts: THREE.Vector3[] = new Array(n);
      for (let i = 0; i < n; i++) {
        verts[i] = new THREE.Vector3(
          e.positions[3 * i],
          e.positions[3 * i + 1],
          e.positions[3 * i + 2],
        ).applyMatrix4(pm);
      }
      worldVerts.push(verts);
    }

    // ---- Faces: one non-indexed position buffer for the whole class ----
    let faceTriTotal = 0;
    for (const e of bucket) faceTriTotal += e.topology.triangles.length;
    const facePos = new Float32Array(faceTriTotal * 3 * 3);
    let fp = 0;
    for (let bi = 0; bi < bucket.length; bi++) {
      const tris = bucket[bi].topology.triangles;
      const verts = worldVerts[bi];
      for (let t = 0; t < tris.length; t++) {
        const tri = tris[t];
        for (let k = 0; k < 3; k++) {
          const p = verts[tri[k]];
          facePos[fp++] = p.x;
          facePos[fp++] = p.y;
          facePos[fp++] = p.z;
        }
      }
    }
    const faceGeom = new THREE.BufferGeometry();
    faceGeom.setAttribute('position', new THREE.BufferAttribute(facePos, 3));
    faceGeom.computeVertexNormals();
    const faceMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(style.faceColor),
      flatShading: true,
      side: THREE.DoubleSide,
      roughness: style.faceRoughness,
      metalness: style.faceMetalness,
    });
    const faceMesh = new THREE.Mesh(faceGeom, faceMat);
    faceMesh.name = `faces:${key}`;
    faceMesh.frustumCulled = false;
    group.add(faceMesh);
    disposables.push(faceGeom, faceMat);
    triangleCount += faceTriTotal;

    // ---- Struts: balls (spheres) + tubes (cylinders), merged per class ----
    const strutGeoms: THREE.BufferGeometry[] = [];
    for (let bi = 0; bi < bucket.length; bi++) {
      const e = bucket[bi];
      const verts = worldVerts[bi];

      // Balls — one scaled+translated unit sphere per vertex.
      for (let i = 0; i < verts.length; i++) {
        M.compose(verts[i], ZERO_QUAT, scale.setScalar(vertexRadius));
        strutGeoms.push(unitSphere.clone().applyMatrix4(M));
      }

      // Tubes — orient the unit cylinder onto each edge A→B.
      const edges = e.topology.edges;
      for (let ei = 0; ei < edges.length; ei++) {
        const [i, j] = edges[ei];
        a.copy(verts[i]);
        b.copy(verts[j]);
        dir.subVectors(b, a);
        const len = dir.length();
        if (len < 1e-9) continue;
        mid.addVectors(a, b).multiplyScalar(0.5);
        quat.setFromUnitVectors(UP, dir.divideScalar(len));
        scale.set(edgeRadius, len, edgeRadius);
        M.compose(mid, quat, scale);
        strutGeoms.push(unitTube.clone().applyMatrix4(M));
      }
    }

    const strutGeom = mergeGeometries(strutGeoms, false);
    // clones are no longer needed once merged
    for (const g of strutGeoms) g.dispose();
    if (strutGeom) {
      const strutMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(strutColor),
        roughness: style.strutRoughness,
        metalness: style.strutMetalness,
      });
      const strutMesh = new THREE.Mesh(strutGeom, strutMat);
      strutMesh.name = `struts:${key}`;
      strutMesh.frustumCulled = false;
      group.add(strutMesh);
      disposables.push(strutGeom, strutMat);
      triangleCount += (strutGeom.getAttribute('position').count / 3) | 0;
    }
  }

  // base primitives are spent
  unitSphere.dispose();
  unitTube.dispose();

  return {
    group,
    triangleCount,
    dispose() {
      for (const d of disposables) d.dispose();
    },
  };
}

const IDENTITY = new THREE.Matrix4();
const ZERO_QUAT = new THREE.Quaternion();
