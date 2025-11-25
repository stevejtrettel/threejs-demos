/********************************************************************
 *  ShaderSurface.js
 *  ---------------------------------------------------------------
 *  THREE.Mesh subclass that visualises a surface of revolution purely
 *  on-GPU with three-custom-shader-material.
 *
 *  ‣ Depends on an *existing* DiffGeo instance, which supplies
 *      • parameters         – { a:1, b:2, … }
 *      • GLSL snippets      – glsl_r, glsl_ru, …, glsl_hu
 *  ‣ Geometry is a static plane; vertex shader performs the lift.
 *  ‣ When DiffGeo.rebuild(eqn) is called the caller should follow
 *    with surface.rebuild() so the new GLSL is compiled.
 *******************************************************************/

import{ Vector2,Mesh,MeshPhysicalMaterial,PlaneGeometry, DoubleSide} from "three";

import CustomShaderMaterial from 'three-custom-shader-material/vanilla';

import woodShader   from '../shaders/woodShader.glsl';   // fragment shader
// If you want to swap colour maps, just pass a different frag shader.

export default class GPURevSurface extends Mesh {

    /** ----------------------------------------------------------------
     * @param {DiffGeo} diffGeo            – already-initialised instance
     * @param {Array<[number,number]>} domain  – [[xmin,xmax],[ymin,ymax]]
     * @param {Object} options
     *        • widthSegments / heightSegments
     *        • fragmentShader – override for colour logic
     *        • baseMaterial   – e.g. THREE.MeshPhysicalMaterial
     * ----------------------------------------------------------------*/
    constructor(revGeo, options = {}){

        const {
            widthSegments  = 128,
            heightSegments = 128,
            fragmentShader = woodShader,
            baseMaterial   = MeshPhysicalMaterial,
        } = options;

        // --- store -----------------------------------------------------------------
        super();                                 // dummy super; we’ll attach geo+mat below

        this.geo = revGeo;

        this._segs   = { widthSegments, heightSegments };
        this._base   = baseMaterial;
        this._frag   = fragmentShader;

        // --- build once -------------------------------------------------------------
        this.geometry = this._buildGeometry();
        this.material = this._buildMaterial();

        this.frustumCulled = false;              // height-field often exceeds plane
    }

    /* ==================================================================== *
     *  PUBLIC API
     * ==================================================================== */

    /** Re-compile shaders after the underlying DiffGeo changed */
    rebuild() {
        // 1. toss uniforms & shaders living on the GPU
        this.material.dispose();
        // 2. replace with fresh GLSL generated from the *current* diffGeo
        this.material = this._buildMaterial();
    }

    /* ==================================================================== *
     *  INTERNAL HELPERS
     * ==================================================================== */

    /* ---- geometry is a simple plane ------------------------------------ */
    _buildGeometry(){
        const [[u0,u1],[t0,t1]] = this.geo.domain;
        return new PlaneGeometry(
            u1-u0,                       // width
            t1 - t0,                       // height
            this._segs.widthSegments,
            this._segs.heightSegments
        );
    }

    /* ---- uniforms & GLSL snippets -------------------------------------- */
    _buildMaterial(){

        const [[u0,u1],[t0,t1]] = this.geo.domain;
        const parameters   = this.geo.parameters;       // live reference – uniforms auto-sync

        /* 1.  uniforms + declarations */
        const uniforms      = {
            uDomainMin : { value: new Vector2(u0, t0) },
            uDomainSize: { value: new Vector2(u1 - u0, t1 - t0) },
        };
        const decls = [
            'uniform vec2 uDomainMin;',
            'uniform vec2 uDomainSize;',
        ];

        //   create a *stable* uniform object for each param so that
        //   onBeforeRender can mutate .value without replacing the slot
        for (const [k,v] of Object.entries(parameters)){
            uniforms[k] = { value: v };
            decls.push(`uniform float ${k};`);
        }

        /* 2.  vertex shader generator ------------------------------------ */
        const vs = /* glsl */`
${decls.join('\n')}

/* --- analytic data supplied by DiffGeo ------------------------------ */
float r   (float u){ return ${this.geo.glsl_r}; }
float h  (float u){ return ${this.geo.glsl_h};}
float ru  (float u){ return ${this.geo.glsl_ru};}
float hu (float u){ return ${this.geo.glsl_hu};}
float ruu (float u){ return ${this.geo.glsl_ruu};}
float huu (float u){ return ${this.geo.glsl_huu};}

varying float vGaussCurve;
varying float vMeanCurve;
varying vec2 vSectionalCurve;

varying vec3 vPosition;
varying vec2  vUv;

varying float vZ;

void main(){
    vUv = uv;

    // map [0,1]² → user domain
    vec2 ut = uDomainMin + uv * uDomainSize;
    float u  = ut.x;
    float t  = ut.y;
    
    float R = r(u);
    float H = h(u);

    // graph parameterization
    float x = R*cos(t);
    float y = R*sin(t);
    float z = H;
    vPosition = vec3(x,y,z);
    
   
    //compute derivatives once
    float Ru = ru(u);
    float Ruu = ruu(u);
    float Hu = hu(u);
    float Huu = huu(u);
    
   
    //compute curvatures
        // 1) compute the two principal curvatures
        float denom = sqrt(Ru*Ru + Hu*Hu);
        float km    = (Ru*Huu - Hu*Ruu) / (denom*denom*denom);
        float kp    = Hu / (R * denom);
        
        // 2) Gaussian and mean
        float Kcurve = km * kp;
        float Hcurve = 0.5 * (km + kp);
        
        vMeanCurve = Hcurve;
        vGaussCurve = Kcurve;
        vSectionalCurve = vec2(km,kp);
    
   
    // set parameterization and normal
    csm_Position = vec3(x,y,z);
    csm_Normal   = normalize(vec3(-Hu*cos(t),-Hu*sin(t),Ru));
}
`;

        /* 3.  material ---------------------------------------------------- */
        const mat = new CustomShaderMaterial({
            baseMaterial  : this._base,
            vertexShader  : vs,
            fragmentShader: this._frag,
            uniforms,
            side          : DoubleSide,
            transparent   : false,
            roughness     : 0.25,
            metalness     : 0.0,
            clearcoat     : 0.0,
        });

        /* 4.  keep uniforms live with diffGeo.parameters ------------------ */
        mat.onBeforeRender = () => {
            for (const key in parameters){
                const u = mat.uniforms[key];
                if (u) u.value = parameters[key];
            }
        };

        return mat;
    }
}
