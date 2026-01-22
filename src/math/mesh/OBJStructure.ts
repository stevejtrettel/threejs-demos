/**
 * OBJStructure
 *
 * Full mesh structure visualization with:
 * - Front/back face meshes (path tracer compatible)
 * - Per-group face coloring (front and back independently)
 * - Vertex spheres
 * - Edge tubes
 *
 * For simple surface rendering without structure, use OBJSurface instead.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { parseGroupedOBJ, extractEdges, type GroupedMesh, type GroupedFace } from './parseOBJ';

export interface OBJStructureOptions {
    // Visibility
    showFaces?: boolean;
    showVertices?: boolean;
    showEdges?: boolean;

    // Sizes
    sphereRadius?: number;
    tubeRadius?: number;

    // Colors
    vertexColor?: string;
    edgeColor?: string;
    defaultFaceColors?: { front: string; back: string };
    faceColors?: Record<string, { front: string; back: string }>;

    // Material properties (applied to face materials)
    roughness?: number;
    metalness?: number;
    clearcoat?: number;
}

const DEFAULT_OPTIONS: Required<Omit<OBJStructureOptions, 'faceColors'>> & { faceColors: Record<string, { front: string; back: string }> } = {
    showFaces: true,
    showVertices: true,
    showEdges: true,
    sphereRadius: 0.06,
    tubeRadius: 0.025,
    vertexColor: '#1a1a1a',
    edgeColor: '#4488cc',
    defaultFaceColors: { front: '#ddaa77', back: '#b8895f' },
    faceColors: {
        '1': { front: '#ffe9ad', back: '#d4c48a' },
        '-1': { front: '#add8e6', back: '#8ab8c6' },
    },
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 0.1,
};

export class OBJStructure extends THREE.Group {
    // Source data
    private readonly sourceData: GroupedMesh;
    private readonly processedVertices: THREE.Vector3[];

    // Child groups
    private facesGroup: THREE.Group;
    private verticesMesh: THREE.Mesh | null = null;
    private edgesMesh: THREE.Mesh | null = null;

    // Materials for color updates
    private faceMaterials: Map<string, THREE.MeshPhysicalMaterial> = new Map();
    private vertexMaterial: THREE.MeshPhysicalMaterial | null = null;
    private edgeMaterial: THREE.MeshPhysicalMaterial | null = null;

    // Current settings
    private _sphereRadius: number;
    private _tubeRadius: number;
    private _vertexColor: string;
    private _edgeColor: string;
    private _faceColors: Record<string, { front: string; back: string }>;
    private _defaultFaceColors: { front: string; back: string };
    private _roughness: number;
    private _metalness: number;
    private _clearcoat: number;

    // Visibility state
    private _showFaces: boolean;
    private _showVertices: boolean;
    private _showEdges: boolean;

    /**
     * Create an OBJStructure from parsed OBJ data
     */
    constructor(mesh: GroupedMesh, options: OBJStructureOptions = {}) {
        super();

        const opts = { ...DEFAULT_OPTIONS, ...options };

        this.sourceData = mesh;
        this._sphereRadius = opts.sphereRadius;
        this._tubeRadius = opts.tubeRadius;
        this._vertexColor = opts.vertexColor;
        this._edgeColor = opts.edgeColor;
        this._defaultFaceColors = opts.defaultFaceColors;
        this._faceColors = { ...DEFAULT_OPTIONS.faceColors, ...opts.faceColors };
        this._roughness = opts.roughness;
        this._metalness = opts.metalness;
        this._clearcoat = opts.clearcoat;
        this._showFaces = opts.showFaces;
        this._showVertices = opts.showVertices;
        this._showEdges = opts.showEdges;

        // Process vertices (center and normalize to unit scale)
        this.processedVertices = this.centerAndScaleVertices(mesh.vertices);

        // Create child groups
        this.facesGroup = new THREE.Group();
        this.facesGroup.name = 'faces';
        this.add(this.facesGroup);

        // Build all geometry
        this.buildFaces();
        this.buildVertices();
        this.buildEdges();
    }

    /**
     * Create an OBJStructure from an OBJ string
     */
    static fromOBJ(objString: string, options?: OBJStructureOptions): OBJStructure {
        const mesh = parseGroupedOBJ(objString);
        return new OBJStructure(mesh, options);
    }

    // ===================================
    // PUBLIC API - Info
    // ===================================

    /** List of face group names from the OBJ */
    get groups(): string[] {
        const groups = new Set<string>();
        for (const face of this.sourceData.faces) {
            groups.add(face.group ?? 'default');
        }
        return Array.from(groups);
    }

    /** Number of vertices */
    get vertexCount(): number {
        return this.sourceData.vertices.length;
    }

    /** Number of faces */
    get faceCount(): number {
        return this.sourceData.faces.length;
    }

    // ===================================
    // PUBLIC API - Visibility
    // ===================================

    setFacesVisible(visible: boolean): void {
        this._showFaces = visible;
        this.facesGroup.visible = visible;
    }

    setVerticesVisible(visible: boolean): void {
        this._showVertices = visible;
        if (this.verticesMesh) {
            this.verticesMesh.visible = visible;
        }
    }

    setEdgesVisible(visible: boolean): void {
        this._showEdges = visible;
        if (this.edgesMesh) {
            this.edgesMesh.visible = visible;
        }
    }

    get facesVisible(): boolean { return this._showFaces; }
    get verticesVisible(): boolean { return this._showVertices; }
    get edgesVisible(): boolean { return this._showEdges; }

    // ===================================
    // PUBLIC API - Face Colors
    // ===================================

    setFaceColor(group: string, side: 'front' | 'back', color: string): void {
        // Update stored color
        if (!this._faceColors[group]) {
            this._faceColors[group] = { ...this._defaultFaceColors };
        }
        this._faceColors[group][side] = color;

        // Update material
        const key = `${group}-${side}`;
        const material = this.faceMaterials.get(key);
        if (material) {
            material.color.set(color);
        }
    }

    getFaceColor(group: string, side: 'front' | 'back'): string {
        return this._faceColors[group]?.[side] ?? this._defaultFaceColors[side];
    }

    // ===================================
    // PUBLIC API - Vertex/Edge Colors
    // ===================================

    setVertexColor(color: string): void {
        this._vertexColor = color;
        if (this.vertexMaterial) {
            this.vertexMaterial.color.set(color);
        }
    }

    setEdgeColor(color: string): void {
        this._edgeColor = color;
        if (this.edgeMaterial) {
            this.edgeMaterial.color.set(color);
        }
    }

    get vertexColor(): string { return this._vertexColor; }
    get edgeColor(): string { return this._edgeColor; }

    // ===================================
    // PUBLIC API - Sizes (triggers rebuild)
    // ===================================

    setSphereRadius(radius: number): void {
        if (radius !== this._sphereRadius) {
            this._sphereRadius = radius;
            this.rebuildVertices();
        }
    }

    setTubeRadius(radius: number): void {
        if (radius !== this._tubeRadius) {
            this._tubeRadius = radius;
            this.rebuildEdges();
        }
    }

    get sphereRadius(): number { return this._sphereRadius; }
    get tubeRadius(): number { return this._tubeRadius; }

    // ===================================
    // PUBLIC API - Cleanup
    // ===================================

    dispose(): void {
        // Dispose face geometries and materials
        this.facesGroup.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                if (obj.material instanceof THREE.Material) {
                    obj.material.dispose();
                }
            }
        });

        // Dispose vertex mesh
        if (this.verticesMesh) {
            this.verticesMesh.geometry.dispose();
            this.vertexMaterial?.dispose();
        }

        // Dispose edge mesh
        if (this.edgesMesh) {
            this.edgesMesh.geometry.dispose();
            this.edgeMaterial?.dispose();
        }

        // Clear references
        this.faceMaterials.clear();
        this.vertexMaterial = null;
        this.edgeMaterial = null;
    }

    // ===================================
    // PRIVATE - Vertex Processing
    // ===================================

    private centerAndScaleVertices(vertices: THREE.Vector3[]): THREE.Vector3[] {
        // Compute bounds
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

    // ===================================
    // PRIVATE - Face Building
    // ===================================

    private buildFaces(): void {
        if (this.sourceData.faces.length === 0) return;

        // Group faces by their group name
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
            const colors = this._faceColors[groupName] ?? this._defaultFaceColors;
            const { group, frontMaterial, backMaterial } = this.buildFaceGroupMesh(
                faces, colors.front, colors.back
            );
            group.name = `group-${groupName}`;
            this.facesGroup.add(group);
            this.faceMaterials.set(`${groupName}-front`, frontMaterial);
            this.faceMaterials.set(`${groupName}-back`, backMaterial);
        }

        this.facesGroup.visible = this._showFaces;
    }

    private buildFaceGroupMesh(
        faces: GroupedFace[],
        frontColor: string,
        backColor: string
    ): { group: THREE.Group; frontMaterial: THREE.MeshPhysicalMaterial; backMaterial: THREE.MeshPhysicalMaterial } {
        const frontPositions: number[] = [];
        const backPositions: number[] = [];

        for (const face of faces) {
            const indices = face.indices;
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

        const frontGeometry = new THREE.BufferGeometry();
        frontGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(frontPositions), 3));
        frontGeometry.computeVertexNormals();

        const backGeometry = new THREE.BufferGeometry();
        backGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(backPositions), 3));
        backGeometry.computeVertexNormals();

        // Offset back geometry slightly inward to avoid coincident surfaces in path tracer
        const backPosAttr = backGeometry.attributes.position as THREE.BufferAttribute;
        const backNormAttr = backGeometry.attributes.normal as THREE.BufferAttribute;
        const offset = 0.001;
        for (let i = 0; i < backPosAttr.count; i++) {
            backPosAttr.setX(i, backPosAttr.getX(i) + backNormAttr.getX(i) * offset);
            backPosAttr.setY(i, backPosAttr.getY(i) + backNormAttr.getY(i) * offset);
            backPosAttr.setZ(i, backPosAttr.getZ(i) + backNormAttr.getZ(i) * offset);
        }
        backPosAttr.needsUpdate = true;

        // Create materials (both FrontSide - back geometry has reversed winding)
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

        const group = new THREE.Group();
        const frontMesh = new THREE.Mesh(frontGeometry, frontMaterial);
        const backMesh = new THREE.Mesh(backGeometry, backMaterial);
        frontMesh.name = 'front';
        backMesh.name = 'back';
        frontMesh.frustumCulled = false;
        backMesh.frustumCulled = false;
        group.add(frontMesh);
        group.add(backMesh);

        return { group, frontMaterial, backMaterial };
    }

    // ===================================
    // PRIVATE - Vertex Sphere Building
    // ===================================

    private buildVertices(): void {
        if (this.processedVertices.length === 0) return;

        const template = new THREE.SphereGeometry(this._sphereRadius, 12, 12);
        const geometries: THREE.BufferGeometry[] = [];
        const matrix = new THREE.Matrix4();

        for (const v of this.processedVertices) {
            const geo = template.clone();
            matrix.makeTranslation(v.x, v.y, v.z);
            geo.applyMatrix4(matrix);
            geometries.push(geo);
        }

        const merged = mergeGeometries(geometries, false);
        template.dispose();
        geometries.forEach(g => g.dispose());

        this.vertexMaterial = new THREE.MeshPhysicalMaterial({
            color: this._vertexColor,
            roughness: 0.3,
            metalness: 0.1,
            clearcoat: 0.3,
        });

        this.verticesMesh = new THREE.Mesh(merged, this.vertexMaterial);
        this.verticesMesh.name = 'vertices';
        this.verticesMesh.frustumCulled = false;
        this.verticesMesh.visible = this._showVertices;
        this.add(this.verticesMesh);
    }

    private rebuildVertices(): void {
        // Dispose old
        if (this.verticesMesh) {
            this.remove(this.verticesMesh);
            this.verticesMesh.geometry.dispose();
            this.vertexMaterial?.dispose();
            this.verticesMesh = null;
            this.vertexMaterial = null;
        }
        // Build new
        this.buildVertices();
    }

    // ===================================
    // PRIVATE - Edge Tube Building
    // ===================================

    private buildEdges(): void {
        if (this.sourceData.faces.length === 0) return;

        const edges = extractEdges(this.sourceData.faces);
        if (edges.length === 0) return;

        const template = new THREE.CylinderGeometry(this._tubeRadius, this._tubeRadius, 1, 8, 1);
        const geometries: THREE.BufferGeometry[] = [];
        const matrix = new THREE.Matrix4();
        const start = new THREE.Vector3();
        const end = new THREE.Vector3();
        const mid = new THREE.Vector3();
        const dir = new THREE.Vector3();
        const quat = new THREE.Quaternion();
        const scale = new THREE.Vector3(1, 1, 1);
        const up = new THREE.Vector3(0, 1, 0);

        for (const [a, b] of edges) {
            start.copy(this.processedVertices[a]);
            end.copy(this.processedVertices[b]);
            mid.addVectors(start, end).multiplyScalar(0.5);
            dir.subVectors(end, start);
            const length = dir.length();
            dir.normalize();
            quat.setFromUnitVectors(up, dir);
            scale.set(1, length, 1);
            matrix.compose(mid, quat, scale);

            const geo = template.clone();
            geo.applyMatrix4(matrix);
            geometries.push(geo);
        }

        const merged = mergeGeometries(geometries, false);
        template.dispose();
        geometries.forEach(g => g.dispose());

        this.edgeMaterial = new THREE.MeshPhysicalMaterial({
            color: this._edgeColor,
            roughness: 0.4,
            metalness: 0.2,
            clearcoat: 0.5,
        });

        this.edgesMesh = new THREE.Mesh(merged, this.edgeMaterial);
        this.edgesMesh.name = 'edges';
        this.edgesMesh.frustumCulled = false;
        this.edgesMesh.visible = this._showEdges;
        this.add(this.edgesMesh);
    }

    private rebuildEdges(): void {
        // Dispose old
        if (this.edgesMesh) {
            this.remove(this.edgesMesh);
            this.edgesMesh.geometry.dispose();
            this.edgeMaterial?.dispose();
            this.edgesMesh = null;
            this.edgeMaterial = null;
        }
        // Build new
        this.buildEdges();
    }
}
