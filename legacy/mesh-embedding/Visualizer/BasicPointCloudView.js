import {
    SphereGeometry,
    BufferGeometry,
    BufferAttribute,
    MeshStandardMaterial,
    InstancedMesh,
    Vector3,
    Matrix4,
    Color,
    PointsMaterial,
    Points,
    Float32BufferAttribute
} from "three";


/**
 * Accepts both custom Vector3 (extending Array) and plain {x,y,z} objects
 * Internally uses Float32Array for maximum performance
 */
export default class PointCloudView extends InstancedMesh {
    constructor(points = [], config = {}) {
        // Configuration with defaults
        const defaultConfig = {
            color: 0x0066ff,
            size: 0.05,
            resolution: 8,
            metalness: 0.1,
            roughness: 0.8
        };
        
        const settings = { ...defaultConfig, ...config };
        
        // Create sphere geometry for each point
        const geometry = new SphereGeometry(settings.size, settings.resolution, settings.resolution);
        
        // Create material
        const material = new MeshStandardMaterial({
            color: settings.color,
            metalness: settings.metalness,
            roughness: settings.roughness
        });
        
        // Create instanced mesh
        super(geometry, material, points.length);
        
        // Store config
        this.config = settings;
        
        // Create typed array for positions (3 floats per point)
        this._positionBuffer = new Float32Array(points.length * 3);
        this._pointCount = points.length;
        
        // Scratch objects for matrix calculations
        this.tmp = {
            matrix: new Matrix4()
        };
        
        // Initialize all instances
        this.setPoints(points);
    }
    
    /**
     * Extract coordinates from a point, handling both custom Vector3 and {x,y,z}
     */
    _extractCoordinates(point, index) {
        const offset = index * 3;
        
        // If it's array-like (your custom Vector3)
        if (Array.isArray(point) || point instanceof Array) {
            this._positionBuffer[offset] = point[0];
            this._positionBuffer[offset + 1] = point[1];
            this._positionBuffer[offset + 2] = point[2];
        }
        // If it has x,y,z properties
        else if (point && typeof point === 'object') {
            this._positionBuffer[offset] = point.x || 0;
            this._positionBuffer[offset + 1] = point.y || 0;
            this._positionBuffer[offset + 2] = point.z || 0;
        }
    }
    
    /**
     * Update instance matrices from position buffer
     */
    _updateInstanceMatrices() {
        const { matrix } = this.tmp;
        
        for (let i = 0; i < this._pointCount; i++) {
            const offset = i * 3;
            
            // Create transformation matrix directly from buffer
            matrix.makeTranslation(
                this._positionBuffer[offset],
                this._positionBuffer[offset + 1],
                this._positionBuffer[offset + 2]
            );
            
            // Apply to instance
            this.setMatrixAt(i, matrix);
        }
        
        // Tell GPU to update
        this.instanceMatrix.needsUpdate = true;
    }
    
    /**
     * Update the point cloud with new points
     * @param {Array} newPoints - Array of Vector3 (extending Array) or {x,y,z} objects
     */
    setPoints(newPoints) {
        const newCount = newPoints.length;
        
        // Resize buffer if needed
        if (newCount > this._positionBuffer.length / 3) {
            this._positionBuffer = new Float32Array(newCount * 3);
        }
        
        // Update point count
        this._pointCount = newCount;
        
        // If we have more points than instances, warn
        if (newCount > this.count) {
            console.warn(`Point cloud has ${newCount} points but only ${this.count} instances. Some points will be ignored.`);
        }
        
        // Update visible instances
        this.count = Math.min(newCount, this.count);
        
        // Extract coordinates to buffer
        for (let i = 0; i < newCount; i++) {
            this._extractCoordinates(newPoints[i], i);
        }
        
        // Update matrices
        this._updateInstanceMatrices();
    }
    
    /**
     * Get direct access to position buffer for advanced operations
     * @returns {Float32Array} - Position buffer [x0,y0,z0,x1,y1,z1,...]
     */
    getPositionBuffer() {
        return this._positionBuffer.subarray(0, this._pointCount * 3);
    }
    
    /**
     * Update positions directly from a Float32Array
     * @param {Float32Array} buffer - Position buffer [x0,y0,z0,x1,y1,z1,...]
     */
    setPositionBuffer(buffer) {
        const pointCount = Math.floor(buffer.length / 3);
        this._pointCount = pointCount;
        
        // Copy data
        if (buffer.length > this._positionBuffer.length) {
            this._positionBuffer = new Float32Array(buffer);
        } else {
            this._positionBuffer.set(buffer);
        }
        
        // Update visible instances
        this.count = Math.min(pointCount, this.count);
        
        // Update matrices
        this._updateInstanceMatrices();
    }
    
    /**
     * Change point size
     * @param {number} size - New point radius
     */
    setSize(size) {
        this.config.size = size;
        this.geometry.dispose();
        this.geometry = new SphereGeometry(size, this.config.resolution, this.config.resolution);
    }
    
    /**
     * Change point color
     * @param {number} color - New color (hex)
     */
    setColor(color) {
        this.config.color = color;
        this.material.color.setHex(color);
    }
    
    /**
     * Get bounding box of all points
     * @returns {Object} - {min: {x, y, z}, max: {x, y, z}}
     */
    getBounds() {
        if (this._pointCount === 0) {
            return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
        }
        
        const bounds = {
            min: { x: Infinity, y: Infinity, z: Infinity },
            max: { x: -Infinity, y: -Infinity, z: -Infinity }
        };
        
        for (let i = 0; i < this._pointCount; i++) {
            const offset = i * 3;
            const x = this._positionBuffer[offset];
            const y = this._positionBuffer[offset + 1];
            const z = this._positionBuffer[offset + 2];
            
            bounds.min.x = Math.min(bounds.min.x, x);
            bounds.min.y = Math.min(bounds.min.y, y);
            bounds.min.z = Math.min(bounds.min.z, z);
            bounds.max.x = Math.max(bounds.max.x, x);
            bounds.max.y = Math.max(bounds.max.y, y);
            bounds.max.z = Math.max(bounds.max.z, z);
        }
        
        return bounds;
    }
    
    /**
     * Get center point of the cloud
     * @returns {Object} - {x, y, z}
     */
    getCenter() {
        if (this._pointCount === 0) {
            return { x: 0, y: 0, z: 0 };
        }
        
        let sumX = 0, sumY = 0, sumZ = 0;
        
        for (let i = 0; i < this._pointCount; i++) {
            const offset = i * 3;
            sumX += this._positionBuffer[offset];
            sumY += this._positionBuffer[offset + 1];
            sumZ += this._positionBuffer[offset + 2];
        }
        
        return {
            x: sumX / this._pointCount,
            y: sumY / this._pointCount,
            z: sumZ / this._pointCount
        };
    }
    
    /**
     * Apply a transformation to all points
     * @param {Function} transform - Function that takes (x,y,z) and returns {x,y,z}
     */
    transformPoints(transform) {
        for (let i = 0; i < this._pointCount; i++) {
            const offset = i * 3;
            const result = transform(
                this._positionBuffer[offset],
                this._positionBuffer[offset + 1],
                this._positionBuffer[offset + 2]
            );
            
            this._positionBuffer[offset] = result.x;
            this._positionBuffer[offset + 1] = result.y;
            this._positionBuffer[offset + 2] = result.z;
        }
        
        this._updateInstanceMatrices();
    }
}


/**
 * Alternative: Direct buffer point cloud using Points geometry
 * This is even more efficient for large point clouds but less flexible visually
 */


export class BufferPointCloudView {
    constructor(points = [], config = {}) {
        const defaultConfig = {
            color: 0x0066ff,
            size: 0.05
        };
        
        const settings = { ...defaultConfig, ...config };
        
        // Create BufferGeometry
        this.geometry = new BufferGeometry();
        
        // Allocate position buffer
        this._positionBuffer = new Float32Array(points.length * 3);
        this._pointCount = points.length;
        
        // Fill buffer
        this._fillBuffer(points);
        
        // Set geometry attribute
        this.geometry.setAttribute('position', 
            new Float32BufferAttribute(this._positionBuffer, 3)
        );
        
        // Create material
        this.material = new PointsMaterial({
            color: settings.color,
            size: settings.size
        });
        
        // Create Points object
        this.points = new Points(this.geometry, this.material);
        this.config = settings;
    }
    
    _fillBuffer(points) {
        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const offset = i * 3;
            
            // Handle array-like (custom Vector3)
            if (Array.isArray(point) || point instanceof Array) {
                this._positionBuffer[offset] = point[0];
                this._positionBuffer[offset + 1] = point[1];
                this._positionBuffer[offset + 2] = point[2];
            }
            // Handle {x,y,z}
            else if (point && typeof point === 'object') {
                this._positionBuffer[offset] = point.x || 0;
                this._positionBuffer[offset + 1] = point.y || 0;
                this._positionBuffer[offset + 2] = point.z || 0;
            }
        }
    }
    
    setPoints(newPoints) {
        const newCount = newPoints.length;
        
        // Resize if needed
        if (newCount > this._positionBuffer.length / 3) {
            this._positionBuffer = new Float32Array(newCount * 3);
            this.geometry.setAttribute('position',
                new Float32BufferAttribute(this._positionBuffer, 3)
            );
        }
        
        this._pointCount = newCount;
        this._fillBuffer(newPoints);
        
        // Update draw range
        this.geometry.setDrawRange(0, newCount);
        
        // Notify Three.js
        this.geometry.attributes.position.needsUpdate = true;
    }
    
    getObject3D() {
        return this.points;
    }

        // Required: Add to Three.js scene
    addToScene(scene) {
        scene.add(this.group);
    }

    // Required: Animation
    tick(time, dTime) {
        // Optional: Add any animation here
    }
}