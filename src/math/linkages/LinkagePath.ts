/**
 * LinkagePath — a parameterized path in configuration space.
 *
 * A path is a function t ∈ [0, 1] → positions (Float32Array).
 * For closure-preserving motion, the caller is responsible for
 * constructing paths whose sample points satisfy the rod-length
 * constraints. The project() helper (coming in a later pass) will
 * be able to snap arbitrary paths onto the constraint variety.
 *
 * Two factories mirror the curves/ domain:
 *   fromFunction — analytic path from a closure
 *   fromSamples  — piecewise-linear path through an array of samples
 */

export type PathFunction = (t: number) => Float32Array;

export class LinkagePath {
  readonly evaluate: PathFunction;

  private constructor(evaluate: PathFunction) {
    this.evaluate = evaluate;
  }

  /**
   * Analytic path. The function may allocate a new Float32Array per call
   * or write into a shared scratch buffer — caller's choice. Note that
   * consumers of evaluate() must treat the returned array as read-only
   * if the path reuses a buffer.
   */
  static fromFunction(f: PathFunction): LinkagePath {
    return new LinkagePath(f);
  }

  /**
   * Piecewise-linear path through the given samples.
   * Each sample is a Float32Array of the same length.
   * t=0 returns samples[0], t=1 returns samples[last]; interior t values
   * linearly interpolate between adjacent samples.
   *
   * Returns a fresh Float32Array on each call.
   */
  static fromSamples(samples: Float32Array[]): LinkagePath {
    if (samples.length === 0) throw new Error('LinkagePath.fromSamples needs ≥ 1 sample');
    const n = samples.length;
    const dim = samples[0].length;

    return new LinkagePath((t: number) => {
      if (n === 1) return new Float32Array(samples[0]);

      const tc = Math.max(0, Math.min(1, t));
      const scaled = tc * (n - 1);
      const i = Math.min(Math.floor(scaled), n - 2);
      const alpha = scaled - i;

      const a = samples[i];
      const b = samples[i + 1];
      const out = new Float32Array(dim);
      for (let k = 0; k < dim; k++) {
        out[k] = (1 - alpha) * a[k] + alpha * b[k];
      }
      return out;
    });
  }
}
