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
    Vector3, Group, SphereGeometry, FloatType, DoubleSide,
} from "three";

import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import {
    GradientEquirectTexture,
    WebGLPathTracer,
    ShapedAreaLight, PhysicalSpotLight,PhysicalCamera,
} from 'three-gpu-pathtracer';

import {GUI} from "three/examples/jsm/libs/lil-gui.module.min.js";



// init scene and objects, and lights
//--------------------------------------------

const scene = new Scene();


//make the glass ball representing a point

let sphGeom = new SphereGeometry(0.25);
let sphMat = new MeshPhysicalMaterial({
    color : 0xc9eaff,
        //0x8fd0ff,
    transparent:true,
    clearcoat:1,
    opacity:1,
    transmission:0.9,
    ior:1.5,
    thickness:1,
    roughness:0.2,
});
let sphMesh = new Mesh(sphGeom, sphMat);


let toTorus = function(pt){

    //takes in a point [i,j] in F5xF5, maps to torus
    let u = 2.*Math.PI * pt[0]/5;
    let v = 2.*Math.PI * pt[1]/5;

    let a = 1;
    let b =2;
    let r = a*Math.cos(u)+b;
    let x = r*Math.cos(v);
    let y = r*Math.sin(v);
    let z = Math.sin(u);

    return new Vector3(x,-z,y);
}

// add the actual points of the elliptic curve!
let elliptic = new Group();
scene.add(elliptic);

let solGeom = new SphereGeometry(0.3);
let solMat = new MeshPhysicalMaterial({
    color : 0xe03d24,
    transparent:true,
    clearcoat:1,
    opacity:1,
    transmission:0.9,
    ior:1.5,
    thickness:1,
    roughness:0.2,
})
let solPt = new Mesh(solGeom, solMat);
let solutions = [
    [0,0],[1,2],[1,-2],[2,2],[2,-2],[-2,1],[-2,-1],[-1,1],[-1,-1]
];

for(let i=0;i<solutions.length;i++){
     let sol = solPt.clone();
     let p = toTorus(solutions[i]);
     sol.position.set(p.x,p.y,p.z);
     elliptic.add(sol);
}

//finally add the point at infinity
let inf = solPt.clone();
inf.position.set(5,0,0);
elliptic.add(inf);




//add the background of points, so long as they are NOT solutions

//check if the point is a solution
let isSol = function(pt){
    for(let i=0;i<solutions.length;i++){
        if(pt[0]==solutions[i][0]&&pt[1]==solutions[i][1]){
            return true;
        }
    }
    return false;
}

let f5xf5 = new Group();
scene.add(f5xf5);

for(let i=-2; i<3; i++){
    for(let j = -2; j<3; j++){

        if(!isSol([i,j])) {
            let sph = sphMesh.clone();
            let p = toTorus([i,j]);
            sph.position.set(p.x,p.y,p.z);
            f5xf5.add(sph);
        }
    }
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

