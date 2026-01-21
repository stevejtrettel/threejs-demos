/**
 * parseOBJ.ts - OBJ file parser with group and material support
 *
 * Parses OBJ text format into vertices and face indices.
 * Supports:
 *   - v (vertex)
 *   - f (face)
 *   - g (group)
 *   - usemtl (material reference)
 *   - mtllib (material library reference)
 */

import { Vector3, Color } from 'three';

export interface ParsedMesh {
  vertices: Vector3[];
  faces: number[][];  // each face is array of vertex indices (0-based)
}

/**
 * Face with group and material information
 */
export interface GroupedFace {
  indices: number[];     // vertex indices (0-based)
  group: string | null;  // group name from 'g' directive
  material: string | null;  // material name from 'usemtl' directive
}

/**
 * Extended parsed mesh with group information
 */
export interface GroupedMesh {
  vertices: Vector3[];
  faces: GroupedFace[];
  groups: string[];        // unique group names
  materials: string[];     // unique material names
  mtlLib: string | null;   // mtl file name from 'mtllib' directive
}

/**
 * Parsed material from MTL file
 */
export interface ParsedMaterial {
  name: string;
  diffuseColor: Color;
  // Could extend with more properties (Ks, Ns, etc.) if needed
}

/**
 * Default color palette for groups
 * Using pleasing colors that work well for checkerboard patterns
 */
export const DEFAULT_GROUP_COLORS: Record<string, number> = {
  '1': 0xffe9ad,      // warm cream
  '-1': 0xadd8e6,     // light blue
  'default': 0xcccccc // gray fallback
};

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
 * Parse OBJ file text with group and material support
 *
 * @param text - OBJ file contents as string
 * @returns GroupedMesh with vertices, faces (with group/material info), and metadata
 *
 * @example
 * const text = await fetch('model.obj').then(r => r.text());
 * const mesh = parseGroupedOBJ(text);
 * console.log('Groups:', mesh.groups);
 * console.log('Materials:', mesh.materials);
 */
export function parseGroupedOBJ(text: string): GroupedMesh {
  const vertices: Vector3[] = [];
  const faces: GroupedFace[] = [];
  const groupSet = new Set<string>();
  const materialSet = new Set<string>();

  let currentGroup: string | null = null;
  let currentMaterial: string | null = null;
  let mtlLib: string | null = null;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    const directive = parts[0].toLowerCase();

    switch (directive) {
      case 'v': {
        // Vertex: v x y z
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);
        const z = parseFloat(parts[3]);
        vertices.push(new Vector3(x, y, z));
        break;
      }

      case 'f': {
        // Face: f v1 v2 v3 ... (may include texture/normal indices)
        const indices: number[] = [];
        for (let i = 1; i < parts.length; i++) {
          const vertexIndex = parseInt(parts[i].split('/')[0], 10);
          // OBJ indices are 1-based, convert to 0-based
          indices.push(vertexIndex - 1);
        }
        if (indices.length >= 3) {
          faces.push({
            indices,
            group: currentGroup,
            material: currentMaterial
          });
        }
        break;
      }

      case 'g': {
        // Group: g groupName
        currentGroup = parts.slice(1).join(' ') || null;
        if (currentGroup) {
          groupSet.add(currentGroup);
        }
        break;
      }

      case 'usemtl': {
        // Material: usemtl materialName
        currentMaterial = parts.slice(1).join(' ') || null;
        if (currentMaterial) {
          materialSet.add(currentMaterial);
        }
        break;
      }

      case 'mtllib': {
        // Material library: mtllib filename.mtl
        mtlLib = parts.slice(1).join(' ') || null;
        break;
      }
    }
  }

  return {
    vertices,
    faces,
    groups: Array.from(groupSet),
    materials: Array.from(materialSet),
    mtlLib
  };
}

/**
 * Parse MTL file text into material definitions
 *
 * @param text - MTL file contents as string
 * @returns Map of material name to ParsedMaterial
 */
export function parseMTL(text: string): Map<string, ParsedMaterial> {
  const materials = new Map<string, ParsedMaterial>();
  let currentMaterial: ParsedMaterial | null = null;

  for (const line of text.split('\n')) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    const directive = parts[0].toLowerCase();

    switch (directive) {
      case 'newmtl': {
        // Save previous material
        if (currentMaterial) {
          materials.set(currentMaterial.name, currentMaterial);
        }
        // Start new material
        const name = parts.slice(1).join(' ');
        currentMaterial = {
          name,
          diffuseColor: new Color(0xffffff)
        };
        break;
      }

      case 'kd': {
        // Diffuse color: Kd r g b (values 0-1)
        if (currentMaterial) {
          const r = parseFloat(parts[1]);
          const g = parseFloat(parts[2]);
          const b = parseFloat(parts[3]);
          currentMaterial.diffuseColor = new Color(r, g, b);
        }
        break;
      }
    }
  }

  // Don't forget the last material
  if (currentMaterial) {
    materials.set(currentMaterial.name, currentMaterial);
  }

  return materials;
}

/**
 * Convert GroupedMesh to ParsedMesh (for backward compatibility)
 */
export function groupedToSimple(grouped: GroupedMesh): ParsedMesh {
  return {
    vertices: grouped.vertices,
    faces: grouped.faces.map(f => f.indices)
  };
}

/**
 * Generate face colors from group names using a color map
 *
 * @param faces - Array of GroupedFace
 * @param colorMap - Map of group name to color (hex number or Color)
 * @returns Array of colors (one per face)
 */
export function groupColorsFromMap(
  faces: GroupedFace[],
  colorMap: Record<string, number | Color> = DEFAULT_GROUP_COLORS
): (number | Color)[] {
  const defaultColor = colorMap['default'] ?? 0xcccccc;

  return faces.map(face => {
    const group = face.group;
    if (group !== null && group in colorMap) {
      return colorMap[group];
    }
    return defaultColor;
  });
}

/**
 * Generate face colors from material definitions
 *
 * @param faces - Array of GroupedFace
 * @param materials - Map of material name to ParsedMaterial (from parseMTL)
 * @param defaultColor - Color for faces without a material
 * @returns Array of colors (one per face)
 */
export function materialColorsFromMap(
  faces: GroupedFace[],
  materials: Map<string, ParsedMaterial>,
  defaultColor: number | Color = 0xcccccc
): (number | Color)[] {
  return faces.map(face => {
    const matName = face.material;
    if (matName !== null && materials.has(matName)) {
      return materials.get(matName)!.diffuseColor;
    }
    return defaultColor;
  });
}

/**
 * Generate distinct colors for each group using HSL
 *
 * @param groups - Array of unique group names
 * @param saturation - HSL saturation (0-1)
 * @param lightness - HSL lightness (0-1)
 * @returns Map of group name to hex color
 */
export function generateGroupPalette(
  groups: string[],
  saturation = 0.7,
  lightness = 0.65
): Record<string, number> {
  const palette: Record<string, number> = {};
  const color = new Color();

  for (let i = 0; i < groups.length; i++) {
    const hue = (i * 0.618033988749895) % 1; // Golden ratio for good distribution
    color.setHSL(hue, saturation, lightness);
    palette[groups[i]] = color.getHex();
  }

  return palette;
}

/**
 * Extract unique edges from faces
 *
 * @param faces - Array of face index arrays or GroupedFace objects
 * @returns Array of [vertexA, vertexB] pairs (0-based indices, sorted so A < B)
 */
export function extractEdges(faces: number[][] | GroupedFace[]): [number, number][] {
  const edgeSet = new Set<string>();
  const edges: [number, number][] = [];

  for (const face of faces) {
    // Handle both number[] and GroupedFace
    const indices = Array.isArray(face) ? face : face.indices;
    const n = indices.length;

    for (let i = 0; i < n; i++) {
      const a = indices[i];
      const b = indices[(i + 1) % n];

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

/**
 * Open a file picker dialog and load a grouped OBJ file
 *
 * @returns Promise that resolves with GroupedMesh, or null if cancelled
 *
 * @example
 * const mesh = await loadGroupedOBJFile();
 * if (mesh) {
 *   console.log('Groups:', mesh.groups);
 *   const colors = groupColorsFromMap(mesh.faces, { '1': 0xff0000, '-1': 0x0000ff });
 *   const viz = new MeshVisualizer(groupedToSimple(mesh), { faceColors: colors });
 *   scene.add(viz);
 * }
 */
export function loadGroupedOBJFile(): Promise<GroupedMesh | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.obj';
    input.style.display = 'none';

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        input.remove();
        return;
      }

      try {
        const text = await file.text();
        const parsed = parseGroupedOBJ(text);
        resolve(parsed);
      } catch (error) {
        console.error('Failed to load OBJ file:', error);
        resolve(null);
      }

      input.remove();
    });

    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });

    document.body.appendChild(input);
    input.click();
  });
}

/**
 * Result of loading OBJ with optional MTL
 */
export interface LoadedGroupedMesh {
  mesh: GroupedMesh;
  materials: Map<string, ParsedMaterial> | null;
  faceColors: (number | Color)[];
}

/**
 * Open file picker(s) to load OBJ and optionally MTL files
 *
 * @param options - Loading options
 * @param options.colorMap - Custom color map for groups (used if no MTL)
 * @param options.autoGeneratePalette - Generate colors for unknown groups (default true)
 * @returns Promise that resolves with LoadedGroupedMesh, or null if cancelled
 *
 * @example
 * const loaded = await loadGroupedOBJWithColors({ colorMap: { '1': 0xff0000, '-1': 0x0000ff } });
 * if (loaded) {
 *   const viz = new MeshVisualizer(
 *     groupedToSimple(loaded.mesh),
 *     { faceColors: loaded.faceColors }
 *   );
 *   scene.add(viz);
 * }
 */
export function loadGroupedOBJWithColors(options: {
  colorMap?: Record<string, number | Color>;
  autoGeneratePalette?: boolean;
} = {}): Promise<LoadedGroupedMesh | null> {
  const { colorMap = DEFAULT_GROUP_COLORS, autoGeneratePalette = true } = options;

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.obj,.mtl';
    input.multiple = true;
    input.style.display = 'none';

    input.addEventListener('change', async () => {
      const files = input.files;
      if (!files || files.length === 0) {
        resolve(null);
        input.remove();
        return;
      }

      try {
        let objText: string | null = null;
        let mtlText: string | null = null;

        // Sort files by extension
        for (const file of Array.from(files)) {
          const name = file.name.toLowerCase();
          if (name.endsWith('.obj')) {
            objText = await file.text();
          } else if (name.endsWith('.mtl')) {
            mtlText = await file.text();
          }
        }

        if (!objText) {
          console.error('No OBJ file selected');
          resolve(null);
          input.remove();
          return;
        }

        const mesh = parseGroupedOBJ(objText);
        let materials: Map<string, ParsedMaterial> | null = null;
        let faceColors: (number | Color)[];

        if (mtlText) {
          // Use MTL colors
          materials = parseMTL(mtlText);
          faceColors = materialColorsFromMap(mesh.faces, materials);
        } else {
          // Build combined color map
          let finalColorMap = { ...colorMap };

          // Auto-generate colors for unknown groups
          if (autoGeneratePalette) {
            const unknownGroups = mesh.groups.filter(g => !(g in finalColorMap));
            if (unknownGroups.length > 0) {
              const generatedPalette = generateGroupPalette(unknownGroups);
              finalColorMap = { ...finalColorMap, ...generatedPalette };
            }
          }

          faceColors = groupColorsFromMap(mesh.faces, finalColorMap);
        }

        resolve({ mesh, materials, faceColors });
      } catch (error) {
        console.error('Failed to load files:', error);
        resolve(null);
      }

      input.remove();
    });

    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });

    document.body.appendChild(input);
    input.click();
  });
}
