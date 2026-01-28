/**
 * OBJSurfaceDoubleSide
 *
 * OBJ renderer with independent front and back face colors.
 * Uses separate geometry with reversed winding for back faces,
 * making it compatible with path tracers.
 *
 * For single-color faces, use OBJSurface instead.
 * For full mesh structure (vertices, edges), use OBJStructure.
 */

import * as THREE from 'three';
import { parseGroupedOBJ, type GroupedMesh, type GroupedFace } from './parseOBJ';

export interface FaceColors {
    front: string;
    back: string;
}

export interface OBJSurfaceDoubleSideOptions {
    // Colors per group (group name -> front/back colors)
    groupColors?: Record<string, FaceColors>;
    defaultColors?: FaceColors;

    // Material properties
    roughness?: number;
    metalness?: number;
    clearcoat?: number;
}

const DEFAULT_OPTIONS: Required<Omit<OBJSurfaceDoubleSideOptions, 'groupColors'>> & { groupColors: Record<string, FaceColors> } = {
    defaultColors: { front: '#ddaa77', back: '#b8895f' },
    groupColors: {
        '1': { front: '#ffe9ad', back: '#d4c48a' },
        '-1': { front: '#add8e6', back: '#8ab8c6' },
    },
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 0.1,
};

export class OBJSurfaceDoubleSide extends THREE.Group {
    private readonly sourceData: GroupedMesh;
    private readonly processedVertices: THREE.Vector3[];

    // Materials keyed by "groupName-front" or "groupName-back"
    private readonly faceMaterials: Map<string, THREE.MeshPhysicalMaterial> = new Map();

    // Settings
    private _groupColors: Record<string, FaceColors>;
    private _defaultColors: FaceColors;
    private readonly _roughness: number;
    private readonly _metalness: number;
    private readonly _clearcoat: number;

    constructor(mesh: GroupedMesh, options: OBJSurfaceDoubleSideOptions = {}) {
        super();

        const opts = { ...DEFAULT_OPTIONS, ...options };

        this.sourceData = mesh;
        this._groupColors = { ...DEFAULT_OPTIONS.groupColors, ...opts.groupColors };
        this._defaultColors = opts.defaultColors;
        this._roughness = opts.roughness;
        this._metalness = opts.metalness;
        this._clearcoat = opts.clearcoat;

        // Center and scale vertices
        this.processedVertices = this.centerAndScaleVertices(mesh.vertices);

        // Build face meshes
        this.buildFaces();
    }

    /**
     * Create from OBJ string
     */
    static fromOBJ(objString: string, options?: OBJSurfaceDoubleSideOptions): OBJSurfaceDoubleSide {
        return new OBJSurfaceDoubleSide(parseGroupedOBJ(objString), options);
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
     * Set color for a group's front or back face
     */
    setGroupColor(group: string, side: 'front' | 'back', color: string): void {
        if (!this._groupColors[group]) {
            this._groupColors[group] = { ...this._defaultColors };
        }
        this._groupColors[group][side] = color;

        const key = `${group}-${side}`;
        const material = this.faceMaterials.get(key);
        if (material) {
            material.color.set(color);
        }
    }

    /**
     * Get color for a group's front or back face
     */
    getGroupColor(group: string, side: 'front' | 'back'): string {
        return this._groupColors[group]?.[side] ?? this._defaultColors[side];
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
        this.faceMaterials.clear();
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
            const colors = this._groupColors[groupName] ?? this._defaultColors;
            const { group, frontMaterial, backMaterial } = this.buildGroupMesh(
                faces,
                colors.front,
                colors.back
            );
            group.name = `group-${groupName}`;
            this.add(group);
            this.faceMaterials.set(`${groupName}-front`, frontMaterial);
            this.faceMaterials.set(`${groupName}-back`, backMaterial);
        }
    }

    private buildGroupMesh(
        faces: GroupedFace[],
        frontColor: string,
        backColor: string
    ): { group: THREE.Group; frontMaterial: THREE.MeshPhysicalMaterial; backMaterial: THREE.MeshPhysicalMaterial } {
        const frontPositions: number[] = [];
        const backPositions: number[] = [];

        for (const face of faces) {
            const indices = face.indices;
            // Fan triangulation
            for (let i = 1; i < indices.length - 1; i++) {
                const v0 = this.processedVertices[indices[0]];
                const v1 = this.processedVertices[indices[i]];
                const v2 = this.processedVertices[indices[i + 1]];

                // Front faces - normal winding
                frontPositions.push(v0.x, v0.y, v0.z);
                frontPositions.push(v1.x, v1.y, v1.z);
                frontPositions.push(v2.x, v2.y, v2.z);

                // Back faces - reversed winding for opposite normals
                backPositions.push(v0.x, v0.y, v0.z);
                backPositions.push(v2.x, v2.y, v2.z);
                backPositions.push(v1.x, v1.y, v1.z);
            }
        }

        // Front geometry
        const frontGeometry = new THREE.BufferGeometry();
        frontGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(frontPositions), 3));
        frontGeometry.computeVertexNormals();

        // Back geometry
        const backGeometry = new THREE.BufferGeometry();
        backGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(backPositions), 3));
        backGeometry.computeVertexNormals();

        // Offset back geometry slightly inward to avoid z-fighting in path tracer
        const backPosAttr = backGeometry.attributes.position as THREE.BufferAttribute;
        const backNormAttr = backGeometry.attributes.normal as THREE.BufferAttribute;
        const offset = 0.001;
        for (let i = 0; i < backPosAttr.count; i++) {
            backPosAttr.setX(i, backPosAttr.getX(i) + backNormAttr.getX(i) * offset);
            backPosAttr.setY(i, backPosAttr.getY(i) + backNormAttr.getY(i) * offset);
            backPosAttr.setZ(i, backPosAttr.getZ(i) + backNormAttr.getZ(i) * offset);
        }
        backPosAttr.needsUpdate = true;

        // Materials (both FrontSide since back geometry has reversed winding)
        const frontMaterial = new THREE.MeshPhysicalMaterial({
            color: frontColor,
            side: THREE.FrontSide,
            roughness: this._roughness,
            metalness: this._metalness,
            clearcoat: this._clearcoat,
        });

        const backMaterial = new THREE.MeshPhysicalMaterial({
            color: backColor,
            side: THREE.FrontSide,
            roughness: this._roughness,
            metalness: this._metalness,
            clearcoat: this._clearcoat,
        });

        // Create meshes
        const group = new THREE.Group();

        const frontMesh = new THREE.Mesh(frontGeometry, frontMaterial);
        frontMesh.name = 'front';
        frontMesh.frustumCulled = false;

        const backMesh = new THREE.Mesh(backGeometry, backMaterial);
        backMesh.name = 'back';
        backMesh.frustumCulled = false;

        group.add(frontMesh);
        group.add(backMesh);

        return { group, frontMaterial, backMaterial };
    }
}