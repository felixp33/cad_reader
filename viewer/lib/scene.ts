import * as THREE from 'three';
import { loadMesh, type MeshModel, type MeshNode } from './mesh';

export type Entry = { name: string; group: THREE.Group; children: Entry[]; proto?: number };

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
  return { name: node.name || '(unnamed)', group, proto: node.proto, children: (node.children ?? []).map((c) => buildEntry(c, model, bin, geoms, group)) };
}

// Converts (cached) and loads a STEP file into a three.js group plus its entry tree.
// The group is rotated to three.js' Y-up when the source is Z-up; `holder.userData.up` records the source axis.
export async function fetchScene(path: string, onStatus: (s: string) => void = () => {}) {
  const name = path.split('/').pop()!;
  onStatus(`Converting ${name} (first load can take a minute; cached afterwards)…`);
  const res = await fetch('/api/convert', { method: 'POST', body: JSON.stringify({ path }) });
  if (!res.ok) throw new Error(await res.text());
  const { id, up } = (await res.json()) as { id: string; up: 'y' | 'z' };
  onStatus('Loading mesh…');
  const { model, bin } = await loadMesh(id);
  const holder = new THREE.Group();
  holder.userData.up = up;
  if (up === 'z') holder.rotation.x = -Math.PI / 2;
  const roots = model.roots.map((r) => buildEntry(r, model, bin, new Map(), holder));
  return { name, model, holder, roots };
}

// Whether the scene a group belongs to was loaded from a Z-up source (and therefore carries the correcting rotation).
export function isZUp(obj: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = obj; o; o = o.parent) if (o.userData.up) return o.userData.up === 'z';
  return true;
}

// The machine is the first node that branches; its children are the parts to name.
// (STEP files often wrap the machine in single-child container nodes.)
export function firstGeneration(roots: Entry[]): Entry[] {
  let level = roots;
  while (level.length === 1 && level[0].children.length > 0) level = level[0].children;
  return level;
}

// The machine node itself (the parent of firstGeneration).
export function findMachine(roots: Entry[]): Entry | null {
  let level = roots, machine: Entry | null = null;
  while (level.length === 1 && level[0].children.length > 0) { machine = level[0]; level = machine.children; }
  return machine ?? roots[0] ?? null;
}

// Entries from `from` down to `target` (inclusive), or null if target isn't below it.
export function pathTo(from: Entry, target: Entry): Entry[] | null {
  if (from === target) return [from];
  for (const c of from.children) {
    const p = pathTo(c, target);
    if (p) return [from, ...p];
  }
  return null;
}
