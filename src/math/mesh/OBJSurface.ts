/**
 * OBJSurface
 *
 * Simple OBJ renderer that displays faces with per-group coloring.
 * No vertices, no edges - just the surface.
 *
 * For full mesh structure visualization (vertices, edges, front/back faces),
 * use OBJStructure instead.
 */

import * as THREE from 'three';
import { parseGroupedOBJ, type GroupedMesh, type GroupedFace } from './parseOBJ';

export interface OBJSurfaceOptions {
    // Colors per group (group name -> color)
    groupColors?: Record<string, string>;
    defaultColor?: string;

    // Material properties
    roughness?: number;
    metalness?: number;
    clearcoat?: number;
    side?: THREE.Side;
}

const DEFAULT_OPTIONS = {
    defaultColor: '#ddaa77',
    groupColors: {
        '1': '#ffe9ad',
        '-1': '#add8e6',
    } as Record<string, string>,
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 0.1,
    side: THREE.DoubleSide,
};

export class OBJSurface extends THREE.Group {
    private readonly sourceData: GroupedMesh;
    private readonly processedVertices: THREE.Vector3[];

    // Materials keyed by group name
    private readonly groupMaterials: Map<string, THREE.MeshPhysicalMaterial> = new Map();

    // Settings
    private _groupColors: Record<string, string>;
    private _defaultColor: string;
    private readonly _roughness: number;
    private readonly _metalness: number;
    private readonly _clearcoat: number;
    private readonly _side: THREE.Side;

    constructor(mesh: GroupedMesh, options: OBJSurfaceOptions = {}) {
        super();

        const opts = { ...DEFAULT_OPTIONS, ...options };

        this.sourceData = mesh;
        this._groupColors = { ...DEFAULT_OPTIONS.groupColors, ...opts.groupColors };
        this._defaultColor = opts.defaultColor;
        this._roughness = opts.roughness;
        this._metalness = opts.metalness;
        this._clearcoat = opts.clearcoat;
        this._side = opts.side;

        // Center and scale vertices
        this.processedVertices = this.centerAndScaleVertices(mesh.vertices);

        // Build face meshes
        this.buildFaces();
    }

    /**
     * Create from OBJ string
     */
    static fromOBJ(objString: string, options?: OBJSurfaceOptions): OBJSurface {
        return new OBJSurface(parseGroupedOBJ(objString), options);
    }

    // ===================================
    // PUBLIC API
    // ===================================

    /** List of group names in the mesh */
    get groups(): string[] {
        const groups = new Set<string>();
        for (const face of this.sourceData.faces) {
            groups.add(face.group ?? 'default');
        }
        return Array.from(groups);
    }

    get vertexCount(): number {
        return this.sourceData.vertices.length;
    }

    get faceCount(): number {
        return this.sourceData.faces.length;
    }

    /**
     * Set color for a group
     */
    setGroupColor(group: string, color: string): void {
        this._groupColors[group] = color;
        const material = this.groupMaterials.get(group);
        if (material) {
            material.color.set(color);
        }
    }

    /**
     * Get color for a group
     */
    getGroupColor(group: string): string {
        return this._groupColors[group] ?? this._defaultColor;
    }

    /**
     * Dispose all geometries and materials
     */
    dispose(): void {
        this.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                if (obj.material instanceof THREE.Material) {
                    obj.material.dispose();
                }
            }
        });
        this.groupMaterials.clear();
    }

    // ===================================
    // PRIVATE
    // ===================================

    private centerAndScaleVertices(vertices: THREE.Vector3[]): THREE.Vector3[] {
        const min = new THREE.Vector3(Infinity, Infinity, Infinity);
        const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
        for (const v of vertices) {
            min.min(v);
            max.max(v);
        }

        const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
        const size = new THREE.Vector3().subVectors(max, min);
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = maxDim > 0 ? 2.0 / maxDim : 1.0;

        return vertices.map(v =>
            new THREE.Vector3(
                (v.x - center.x) * scale,
                (v.y - center.y) * scale,
                (v.z - center.z) * scale
            )
        );
    }

    private buildFaces(): void {
        if (this.sourceData.faces.length === 0) return;

        // Group faces by group name
        const facesByGroup = new Map<string, GroupedFace[]>();
        for (const face of this.sourceData.faces) {
            const key = face.group ?? 'default';
            if (!facesByGroup.has(key)) {
                facesByGroup.set(key, []);
            }
            facesByGroup.get(key)!.push(face);
        }

        // Build mesh for each group
        for (const [groupName, faces] of facesByGroup) {
            const color = this._groupColors[groupName] ?? this._defaultColor;
            const { mesh, material } = this.buildGroupMesh(faces, color);
            mesh.name = `group-${groupName}`;
            this.add(mesh);
            this.groupMaterials.set(groupName, material);
        }
    }

    private buildGroupMesh(
        faces: GroupedFace[],
        color: string
    ): { mesh: THREE.Mesh; material: THREE.MeshPhysicalMaterial } {
        const positions: number[] = [];

        for (const face of faces) {
            const indices = face.indices;
            // Fan triangulation
            for (let i = 1; i < indices.length - 1; i++) {
                const v0 = this.processedVertices[indices[0]];
                const v1 = this.processedVertices[indices[i]];
                const v2 = this.processedVertices[indices[i + 1]];
                positions.push(v0.x, v0.y, v0.z);
                positions.push(v1.x, v1.y, v1.z);
                positions.push(v2.x, v2.y, v2.z);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        geometry.computeVertexNormals();

        const material = new THREE.MeshPhysicalMaterial({
            color,
            side: this._side,
            roughness: this._roughness,
            metalness: this._metalness,
            clearcoat: this._clearcoat,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;

        return { mesh, material };
    }
}
