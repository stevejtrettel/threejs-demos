/**
 * components.js - Primitive visualization components
 *
 * Building blocks for mesh visualization:
 *   - VertexView: instanced spheres at vertex positions
 *   - EdgeView: instanced cylinders along edges
 *   - FaceView: triangulated surface mesh
 *
 * These can be composed into higher-level views like MeshView.
 */

import {
    BufferGeometry,
    BufferAttribute,
    DynamicDrawUsage,
    Group,
    Mesh,
    MeshPhysicalMaterial,
    MeshStandardMaterial,
    DoubleSide,
    SphereGeometry,
    CylinderGeometry,
    InstancedMesh,
    Matrix4,
    Vector3,
    Quaternion,
    Color
} from 'three';

// ============================================================================
// Color Utilities
// ============================================================================

/**
 * Map a value to a green→red color scale
 * @param {number} x - value (0 = green, larger = more red)
 * @param {number} sigma - sensitivity (typical scale of values)
 */
export function strainColor(x, sigma = 0.1) {
    const a = Math.abs(x) / Math.max(1e-12, sigma);

    // Soft mapping [0,∞) → [0,1]
    let t = 1 - Math.exp(-Math.pow(a, 1.3));
    t = Math.min(1, Math.max(0, t));

    // Hue: green (1/3) → red (0)
    const hue = (1 / 3) * (1 - t);

    const color = new Color();
    color.setHSL(hue, 0.95, 0.5);
    return color;
}

// ============================================================================
// Vertex View (instanced spheres)
// ============================================================================

export class VertexView extends InstancedMesh {
    /**
     * @param {Vertex[]} vertices - array of vertices with .idx
     * @param {Float32Array} pos - position buffer (xyz xyz ...)
     * @param {Object} options
     */
    constructor(vertices, pos, options = {}) {
        const { radius = 0.04, color = 0x000000 } = options;

        super(
            new SphereGeometry(radius, 8, 8),
            new MeshStandardMaterial({ color }),
            vertices.length
        );

        this.pos = pos;
        this.ids = vertices.map(v => v.idx);
        this._M = new Matrix4();

        // Initialize
        for (let i = 0; i < vertices.length; i++) {
            this.setMatrixAt(i, this._M);
        }

        this.sync();
    }

    sync() {
        const pos = this.pos;
        const M = this._M;

        for (let i = 0; i < this.ids.length; i++) {
            const base = 3 * this.ids[i];
            M.makeTranslation(pos[base], pos[base + 1], pos[base + 2]);
            this.setMatrixAt(i, M);
        }

        this.instanceMatrix.needsUpdate = true;
    }
}

// ============================================================================
// Edge View (instanced cylinders)
// ============================================================================

const AXIS_Z = new Vector3(0, 0, 1);

export class EdgeView extends InstancedMesh {
    /**
     * @param {Edge[]} edges - array of edges with .origin.idx and .next.origin.idx
     * @param {Float32Array} pos - position buffer
     * @param {Object} options
     */
    constructor(edges, pos, options = {}) {
        const { radius = 0.02, color = 0x456abc } = options;

        const geom = new CylinderGeometry(radius, radius, 1, 6, 1, true);
        geom.rotateX(Math.PI / 2);  // align along Z

        const mat = new MeshPhysicalMaterial({ color, clearcoat: 1 });

        super(geom, mat, edges.length);

        this.pos = pos;
        this.pairs = edges.map(e => [e.origin.idx, e.next.origin.idx]);

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
        for (let i = 0; i < edges.length; i++) {
            this.setMatrixAt(i, I);
        }

        this.sync();
    }

    sync() {
        const pos = this.pos;
        const { _start, _end, _mid, _dir, _quat, _scale, _mat } = this;

        for (let k = 0; k < this.pairs.length; k++) {
            const [i, j] = this.pairs[k];
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
        }

        this.instanceMatrix.needsUpdate = true;
    }
}

// ============================================================================
// Face View (triangulated mesh)
// ============================================================================

export class FaceView extends Mesh {
    /**
     * @param {Face[]} faces - array of faces with .vertices array
     * @param {Float32Array} pos - position buffer
     * @param {Object} options
     */
    constructor(faces, pos, options = {}) {
        super();

        const {
            color = 0xffffff,
            opacity = 0.9,
            transmission = 0.3
        } = options;

        this.pos = pos;

        // Build triangle indices (fan triangulation)
        const indices = this._buildIndices(faces);

        // Material
        this.material = new MeshPhysicalMaterial({
            color,
            clearcoat: 1,
            side: DoubleSide,
            transparent: true,
            opacity,
            transmission,
            ior: 1.1
        });

        // Geometry
        this.geometry = new BufferGeometry();
        this.geometry.setAttribute(
            'position',
            new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage)
        );
        this.geometry.setIndex(new BufferAttribute(indices, 1));
        this.geometry.computeVertexNormals();
        this.geometry.computeBoundingSphere();
    }

    _buildIndices(faces) {
        let triCount = 0;
        for (const f of faces) {
            triCount += f.vertices.length - 2;
        }

        const indices = new Uint32Array(3 * triCount);
        let k = 0;

        for (const face of faces) {
            const v = face.vertices;
            for (let i = 1; i < v.length - 1; i++) {
                indices[k++] = v[0].idx;
                indices[k++] = v[i].idx;
                indices[k++] = v[i + 1].idx;
            }
        }

        return indices;
    }

    sync() {
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.computeVertexNormals();
        this.geometry.computeBoundingSphere();
    }
}

// ============================================================================
// Grouped Face View (separate meshes per face.data value)
// ============================================================================

/**
 * Default colors for grouped faces.
 * Uses a pleasing palette that works well for alternating +1/-1 patterns.
 */
const DEFAULT_GROUP_COLORS = {
    1: 0xffe9ad,   // warm cream (original face color)
    [-1]: 0xadd8e6  // light blue
};

/**
 * Generate a color for a data value not in the color map.
 * Uses HSL to create distinct hues.
 */
function autoColor(dataValue, index) {
    const hue = (index * 0.618033988749895) % 1;  // golden ratio for good distribution
    const color = new Color();
    color.setHSL(hue, 0.7, 0.65);
    return color.getHex();
}

export class GroupedFaceView extends Group {
    /**
     * @param {Face[]} faces - array of faces with .vertices and .data
     * @param {Float32Array} pos - shared position buffer
     * @param {Object} options
     * @param {Object} options.colors - map of data value → hex color (e.g., { 1: 0xff0000, -1: 0x0000ff })
     * @param {number} options.opacity - material opacity (default 0.9)
     * @param {number} options.transmission - material transmission (default 0.3)
     */
    constructor(faces, pos, options = {}) {
        super();

        const {
            colors = DEFAULT_GROUP_COLORS,
            opacity = 0.9,
            transmission = 0.3
        } = options;

        this.pos = pos;
        this.meshes = new Map();  // dataValue → Mesh

        // Group faces by data value
        const groups = new Map();
        for (const face of faces) {
            const key = face.data ?? 'null';
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(face);
        }

        // Create a mesh for each group
        let colorIndex = 0;
        for (const [dataValue, groupFaces] of groups) {
            // Determine color
            let color = colors[dataValue];
            if (color === undefined) {
                color = autoColor(dataValue, colorIndex);
            }
            colorIndex++;

            // Build indices for this group
            const indices = this._buildIndices(groupFaces);

            // Create material
            const material = new MeshPhysicalMaterial({
                color,
                clearcoat: 1,
                side: DoubleSide,
                transparent: true,
                opacity,
                transmission,
                ior: 1.1
            });

            // Create geometry (shares position buffer)
            const geometry = new BufferGeometry();
            geometry.setAttribute(
                'position',
                new BufferAttribute(this.pos, 3).setUsage(DynamicDrawUsage)
            );
            geometry.setIndex(new BufferAttribute(indices, 1));
            geometry.computeVertexNormals();
            geometry.computeBoundingSphere();

            // Create mesh and add to group
            const mesh = new Mesh(geometry, material);
            mesh.userData.dataValue = dataValue;
            this.meshes.set(dataValue, mesh);
            this.add(mesh);
        }
    }

    _buildIndices(faces) {
        let triCount = 0;
        for (const f of faces) {
            triCount += f.vertices.length - 2;
        }

        const indices = new Uint32Array(3 * triCount);
        let k = 0;

        for (const face of faces) {
            const v = face.vertices;
            for (let i = 1; i < v.length - 1; i++) {
                indices[k++] = v[0].idx;
                indices[k++] = v[i].idx;
                indices[k++] = v[i + 1].idx;
            }
        }

        return indices;
    }

    /**
     * Update positions and recompute normals for all group meshes.
     */
    sync() {
        for (const mesh of this.meshes.values()) {
            mesh.geometry.attributes.position.needsUpdate = true;
            mesh.geometry.computeVertexNormals();
            mesh.geometry.computeBoundingSphere();
        }
    }

    /**
     * Set visibility for a specific data group.
     * @param {any} dataValue - the face.data value
     * @param {boolean} visible - whether to show this group
     */
    setGroupVisible(dataValue, visible) {
        const mesh = this.meshes.get(dataValue);
        if (mesh) {
            mesh.visible = visible;
        }
    }

    /**
     * Set color for a specific data group.
     * @param {any} dataValue - the face.data value
     * @param {number} color - hex color
     */
    setGroupColor(dataValue, color) {
        const mesh = this.meshes.get(dataValue);
        if (mesh) {
            mesh.material.color.setHex(color);
        }
    }

    /**
     * Get all data values present in this view.
     * @returns {any[]} array of data values
     */
    getDataValues() {
        return Array.from(this.meshes.keys());
    }
}

// ============================================================================
// Cylinder View (for springs - takes i,j pairs directly)
// ============================================================================

export class CylinderView extends InstancedMesh {
    /**
     * @param {Array} pairs - array of {i, j} or [i, j] pairs
     * @param {Float32Array} pos - position buffer
     * @param {Object} options
     */
    constructor(pairs, pos, options = {}) {
        const { radius = 0.02, color = 0xffffff } = options;

        const geom = new CylinderGeometry(radius, radius, 1, 6, 1, true);
        geom.rotateX(Math.PI / 2);

        const mat = new MeshStandardMaterial({ color });

        super(geom, mat, pairs.length);

        this.pos = pos;
        this.pairs = pairs.map(p => Array.isArray(p) ? p : [p.i, p.j]);

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
        for (let i = 0; i < pairs.length; i++) {
            this.setMatrixAt(i, I);
        }

        this.sync();
    }

    sync() {
        const pos = this.pos;
        const { _start, _end, _mid, _dir, _quat, _scale, _mat } = this;

        for (let k = 0; k < this.pairs.length; k++) {
            const [i, j] = this.pairs[k];
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
        }

        this.instanceMatrix.needsUpdate = true;
    }
}
