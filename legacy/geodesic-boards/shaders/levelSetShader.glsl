#include ./components/colors.glsl
#include ./components/levelSets.glsl



// varyings from your vertex shader
varying float vGaussCurve;
varying float vMeanCurve;
varying vec2 vSectionalCurve;
varying vec2  vUv;
varying float vZ;

//void main() {
//    //pick a base color
//    vec3 baseColor = vec3(0.5,0.6,0.9);
//
//    //stripes
//    float sinStripes = sin(100.*vZ);
//    sinStripes =(1.+sinStripes)/2.;
//    sinStripes = pow(sinStripes,10.);
//    float stripes = (1.+0.5*sinStripes)/2.;
////    if(sinStripes*sinStripes>0.9){
////        stripes=0.2;
////    }
//    csm_DiffuseColor = vec4(stripes*baseColor, 1.0);
//}






void main(){

    //allowable variables to use in coloring:
    float x = vUv.x;
    float y = vUv.y;
    float z = vZ;

    float r = sqrt(x*x+y*y);
    float t = atan(y,x)/3.14;
    vec2 polar = vec2(r,t);

    float hue = t;
    float sat =(2.*r*r/(1.+2.*r*r));
    float light =0.5;
    vec3 base = hsb2rgb(vec3(hue,sat,light));

    float grid = levelSets(z, 2.);
    vec3 col = base + 3.*vec3(grid);

    csm_DiffuseColor = vec4(col,1);
}
