import {Group} from "three";
import Geodesic from "./Geodesic.js";

//abstract class for different geodesic collections
//geodesic spray and stripes are examples
export default class GeodesicArray extends Group{
    constructor(surface, N =10, properties, material) {

        super();

        this.surface = surface;
        this.N = N;
        this.properties = properties;
        this.material = material;

        //build any internal things that are needed to set initial conditions
        this._initialize();

        this.ini = new Array(this.N);
        this.setIni();

        this.geodesics = [];
        for(let i=0;i<this.N;i++) {
            let geo = new Geodesic(this.surface, this.ini[i], this.properties.radius, this.material)
            this.geodesics.push(geo);
            //add to the group
            this.add(geo);
        }

    }

    _initialize(){
        //to fill in in each individual
    }

    setIni(){
        //this is the class that needs to be instantiated!
        console.log('This is an abstract class: need to instantiate this.setIni()');
    }

    redraw(){
        for(let i=0;i<this.N;i++) {
            this.geodesics[i].update(this.ini[i]);
        }
    }

    update(properties={}){

        for(const [key,value] of Object.entries(properties)){
            if(this.properties.hasOwnProperty(key)){
                this.properties[key]=value;
            }
        }
        this.setIni();
        this.redraw();
    }


    printToSring(numPts) {
        let string = ``;
        for(let i=0; i<this.N;i++){
            string += this.geodesics[i].printToSring(numPts);
        }
        return string;
    }


    setVisibility(bool){
        for(let i=0; i<this.N; i++){
            this.geodesics[i].setVisibility(bool);
        }
    }


    dispose() {
        //when we want to delete it
        this.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
            }
        });
    }



}
