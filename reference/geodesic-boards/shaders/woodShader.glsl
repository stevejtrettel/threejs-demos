#include ./components/wood.glsl;

// varyings from your vertex shader
varying vec2  vUv;
varying float vZ;

varying float vGaussCurve;
varying float vMeanCurve;
varying vec2 vSectionalCurve;


void main() {
    float woodType = 2.;
    vec2 pos = vec2(vMeanCurve/10.+vUv.x,vUv.y);
    //vUv+vec2(vZ,vZ);
    vec3 p = vec3(pos, vZ);
    csm_DiffuseColor = vec4(pow(matWood(p), vec3(.4545)),1);
}
