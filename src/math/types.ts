/**
 * Shared types for the math library
 *
 * These interfaces are used across all mathematical domains (surfaces, curves, geodesics, etc.)
 */

/**
 * Objects with reactive parameters
 *
 * Mathematical primitives can have parameters that change over time.
 * The Params system provides reactivity and dependency tracking.
 */
export interface Parametric {
  readonly params: import('@/Params').Params;
}

/**
 * Objects that can rebuild their geometry
 *
 * rebuild() is called when structural parameters change (domain, segments, topology).
 * This is EXPENSIVE - allocates new geometry, rebuilds vertex/index buffers.
 *
 * @example
 *   // Changing segment count requires rebuild
 *   surface.segments = 64; // triggers rebuild()
 */
export interface Rebuildable {
  rebuild(): void;
}

/**
 * Objects that can update their appearance
 *
 * update() is called when visual parameters change (colors, materials, visibility).
 * This is CHEAP - modifies existing properties without reallocating geometry.
 *
 * @example
 *   // Changing color is just an update
 *   mesh.color = 0xff0000; // triggers update()
 */
export interface Updatable {
  update(): void;
}

/**
 * Trigger type for parameter changes
 *
 * Declares what a parameter affects when changed:
 * - 'rebuild': Expensive geometry rebuild
 * - 'update': Cheap visual update
 * - 'none': No automatic action
 */
export type ParamTrigger = 'rebuild' | 'update' | 'none';
