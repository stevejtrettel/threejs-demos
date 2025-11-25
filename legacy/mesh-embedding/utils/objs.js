// utils/objToMesh.js
import { Vertex, Face } from '../Topology/Cells.js';
import Topology         from '../Topology/Topology.js';
import Embedding        from '../Embedding/Embedding.js';

//AMAZING! (Thanks to ChatGPT for noticing and alerting me) Our Topology and Embeding classes together
//carry the exact same data as the OBJ file format for 3D Meshes.
//such files have lines starting with v, followed by 3 floats: these are the coordinates of a vertex
//then they have line starting with f, followed by 3 integers: these are the indices of the vertices making that face
//(Only annoyance: vertex indices start with 1 instead of 0)
//we can easily read such a thing!

/** Convert OBJ text (positions + faces) into our Embedding class. */
//text is a giant string containing the file contents
export function loadOBJ(text) {
    const vertexCoords = [];
    const faceIndices = [];

    //split the string at each new line
    for (const line of text.split('\n')) {
        const t = line.trim();//remove whitespace

        //lines that start with v are vertex coordiantes!
        if (t.startsWith('v ')) {
            //split turns this into ["v", x,y,z]: we want to save x,y,z
            const [, x, y, z] = t.split(/\s+/);
            vertexCoords.push([parseFloat(x), parseFloat(y), parseFloat(z)]);//cast from strings to numbers
        }

        //lines that start with f are the vertex indices for a face!
        else if (t.startsWith('f ')) {

            const [, ...ids] = t.split(/\s+/); //this stores as 'id' the stuff coming after "f" when parsing the string
            //now take each one, convert to an integer,
            faceIndices.push(ids.map(s => parseInt(s) - 1));     // OBJ indices are 1-based :(
        }
    }

    // vertices to Vertex instances
    //make a vertex for each element of the coordinate list, give it the index of its coordinates
    const vertexList = vertexCoords.map((_, i) => { const v = new Vertex(); v.idx = i; return v; });

    // faces to Face instances with vertex refs
    //faceVertices is the list [23,41,1] of indices for vertices on the given face
    //idx is the index of that face in the list faceIndices
    const faceList = faceIndices.map((faceVertices, idx) => {
        const f = new Face();
        f.idx      = idx;
        f.vertices = faceVertices.map(i => vertexList[i]);
        return f;
    });

    const topo = Topology.fromSoup(vertexList, faceList);
    const emb  = new Embedding(topo, vertexCoords);

    return emb;
}





/**
 * Export to OBJ (only v/f), auto-downloads as "mesh.obj".
 * Usage:
 *   exportOBJ(embedding);                         // downloads mesh.obj
 *   exportOBJ(embedding, { triangulate:true });   // fan-triangulate n-gons
 *   const s = exportOBJ(embedding, { download:false }); // just get the string
 */
export function exportOBJ(embedding, opts = {}) {
    const FILENAME = 'mesh.obj';
    const {
        precision   = 6,
        triangulate = false,
        download    = true,
    } = opts;

    const topo = embedding.topology;
    const V = topo.vertices.length;
    const format = (n) => Number(n).toFixed(precision).replace(/\.?0+$/,'');

    // vertices
    const lines = [];
    for (let i = 0; i < V; i++) {
        const p = embedding.coords(i);
        lines.push(`v ${format(p[0])} ${format(p[1])} ${format(p[2])}`);
    }

    // face vertex indices (0-based) in cyclic order
    const faceIndices = (f) => {
        if (Array.isArray(f.vertices) && f.vertices.length) {
            return f.vertices.map(v => v.idx);
        }
        const idxs = [];
        let e = f.markedEdge;
        if (!e) return idxs;
        const start = e;
        do {
            idxs.push(e.origin.idx);
            e = e.next;
            if (!e) throw new Error('exportOBJ: broken face loop (missing next)');
        } while (e !== start);
        return idxs;
    };

    // faces (OBJ is 1-based)
    for (const f of topo.faces) {
        const idxs0 = faceIndices(f);
        if (idxs0.length < 3) continue;

        if (!triangulate || idxs0.length === 3) {
            lines.push(`f ${idxs0.map(i => i + 1).join(' ')}`);
        } else {
            for (let k = 1; k < idxs0.length - 1; k++) {
                const tri = [idxs0[0], idxs0[k], idxs0[k + 1]].map(i => i + 1);
                lines.push(`f ${tri.join(' ')}`);
            }
        }
    }

    lines.push('');
    const objString = lines.join('\n');

    // auto-download in browser
    if (download && typeof window !== 'undefined' && typeof document !== 'undefined' && window.Blob) {
        const blob = new Blob([objString], { type: 'text/plain' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url;
        a.download = FILENAME;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    return objString;
}

