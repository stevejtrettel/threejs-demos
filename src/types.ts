import * as THREE from 'three';

// ============================================================================
// LIFECYCLE INTERFACES
// ============================================================================

export interface Animatable {
  animate(time: number, delta: number): void;
}

export interface Disposable {
  dispose(): void;
}

export interface Renderable {
  mesh?: THREE.Object3D;
}

/**
 * Objects that can rebuild their geometry
 *
 * rebuild() is called when structural parameters change (domain, segments, topology).
 * This is EXPENSIVE - allocates new geometry, rebuilds vertex/index buffers.
 */
export interface Rebuildable {
  rebuild(): void;
}

/**
 * Objects that can update their appearance
 *
 * update() is called when visual parameters change (colors, materials, visibility).
 * This is CHEAP - modifies existing properties without reallocating geometry.
 */
export interface Updatable {
  update(): void;
}

/**
 * Math component with optional lifecycle methods
 *
 * Components can implement:
 * - rebuild(): Expensive operation that recreates geometry (topology changes)
 * - update(): Cheap operation that modifies existing geometry in place
 * - animate(): Called every frame for animation
 * - dispose(): Cleanup resources
 */
export interface MathComponent extends
  Partial<Animatable>,
  Partial<Disposable>,
  Partial<Renderable>,
  Partial<Rebuildable>,
  Partial<Updatable> {}

// ============================================================================
// PARAMS SYSTEM TYPES
// ============================================================================

/**
 * Objects with reactive parameters
 *
 * Mathematical primitives can have parameters that change over time.
 * The Params system provides reactivity and dependency tracking.
 */
export interface Parametric {
  readonly params: import('./Params').Params;
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

/**
 * Options for Params.define() - lifecycle and reactivity behavior
 *
 * These options control what happens when a parameter value changes.
 */
export interface DefineOptions {
  /**
   * What lifecycle method to trigger when this parameter changes
   *
   * - 'rebuild': Calls owner.rebuild() and dependent.rebuild()
   * - 'update': Calls owner.update() and dependent.update()
   * - 'none': No automatic action (use onChange for custom behavior)
   */
  triggers?: ParamTrigger;

  /**
   * Custom callback when value changes (called before lifecycle hooks)
   */
  onChange?: (value: any) => void;
}

/**
 * Options for UI presentation of parameters
 *
 * These options control how parameters appear in UI controls.
 */
export interface UIOptions {
  /** Minimum value (for sliders) */
  min?: number;

  /** Maximum value (for sliders) */
  max?: number;

  /** Step increment (for sliders) */
  step?: number;

  /** Explicit type hint for UI control selection */
  type?: 'number' | 'boolean' | 'color' | 'string';

  /** Display label in UI */
  label?: string;

  /** Folder/group name in UI */
  folder?: string;
}

/**
 * Combined options for parameter definition
 *
 * Includes both lifecycle behavior (DefineOptions) and UI presentation (UIOptions).
 */
export interface ParamOptions extends DefineOptions, UIOptions {}

/**
 * Stored parameter definition
 */
export interface ParamDefinition {
  name: string;
  defaultValue: any;
  options: ParamOptions;
}

// ============================================================================
// APP TYPES
// ============================================================================

export type AnimateCallback = (time: number, delta: number) => void;

export interface ShadowConfig {
  type?: 'basic' | 'pcf' | 'pcfsoft' | 'vsm';
  mapSize?: number;
  autoUpdate?: boolean;
}

export type ToneMappingType = 'none' | 'linear' | 'reinhard' | 'cineon' | 'aces' | 'neutral';
export type ColorSpace = 'srgb' | 'linear' | 'display-p3';

export interface AppOptions {
  // Camera options
  fov?: number;
  near?: number;
  far?: number;

  // Renderer WebGL context options
  antialias?: boolean;
  alpha?: boolean;
  powerPreference?: 'default' | 'high-performance' | 'low-power';

  // Shadow configuration
  shadows?: boolean | ShadowConfig;

  // Tone mapping
  toneMapping?: ToneMappingType;
  toneMappingExposure?: number;

  // Color space
  colorSpace?: ColorSpace;

  // Physically correct lighting
  physicallyCorrectLights?: boolean;

  // Path tracer defaults
  pathTracerDefaults?: {
    bounces?: number;
    samples?: number;
    tiles?: { x: number; y: number };
  };

  // Debug mode (enables keyboard shortcuts and performance monitoring)
  // Default: true
  debug?: boolean;
}

export interface AddOptions {
  params?: boolean | string[] | Record<string, boolean | ParamOptions>;
  set?: Record<string, any>;
  animate?: AnimateCallback;
}
