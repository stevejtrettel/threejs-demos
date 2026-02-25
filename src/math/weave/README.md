# Weave from Quad Mesh

Generates interlocking woven strands from an all-quad mesh.

## Pipeline

```
ParsedMesh → HalfEdgeMesh → classify edges → color faces → trace strands → Hermite curves
```

**1. Edge Classification** (`classifyEdges.ts`)
BFS labels every edge as U (0) or V (1). On each quad face, opposite edges share a family, adjacent edges differ. Propagates via twin edges across the mesh.

**2. Face 2-Coloring** (`colorFaces.ts`)
BFS assigns each face color 0 or 1 so that adjacent faces have opposite colors (checkerboard). This determines which family is on top at each crossing.

**3. Strand Tracing** (`traceStrands.ts`)
Each face has two segments — one per family — connecting midpoints of same-family edges. Segments chain across faces by jumping `twin → next.next` (the opposite edge on a quad). Each chain becomes one continuous strand.

**4. Curve Generation** (`buildWeave.ts`)
Per segment: cubic Hermite curve between entry/exit edge midpoints, with tangents aimed at the face center. Over/under displacement along the face normal using a `sin(πt)` profile. Sign is `+1` when `faceColor == family` (on top), `-1` otherwise.

## Usage

```ts
import { parseOBJ, buildWeave } from '@/math';

const parsed = parseOBJ(objText);  // must be all quads
const weave = buildWeave(parsed, { amplitude: 0.05, samplesPerSegment: 10 });

// weave.strands[i]       → Vector3[] polyline
// weave.strandFamilies[i] → 0 or 1
// weave.strandClosed[i]   → boolean

// Render as tubes:
for (const [i, strand] of weave.strands.entries()) {
  const curve = new THREE.CatmullRomCurve3(strand, weave.strandClosed[i]);
  const geo = new THREE.TubeGeometry(curve, strand.length * 4, 0.02, 8, weave.strandClosed[i]);
  scene.add(new THREE.Mesh(geo, material));
}
```

## Requirements

- All faces must be quads (4 sides)
- Dual graph must be 2-colorable (true for any orientable quad mesh without odd-length face cycles)
