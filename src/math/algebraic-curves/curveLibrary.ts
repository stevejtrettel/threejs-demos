import { homoPoly, type HomoPoly } from '@/math/algebraic-curves/homopoly';

export type CurveDef = {
  label: string;
  /** Default target point count for the UI slider. Internally converted to walk steps. */
  defaultPoints: number;
  F: HomoPoly;
  note?: string;
};

export const CURVES: CurveDef[] = [
  {
    label: 'Conic  X² + Y² + Z² = 0',
    defaultPoints: 12000,
    F: homoPoly(2, [
      [2, 0, 0, 1],
      [0, 2, 0, 1],
      [0, 0, 2, 1],
    ]),
    note: 'Degree 2, smooth, genus 0 (a sphere).',
  },
  {
    label: 'Weierstrass cubic  Y²Z = X³ - XZ² + Z³',
    defaultPoints: 12000,
    F: homoPoly(3, [
      [0, 2, 1, 1],
      [3, 0, 0, -1],
      [1, 0, 2, 1],
      [0, 0, 3, -1],
    ]),
    note: 'Smooth elliptic curve (genus 1, topological torus).',
  },
  {
    label: 'Fermat cubic  X³ + Y³ + Z³ = 0',
    defaultPoints: 12000,
    F: homoPoly(3, [
      [3, 0, 0, 1],
      [0, 3, 0, 1],
      [0, 0, 3, 1],
    ]),
    note: 'Symmetric elliptic curve, genus 1.',
  },
  {
    label: 'Nodal cubic  Y²Z = X³ + X²Z',
    defaultPoints: 12000,
    F: homoPoly(3, [
      [0, 2, 1, 1],
      [3, 0, 0, -1],
      [2, 0, 1, -1],
    ]),
    note: 'Singular at [0:0:1] (node). Arithmetic genus 1, geometric genus 0.',
  },
  {
    label: 'Cuspidal cubic  Y²Z = X³',
    defaultPoints: 12000,
    F: homoPoly(3, [
      [0, 2, 1, 1],
      [3, 0, 0, -1],
    ]),
    note: 'Singular cusp at [0:0:1]. Geometric genus 0.',
  },
  {
    label: 'Fermat quartic  X⁴ + Y⁴ + Z⁴ = 0',
    defaultPoints: 12000,
    F: homoPoly(4, [
      [4, 0, 0, 1],
      [0, 4, 0, 1],
      [0, 0, 4, 1],
    ]),
    note: 'Smooth genus-3 curve.',
  },
  {
    label: 'Klein quartic  X³Y + Y³Z + Z³X = 0',
    defaultPoints: 12000,
    F: homoPoly(4, [
      [3, 1, 0, 1],
      [0, 3, 1, 1],
      [1, 0, 3, 1],
    ]),
    note: 'Smooth genus-3 curve, 168-fold symmetry.',
  },
  {
    label: 'Fermat quintic  X⁵ + Y⁵ + Z⁵ = 0',
    defaultPoints: 12000,
    F: homoPoly(5, [
      [5, 0, 0, 1],
      [0, 5, 0, 1],
      [0, 0, 5, 1],
    ]),
    note: 'Smooth genus-6 curve.',
  },
  {
    label: 'Fermat sextic  X⁶ + Y⁶ + Z⁶ = 0',
    defaultPoints: 12000,
    F: homoPoly(6, [
      [6, 0, 0, 1],
      [0, 6, 0, 1],
      [0, 0, 6, 1],
    ]),
    note: 'Smooth genus-10 curve.',
  },
];
