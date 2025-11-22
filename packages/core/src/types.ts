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

export type AnimateCallback = (time: number, delta: number) => void;

export interface AppOptions {
  fov?: number;
  near?: number;
  far?: number;
  antialias?: boolean;
  alpha?: boolean;
}
