
import {Raycaster, Vector2} from "three";


/**
 * Builds a listener that converts pointer position → UV on the given mesh(es).
 *
 * @param {THREE.Camera}      camera   – the active camera.
 * @param {THREE.Object3D|THREE.Object3D[]} targets – one mesh or an array of meshes to test.
 * @param {Function}          onHit    – callback (uv, hit, ev) called when a face with UVs is under the pointer.
 *
 * @returns {Function}  The event listener you can add/remove from your canvas element.
 */
function makePointerUvListener(camera, targets, onHit) {
    const raycaster = new Raycaster();
    const mouse     = new Vector2();

    // Convert screen (pixels) → NDC (-1…+1)
    function toNdc(ev) {
        mouse.x =  (ev.clientX / window.innerWidth)  * 2 - 1;
        mouse.y = -(ev.clientY / window.innerHeight) * 2 + 1;
    }

    // The listener you’ll attach to renderer.domElement
    function handlePointerMove(ev) {
        toNdc(ev);
        raycaster.setFromCamera(mouse, camera);

        const objs  = Array.isArray(targets) ? targets : [targets];
        const hits  = raycaster.intersectObjects(objs, false);

        if (hits.length && hits[0].uv) {
            const uv = hits[0].uv.clone();   // clone → safe to mutate
            onHit(uv, hits[0], ev);
        }
    }

    return handlePointerMove;
}



export {makePointerUvListener}
