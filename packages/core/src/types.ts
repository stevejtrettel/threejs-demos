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

export interface AppOptions {
  fov?: number;
  near?: number;
  far?: number;
  antialias?: boolean;
  alpha?: boolean;
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
