import * as THREE from 'three';
import { loadMesh, type MeshModel, type MeshNode } from './mesh';

export type Entry = { name: string; group: THREE.Group; children: Entry[] };

// Builds the three.js hierarchy and a parallel tree of entries for the sidebar.
// Parts are meshed once; instances share geometry but get their own material (for highlighting).
export function buildEntry(node: MeshNode, model: MeshModel, bin: ArrayBuffer, geoms: Map<number, THREE.BufferGeometry[]>, parent: THREE.Object3D): Entry {
  const group = new THREE.Group();
  if (node.matrix) { group.matrixAutoUpdate = false; group.matrix.fromArray(node.matrix); }
  if (node.proto !== undefined) {
    const chunks = model.protos[node.proto];
    if (!geoms.has(node.proto)) {
      geoms.set(node.proto, chunks.map((c) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(bin, c.pos, c.vertices * 3), 3));
        g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(bin, c.nrm, c.vertices * 3), 3));
        g.setIndex(new THREE.BufferAttribute(new Uint32Array(bin, c.idx, c.triangles * 3), 1));
        return g;
      }));
    }
    chunks.forEach((c, i) => {
      const color = c.color ? new THREE.Color(c.color[0], c.color[1], c.color[2]) : new THREE.Color(0xb0b8c4);
      group.add(new THREE.Mesh(geoms.get(node.proto!)![i], new THREE.MeshStandardMaterial({ color, metalness: 0.2, roughness: 0.55, side: THREE.DoubleSide })));
    });
  }
  parent.add(group);
  return { name: node.name || '(unnamed)', group, children: (node.children ?? []).map((c) => buildEntry(c, model, bin, geoms, group)) };
}

// Converts (cached) and loads a STEP file into a three.js group plus its entry tree.
// The group is rotated from STEP's Z-up to three.js' Y-up.
export async function fetchScene(path: string, onStatus: (s: string) => void = () => {}) {
  const name = path.split('/').pop()!;
  onStatus(`Converting ${name} (first load can take a minute; cached afterwards)…`);
  const res = await fetch('/api/convert', { method: 'POST', body: JSON.stringify({ path }) });
  if (!res.ok) throw new Error(await res.text());
  const { id } = await res.json();
  onStatus('Loading mesh…');
  const { model, bin } = await loadMesh(id);
  const holder = new THREE.Group();
  holder.rotation.x = -Math.PI / 2;
  const roots = model.roots.map((r) => buildEntry(r, model, bin, new Map(), holder));
  return { name, model, holder, roots };
}
