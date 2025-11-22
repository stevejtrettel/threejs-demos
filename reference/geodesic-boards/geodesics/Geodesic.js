
import NumericalCurve from "../meshes/NumericalCurve.js";
import {CatmullRomCurve3} from "three";
import CatmullRomCurve2 from "../interpolators/CatmullRomCurve2.js";


export default class Geodesic extends NumericalCurve{
    constructor(surface, tv, radius, material ) {

         let pts = surface.integrateGeodesic(tv);

        super(pts, radius, material);

        this.pts = pts;
        this.tv = tv;
        this.surface = surface;

    }

    update( tv=null){
        if(tv){
            this.tv = tv;
        }
        this.pts = this.surface.integrateGeodesic(this.tv);
        this.redraw(this.pts);
    }

    //get points and surface normals for Edmund
    printToSring(numPts = 500){

        const precision = 3.;//decimals to show

        //reintegrate out the geodesic in coords
        let pts = this.surface.integrateGeodesicCoords(this.tv);
        let curve = new CatmullRomCurve2(pts);

        //string we will add to
        let string = '';

        //now sample the curve at even spacings
        let t,p,n,coord;
        for(let i=0; i<numPts; i++){
            t = i/(numPts-1);//goes from 0 to 1

            //point along curve and on surface
            coord = curve.getPoint(t);
            p = this.surface.parameterization(...coord);
            n = this.surface.surfaceNormal(...coord);

            //get the individual coordinates at the right precision
            let px = p.x.toFixed(precision);
            let py = p.y.toFixed(precision);
            let pz = p.z.toFixed(precision);

            let nx = n.x.toFixed(precision);
            let ny = n.y.toFixed(precision);
            let nz = n.z.toFixed(precision);

            let ptString = `(${px},${py},${pz},${nx},${ny},${nz}), `;
            string += ptString;
        }

        return string+'\n\n';
    }

}
