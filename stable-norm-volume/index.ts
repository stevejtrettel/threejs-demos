// Stable-norm ball volume over Teichmüller space of the once-punctured torus.
// Pure, dependency-free TypeScript — bring your own renderer.
export {
  Slope,
  type TraceTriple,
  type Curve,
  modularTorus,
  traceToLength,
  generateCurves,
} from "./curves.ts";

export { tripleFromTraces } from "./chart.ts";

export {
  type Vec2,
  normBallSamples,
  convexHull,
  polygonArea,
  normBallHull,
  normBallArea,
  normBallAreaAt,
} from "./norm-ball.ts";
