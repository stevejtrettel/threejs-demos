import { App } from '@/app/App';
import { Params } from '@/Params';
import { Panel } from '@/ui/containers/Panel';
import { Folder } from '@/ui/containers/Folder';
import { Slider } from '@/ui/inputs/Slider';
import { ColorInput } from '@/ui/inputs/ColorInput';
import { Toggle } from '@/ui/inputs/Toggle';
import '@/ui/styles/index.css';
import * as THREE from 'three';

// Simple rotating cube with parameters
class ParametricCube {
    mesh: THREE.Mesh;
    params: Params;
    size: number = 1;
    speed: number = 1;
    color: string = '#4da6ff';
    wireframe: boolean = false;

    constructor() {
        // Create Params instance and define reactive parameters
        this.params = new Params(this);
        this.params.define('size', 1, { min: 0.1, max: 5, step: 0.1 });
        this.params.define('speed', 1, { min: 0, max: 5, step: 0.1 });
        this.params.define('color', '#4da6ff', { type: 'color' });
        this.params.define('wireframe', false, { type: 'boolean', triggers: 'rebuild' });

        // Create mesh
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({
            color: this.color,
            wireframe: this.wireframe
        });
        this.mesh = new THREE.Mesh(geometry, material);

        // Apply initial size
        this.mesh.scale.setScalar(this.size);
    }

    animate(_time: number, delta: number): void {
        // Rotate based on speed parameter
        this.mesh.rotation.y += delta * this.speed;
        this.mesh.rotation.x += delta * this.speed * 0.5;
    }

    rebuild(): void {
        // Update mesh when params change
        this.mesh.scale.setScalar(this.size);
        (this.mesh.material as THREE.MeshStandardMaterial).color.set(this.color);
        (this.mesh.material as THREE.MeshStandardMaterial).wireframe = this.wireframe;
    }
}

// Setup
const app = new App({
    debug: true,
    antialias: true
});

// Add lights
app.lights.set('three-point');

// Create the parametric cube
const cube = new ParametricCube();

// Add cube to app and expose its parameters to the UI
app.add(cube, {
    params: true  // Expose all parameters
});

// Position camera
app.camera.position.set(0, 2, 5);
app.camera.lookAt(0, 0, 0);

// Create manual UI (simpler than full ControlRoom for demo)
const panel = new Panel('Controls');
const sceneFolder = new Folder('Cube Settings');

sceneFolder.add(new Slider(cube.size, {
    min: 0.1,
    max: 5,
    step: 0.1,
    label: 'Size',
    onChange: (v) => {
        cube.size = v;
        cube.rebuild();
    }
}));

sceneFolder.add(new Slider(cube.speed, {
    min: 0,
    max: 5,
    step: 0.1,
    label: 'Speed',
    onChange: (v) => cube.speed = v
}));

sceneFolder.add(new ColorInput(cube.color, {
    label: 'Color',
    onChange: (v) => {
        cube.color = v;
        cube.rebuild();
    }
}));

sceneFolder.add(new Toggle(cube.wireframe, {
    label: 'Wireframe',
    onChange: (v) => {
        cube.wireframe = v;
        cube.rebuild();
    }
}));

panel.add(sceneFolder);
panel.mount(document.body);

// Start the animation
app.start();
