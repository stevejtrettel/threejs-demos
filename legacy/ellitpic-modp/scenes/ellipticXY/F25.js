import {
    WebGLRenderer,
    ACESFilmicToneMapping,
    PerspectiveCamera,
    Color,
    Scene,
    Mesh,
    MeshPhysicalMaterial,
    Vector2,
    BoxGeometry, TorusKnotGeometry,
    TorusGeometry, TubeGeometry, CylinderGeometry,
    Vector3, Group, SphereGeometry, FloatType, DoubleSide, LineCurve3,
} from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
    GradientEquirectTexture,
    WebGLPathTracer,
    ShapedAreaLight, PhysicalSpotLight,PhysicalCamera,
} from 'three-gpu-pathtracer';

import {GUI} from "three/examples/jsm/libs/lil-gui.module.min.js";

import Grid3D from "../../items/Grid3D";
import {colors, makeMaterial} from "../../items/utils";

// init scene and objects, and lights
//--------------------------------------------

const scene = new Scene();

let grid = new Grid3D(0.5);

//there are going to be five layers
//we need to position them in space
//give five translation vectors
let t0 = new Vector3(-1.5,3,0);
let t1 = new Vector3(-3,0,0);
let t2 = new Vector3(0,0,0);
let t3 = new Vector3(3,0,0);
let t4 = new Vector3(1.5,3,0);

let translation = [t0,t1,t2,t3,t4]



let layer0 = new Group();
scene.add(layer0);

let grid0 = grid.getGridLines(2);
let vert0 = grid.getGridVertices(2);
layer0.add(grid0);
layer0.add(vert0);
layer0.position.set(t0.x,t0.y,t0.z);


let layer1 = new Group();
scene.add(layer1);

let grid1 = grid.getGridLines(2);
let vert1 = grid.getGridVertices(2);
layer1.add(grid1);
layer1.add(vert1);
layer1.position.set(t1.x,t1.y,t1.z);



let layer2 = new Group();
scene.add(layer2);

let grid2 = grid.getGridLines(2);
let vert2 = grid.getGridVertices(2);
layer2.add(grid2);
layer2.add(vert2);
layer2.position.set(t2.x,t2.y,t2.z);



let layer3 = new Group();
scene.add(layer3);

let grid3 = grid.getGridLines(2);
let vert3 = grid.getGridVertices(2);
layer3.add(grid3);
layer3.add(vert3);
layer3.position.set(t3.x,t3.y,t3.z);



let layer4 = new Group();
scene.add(layer4);

let grid4 = grid.getGridLines(2);
let vert4 = grid.getGridVertices(2);
layer4.add(grid4);
layer4.add(vert4);
layer4.position.set(t4.x,t4.y,t4.z);




//the elliptic curve!


let ellipticPts = new Group();
scene.add(ellipticPts);

// //the points that are on the elliptic curve
// let solutions = [[[0, 0], [0, 0]], [[0, 1], [0, 0]], [[0, 4], [0, 0]], [[1, 0], [2,
//     0]], [[1, 0], [3, 0]], [[1, 2], [1, 4]], [[1, 2], [4, 1]], [[1,
//     3], [1, 1]], [[1, 3], [4, 4]], [[2, 0], [2, 0]], [[2, 0], [3,
//     0]], [[3, 0], [1, 0]], [[3, 0], [4, 0]], [[4, 0], [1, 0]], [[4,
//     0], [4, 0]], [[4, 2], [2, 2]], [[4, 2], [3, 3]], [[4, 3], [2,
//     3]], [[4, 3], [3, 2]]];
//


//in modified to be in -2 2
let solutions = [[[0, 0], [0, 0]], [[0, 1], [0, 0]], [[0, -1], [0, 0]], [[1, 0], [2,
    0]], [[1, 0], [-2, 0]], [[1, 2], [1, -1]], [[1, 2], [-1, 1]], [[1,
    -2], [1, 1]], [[1, -2], [-1, -1]], [[2, 0], [2, 0]], [[2, 0], [-2,
    0]], [[-2, 0], [1, 0]], [[-2, 0], [-1, 0]], [[-1, 0], [1, 0]], [[-1,
    0], [-1, 0]], [[-1, 2], [2, 2]], [[-1, 2], [-2, -2]], [[-1, -2], [2,
    -2]], [[-1, -2], [-2, 2]]];

//position these in a grid:
function getGridIndex(sol){
    let point = [sol[0][0],sol[0][1],sol[1][0]];
    let layer = sol[1][1]+2;//so its still in 0 to 4
    return {point: point, layer:layer};
}

function getPosition(sol){
    //get the position in space to put a solution
    let location = new Vector3(sol[0][0],sol[0][1],sol[1][0]).multiplyScalar(0.5);
    let layer = sol[1][1]+2;//so its still in 0 to 4
    location.add(translation[layer]);
    return location;
}

for(let i=0; i<solutions.length;i++){
    let data = getGridIndex(solutions[i]);
    let pt = grid.getVertex(data.point);
    let t = translation[data.layer];
    let pos = pt.position.clone();
    pos.add(t);
    pt.position.set(pos.x,pos.y,pos.z);
    ellipticPts.add(pt);
}

//finally, add the point at infinity
let infPos = [[0,10],[0,0]];
let inf = grid.getVertex([0,10,0]);
ellipticPts.add(inf);


//draw the group structure
//group is Z10xZ2, so will list as subgroup and coset

let F5Group = [[2, -2], [1, 2], [-2, 1], [-1, 1], [0, 0], [-1, -1], [-2, -1], [1, -2], [2,
    2]];

function f5embed(p){
    return [[p[0],0],[p[1],0]];
}

let subgroup = [infPos];
for(let i=0;i<F5Group.length; i++){
    subgroup.push(f5embed(F5Group[i]));
}
subgroup.push(infPos);

let coset = [
    [[0,1],[0,0]],
    [[-1,-2],[2,-2]],
    [[1,2],[1,-1]],
    [[1,-2],[-1,-1]],
    [[-1,2],[-2,-2]],
    [[0,-1],[0,0]],
    [[-1,2],[2,2]],
    [[1,-2],[1,1]],
    [[1,2],[-1,1]],
    [[-1,-2],[-2,2]],
    [[0,1],[0,0]]
];


function getRod(sol1, sol2, color,radius,glass){
    //get two positions in space
    let pos1 = getPosition(sol1);
    let pos2 = getPosition(sol2);

    //make a line
    let line = new LineCurve3(pos1,pos2);
    let geo = new TubeGeometry(line,64,radius,8,false);
    return new Mesh(geo, makeMaterial(color,glass));
}






//draw the edges of the subgroup
let subG = new Group();
scene.add(subG);

for(let i=0;i<subgroup.length-1;i++){
    let edge = getRod(subgroup[i],subgroup[i+1],colors.blue,0.025,false);
    subG.add(edge);
}

//
//draw the edges of the coset
let coS = new Group();
scene.add(coS);

for(let i=0;i<coset.length-1;i++){
    let edge = getRod(coset[i],coset[i+1],colors.blue, 0.025,false);
    coS.add(edge);
}


//draw the crosstracks

let tracks = new Group();
scene.add(tracks);

for(let i=0;i<coset.length-1;i++){
    let edge = getRod(subgroup[i],coset[i],colors.yellow,0.025,false);
    tracks.add(edge);
}


// spot light
let spotLight = new PhysicalSpotLight( 0xffffff );
spotLight.position.set( 2, 6.0, 0 );
spotLight.angle = Math.PI / 2;
spotLight.decay = 0;
spotLight.penumbra = 1.0;
spotLight.distance = 0.0;
spotLight.intensity = 2.0;
spotLight.radius = 0.5;

// spot light shadow
spotLight.shadow.mapSize.width = 512;
spotLight.shadow.mapSize.height = 512;
spotLight.shadow.camera.near = 0.1;
spotLight.shadow.camera.far = 10.0;
spotLight.shadow.focus = 1.0;
spotLight.castShadow = true;
scene.add( spotLight );

// spot light target
const targetObject = spotLight.target;
targetObject.position.x = 1;
targetObject.position.y = 0;
targetObject.position.z = 0.05;
scene.add( targetObject );









const ground = new Mesh(
    new BoxGeometry( 100, 0.1, 100 ),
    new MeshPhysicalMaterial({
        color:0xffffff, clearcoat:1, roughness:0.5,metalness:0
    }),
);
ground.position.set(0.,-1.5,0);
scene.add(ground);

const backWall = new Mesh(
    new BoxGeometry( 100, 100, 0.1 ),
    new MeshPhysicalMaterial({
    }),
);
backWall.position.set(0,4,10);
scene.add(backWall);


// environment for the scene
//--------------------------------------------
// set the environment map
const texture = new GradientEquirectTexture();
texture.bottomColor.set( 0xffffff );
texture.bottomColor.set( 0x666666 );
texture.update();
scene.environment = texture;
scene.background = texture;


// camera
//--------------------------------------------
const camera = new PerspectiveCamera();
camera.position.set( 1, 3, - 12 );
camera.lookAt( 0, 4, 0 );


// const camera = new PhysicalCamera( 60, window.innerWidth / window.innerHeight, 0.025, 500 );
// camera.position.set( - 0.262, 0.5276, - 1.1606 );
// camera.apertureBlades = 0;
// camera.fStop = 1.5;
// camera.focusDistance = 1.1878;
// let focusPoint = new Vector3();
// focusPoint.set( 0,0,-0.25 );



// set up the renderer
//--------------------------------------------
let renderer = new WebGLRenderer({
    preserveDrawingBuffer:true,
});
renderer.toneMapping = ACESFilmicToneMapping;
document.body.appendChild( renderer.domElement );



// set up the Path tracer
//--------------------------------------------
let pathTracer = new WebGLPathTracer( renderer );
pathTracer.setScene( scene, camera );

pathTracer.renderScale = Math.max( 1 / window.devicePixelRatio, 0.5 );;
pathTracer.tiles.setScalar( 3 );
pathTracer.bounces = 30.;



// SCREENSHOTS
//---------------------------------------------------

function saveImage(canvas){
    const date = new Date();
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let hour = date.getHours();
    let minute = date.getMinutes();

    let link = document.createElement('a');
    link.download = `pathtrace ${month}-${day}-${hour}${minute}`+'.png';
    link.href = canvas.toDataURL("image/png");
    //.replace("image/png", "image/octet-stream");
    link.click();
}


const gui = new GUI().close();
let params = {
    saveit: ()=>saveImage(renderer.domElement),
};
gui.add( params, 'saveit' );



//controls
//--------------------------------------------
let controls = new OrbitControls( camera, renderer.domElement );
controls.target.set( 0, 0.33, - 0.08 );
controls.addEventListener( 'change', () => pathTracer.updateCamera() );
controls.update();
// controls.addEventListener( 'change', () => {
//     camera.focusDistance = camera.position.distanceTo( focusPoint ) - camera.near;
//     pathTracer.updateCamera();
// } );




//animate loop
//--------------------------------------------


onResize();

animate();

window.addEventListener( 'resize', onResize );

function animate() {

    // if the camera position changes call "ptRenderer.reset()"
    requestAnimationFrame( animate );

    // update the camera and render one sample
    pathTracer.renderSample();

}

function onResize() {

    // update rendering resolution
    const w = window.innerWidth;
    const h = window.innerHeight;

    renderer.setSize( w, h );
    renderer.setPixelRatio( window.devicePixelRatio );

    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();

    pathTracer.setScene( scene, camera );

}

