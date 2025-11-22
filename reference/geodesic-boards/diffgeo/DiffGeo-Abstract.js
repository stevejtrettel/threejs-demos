
//abstract differential geometry class we are extending

export default class DiffGeo{
    constructor() {
    }

    parameterization = (u,v)=> {
        console.log('Need to Implement Parameterization')
    }

    surfaceNormal= (u,v)=>{
        console.log('Need to Implement GetNormal')
    }

    integrateGeodesic(tv){
        //parameterized geodesic in R3
        console.log('Need to Implement IntegrateGeodesic')
    }

    integrateGeodesicCoords(tv){
        //geodesic in coordinates
        console.log('Need to Implement IntegrateGeodesicCoords')
    }

    getParallelTransport(coordCurve){
        //return a parallel transport integrator along the curve
        //curve domain = [0,1]
        console.log('Need to Implement ParallelTransport')
    }

    rebuild(){

    }

}
