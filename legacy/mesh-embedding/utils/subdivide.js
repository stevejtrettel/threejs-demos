import Topology from "../Topology/Topology";
import Embedding from "../Embedding/Embedding";
import {Vertex, Edge, Face} from "../Topology/Cells";

export function subdivide(embedding) {
    // create a deep copy of the topology vertices


    let newVertices = embedding.topology.vertices.map(v => {
        let newV = new Vertex();
        newV.idx = v.idx; // keep the same index
        return newV;
    });

    // console.log(newVertices);
    let newFaces = [];

    const newPos = [];
    for (let i = 0; i < embedding.pos.length; i += 3) {
        newPos.push(
            [
                embedding.pos[i], // x
                embedding.pos[i + 1],  // y
                embedding.pos[i + 2]  // z
            ]
        );
    }

    for(const face of embedding.topology.faces){
        const newF0 = new Face();
        const newF1 = new Face();
        const newF2 = new Face();

        const newV = new Vertex();
        newVertices.push(newV);
        newV.idx = newVertices.length - 1; // assign a new index

        newF0.idx = newFaces.length;
        newF1.idx = newFaces.length + 1;
        newF2.idx = newFaces.length + 2;

        newF0.vertices = [face.vertices[2], face.vertices[0], newV];
        newF1.vertices = [face.vertices[0], face.vertices[1], newV];
        newF2.vertices = [face.vertices[1], face.vertices[2], newV];


        const triple0 = newPos[face.vertices[0].idx];
        const triple1 = newPos[face.vertices[1].idx];
        const triple2 = newPos[face.vertices[2].idx];

        const avg_x = (triple0[0] + triple1[0] + triple2[0]) / 3;
        const avg_y = (triple0[1] + triple1[1] + triple2[1]) / 3;
        const avg_z = (triple0[2] + triple1[2] + triple2[2]) / 3;

        newPos.push([avg_x, avg_y, avg_z]);
        newFaces.push(newF0, newF1, newF2);
    }

    const newTopology = Topology.fromSoup(newVertices, newFaces);
    const newEmbedding = new Embedding(newTopology, newPos);
    return newEmbedding;
}
