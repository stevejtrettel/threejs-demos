import CustomShaderMaterial from "three-custom-shader-material/vanilla";
import {DoubleSide, MeshPhysicalMaterial} from "three";
import defaultShader from "../shaders/defaultShader.glsl";

export default class FragmentMaterial extends CustomShaderMaterial{
    constructor(fragmentShader = defaultShader, options={}) {

        //vertex shader
        const vertexShader = `
        varying vec3 vPosition;

        void main(){
             vPosition = position;
            
            //leave everything unchanged
            csm_Position = position;
            csm_Normal   = normal;
        }
        `;

        const csm_options = {
            baseMaterial  : MeshPhysicalMaterial,
            vertexShader  : vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {},
            side          : options.side||DoubleSide,
            transparent   : false,
            roughness     : options.roughness||0.25,
            metalness     : options.metalness||.0,
            clearcoat     : options.clearcoat||1,
        };


        super(csm_options);
    }
}


