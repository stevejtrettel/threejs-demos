/**
 * Matrix Lie groups and algebras.
 *
 * See `README.md` and `docs/planning/lie.md` for the design rationale.
 *
 *   Phase 1: `SO(2)`, `SO(3)`, Lie-Poisson on `so(3)*`, torque-free rigid body.
 *   Phase 2: `SU(2)`, `SE(3)`, generic Padé `exp`, polar factorization, render glue.
 *   Post-2:  `SE(2)`, Lie-group stepper utility.
 *
 * Poisson-manifold primitives (`PoissonManifold`, `PoissonGradient`) live
 * as siblings of `SymplecticManifold` / `SymplecticGradient` in
 * `math/symplectic/`. `liePoissonManifold` here constructs the Lie-Poisson
 * structure on `𝔤*` from a `MatrixLieGroup`.
 */

export { MatrixLieGroup } from './types';

export { SO2, hatSO2, veeSO2, expSO2, logSO2 } from './groups/SO2';
export { SO3, hatSO3, veeSO3, expSO3, logSO3 } from './groups/SO3';
export { SU2, hatSU2, veeSU2, expSU2, logSU2 } from './groups/SU2';
export { SE2, hatSE2, veeSE2, expSE2, logSE2 } from './groups/SE2';
export { SE3, hatSE3, veeSE3, expSE3, logSE3 } from './groups/SE3';
export { SL2R, hatSL2R, veeSL2R, expSL2R, logSL2R } from './groups/SL2R';
export { SU11, hatSU11, veeSU11, expSU11, logSU11 } from './groups/SU11';
export { SL2C, hatSL2C, veeSL2C, expSL2C } from './groups/SL2C';

export { padeExp } from './exp/pade';

export { polar } from './factorizations/polar';
export type { PolarResult } from './factorizations/polar';

export { iwasawaSL2R, iwasawaCoordsSL2R } from './factorizations/iwasawa';
export type { IwasawaSL2R, IwasawaCoords } from './factorizations/iwasawa';

export { classifySL2R, classifySL2C } from './factorizations/classify';
export type { SL2RClass, SL2CClass } from './factorizations/classify';

export { mobiusSL2R, mobiusSU11, mobiusSL2C } from './mobius';

export { stepBody, stepWorld } from './stepper';

export { liePoissonManifold } from './liePoisson';

export { rigidBodyHamiltonian, rigidBodyStep } from './RigidBody';
export type { RigidBodyState, RigidBodyOptions } from './RigidBody';

export { so3ToMatrix4 } from './render/so3ToMatrix4';
export { so3ToQuaternion } from './render/so3ToQuaternion';
export { se3ToMatrix4 } from './render/se3ToMatrix4';
export { su2ToQuaternion } from './render/su2ToQuaternion';
