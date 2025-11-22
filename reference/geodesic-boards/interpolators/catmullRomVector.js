
/**
 * Uniform‐spacing Catmull–Rom for Vector2/Vector3 outputs.
 * xs: increasing float array, ys: matching Vector2 or Vector3 array.
 */
export function createCatmullRomVec(xs, ys) {
    const n = xs.length;
    if (n !== ys.length || n < 2) {
        throw new Error("xs and ys must be same length ≥ 2");
    }

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

    return function interp(x) {
        // clamp to endpoints
        if (x <= xs[0]) return ys[0].clone();
        if (x >= xs[n - 1]) return ys[n - 1].clone();

        const i1 = findInterval(x);
        const i0 = Math.max(i1 - 1, 0);
        const i2 = Math.min(i1 + 1, n - 1);
        const i3 = Math.min(i1 + 2, n - 1);

        const x1 = xs[i1], x2 = xs[i2];
        const t = (x - x1) / (x2 - x1);
        const t2 = t * t, t3 = t2 * t;

        const p0 = ys[i0],
            p1 = ys[i1],
            p2 = ys[i2],
            p3 = ys[i3];

        // build each term as a new vector
        const term0 = p1.clone().multiplyScalar(2);
        const term1 = p2.clone().sub(p0).multiplyScalar(t);
        const term2 = p0.clone()
            .multiplyScalar(2)
            .sub(p1.clone().multiplyScalar(5))
            .add(p2.clone().multiplyScalar(4))
            .sub(p3)
            .multiplyScalar(t2);
        const term3 = p3.clone()
            .sub(p2.clone().multiplyScalar(3))
            .add(p1.clone().multiplyScalar(3))
            .sub(p0)
            .multiplyScalar(t3);

        return term0
            .add(term1)
            .add(term2)
            .add(term3)
            .multiplyScalar(0.5);
    };
}

/**
 * Centripetal Catmull–Rom for Vector2/Vector3 outputs.
 * xs: increasing float array, ys: matching Vector2 or Vector3 array.
 * alpha=0.5 gives standard centripetal; alpha=1 would be chordal.
 */
export function createCentripetalCatmullRomVec(xs, ys, alpha = 0.5) {
    const n = xs.length;
    if (n !== ys.length || n < 2) {
        throw new Error("xs and ys must be same length ≥ 2");
    }

    // build chord‐length params
    const ts = new Array(n);
    ts[0] = 0;
    for (let i = 1; i < n; ++i) {
        ts[i] = ts[i - 1] + Math.pow(Math.abs(xs[i] - xs[i - 1]), alpha);
    }

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

    return function interp(x) {
        // handle endpoints
        if (x <= xs[0]) return ys[0].clone();
        if (x >= xs[n - 1]) return ys[n - 1].clone();

        const i1 = findInterval(x);
        const i0 = Math.max(i1 - 1, 0);
        const i2 = Math.min(i1 + 1, n - 1);
        const i3 = Math.min(i1 + 2, n - 1);

        // map x -> t linearly on [i1,i2]
        const t1 = ts[i1], t2 = ts[i2];
        const x1 = xs[i1], x2 = xs[i2];
        const t = t1 + (t2 - t1) * ((x - x1) / (x2 - x1));

        const p0 = ys[i0], p1 = ys[i1], p2 = ys[i2], p3 = ys[i3];

        // local lerp helper (Vector.lerp mutates, so we clone)
        const lerp = (A, B, alpha) => A.clone().lerp(B, alpha);

        // first level
        const A1 = lerp(p0, p1, (t - ts[i0]) / (t1 - ts[i0]));
        const A2 = lerp(p1, p2, (t - t1)      / (t2 - t1));
        const A3 = lerp(p2, p3, (t - t2)      / (ts[i3] - t2));
        // second level
        const B1 = lerp(A1, A2, (t - ts[i0]) / (t2 - ts[i0]));
        const B2 = lerp(A2, A3, (t - t1)      / (ts[i3] - t1));
        // final blend
        return lerp(B1, B2, (t - t1) / (t2 - t1));
    };
}
