export type Chunk = { color: [number, number, number] | null; vertices: number; triangles: number; pos: number; nrm: number; idx: number };
export type MeshNode = { name: string; matrix?: number[]; proto?: number; children?: MeshNode[] };
export type MeshModel = { roots: MeshNode[]; protos: Chunk[][] };

// Loads a converted model: the JSON tree plus the binary vertex/index buffer.
export async function loadMesh(id: string): Promise<{ model: MeshModel; bin: ArrayBuffer }> {
  const [model, bin] = await Promise.all([
    fetch(`/api/model/${id}/model.json`).then((r) => r.json()),
    fetch(`/api/model/${id}/model.bin`).then((r) => r.arrayBuffer()),
  ]);
  return { model, bin };
}
