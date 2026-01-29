/**
 * SpringView.js - Visualize springs colored by strain
 *
 * Shows springs as cylinders colored by how close they are to rest length:
 *   - Green: at rest length
 *   - Red: stretched or compressed
 *
 * Useful for debugging and seeing where the surface is under stress.
 */

import {
    CylinderGeometry,
    MeshStandardMaterial,
    InstancedMesh,
    Vector3,
    Quaternion,
    Matrix4
} from 'three';

import { strainColor } from './components.js';

const AXIS_Z = new Vector3(0, 0, 1);

export default class SpringView extends InstancedMesh {
    /**
     * @param {Spring[]} springs - array of springs with {i, j, rest}
     * @param {Float32Array} pos - position buffer (xyz xyz ...)
     * @param {Object} options
     */
    constructor(springs, pos, options = {}) {
        const { radius = 0.03, sigma = 0.1 } = options;

        // Geometry: cylinder along Z
        const geom = new CylinderGeometry(radius, radius, 1, 6, 1, true);
        geom.rotateX(Math.PI / 2);

        // Material
        const mat = new MeshStandardMaterial({ color: 0xffffff });

        super(geom, mat, springs.length);

        // Store spring data
        console.log(springs);
        this.springs = springs.map(s => ({ i: s.i, j: s.j, rest: s.rest }));
        this.pos = pos;
        this.sigma = sigma;

        // Scratch objects
        this._start = new Vector3();
        this._end = new Vector3();
        this._mid = new Vector3();
        this._dir = new Vector3();
        this._quat = new Quaternion();
        this._scale = new Vector3(1, 1, 1);
        this._mat = new Matrix4();

        // Initialize
        const I = new Matrix4();
        for (let i = 0; i < springs.length; i++) {
            this.setMatrixAt(i, I);
        }

        this.sync();
    }

    sync() {
        const pos = this.pos;
        const { _start, _end, _mid, _dir, _quat, _scale, _mat } = this;

        for (let k = 0; k < this.springs.length; k++) {
            const { i, j, rest } = this.springs[k];
            const a = 3 * i, b = 3 * j;

            _start.set(pos[a], pos[a + 1], pos[a + 2]);
            _end.set(pos[b], pos[b + 1], pos[b + 2]);

            _dir.subVectors(_end, _start);
            const len = _dir.length();
            _mid.addVectors(_start, _end).multiplyScalar(0.5);

            _quat.setFromUnitVectors(AXIS_Z, _dir.normalize());
            _scale.z = len;
            _mat.compose(_mid, _quat, _scale);
            this.setMatrixAt(k, _mat);

            // Color by strain
            this.setColorAt(k, strainColor(len - rest, this.sigma));
        }

        this.instanceMatrix.needsUpdate = true;
        this.instanceColor.needsUpdate = true;
    }
}
