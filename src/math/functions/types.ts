/**
 * Type definitions for scalar fields and functions
 */

/**
 * A scalar field: R² → R
 *
 * Represents a function f(u, v) that takes two parameters and returns a number.
 * Used for function graphs z = f(x,y), height fields, and other scalar-valued functions.
 */
export interface ScalarField2D {
  /**
   * Evaluate the function at a point
   *
   * @param u - First coordinate
   * @param v - Second coordinate
   * @returns Function value f(u, v)
   */
  evaluate(u: number, v: number): number;

  /**
   * Get the domain of the function
   *
   * @returns Rectangular domain bounds
   */
  getDomain(): {
    uMin: number;
    uMax: number;
    vMin: number;
    vMax: number;
  };
}

/**
 * A differentiable scalar field with partial derivatives
 *
 * Extends ScalarField2D with derivative information needed for
 * differential geometry computations.
 */
export interface DifferentiableScalarField2D extends ScalarField2D {
  /**
   * Compute partial derivatives at a point
   *
   * @param u - First coordinate
   * @param v - Second coordinate
   * @returns Object containing ∂f/∂u and ∂f/∂v
   */
  computePartials(u: number, v: number): {
    du: number;  // ∂f/∂u
    dv: number;  // ∂f/∂v
  };

  /**
   * Compute second partial derivatives at a point
   *
   * @param u - First coordinate
   * @param v - Second coordinate
   * @returns Object containing ∂²f/∂u², ∂²f/∂u∂v, ∂²f/∂v²
   */
  computeSecondPartials(u: number, v: number): {
    duu: number;  // ∂²f/∂u²
    duv: number;  // ∂²f/∂u∂v
    dvv: number;  // ∂²f/∂v²
  };
}
