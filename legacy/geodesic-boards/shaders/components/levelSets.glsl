float levelSets(float x, float scale){
    float spacing = 3.1416*scale;
    float grid1 = (1.-pow(abs(sin(spacing*x)),0.1))/10.;
    float grid2 = (1.-pow(abs(sin(5.*spacing*x)),0.1))/25.;
    float grid3 = (1.-pow(abs(sin(10.*spacing *x)),0.1))/50.;
    return grid1+grid2+grid3;
}
