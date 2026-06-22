/**
 * Shared visual identity for the black-hole / relativity demos.
 *
 * Adopts the palette of the `homogeneous-spaces` talk: one warm off-white
 * background (`#F7F5F0`) and a curated set of medium-saturation hues that read
 * cleanly on it. A light scene needs a light rig — image-based lighting
 * (three's `RoomEnvironment`, baked to a PMREM) plus a soft key/fill and ACES
 * tonemapping — *not* the dark ambient setup. `applyStage(app)` sets all of it
 * in one call.
 *
 * Every demo reads its colours from `PALETTE`, so retuning here restyles them
 * all.
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { App } from '@/app/App';
import type { FunnelSurface } from '@/math/relativity';

/** Warm off-white page/scene background (stevejtrettel.com `--bg`). */
export const BACKGROUND = 0xf7f5f0;

/**
 * The palette. Base colours are chosen a touch deep because the lit
 * `MeshPhysicalMaterial` brightens them under the IBL rig.
 */
export const PALETTE = {
  red: 0xcb4f4a,
  orange: 0xe08a4b,
  yellow: 0xd9a93e,
  green: 0x5aa469,
  teal: 0x3e938f,
  blue: 0x4c72b0,
  purple: 0x8166ae,
  // Neutrals for scaffolding, surfaces, and the holes themselves.
  surface: 0xb3aa99, // warm grey — default "stage" surface
  ink: 0x2c2c2c, // near-black — the black holes / horizons read perfectly on cream
  slate: 0x9a9894, // muted grey — axes, grids, secondary scaffolding
  slateDark: 0x37474f, // dark slate — crosshairs
  accent: 0x3d5a80, // slate blue — the one line you want to stand out
} as const;

export type PaletteColor = keyof typeof PALETTE;

/** Blend two hex colours (t = 0 → a, t = 1 → b). */
export function mixHex(a: number, b: number, t: number): number {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHex();
}

/** Warm orange-yellow used for light rays and light cones (they share a hue). */
export const LIGHTRAY = mixHex(PALETTE.orange, PALETTE.yellow, 0.45);

/** Light warm-grey for "stage" surfaces (funnels), and a grey for their grid. */
export const SURFACE_GREY = mixHex(PALETTE.surface, 0xffffff, 0.42);
export const GRID_GREY = mixHex(PALETTE.slate, PALETTE.ink, 0.35);

/**
 * Matte `MeshStandardMaterial` — the homogeneous-spaces look: high roughness,
 * no metalness, no clearcoat. The IBL rig supplies soft form without gloss.
 */
export function matte(color: number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.0, ...extra });
}

/**
 * A coordinate grid (parallels + meridians) lifted onto a rotationally-symmetric
 * funnel, drawn as thin matte tubes — the surface-of-revolution grid look from
 * the talk, via this repo's tube idiom. Returns a group you toggle with the
 * funnel mesh.
 */
export function funnelGrid(
  funnel: FunnelSurface,
  options: { parallels?: number; meridians?: number; color?: number; radius?: number } = {},
): THREE.Group {
  const { parallels = 11, meridians = 24, color = GRID_GREY, radius = 0.03 } = options;
  const { rMinEmbed, rMax } = funnel.profile;
  const mat = matte(color, { roughness: 0.8 });
  const group = new THREE.Group();

  const SAMPLES = 200;
  // Parallels: circles at constant r.
  for (let i = 0; i < parallels; i++) {
    const r = rMinEmbed + ((rMax - rMinEmbed) * i) / (parallels - 1);
    const pts = Array.from({ length: SAMPLES + 1 }, (_, j) => {
      const a = (2 * Math.PI * j) / SAMPLES;
      return funnel.lift(r * Math.cos(a), r * Math.sin(a));
    });
    const geom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), SAMPLES, radius, 6, true);
    group.add(new THREE.Mesh(geom, mat));
  }
  // Meridians: profile curves at constant angle.
  for (let k = 0; k < meridians; k++) {
    const phi = (2 * Math.PI * k) / meridians;
    const pts = Array.from({ length: SAMPLES + 1 }, (_, j) => {
      const r = rMinEmbed + ((rMax - rMinEmbed) * j) / SAMPLES;
      return funnel.lift(r * Math.cos(phi), r * Math.sin(phi));
    });
    const geom = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false), SAMPLES, radius, 6, false);
    group.add(new THREE.Mesh(geom, mat));
  }
  return group;
}

/**
 * Apply the warm-background stage to an `App`: cream background, IBL, a soft
 * directional rig, and ACES tonemapping. Call once after creating the app and
 * before adding lit content.
 */
export function applyStage(app: App, environmentIntensity = 0.5): void {
  app.backgrounds.setColor(BACKGROUND);

  const renderer = app.renderManager.renderer;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // Image-based lighting: procedural neutral studio, baked to a PMREM. The
  // background stays flat cream; only scene.environment is set.
  const pmrem = new THREE.PMREMGenerator(renderer);
  app.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  app.scene.environmentIntensity = environmentIntensity;
  pmrem.dispose();

  // Soft directional rig on top of the IBL: a key for clearcoat highlights and
  // form, plus a gentle fill. Moderate, since the environment supplies ambient.
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(2.5, 4, 3);
  app.scene.add(key);

  const fill = new THREE.DirectionalLight(0xffffff, 0.25);
  fill.position.set(-3, -1, -2);
  app.scene.add(fill);
}
