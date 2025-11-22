
import {createCatmullRom} from "../interpolators/catmullRom.js";


export function NIntegrateRK(f, domain, dx = 0.01) {
    const [a, b] = domain;
    const N = Math.ceil((b - a) / dx);
    const h = (b - a) / N;

    const xs = [];
    const ys = [];

    let x = a;
    let I = 0;

    xs.push(x);
    ys.push(I);

    for (let i = 0; i < N; i++) {
        // classical RK4 for I' = f(x)
        const k1 = f(x);
        const k2 = f(x + 0.5 * h);
        const k3 = f(x + 0.5 * h);
        const k4 = f(x + h);

        I += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
        x += h;

        xs.push(x);
        ys.push(I);
    }

    return createCatmullRom(xs, ys, 0.5);
}
