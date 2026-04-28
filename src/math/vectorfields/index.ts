/**
 * Vector fields & flows
 *
 * Public API. See README.md for design notes and the planning doc
 * `docs/planning/vector-fields-and-flows.md` for the rationale.
 *
 * Note: curve rendering lives in `math/patchcurves/` — `FlowCurve`,
 * `StreamPoints`, `CurveOnSurface`, `StreamLine`, `StreamTube`. This
 * module only covers the fields themselves and their glyph visualizers.
 */

export type { VectorField, FlowState, BoundedFlowResult } from './types';

export { FromFunction } from './FromFunction';
export { ConstantField } from './ConstantField';
export type { ConstantFieldOptions } from './ConstantField';
export { GradientField } from './GradientField';
export type { GradientFieldOptions } from './GradientField';

export { FlowIntegrator } from './FlowIntegrator';
export type { FlowIntegratorOptions } from './FlowIntegrator';
export { FieldArrows } from './FieldArrows';
export type { FieldArrowsOptions } from './FieldArrows';
export { ArrowGlyphs } from './ArrowGlyphs';
export type { ArrowGlyphsOptions } from './ArrowGlyphs';
