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
    Vector3, Group, SphereGeometry, FloatType, DoubleSide, CatmullRomCurve3,
} from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
    GradientEquirectTexture,
    WebGLPathTracer,
    ShapedAreaLight, PhysicalSpotLight,PhysicalCamera,
} from 'three-gpu-pathtracer';

import {GUI} from "three/examples/jsm/libs/lil-gui.module.min.js";

import Grid3D from "../../items/Grid3D";
import {colors} from "../../items/utils";


// init scene and objects, and lights
//--------------------------------------------

const scene = new Scene();

//color scheme
const glassColor =0xc9eaff;
const redColor = 0xd43b3b;//0xe03d24
const greenColor = 0x4fbf45;
const blueColor = 0x4287f5;
const yellowColor = 0xffd738;

let grid = new Grid3D();

//the background additive structure grid
let additiveGrid = grid.getGridLines(1);
scene.add(additiveGrid);


//the nonzero points of the variety
let points = new Group();
scene.add(points);
for(let i=-1;i<2;i++){
    for(let j=-1;j<2;j++){
        for(let k=-1;k<2;k++) {
            if (!(i == 0 && j == 0 && k == 0)) {
                let element = grid.getVertex([i, j, k]);
                points.add(element);
            }
        }
    }
}

// //the origin
//  scene.add(grid.getVertex([0,0],0x000000,0.05));



//FROBENIUS

//frobenius map x->x^3 has 1 fixed points (+-1) and eight 3-cycles
// (they are in four groups, each  negative of the other)
//each group has a LONG DIAGONAL as the last connection of the triangle, which we will have to render separately
//the orbits are set up so the long diagonal connects the START to the END of the list

const frob = new Group();
scene.add(frob);



//fixed point 1
let fix1 = function(s){
    let t = 2*Math.PI*s;
    let circ = new Vector3(0,0.2*Math.sin(t),0.2*Math.cos(t));
    circ.add(new Vector3(0,0,1.25));
    return circ;
}
frob.add(grid.getCurve(fix1,colors.green,0.025));

//fixed point 2
let fix2 = function(s){
    let t = 2*Math.PI*s;
    let circ = new Vector3(0,0.2*Math.sin(t),0.2*Math.cos(t));
    circ.add(new Vector3(0,0,-1.25));
    return circ;
}
frob.add(grid.getCurve(fix2,colors.green,0.025));


//orbit1
const o1 = [[1,-1,1],[1,0,0], [1,1,1]];
frob.add(grid.getRod(o1[0],o1[1],colors.green,0.025));
frob.add(grid.getRod(o1[1],o1[2],colors.green,0.025));
frob.add(grid.getBentRod(o1[2],o1[0],new Vector3(0,0,-0.3),colors.green,0.025));

//orbit2
const o2 = [[-1,1,-1],[-1,0,0], [-1,-1,-1]];
frob.add(grid.getRod(o2[0],o2[1],colors.green,0.025));
frob.add(grid.getRod(o2[1],o2[2],colors.green,0.025));
frob.add(grid.getBentRod(o2[2],o2[0],new Vector3(0,0,0.3),colors.green,0.025));


//orbit3
const o3 = [[0,1,1],[0,1,0], [0,1,-1]];
frob.add(grid.getRod(o3[0],o3[1],colors.green,0.025));
frob.add(grid.getRod(o3[1],o3[2],colors.green,0.025));
frob.add(grid.getBentRod(o3[2],o3[0],new Vector3(0,0.3,0),colors.green,0.025));

//orbit4
const o4 = [[0,-1,-1],[0,-1,0], [0,-1,1]];
frob.add(grid.getRod(o4[0],o4[1],colors.green,0.025));
frob.add(grid.getRod(o4[1],o4[2],colors.green,0.025));
frob.add(grid.getBentRod(o4[2],o4[0],new Vector3(0,-0.3,0),colors.green,0.025));


//orbit5
const o5 = [[1,-1,-1],[1,0,1],[1,1,-1]];
// frob.add(grid.getRod(o5[0],o5[1]));
// frob.add(grid.getRod(o5[1],o5[2]));
frob.add(grid.getBentRod(o5[0],o5[1],new Vector3(0.3,0,0),colors.green,0.025));
frob.add(grid.getBentRod(o5[1],o5[2],new Vector3(0.3,0,0),colors.green,0.025));
frob.add(grid.getBentRod(o5[2],o5[0],new Vector3(-0.3,0,0),colors.green,0.025));

//orbit6
const o6 = [[-1,1,1],[-1,0,-1],[-1,-1,1]];
// frob.add(grid.getRod(o6[0],o6[1]));
// frob.add(grid.getRod(o6[1],o6[2]));
frob.add(grid.getBentRod(o6[0],o6[1],new Vector3(-0.3,0,0),colors.green,0.025));
frob.add(grid.getBentRod(o6[1],o6[2],new Vector3(-0.3,0,0),colors.green,0.025));
frob.add(grid.getBentRod(o6[2],o6[0],new Vector3(0.3,0,0),colors.green,0.025));





//orbit7
const o7 = [[1,-1,0],[1,0,-1],[1,1,0]];
frob.add(grid.getRod(o7[0],o7[1],colors.green,0.025));
frob.add(grid.getRod(o7[1],o7[2],colors.green,0.025));
frob.add(grid.getBentRod(o7[2],o7[0],new Vector3(0,0,-0.3),colors.green,0.025));


//orbit8
const o8 = [[-1,1,0],[-1,0,1],[-1,-1,0]];
frob.add(grid.getRod(o8[0],o8[1],colors.green,0.025));
frob.add(grid.getRod(o8[1],o8[2],colors.green,0.025));
frob.add(grid.getBentRod(o8[2],o8[0],new Vector3(0,0,0.3),colors.green,0.025));









//--------------------------------------------------------------
//-------------THE DEFAULT STUFF--------------------------------
//--------------------------------------------------------------


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

// const backWall = new Mesh(
//     new BoxGeometry( 100, 100, 0.1 ),
//     new MeshPhysicalMaterial({
//     }),
// );
// backWall.position.set(0,4,31);
// scene.add(backWall);


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
camera.position.set( 1, 2.2, - 5 );
camera.lookAt( 0, 0, 0 );


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

