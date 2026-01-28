/**
 * Mathematical Visualization Library
 *
 * Reusable components for creating mathematical animations and visualizations.
 *
 * ## Structure
 *
 * - **Primitives**: Pure mathematical abstractions (Helicoid, Torus, GeodesicIntegrator)
 * - **Builders**: Functions that transform math → THREE.js (buildGeometry, buildMesh)
 * - **Components**: Scene objects that extend THREE.js classes (SurfaceMesh, GeodesicTrail)
 * - **Helpers**: Utilities for composition and decoration (withNormals, syncGeometry)
 *
 * ## Organization
 *
 * Content is organized by mathematical domain:
 * - `surfaces/`: Parametric surfaces and differential geometry
 * - `curves/`: Parametric curves and Frenet frames
 * - `geodesics/`: Geodesic integration and visualization
 * - `shared/`: Cross-domain utilities (materials, animation helpers)
 *
 * ## Naming Conventions
 *
 * - **Primitives**: Mathematical name only (Torus.ts, Helix.ts)
 * - **Builders**: build*.ts or verb prefix (buildGeometry.ts, extractBoundary.ts)
 * - **Components**: Ends with visual type (SurfaceMesh.ts, CurveLine.ts)
 * - **Helpers**: Descriptive of purpose (withNormals.ts, syncGeometry.ts)
 * - **Types**: Always types.ts
 */

// Shared types
export * from './types';

// Domain-specific exports
// (These will be populated as we implement each domain)

// Surfaces
export * from './surfaces/types';
export { Torus } from './surfaces/Torus';
export { FunctionGraph } from './surfaces/FunctionGraph';
export { buildGeometry } from './surfaces/buildGeometry';
export type { BuildGeometryOptions } from './surfaces/buildGeometry';
export { SurfaceMesh } from './surfaces/SurfaceMesh';
export type { SurfaceMeshOptions, FromFunctionOptions } from './surfaces/SurfaceMesh';
export { EllipticCurveMesh } from './surfaces/EllipticCurveMesh';
export type { EllipticCurveMeshOptions } from './surfaces/EllipticCurveMesh';

// Functions (scalar fields)
export * from './functions/types';
export { RippleFunction } from './functions/RippleFunction';

// Curves
export * from './curves/types';

// Geodesics
export * from './geodesics/types';
export { GeodesicIntegrator } from './geodesics/GeodesicIntegrator';
export type { GeodesicIntegratorOptions } from './geodesics/GeodesicIntegrator';
export { GeodesicTrail } from './geodesics/GeodesicTrail';
export type { GeodesicTrailOptions } from './geodesics/GeodesicTrail';

// Mesh utilities
export { extractBoundary, extractBoundaryEdges, extractBoundaryIndices } from './mesh/extractBoundary';
export type { BoundaryLoop } from './mesh/extractBoundary';
export {
  parseOBJ,
  parseGroupedOBJ,
  parseMTL,
  groupedToSimple,
  extractEdges,
  groupColorsFromMap,
  materialColorsFromMap,
  generateGroupPalette,
  loadOBJFile,
  loadGroupedOBJFile,
  loadGroupedOBJWithColors,
  DEFAULT_GROUP_COLORS,
} from './mesh/parseOBJ';
export type {
  ParsedMesh,
  GroupedMesh,
  GroupedFace,
  ParsedMaterial,
  LoadedGroupedMesh,
} from './mesh/parseOBJ';
export { OBJStructure } from './mesh/OBJStructure';
export type { OBJStructureOptions } from './mesh/OBJStructure';
export { OBJSurface } from './mesh/OBJSurface';
export type { OBJSurfaceOptions } from './mesh/OBJSurface';

// For convenience, re-export Params from the framework
export { Params } from '@/Params';
