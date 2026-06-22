/**
 * Relativity: spacetimes, coordinate charts, null geodesics, light cones.
 *
 * See `README.md` for the design. The short version:
 *
 *   - A **spacetime** (`Schwarzschild`, `MajumdarPapapetrou`) exposes several
 *     **charts** via `chart(name)`. Every chart is a `Manifold`, so the n-D
 *     `geodesicDeriv` (in `math/geodesics`) flows geodesics on any of them.
 *   - **Lorentzian** charts → null geodesics → light-cone surfaces
 *     (`sampleLightCone` + `lightConeGeometry`).
 *   - The **optical** chart of a static spacetime is the Riemannian Fermat
 *     metric `h/N²`; its geodesics are the spatial light paths, and
 *     `FunnelSurface` embeds the rotationally-symmetric case as the classic
 *     funnel.
 */

export type { Spacetime, Chart, Signature, Vec3Tuple } from './types';

export {
  spacetimeChart,
  opticalChart,
  type StaticData,
  type SpacetimeChartOptions,
  type OpticalChartOptions,
} from './staticSpacetime';

export { opticalMetric } from './opticalMetric';

export { Schwarzschild, type SchwarzschildOptions } from './Schwarzschild';
export { MajumdarPapapetrou, type MajumdarPapapetrouOptions, type Hole } from './MajumdarPapapetrou';

export {
  nullVelocity,
  sampleLightCone,
  sampleOpticalLightCone,
  traceOpticalCone,
  traceOpticalRay,
  opticalConeRays,
  type NullRay,
  type LightConeOptions,
  type OpticalLightConeOptions,
  type OpticalConeRay,
  type TraceOpticalConeOptions,
  type TraceOpticalRayOptions,
  type OpticalConeBuildOptions,
} from './nullGeodesic';

export { lightConeGeometry, type LightConeGeometryOptions } from './lightcone';

export {
  FunnelSurface,
  funnelProfile,
  radialFromOpticalChart,
  type FunnelProfile,
  type FunnelOptions,
  type RadialProfile,
} from './funnel';
