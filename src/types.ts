import * as THREE from 'three';

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
  Partial<Renderable> {
  /**
   * Rebuild geometry from scratch
   *
   * Called when structural parameters change (domain bounds, segment counts, etc.)
   * This is EXPENSIVE - allocates new BufferGeometry, rebuilds vertex/index buffers
   *
   * @example
   *   // Changing segments requires rebuild
   *   curve.segments = 200; // triggers rebuild()
   */
  rebuild?(): void;

  /**
   * Update existing geometry in place
   *
   * Called when visual parameters change (colors, materials, etc.)
   * This is CHEAP - modifies existing Float32Array values
   *
   * @example
   *   // Changing color is just an update
   *   curve.color = 0xff0000; // triggers update()
   */
  update?(): void;
}

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

export interface ParamOptions {
  min?: number;
  max?: number;
  step?: number;
  type?: 'number' | 'boolean' | 'color' | 'string';
  label?: string;
  folder?: string;
  onChange?: (value: any) => void;

  /**
   * Declares what this parameter affects when changed
   *
   * - 'rebuild': Triggers expensive geometry rebuild (domain, segments, topology)
   * - 'update': Triggers cheap in-place update (colors, materials)
   * - 'none': No automatic action (use onChange for custom behavior)
   *
   * Params will automatically call owner.rebuild() or owner.update()
   *
   * @example
   *   this.params.define('segments', 32, {
   *     triggers: 'rebuild'  // Changing segments needs new geometry
   *   });
   *
   *   this.params.define('color', 0xff0000, {
   *     triggers: 'update'   // Changing color just updates material
   *   });
   */
  triggers?: 'rebuild' | 'update' | 'none';
}

export interface ParamDefinition {
  name: string;
  defaultValue: any;
  options: ParamOptions;
}

export interface AddOptions {
  params?: boolean | string[] | Record<string, boolean | ParamOptions>;
  set?: Record<string, any>;
  animate?: AnimateCallback;
}
