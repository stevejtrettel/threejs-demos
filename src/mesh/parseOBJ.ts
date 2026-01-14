/**
 * parseOBJ.ts - Simple OBJ file parser
 *
 * Parses OBJ text format into vertices and face indices.
 * Supports basic v (vertex) and f (face) lines.
 */

import { Vector3 } from 'three';

export interface ParsedMesh {
  vertices: Vector3[];
  faces: number[][];  // each face is array of vertex indices (0-based)
}

/**
 * Parse OBJ file text into vertices and faces
 *
 * @param text - OBJ file contents as string
 * @returns ParsedMesh with vertices and faces
 *
 * @example
 * const text = await fetch('model.obj').then(r => r.text());
 * const mesh = parseOBJ(text);
 * console.log(mesh.vertices.length, 'vertices');
 * console.log(mesh.faces.length, 'faces');
 */
export function parseOBJ(text: string): ParsedMesh {
  const vertices: Vector3[] = [];
  const faces: number[][] = [];

  for (const line of text.split('\n')) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Vertex line: v x y z
    if (trimmed.startsWith('v ')) {
      const parts = trimmed.split(/\s+/);
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      vertices.push(new Vector3(x, y, z));
    }

    // Face line: f v1 v2 v3 ... (may include texture/normal indices like v1/vt1/vn1)
    else if (trimmed.startsWith('f ')) {
      const parts = trimmed.split(/\s+/).slice(1); // skip 'f'
      const faceIndices: number[] = [];

      for (const part of parts) {
        // Handle formats: "1", "1/2", "1/2/3", "1//3"
        const vertexIndex = parseInt(part.split('/')[0], 10);
        // OBJ indices are 1-based, convert to 0-based
        faceIndices.push(vertexIndex - 1);
      }

      if (faceIndices.length >= 3) {
        faces.push(faceIndices);
      }
    }
  }

  return { vertices, faces };
}

/**
 * Extract unique edges from faces
 *
 * @param faces - Array of face index arrays
 * @returns Array of [vertexA, vertexB] pairs (0-based indices, sorted so A < B)
 */
export function extractEdges(faces: number[][]): [number, number][] {
  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];

  for (const face of faces) {
    const n = face.length;
    for (let i = 0; i < n; i++) {
      const a = face[i];
      const b = face[(i + 1) % n];

      // Normalize edge direction so we don't duplicate (a,b) and (b,a)
      const min = Math.min(a, b);
      const max = Math.max(a, b);
      const key = `${min}-${max}`;

      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push([min, max]);
      }
    }
  }

  return edges;
}

/**
 * Open a file picker dialog and load an OBJ file
 *
 * @returns Promise that resolves with ParsedMesh, or null if cancelled
 *
 * @example
 * const mesh = await loadOBJFile();
 * if (mesh) {
 *   console.log(`Loaded ${mesh.vertices.length} vertices`);
 *   const viz = new MeshVisualizer(mesh);
 *   scene.add(viz);
 * }
 */
export function loadOBJFile(): Promise<ParsedMesh | null> {
  return new Promise((resolve) => {
    // Create hidden file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.obj';
    input.style.display = 'none';

    // Handle file selection
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        input.remove();
        return;
      }

      try {
        const text = await file.text();
        const parsed = parseOBJ(text);
        resolve(parsed);
      } catch (error) {
        console.error('Failed to load OBJ file:', error);
        resolve(null);
      }

      input.remove();
    });

    // Handle cancel (user closes dialog without selecting)
    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });

    // Trigger file picker
    document.body.appendChild(input);
    input.click();
  });
}
