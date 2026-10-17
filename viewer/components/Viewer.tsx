'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadMesh, type MeshModel, type MeshNode } from '@/lib/mesh';
import IsolatedView from './IsolatedView';
import TreeNode, { type Entry } from './TreeNode';

type ModelFile = { path: string; size: number };

// Builds the three.js hierarchy and a parallel tree of entries for the sidebar.
// Parts are meshed once; instances share geometry but get their own material (for highlighting).
function buildEntry(node: MeshNode, model: MeshModel, bin: ArrayBuffer, geoms: Map<number, THREE.BufferGeometry[]>, parent: THREE.Object3D): Entry {
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

export default function Viewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const three = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; model: THREE.Group | null }>(null!);
  const [models, setModels] = useState<ModelFile[]>([]);
  const [root, setRoot] = useState<Entry | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [status, setStatus] = useState('Pick a model to load.');
  const [filter, setFilter] = useState('');
  const [wire, setWire] = useState(false);
  const [isolated, setIsolated] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(devicePixelRatio);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x14171c);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1e6);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404858, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(1, 1, 2);
    camera.add(sun);
    scene.add(camera);
    three.current = { scene, camera, controls, model: null };

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas.parentElement!;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    addEventListener('resize', resize);
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });

    fetch('/api/models').then((r) => r.json()).then(setModels);
    return () => { removeEventListener('resize', resize); renderer.setAnimationLoop(null); renderer.dispose(); };
  }, []);

  const fit = useCallback(() => {
    const { model, camera, controls } = three.current;
    if (!model) return;
    model.updateMatrixWorld(true); // world matrices are stale until the first render
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    camera.near = size / 1000;
    camera.far = size * 20;
    camera.updateProjectionMatrix();
    camera.position.copy(center).add(new THREE.Vector3(1, 0.8, 1.2).normalize().multiplyScalar(size * 1.1));
    controls.target.copy(center);
    controls.update();
  }, []);

  const loadModel = async (path: string) => {
    const name = path.split('/').pop()!;
    setLoading(true);
    setStatus(`Converting ${name} (first load can take a minute; cached afterwards)…`);
    try {
      const res = await fetch('/api/convert', { method: 'POST', body: JSON.stringify({ path }) });
      if (!res.ok) throw new Error(await res.text());
      const { id } = await res.json();
      setStatus('Loading mesh…');
      const { model, bin } = await loadMesh(id);

      const t = three.current;
      if (t.model) t.scene.remove(t.model);
      // STEP is Z-up, three.js is Y-up
      const holder = new THREE.Group();
      holder.rotation.x = -Math.PI / 2;
      t.scene.add(holder);
      t.model = holder;
      const roots = model.roots.map((r) => buildEntry(r, model, bin, new Map(), holder));
      setRoot(roots.length === 1 ? roots[0] : { name: name, group: holder, children: roots });
      setSelected(null);
      setIsolated(null);
      fit();
      const tris = model.protos.flat().reduce((n, c) => n + c.triangles, 0);
      setStatus(`${name}: ${model.protos.length} unique parts, ${tris.toLocaleString()} triangles`);
    } catch (e) {
      setStatus(`Failed: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const select = (entry: Entry) => {
    selected?.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(0); });
    entry.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(0x1a4a80); });
    setSelected(entry);
    const box = new THREE.Box3().setFromObject(entry.group);
    if (!box.isEmpty()) {
      const s = box.getSize(new THREE.Vector3());
      setStatus(`${entry.name} — ${s.x.toFixed(1)} × ${s.y.toFixed(1)} × ${s.z.toFixed(1)}`);
    }
  };

  const toggleWire = () => {
    const next = !wire;
    setWire(next);
    three.current.model?.traverse((o) => { if ((o as THREE.Mesh).isMesh) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).wireframe = next; });
  };

  const showAll = () => {
    const walk = (e: Entry) => { e.group.visible = true; e.children.forEach(walk); };
    if (root) walk(root);
    setRoot({ ...root! }); // force re-render of the tree
  };

  return (
    <div className="app">
      <aside>
        <h2>Project models</h2>
        <div className="models">
          {models.length === 0 && 'No .stp/.step files found.'}
          {models.map((m) => (
            <button key={m.path} disabled={loading} onClick={() => loadModel(m.path)}>
              {m.path.split('/').pop()}<br /><small>{(m.size / 1e6).toFixed(1)} MB</small>
            </button>
          ))}
        </div>
        <h2>Assembly</h2>
        <input className="filter" placeholder="Filter parts…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="tree">
          {root && <TreeNode entry={root} depth={0} filter={filter.toLowerCase()} selected={selected} onSelect={select} onIsolate={setIsolated} />}
        </div>
      </aside>
      <main>
        <canvas ref={canvasRef} />
        <div className="toolbar">
          <button onClick={fit}>Fit</button>
          <button onClick={toggleWire}>Wireframe</button>
          <button onClick={showAll}>Show all</button>
        </div>
        {isolated && <IsolatedView entry={isolated} onClose={() => setIsolated(null)} />}
        <div className="status">{status}</div>
      </main>
    </div>
  );
}
