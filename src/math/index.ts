/**
 * Mathematical Visualization Library
 *
 * Reusable components for creating mathematical animations and visualizations.
 *
 * ## Structure
 *
 * - **Primitives**: Pure mathematical abstractions (Helicoid, Torus, GeodesicIntegrator)
 * - **Builders**: Functions that transform math → THREE.js (buildGeometry, buildMesh)
 * - **Components**: Scene objects that extend THREE.js classes (SurfaceMesh, CurveLine, TrailTube)
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

// Algebra
export * from './algebra';

// Lattices
export { Lattice2D } from './lattices/Lattice2D';
export type { TauData, TauReducedData } from './lattices/Lattice2D';
export { G4, G6, g2, g3, g2g3, discriminant, jInvariant, sigmak } from './lattices/eisenstein';
export { latticeG2, latticeG3, latticeInvariants } from './lattices/invariants';
export { toS3, toR3 } from './lattices/projections';
export { weierstrassSum, weierstrassTheta, weierstrassP } from './lattices/weierstrass';
export type { WeierstrassResult } from './lattices/weierstrass';
export { createTheta, jacobi, thetaLevel } from './lattices/theta';
export type { ThetaFunction, ThetaLevel } from './lattices/theta';
export { LatticeFlow } from './lattices/LatticeFlow';
export type { Mat2 } from './lattices/LatticeFlow';
export { LatticePlane } from './lattices/LatticePlane';
export type { LatticePlaneOptions, LatticeLayer } from './lattices/LatticePlane';
export {
  toWorld,
  domainPoint,
  latticeSlab,
  latticeBoundary,
  latticeGridlines,
  latticeTiling,
  latticePoints,
} from './lattices/fundamentalDomain';

// Hopf fibration
export { HopfTorus, fromSpherical, hopfFiber, hopfPreimage } from './hopf';
export { toSpherical, fromSphericalCoords, toroidalCoords, stereoProj } from './hopf';
export type { HopfTorusOptions } from './hopf';

// Spaces
export * from './spaces';

// Domain-specific exports
// (These will be populated as we implement each domain)

// Surfaces
export * from './surfaces/types';
export { Torus } from './surfaces/Torus';
export { BoysSurface } from './surfaces/BoysSurface';
export { KleinBottle } from './surfaces/KleinBottle';
export { FunctionGraph } from './surfaces/FunctionGraph';
export { FlatPatch } from './surfaces/FlatPatch';
export { buildGeometry } from './surfaces/buildGeometry';
export type { BuildGeometryOptions } from './surfaces/buildGeometry';
export { SurfaceMesh } from './surfaces/SurfaceMesh';
export type { SurfaceMeshOptions, FromFunctionOptions } from './surfaces/SurfaceMesh';
export { RollUpMesh } from './surfaces/RollUpMesh';
export type { RollUpMeshOptions } from './surfaces/RollUpMesh';
export { EllipticCurveMesh } from './surfaces/EllipticCurveMesh';
export type { EllipticCurveMeshOptions } from './surfaces/EllipticCurveMesh';
export { NumericSurface } from './surfaces/NumericSurface';
export type { NumericSurfaceOptions } from './surfaces/NumericSurface';
export { MetricSurface } from './surfaces/MetricSurface';
export type { MetricSurfaceOptions } from './surfaces/MetricSurface';
export { pullbackMetric } from './surfaces/pullback';
export type { PullbackMetricOptions } from './surfaces/pullback';
export { christoffelFromMetric, gaussianCurvatureFromMetric } from './surfaces/christoffel';

// Functions (scalar fields)
export * from './functions/types';
export { RippleFunction } from './functions/RippleFunction';

// Mesh
export * from './mesh';

// Linear Algebra
export * from './linear-algebra';

// Curves
export * from './curves/types';
export { NumericalCurve } from './curves/NumericalCurve';
export type { NumericalCurveOptions } from './curves/NumericalCurve';
export { ParametricCurve } from './curves/ParametricCurve';
export type { ParametricCurveOptions, Parameterization } from './curves/ParametricCurve';
export { CurveTube } from './curves/CurveTube';
export type { CurveTubeOptions } from './curves/CurveTube';
export { buildTubeGeometry } from './curves/buildTubeGeometry';
export type { BuildTubeGeometryOptions } from './curves/buildTubeGeometry';
export {
  smoothCurve,
  smoothBoundary,
  laplacianSmooth,
  chaikinSmooth,
  resampleUniform,
} from './curves/smoothCurve';
export type { SmoothCurveOptions, SmoothingMethod } from './curves/smoothCurve';

// ODE integration
export { euler, rk4, integrate } from './ode';
export type { DerivFn, Stepper, IntegrateOptions, Trajectory } from './ode';

// Geodesics
export * from './geodesics/types';
export { GeodesicIntegrator } from './geodesics/GeodesicIntegrator';
export type { GeodesicIntegratorOptions } from './geodesics/GeodesicIntegrator';

// Vector fields & flows
export * from './vectorfields';

// Patch curves (curves in 2D coordinate patches + renderers)
export * from './patchcurves';

// Linkages
export type { Joint, JointId, Rod } from './linkages/types';
export { Linkage } from './linkages/Linkage';
export type { LinkageOptions, JacobianEntry } from './linkages/Linkage';
export { LinkageMesh } from './linkages/LinkageMesh';
export type { LinkageMeshOptions } from './linkages/LinkageMesh';
export { buildPlanarChain, setChainAngles } from './linkages/PlanarChain';
export type { PlanarChainOptions } from './linkages/PlanarChain';
export { LinkagePath } from './linkages/LinkagePath';
export type { PathFunction } from './linkages/LinkagePath';

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
