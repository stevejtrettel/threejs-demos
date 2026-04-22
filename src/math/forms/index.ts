/**
 * Differential forms.
 *
 * Storage conventions match `math/linear-algebra`:
 *   - 1-form → `Float64Array(dim)`
 *   - 2-form → `Matrix(dim, dim)` (antisymmetric: `ω[i][j] = -ω[j][i]`)
 *   - k-form (k ≥ 3): not implemented; would be a flat `Float64Array(dim^k)`
 */

export type { OneForm, TwoForm } from './types';

export { FromGradient } from './FromGradient';
export { wedge } from './wedge';
export { d } from './d';
export { interiorOneForm, interiorTwoForm } from './interior';
export {
  hodge2D_OneForm,
  hodge2D_TwoForm,
  volumeTwoForm2D,
} from './hodge';
