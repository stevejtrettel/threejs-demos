
/**
 * Build a Catmull–Rom interpolator for (xs[i], ys[i]) pairs.
 * Assumes xs is strictly increasing.  Returns I(x) which:
 *   • for x≤xs[0], returns ys[0],
 *   • for x≥xs[n−1], returns ys[n−1],
 *   • otherwise does a standard 4-point Catmull–Rom on the two surrounding knots.
 */
export function createCatmullRom(xs, ys) {
    const n = xs.length;
    if (n !== ys.length || n < 2) {
        throw new Error("xs and ys must be same length ≥ 2");
    }

    // locate interval i so that xs[i] ≤ x ≤ xs[i+1]
    function findInterval(x) {
        let lo = 0, hi = n - 1;
        if (x <= xs[0]) return 0;
        if (x >= xs[hi]) return hi - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >>> 1;
            if (xs[mid] > x) hi = mid;
            else lo = mid;
        }
        return lo;
    }

    // the interpolator function
    return function interp(x) {
        // clamp
        if (x <= xs[0]) return ys[0];
        if (x >= xs[n - 1]) return ys[n - 1];

        // find segment
        const i1 = findInterval(x);
        const i0 = Math.max(i1 - 1, 0);
        const i2 = Math.min(i1 + 1, n - 1);
        const i3 = Math.min(i1 + 2, n - 1);

        // normalized parameter in [0,1] over [x1,x2]
        const t = (x - xs[i1]) / (xs[i2] - xs[i1]);
        const t2 = t * t, t3 = t2 * t;

        const p0 = ys[i0], p1 = ys[i1], p2 = ys[i2], p3 = ys[i3];

        // Catmull-Rom basis (uniform)
        return 0.5 * (
            (2 * p1) +
            (   - p0 + p2) * t +
            (2*p0 - 5*p1 + 4*p2 - p3) * t2 +
            (-p0 + 3*p1 - 3*p2 + p3) * t3
        );
    };
}



export function createCentripetalCatmullRom(xs, ys, alpha = 0.5) {
    const n = xs.length;
    if (n !== ys.length || n < 2) throw new Error("...");
    // build parameter t’s by t[i+1] = t[i] + |x[i+1]-x[i]|^alpha
    const ts = new Array(n);
    ts[0] = 0;
    for (let i = 1; i < n; ++i) {
        ts[i] = ts[i-1] + Math.pow(Math.abs(xs[i] - xs[i-1]), alpha);
    }

    function findInterval(x) {
        let lo = 0, hi = n-1;
        if (x <= xs[0]) return 0;
        if (x >= xs[hi]) return hi-1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >>> 1;
            if (xs[mid] > x) hi = mid;
            else lo = mid;
        }
        return lo;
    }

    // linear blend in (t0,p0)→(t1,p1)
    function lerp(t0, p0, t1, p1, t) {
        return t1 === t0
            ? p0
            : ((t1 - t)/(t1 - t0))*p0 + ((t - t0)/(t1 - t0))*p1;
    }

    return function interp(x) {
        const i1 = findInterval(x);
        const i0 = Math.max(0, i1-1);
        const i2 = Math.min(n-1, i1+1);
        const i3 = Math.min(n-1, i1+2);

        // map x→t linearly between t1 and t2
        const t1 = ts[i1], t2 = ts[i2];
        const x1 = xs[i1], x2 = xs[i2];
        const t = t1 + (t2 - t1)*( (x - x1)/(x2 - x1) );

        const p0 = ys[i0], p1 = ys[i1], p2 = ys[i2], p3 = ys[i3];

        // first level
        const A1 = lerp(ts[i0], p0, t1, p1, t);
        const A2 = lerp(t1, p1, t2, p2, t);
        const A3 = lerp(t2, p2, ts[i3], p3, t);
        // second
        const B1 = lerp(ts[i0], A1, t2, A2, t);
        const B2 = lerp(t1, A2, ts[i3], A3, t);
        // final
        return lerp(t1, B1, t2, B2, t);
    };
}
