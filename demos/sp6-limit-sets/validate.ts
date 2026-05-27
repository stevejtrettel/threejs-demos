/**
 * Startup sanity checks for the example dataset.
 *
 *   Structural   — polynomial lists are length 7, palindromic, integer,
 *                  with lead/trail coefficient 1.
 *   Dynamical    — power iteration on γ converges (low drift) and produces
 *                  a |λ_max| consistent with the BDN-reported value (if
 *                  provided). This is end-to-end: a wrong polynomial, a
 *                  wrong γ word, or a buggy applyGen will all surface here.
 *
 * Failures throw on app startup; warnings (drift > tolerance, |λ_max|
 * mismatch) just log.
 */

import { EXAMPLES, type ExampleGroup } from './examples';
import { makeGroupAction, computeProximalBasepoint } from './orbit';

export interface ValidationResult {
  example: ExampleGroup;
  passed: boolean;
  errors: string[];
  warnings: string[];
  lambdaMax: number;
  drift: number;
}

function structuralCheck(ex: ExampleGroup, errors: string[]): void {
  const checks: [string, readonly number[]][] = [
    ['coefflistf', ex.coefflistf],
    ['coefflistg', ex.coefflistg],
  ];
  for (const [name, c] of checks) {
    if (c.length !== 7) {
      errors.push(`${name} has length ${c.length}, expected 7`);
      continue;
    }
    if (c[0] !== 1) errors.push(`${name}[0] = ${c[0]}, expected 1`);
    if (c[6] !== 1) errors.push(`${name}[6] = ${c[6]}, expected 1`);
    for (let i = 0; i < 4; i++) {
      if (c[i] !== c[6 - i]) {
        errors.push(`${name} not palindromic: [${i}]=${c[i]}, [${6 - i}]=${c[6 - i]}`);
      }
    }
    for (let i = 0; i < 7; i++) {
      if (!Number.isInteger(c[i])) {
        errors.push(`${name}[${i}] = ${c[i]} is not integer`);
      }
    }
  }
}

export function validateExample(ex: ExampleGroup): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  structuralCheck(ex, errors);

  let lambdaMax = NaN;
  let drift = NaN;
  if (errors.length === 0) {
    const action = makeGroupAction(ex);
    const r = computeProximalBasepoint(ex, action);
    lambdaMax = r.lambdaMax;
    drift = r.drift;
    if (!Number.isFinite(lambdaMax) || lambdaMax === 0) {
      errors.push(`power iteration produced |λ_max| = ${lambdaMax}; γ may be wrong`);
    } else if (drift > 1e-2 && Math.abs(drift - 2) > 1e-2) {
      // drift ≈ 0 ⇒ λ > 0; drift ≈ 2 ⇒ λ < 0; both fine projectively.
      warnings.push(`drift = ${drift.toFixed(4)} (expected ≈0 or ≈2); γ may not be loxodromic`);
    }
    if (ex.expectedLambdaMax !== undefined) {
      const rel = Math.abs(lambdaMax - ex.expectedLambdaMax) / ex.expectedLambdaMax;
      if (rel > 0.01) {
        warnings.push(
          `|λ_max| = ${lambdaMax.toFixed(3)}, expected ≈ ${ex.expectedLambdaMax}`,
        );
      }
    }
  }

  return {
    example: ex,
    passed: errors.length === 0,
    errors,
    warnings,
    lambdaMax,
    drift,
  };
}

export function validateAllExamples(): ValidationResult[] {
  const results = EXAMPLES.map(validateExample);
  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    console.error(`[sp6] ${failed.length} example(s) failed validation:`);
    for (const r of failed) {
      console.error(`  ${r.example.id}: ${r.errors.join('; ')}`);
    }
    throw new Error('sp6 example validation failed');
  }
  console.log('[sp6] example validation:');
  for (const r of results) {
    const summary =
      `λ_max=${r.lambdaMax.toFixed(3)}  drift=${r.drift.toFixed(4)}`;
    const warns = r.warnings.length > 0 ? `  ⚠ ${r.warnings.join('; ')}` : '';
    console.log(`         ${r.example.id.padEnd(4)}  ${summary}${warns}`);
  }
  return results;
}
