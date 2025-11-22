#include ./components/colors.glsl
#include ./components/levelSets.glsl
#include ./components/wood.glsl


// varyings from your vertex shader
varying float vGaussCurve;
varying float vMeanCurve;
varying vec2 vSectionalCurve;
varying vec2  vUv;
varying vec3 vPosition;




void main(){


    vec3 p = vec3(vPosition.z*vPosition.x,vPosition.x,vPosition.y);
    vec3 base = pow(matWood(p), vec3(.4545));

//    vec3 base = heightColor(vGaussCurve/10.);

    //float grid = levelSets(vGaussCurve, 2.);
    //vec3 col = base + 5.*vec3(grid);
    vec3 col = base;

    float k1 = vSectionalCurve.x;
    float k2 = vSectionalCurve.y;

    if(k1>4.|| k2>4.){
        col = vec3(1.,0,0);
    }

    if(vPosition.z>1.|| vPosition.z<-1.){
        col = vec3(0.5,0,0.5);
    }

    csm_DiffuseColor = vec4(col,1);
}
