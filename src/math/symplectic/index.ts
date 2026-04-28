/**
 * Symplectic geometry and Hamiltonian mechanics.
 *
 * A `SymplecticManifold` is an even-dim manifold with a closed, non-degenerate
 * 2-form (the symplectic form). `cotangentBundle(M)` builds `T*M` with the
 * canonical Liouville symplectic form. `SymplecticGradient(ω, H)` is the
 * vector field `X_H` defined by `ι_{X_H} ω = dH`, whose flow reproduces
 * Hamilton's equations.
 */

export type { SymplecticManifold } from './types';
export { cotangentBundle } from './CotangentBundle';
export { SymplecticGradient } from './SymplecticGradient';

export type { PoissonManifold } from './PoissonManifold';
export { PoissonGradient } from './PoissonGradient';
