
//returns an interpolating function
//integrating fn on domain

import {createCatmullRom} from "../interpolators/catmullRom.js";

export function NIntegrate(f, domain, dx=0.01){

    const [a, b] = domain;
    const N = Math.ceil((b - a) / dx);
    const h = (b - a) / N;

    let xs = [];
    let ys = [];

    //the integration loop
    let xi,fi;
    let sum = 0;

    //midpoint sum
    for(let i=0; i<N; i++){
        xi = start + (i+0.5)*h;
        fi = f(xi);
        sum += fi*h;
        xs.push(xi);
        ys.push(sum);
    }

    //now have the riemann sum across this interval: get interpolator
    return createCatmullRom(xs,ys,0.5);
}
