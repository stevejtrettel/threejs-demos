import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { saveAs } from 'file-saver';

/**
 * ExportManager
 * 
 * Handles exporting 3D geometry to various formats.
 */
export class ExportManager {
    private scene: THREE.Scene;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    /**
     * Export object or scene to GLTF/GLB
     */
    exportGLTF(object: THREE.Object3D = this.scene, filename: string = 'scene.glb'): void {
        const exporter = new GLTFExporter();

        exporter.parse(
            object,
            (result) => {
                if (result instanceof ArrayBuffer) {
                    saveAs(new Blob([result], { type: 'application/octet-stream' }), filename);
                } else {
                    const output = JSON.stringify(result, null, 2);
                    saveAs(new Blob([output], { type: 'text/plain' }), filename);
                }
            },
            (error) => {
                console.error('An error happened during GLTF export:', error);
            },
            { binary: filename.endsWith('.glb') }
        );
    }

    /**
     * Export object or scene to OBJ
     */
    exportOBJ(object: THREE.Object3D = this.scene, filename: string = 'scene.obj'): void {
        const exporter = new OBJExporter();
        const result = exporter.parse(object);
        saveAs(new Blob([result], { type: 'text/plain' }), filename);
    }

    /**
     * Export object or scene to STL (binary)
     * Useful for 3D printing
     */
    exportSTL(object: THREE.Object3D = this.scene, filename: string = 'scene.stl'): void {
        const exporter = new STLExporter();
        const result = exporter.parse(object, { binary: true });
        saveAs(new Blob([result], { type: 'application/octet-stream' }), filename);
    }

    dispose(): void {
        // Nothing to dispose
    }
}
