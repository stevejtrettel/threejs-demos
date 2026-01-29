/**
 * MeshView.js - Visualization of a mesh embedding
 *
 * Combines VertexView, EdgeView, and FaceView from components.
 * Call sync() to update after the embedding changes.
 */

import { Group } from 'three';
import { VertexView, EdgeView, FaceView, GroupedFaceView } from './components.js';

export default class MeshView extends Group {
    /**
     * @param {Embedding} embedding - the embedding to visualize
     * @param {Object} options - display options
     * @param {boolean} options.groupFacesByData - if true, use GroupedFaceView to color faces by face.data
     * @param {Object} options.faceColors - color map for grouped faces (e.g., { 1: 0xff0000, -1: 0x0000ff })
     */
    constructor(embedding, options = {}) {
        super();

        const {
            vertexColor = 0x000000,
            edgeColor = 0x456abc,
            faceColor = 0xffe9ad,
            vertexRadius = 0.04,
            edgeRadius = 0.02,
            showVertices = true,
            showEdges = true,
            showFaces = true,
            groupFacesByData = false,
            faceColors = undefined
        } = options;

        this.embedding = embedding;
        const topology = embedding.topology;

        // Shared coordinate buffer
        this.coords = new Float32Array(3 * embedding.N);
        this._computeCoords();

        // Create sub-views using components
        if (showFaces) {
            if (groupFacesByData) {
                // Use GroupedFaceView for per-data coloring
                this.faces = new GroupedFaceView(topology.faces, this.coords, {
                    colors: faceColors
                });
            } else {
                // Use standard FaceView
                this.faces = new FaceView(topology.faces, this.coords, {
                    color: faceColor
                });
            }
            this.add(this.faces);
        }

        if (showEdges) {
            this.edges = new EdgeView(topology.uniqueEdges, this.coords, {
                color: edgeColor,
                radius: edgeRadius
            });
            this.add(this.edges);
        }

        if (showVertices) {
            this.vertices = new VertexView(topology.vertices, this.coords, {
                color: vertexColor,
                radius: vertexRadius
            });
            this.add(this.vertices);
        }
    }

    _computeCoords() {
        for (let i = 0; i < this.embedding.N; i++) {
            const c = this.embedding.coords(i);
            const a = 3 * i;
            this.coords[a] = c[0];
            this.coords[a + 1] = c[1];
            this.coords[a + 2] = c[2];
        }
    }

    /**
     * Update visualization after embedding changes
     */
    sync() {
        this._computeCoords();

        if (this.faces) this.faces.sync();
        if (this.edges) this.edges.sync();
        if (this.vertices) this.vertices.sync();
    }
}
