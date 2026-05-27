/**
 * Sp(6,Z) hypergeometric monodromy examples (Bajpai-Dona-Nitsche, Tables 1-2).
 *
 * Each ExampleGroup carries the polynomial data for the two generators:
 *   coefflistf — palindromic integer coefficients of f(x) = ∏(x - exp(2πi α_j))
 *   coefflistg — palindromic integer coefficients of g(x) = ∏(x - exp(2πi β_j))
 *
 * Both are length 7 with coefflistf[0] = coefflistf[6] = 1 (same for g). The
 * companion matrices A, B ∈ SL₆(Z) of these are symplectic; T = A·B⁻¹ is a
 * unipotent transvection of the form I + c·e_1ᵀ.
 *
 * Pipeline knobs:
 *   gamma     — loxodromic word as a sequence of generator codes
 *               (0 = B, 1 = B⁻¹, 2 = T, 3 = T⁻¹) used for power iteration
 *               to find the proximal basepoint ξ₊(γ) ∈ Λ.
 *   gammaName — display string
 *   powerIter — iteration count
 *
 * The transvection column T_COL and the inner sparse-mat-vec coefficients
 * B_C are *derived* from coefflistf, coefflistg (no need to hand-type):
 *   B_C   = coefflistg[1..5]
 *   T_COL = (1, c_1, c_2, c_3, c_4, c_5),   c_i = coefflistf[i] - coefflistg[i].
 *
 * Adding a new example requires only the two polynomial coefficient lists,
 * a γ word, and an iteration count.
 */

export interface ExampleGroup {
  id: string;
  label: string;
  nature: 'thin' | 'arithmetic' | 'open';
  coefflistf: readonly number[];
  coefflistg: readonly number[];
  gamma: readonly number[];
  gammaName: string;
  powerIter: number;
  alpha: string;
  beta: string;
  expectedLambdaMax?: number;
}

export const EXAMPLES: readonly ExampleGroup[] = [
  {
    id: 'A1',
    label: 'A-1',
    nature: 'thin',
    coefflistf: [1, -6, 15, -20, 15, -6, 1], // (x-1)⁶
    coefflistg: [1,  6, 15,  20, 15,  6, 1], // (x+1)⁶
    gamma: [1, 2, 2, 1, 2], // TBT = A⁻¹·B·B·A⁻¹·B (T = A⁻¹B from Section 2)
    gammaName: 'TBT',
    powerIter: 30,
    alpha: '(0, 0, 0, 0, 0, 0)',
    beta:  '(½, ½, ½, ½, ½, ½)',
    expectedLambdaMax: 29.607,
  },
  {
    id: 'A15',
    label: 'A-15',
    nature: 'arithmetic',
    coefflistf: [1, -6, 15, -20, 15, -6, 1], // (x-1)⁶
    coefflistg: [1,  1,  2,   1,  2,  1, 1], // (x²+x+1)²(x²-x+1)
    gamma: [1, 2, 2, 1, 2],
    gammaName: 'TBT',
    powerIter: 30,
    alpha: '(0, 0, 0, 0, 0, 0)',
    beta:  '(⅓, ⅓, ⅔, ⅔, ⅙, ⅚)',
    expectedLambdaMax: 16.607,
  },
  {
    id: 'c2',
    label: 'C-2',
    nature: 'thin',
    coefflistf: [1, -3, 3, -2, 3, -3, 1],   // (x-1)⁴(x²+x+1)
    coefflistg: [1,  4, 7,  8, 7,  4, 1],   // (x+1)⁴(x²+1)
    gamma: [1, 2, 2, 1, 2],
    gammaName: 'TBT',
    powerIter: 30,
    alpha: '(0, 0, 0, 0, ⅓, ⅔)',
    beta:  '(½, ½, ½, ½, ¼, ¾)',
    expectedLambdaMax: 17.221,
  },
  {
    id: 'c32',
    label: 'C-32',
    nature: 'open',
    coefflistf: [1, -5, 11, -14, 11, -5, 1], // (x-1)⁴(x²-x+1)
    coefflistg: [1,  0,  0,   0,  0,  0, 1], // x⁶ + 1
    gamma: [1, 2, 2, 1, 2],
    gammaName: 'TBT',
    powerIter: 30,
    alpha: '(0, 0, 0, 0, ⅙, ⅚)',
    beta:  '(¼, ¾, 1/12, 5/12, 7/12, 11/12)',
    expectedLambdaMax: 12.035,
  },
  {
    id: 'c47',
    label: 'C-47',
    nature: 'arithmetic',
    coefflistf: [1, -1, 0,  0, 0, -1, 1],    // (x-1)²(x⁴+x³+x²+x+1)
    coefflistg: [1,  4, 8, 10, 8,  4, 1],    // (x+1)²(x²+x+1)²
    gamma: [1, 2, 2, 1, 2],
    gammaName: 'TBT',
    powerIter: 30,
    alpha: '(0, 0, ⅕, ⅖, ⅗, ⅘)',
    beta:  '(½, ½, ⅓, ⅓, ⅔, ⅔)',
    expectedLambdaMax: 12.225,
  },
  {
    id: 'c55',
    label: 'C-55',
    nature: 'arithmetic',
    coefflistf: [1, -2, 1,  0, 1, -2, 1],    // (x-1)²(x⁴+1)
    coefflistg: [1,  2, 0, -2, 0,  2, 1],    // (x+1)²(x⁴-x²+1)
    gamma: [1, 2, 2, 1, 2],
    gammaName: 'TBT',
    powerIter: 30,
    alpha: '(0, 0, ⅛, ⅜, ⅝, ⅞)',
    beta:  '(½, ½, 1/12, 5/12, 7/12, 11/12)',
    expectedLambdaMax: 10.142,
  },
];

export function deriveBC(g: readonly number[]): readonly number[] {
  return g.slice(1, 6);
}

export function deriveTCol(
  f: readonly number[],
  g: readonly number[],
): readonly number[] {
  return [
    1,
    f[1] - g[1],
    f[2] - g[2],
    f[3] - g[3],
    f[4] - g[4],
    f[5] - g[5],
  ];
}

export function exampleById(id: string): ExampleGroup {
  const ex = EXAMPLES.find((e) => e.id === id);
  if (!ex) throw new Error(`unknown sp6 example id: ${id}`);
  return ex;
}
