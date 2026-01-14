/**
 * MeshVisualizer.ts - Visualize mesh with spheres at vertices, tubes on edges, and faces
 *
 * Creates merged geometries (not instanced) for path tracer compatibility.
 */

import {
  Group,
  Mesh,
  Vector3,
  Color,
  Matrix4,
  Quaternion,
  SphereGeometry,
  CylinderGeometry,
  BufferGeometry,
  BufferAttribute,
  MeshPhysicalMaterial,
  DoubleSide,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { type ParsedMesh, extractEdges } from './parseOBJ';

export interface MeshVisualizerOptions {
  // Geometry sizes
  sphereRadius?: number;
  tubeRadius?: number;
  sphereSegments?: number;
  tubeSegments?: number;

  // Colors
  vertexColor?: number | Color;
  edgeColor?: number | Color;
  faceColor?: number | Color;
  faceColors?: (number | Color)[];  // per-face colors (overrides faceColor)

  // Visibility
  showVertices?: boolean;
  showEdges?: boolean;
  showFaces?: boolean;

  // Materials
  vertexMaterial?: MeshPhysicalMaterial;
  edgeMaterial?: MeshPhysicalMaterial;
  faceMaterial?: MeshPhysicalMaterial;

  // Face material options
  faceOpacity?: number;
  faceTransmission?: number;
}

const DEFAULT_OPTIONS: Required<Omit<MeshVisualizerOptions, 'faceColors' | 'vertexMaterial' | 'edgeMaterial' | 'faceMaterial'>> = {
  sphereRadius: 0.05,
  tubeRadius: 0.02,
  sphereSegments: 16,
  tubeSegments: 8,
  vertexColor: 0x222222,
  edgeColor: 0x456abc,
  faceColor: 0xffe9ad,
  showVertices: true,
  showEdges: true,
  showFaces: true,
  faceOpacity: 1.0,
  faceTransmission: 0,
};

/**
 * MeshVisualizer - Three.js Group containing vertex spheres, edge tubes, and face mesh
 *
 * All geometries are merged (not instanced) for path tracer compatibility.
 *
 * @example
 * const parsed = parseOBJ(objText);
 * const viz = new MeshVisualizer(parsed, {
 *   sphereRadius: 0.03,
 *   edgeColor: 0xff0000
 * });
 * scene.add(viz);
 */
export class MeshVisualizer extends Group {
  readonly vertexMesh: Mesh | null = null;
  readonly edgeMesh: Mesh | null = null;
  readonly faceMesh: Mesh | null = null;

  private readonly options: typeof DEFAULT_OPTIONS & { faceColors?: (number | Color)[] };
  private readonly parsedMesh: ParsedMesh;

  constructor(parsed: ParsedMesh, options: MeshVisualizerOptions = {}) {
    super();

    this.parsedMesh = parsed;
    this.options = { ...DEFAULT_OPTIONS, ...options };

    const { vertices, faces } = parsed;
    const edges = extractEdges(faces);

    // Build vertex spheres
    if (this.options.showVertices && vertices.length > 0) {
      this.vertexMesh = this.buildVertexMesh(vertices, options.vertexMaterial);
      this.add(this.vertexMesh);
    }

    // Build edge tubes
    if (this.options.showEdges && edges.length > 0) {
      this.edgeMesh = this.buildEdgeMesh(vertices, edges, options.edgeMaterial);
      this.add(this.edgeMesh);
    }

    // Build face mesh
    if (this.options.showFaces && faces.length > 0) {
      this.faceMesh = this.buildFaceMesh(vertices, faces, options.faceMaterial);
      this.add(this.faceMesh);
    }
  }

  /**
   * Build merged sphere geometry for all vertices
   */
  private buildVertexMesh(vertices: Vector3[], customMaterial?: MeshPhysicalMaterial): Mesh {
    const { sphereRadius, sphereSegments, vertexColor } = this.options;

    // Create template sphere
    const template = new SphereGeometry(sphereRadius, sphereSegments, sphereSegments);

    // Create transformed copies for each vertex
    const geometries: BufferGeometry[] = [];
    const matrix = new Matrix4();

    for (const vertex of vertices) {
      const geo = template.clone();
      matrix.makeTranslation(vertex.x, vertex.y, vertex.z);
      geo.applyMatrix4(matrix);
      geometries.push(geo);
    }

    // Merge all spheres
    const merged = mergeGeometries(geometries, false);
    template.dispose();
    geometries.forEach(g => g.dispose());

    // Create material
    const material = customMaterial ?? new MeshPhysicalMaterial({
      color: vertexColor,
      roughness: 0.3,
      metalness: 0.1,
    });

    return new Mesh(merged, material);
  }

  /**
   * Build merged cylinder geometry for all edges
   */
  private buildEdgeMesh(
    vertices: Vector3[],
    edges: [number, number][],
    customMaterial?: MeshPhysicalMaterial
  ): Mesh {
    const { tubeRadius, tubeSegments, edgeColor } = this.options;

    // Create template cylinder aligned along Y axis
    const template = new CylinderGeometry(tubeRadius, tubeRadius, 1, tubeSegments, 1);

    // Reusable objects
    const geometries: BufferGeometry[] = [];
    const matrix = new Matrix4();
    const start = new Vector3();
    const end = new Vector3();
    const mid = new Vector3();
    const dir = new Vector3();
    const quat = new Quaternion();
    const scale = new Vector3(1, 1, 1);
    const up = new Vector3(0, 1, 0);

    for (const [a, b] of edges) {
      start.copy(vertices[a]);
      end.copy(vertices[b]);

      // Compute midpoint, direction, and length
      mid.addVectors(start, end).multiplyScalar(0.5);
      dir.subVectors(end, start);
      const length = dir.length();
      dir.normalize();

      // Build rotation to align Y axis with edge direction
      quat.setFromUnitVectors(up, dir);

      // Scale Y to edge length
      scale.set(1, length, 1);

      // Build transform matrix
      matrix.compose(mid, quat, scale);

      // Apply to cloned geometry
      const geo = template.clone();
      geo.applyMatrix4(matrix);
      geometries.push(geo);
    }

    // Merge all cylinders
    const merged = mergeGeometries(geometries, false);
    template.dispose();
    geometries.forEach(g => g.dispose());

    // Create material
    const material = customMaterial ?? new MeshPhysicalMaterial({
      color: edgeColor,
      roughness: 0.4,
      metalness: 0.2,
    });

    return new Mesh(merged, material);
  }

  /**
   * Build face mesh with optional per-face colors
   */
  private buildFaceMesh(
    vertices: Vector3[],
    faces: number[][],
    customMaterial?: MeshPhysicalMaterial
  ): Mesh {
    const { faceColor, faceColors, faceOpacity, faceTransmission } = this.options;

    // Triangulate faces and build position/color arrays
    // Using fan triangulation (v0, v1, v2), (v0, v2, v3), ...
    const positions: number[] = [];
    const colors: number[] = [];
    const useVertexColors = !!faceColors;

    for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
      const face = faces[faceIdx];
      const faceColorValue = faceColors?.[faceIdx] ?? faceColor;
      const color = new Color(faceColorValue);

      // Fan triangulation
      for (let i = 1; i < face.length - 1; i++) {
        const v0 = vertices[face[0]];
        const v1 = vertices[face[i]];
        const v2 = vertices[face[i + 1]];

        // Triangle vertices
        positions.push(v0.x, v0.y, v0.z);
        positions.push(v1.x, v1.y, v1.z);
        positions.push(v2.x, v2.y, v2.z);

        // Vertex colors (all same for flat face color)
        if (useVertexColors) {
          colors.push(color.r, color.g, color.b);
          colors.push(color.r, color.g, color.b);
          colors.push(color.r, color.g, color.b);
        }
      }
    }

    // Build geometry
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));

    if (useVertexColors) {
      geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3));
    }

    geometry.computeVertexNormals();

    // Create material
    const material = customMaterial ?? new MeshPhysicalMaterial({
      color: useVertexColors ? 0xffffff : faceColor,
      vertexColors: useVertexColors,
      side: DoubleSide,
      roughness: 0.5,
      metalness: 0.0,
      transparent: faceOpacity < 1 || faceTransmission > 0,
      opacity: faceOpacity,
      transmission: faceTransmission,
      ...(faceTransmission > 0 ? { ior: 1.5, thickness: 0.5 } : {}),
    });

    return new Mesh(geometry, material);
  }

  /**
   * Update per-face colors
   */
  setFaceColors(colors: (number | Color)[]): void {
    if (!this.faceMesh) return;

    const geometry = this.faceMesh.geometry;
    const colorAttr = geometry.getAttribute('color');

    if (!colorAttr) {
      console.warn('MeshVisualizer: Face mesh was not created with vertex colors. Rebuild with faceColors option.');
      return;
    }

    const { faces } = this.parsedMesh;
    let vertexIdx = 0;

    for (let faceIdx = 0; faceIdx < faces.length; faceIdx++) {
      const face = faces[faceIdx];
      const color = new Color(colors[faceIdx] ?? 0xffffff);

      // Each face contributes (n-2) triangles, each with 3 vertices
      const numTriangles = face.length - 2;
      const numVertices = numTriangles * 3;

      for (let i = 0; i < numVertices; i++) {
        colorAttr.setXYZ(vertexIdx++, color.r, color.g, color.b);
      }
    }

    colorAttr.needsUpdate = true;
  }

  /**
   * Toggle visibility of vertex spheres
   */
  setVerticesVisible(visible: boolean): void {
    if (this.vertexMesh) {
      this.vertexMesh.visible = visible;
    }
  }

  /**
   * Toggle visibility of edge tubes
   */
  setEdgesVisible(visible: boolean): void {
    if (this.edgeMesh) {
      this.edgeMesh.visible = visible;
    }
  }

  /**
   * Toggle visibility of face mesh
   */
  setFacesVisible(visible: boolean): void {
    if (this.faceMesh) {
      this.faceMesh.visible = visible;
    }
  }

  /**
   * Dispose all geometries and materials
   */
  dispose(): void {
    if (this.vertexMesh) {
      this.vertexMesh.geometry.dispose();
      (this.vertexMesh.material as MeshPhysicalMaterial).dispose();
    }
    if (this.edgeMesh) {
      this.edgeMesh.geometry.dispose();
      (this.edgeMesh.material as MeshPhysicalMaterial).dispose();
    }
    if (this.faceMesh) {
      this.faceMesh.geometry.dispose();
      (this.faceMesh.material as MeshPhysicalMaterial).dispose();
    }
  }
}
