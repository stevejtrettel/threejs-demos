import {MeshPhysicalMaterial, Mesh, DoubleSide} from "three";
import NumericalSurfaceGeometry from "../geometries/NumericalSurfaceGeometry.js";

let defaultMat = new MeshPhysicalMaterial({
    color:0xffffff,
    clearcoat:1,
    roughness:0,
    metalness:0,
    side: DoubleSide,
});

export default class NumericalSurface extends Mesh {
    constructor(pts, material = defaultMat ) {

        let geometry = new NumericalSurfaceGeometry(pts);
        super(geometry,material);

    }

    redraw(pts){
        this.geometry.dispose();
        this.geometry = new NumericalSurfaceGeometry(pts);
    }

}

