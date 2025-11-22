#include ./components/colors.glsl
#include ./components/levelSets.glsl


// varyings from your vertex shader
varying float vGaussCurve;
varying float vMeanCurve;
varying vec2 vSectionalCurve;


void main(){

    vec3 base = heightColor(vGaussCurve/10.);

    float grid = levelSets(vGaussCurve, 2.);
    vec3 col = base + 5.*vec3(grid);

    csm_DiffuseColor = vec4(col,1);
}
