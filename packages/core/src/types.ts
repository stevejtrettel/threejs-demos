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

export interface MathComponent extends
  Partial<Animatable>,
  Partial<Disposable>,
  Partial<Renderable> {
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
}

export interface ParamOptions {
  min?: number;
  max?: number;
  step?: number;
  type?: 'number' | 'boolean' | 'color' | 'string';
  label?: string;
  folder?: string;
  onChange?: (value: any) => void;
}

export interface ParamDefinition {
  name: string;
  defaultValue: any;
  options: ParamOptions;
}

export interface AddOptions {
  params?: boolean | string[] | Record<string, boolean | ParamOptions>;
  set?: Record<string, any>;
}
