vec3 pal(float x, vec3 c, vec3 d){
    return abs(c*x+d);
}

vec3 heightColor(float wave){
    float q = sign(wave) * pow(abs(wave),0.8) * 3.0;
    vec3 col = pal(q, vec3(1.0,1.0,-1.0), vec3(0.2,-0.1,0.15));
    return col;
}

vec3 hsb2rgb( in vec3 c ){
    vec3 rgb = clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),
    6.0)-3.0)-1.0,
    0.0,
    1.0 );
    rgb = rgb*rgb*(3.0-2.0*rgb);
    return c.z * mix( vec3(1.0), rgb, c.y);
}
