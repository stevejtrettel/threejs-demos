/**
 * Utility for reading point cloud data from JSON files
 * Handles flat coordinate arrays and returns structured data
 */

export class PointCloudReader {
    /**
     * Read point cloud data from a URL
     * @param {string} url - URL to the JSON file
     * @returns {Promise<{points: Array, metadata: Object}>}
     */
    static async readFromURL(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return this.parsePointCloudData(data);
        } catch (error) {
            console.error("Failed to read point cloud from URL:", error);
            throw error;
        }
    }
    
    /**
     * Read point cloud data from a File object
     * @param {File} file - File object from input element
     * @returns {Promise<{points: Array, metadata: Object}>}
     */
    static async readFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    resolve(this.parsePointCloudData(data));
                } catch (error) {
                    console.error("Error parsing JSON file:", error);
                    reject(error);
                }
            };
            
            reader.onerror = (error) => {
                console.error("Error reading file:", error);
                reject(error);
            };
            
            reader.readAsText(file);
        });
    }
    
    /**
     * Parse point cloud data from JSON structure
     * @param {Object} data - Raw JSON data with metadata and coordinates
     * @returns {{points: Array, metadata: Object}}
     */
    static parsePointCloudData(data) {
        // Validate data structure
        if (!data.metadata || !data.coordinates) {
            throw new Error("Invalid point cloud data: missing metadata or coordinates");
        }
        
        // Validate coordinate array length
        const expectedLength = data.metadata.totalPoints * 3;
        if (data.coordinates.length !== expectedLength) {
            console.warn(`Expected ${expectedLength} coordinates but got ${data.coordinates.length}`);
        }
        
        // Convert flat array to point arrays
        const points = [];
        for (let i = 0; i < data.coordinates.length; i += 3) {
            points.push([
                data.coordinates[i],
                data.coordinates[i + 1],
                data.coordinates[i + 2]
            ]);
        }
        
        return {
            points: points,
            metadata: data.metadata
        };
    }
    
    /**
     * Read multiple files in parallel
     * @param {FileList|Array<File>} files - List of files to read
     * @returns {Promise<Array<{filename: string, points: Array, metadata: Object}>>}
     */
    static async readMultipleFiles(files) {
        const promises = Array.from(files).map(async (file) => {
            try {
                const data = await this.readFromFile(file);
                return {
                    filename: file.name,
                    ...data,
                    success: true
                };
            } catch (error) {
                return {
                    filename: file.name,
                    error: error,
                    success: false
                };
            }
        });
        
        return Promise.all(promises);
    }
    
    /**
     * Calculate statistics from points array
     * @param {Array} points - Array of [x, y, z] coordinates
     * @returns {Object} Statistics including bounds and center
     */
    static calculateStatistics(points) {
        if (points.length === 0) {
            return {
                totalPoints: 0,
                bounds: {
                    min: { x: 0, y: 0, z: 0 },
                    max: { x: 0, y: 0, z: 0 },
                    size: { x: 0, y: 0, z: 0 }
                },
                center: { x: 0, y: 0, z: 0 }
            };
        }
        
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        let sumX = 0, sumY = 0, sumZ = 0;
        
        for (const point of points) {
            const [x, y, z] = point;
            
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            minZ = Math.min(minZ, z);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
            maxZ = Math.max(maxZ, z);
            
            sumX += x;
            sumY += y;
            sumZ += z;
        }
        
        return {
            totalPoints: points.length,
            bounds: {
                min: { x: minX, y: minY, z: minZ },
                max: { x: maxX, y: maxY, z: maxZ },
                size: {
                    x: maxX - minX,
                    y: maxY - minY,
                    z: maxZ - minZ
                }
            },
            center: {
                x: sumX / points.length,
                y: sumY / points.length,
                z: sumZ / points.length
            }
        };
    }
}