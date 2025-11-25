

//Reformulate `data` into a Float32Array of length N.
//If `data` is an Array or TypedArray of length N ─ copy it.
// Otherwise treat `data` as a scalar and return [data, …, data].
export function buildFloatArray(data, N) {
    /* Array or typed-array case ------------------------------------ */
    if (Array.isArray(data) || ArrayBuffer.isView(data)) {
        if (data.length !== N) {
            throw new Error(
                `toFloatArray: length ${data.length} ≠ expected ${N}`
            );
        }
        return Float32Array.from(data);
    }

    /* Scalar fallback ---------------------------------------------- */
    return new Float32Array(N).fill(data);
}
