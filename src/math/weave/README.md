# Weave — Textile Patterns on Quad Meshes

Generates interlocking strand patterns (woven, knit-stitch, or custom) from an all-quad mesh.

## Architecture

```
ParsedMesh
    │
    ▼
analyzeMesh()        ← shared topology pipeline (once per mesh)
    │
    ▼
MeshAnalysis         ← reusable: edge families, face colors, traced strands
    │
    ▼
generateStrands()    ← plug in any StrandDesign
    │
    ▼
WeaveResult          ← polyline curves ready for rendering
```

## Quick Start

```ts
import { buildWeave } from './buildWeave';
import { buildLoops } from './buildLoops';

const mesh = { vertices: [...], faces: [[0,1,2,3], ...] };  // all quads

// Classic over/under weave
const weave = buildWeave(mesh, { amplitude: 0.05, samplesPerSegment: 10 });

// Knit-stitch interlocking loops
const loops = buildLoops(mesh, { amplitude: 0.15, loopHeight: 1.5 });

// Render as tubes
for (const [i, strand] of weave.strands.entries()) {
  const curve = new THREE.CatmullRomCurve3(strand, weave.strandClosed[i]);
  const geo = new THREE.TubeGeometry(curve, strand.length * 4, 0.02, 8, weave.strandClosed[i]);
  scene.add(new THREE.Mesh(geo, material));
}
```

## Advanced: Reuse Analysis / Custom Designs

```ts
import { analyzeMesh } from './analyzeMesh';
import { generateStrands } from './generateStrands';
import { weaveDesign } from './designs/weaveDesign';
import { loopDesign } from './designs/loopDesign';

// Analyze once, generate multiple designs
const analysis = analyzeMesh(mesh);
const weaveResult = generateStrands(analysis, weaveDesign, { amplitude: 0.05 });

const loopAnalysis = analyzeMesh(mesh, [0]);  // loops only need family 0
const loopResult = generateStrands(loopAnalysis, loopDesign, { loopHeight: 1.5 });
```

### Writing a Custom Design

Implement the `StrandDesign` interface — a single `generateStrandCurve` method:

```ts
import { analyzeMesh } from './analyzeMesh';
import { generateStrands } from './generateStrands';
import { edgeMidpoint, faceCenter, faceNormal } from './helpers';
import type { StrandDesign, MeshAnalysis } from './types';
import type { Strand } from './traceStrands';

interface MyOptions { twist: number }

const myDesign: StrandDesign<MyOptions> = {
  name: 'spiral',
  families: [0, 1],

  generateStrandCurve(strand: Strand, analysis: MeshAnalysis, options: MyOptions): Vector3[] {
    const points: Vector3[] = [];
    for (const seg of strand.segments) {
      const p0 = edgeMidpoint(seg.entryEdge, analysis.positions);
      const p1 = edgeMidpoint(seg.exitEdge, analysis.positions);
      // ... your curve logic here ...
    }
    return points;
  },
};

const result = generateStrands(analyzeMesh(mesh), myDesign, { twist: 3 });
```

## Pipeline Stages

### 1. Edge Classification — `classifyEdges.ts`
BFS labels every edge as U (0) or V (1). On each quad, opposite edges share a family, adjacent edges differ. Propagates via twin edges.

### 2. Face 2-Coloring — `colorFaces.ts`
BFS assigns each face color 0 or 1 so adjacent faces differ (checkerboard). Determines over/under at crossings.

### 3. Strand Tracing — `traceStrands.ts`
Each face has two segments (one per family) connecting midpoints of same-family edges. Segments chain across faces via `twin → next.next`. Each chain becomes one continuous strand.

### 4. Curve Generation — `designs/`
Each `StrandDesign` turns traced strands into 3D polylines:

- **`weaveDesign`** — Cubic Hermite curves with sin(πt) normal displacement for over/under crossings. Traces both families.
- **`loopDesign`** — 7-waypoint (A–G) Catmull-Rom splines forming self-crossing chain links. Traces family 0 only.
- **`omegaDesign`** — 9-waypoint horseshoe arches extending into adjacent faces. Traces family 0 only.

## File Map

```
weave/
├── types.ts              type definitions (MeshAnalysis, StrandDesign, WeaveResult, ...)
├── analyzeMesh.ts        shared pipeline: mesh → topology analysis
├── generateStrands.ts    generic: analysis + design → curves
├── buildWeave.ts         convenience wrapper (analyzeMesh + weaveDesign)
├── buildLoops.ts         convenience wrapper (analyzeMesh + loopDesign)
├── classifyEdges.ts      edge U/V classification (BFS)
├── colorFaces.ts         face 2-coloring (BFS)
├── traceStrands.ts       strand path tracing
├── helpers.ts            geometric utilities (edgeMidpoint, faceCenter, sampleCatmullRom, ...)
└── designs/
    ├── weaveDesign.ts    classic over/under weave
    ├── loopDesign.ts     knit-stitch interlocking loops
    └── omegaDesign.ts    horseshoe arch pattern
```

## Requirements

- All faces must be quads (4 sides)
- Dual graph must be 2-colorable (true for any orientable quad mesh without odd-length face cycles)
