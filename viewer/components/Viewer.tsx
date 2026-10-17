'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Link from 'next/link';
import { fetchScene, type Entry } from '@/lib/scene';
import IsolatedView from './IsolatedView';
import TreeNode from './TreeNode';

type ModelFile = { path: string; size: number };

export default function Viewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const three = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: OrbitControls; model: THREE.Group | null }>(null!);
  const [models, setModels] = useState<ModelFile[]>([]);
  const [root, setRoot] = useState<Entry | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [status, setStatus] = useState('Pick a model to load.');
  const [filter, setFilter] = useState('');
  const [wire, setWire] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [showGiven, setShowGiven] = useState(true);
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
    setLoading(true);
    try {
      const { name, model, holder, roots } = await fetchScene(path, setStatus);
      setCurrentModel(path);
      setNames(await fetch('/api/names?model=' + encodeURIComponent(path)).then((r) => r.json()).catch(() => ({})));
      const t = three.current;
      if (t.model) t.scene.remove(t.model);
      t.scene.add(holder);
      t.model = holder;
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

  // Open straight into a model when linked from the library (/viewer?model=...).
  useEffect(() => {
    const m = new URLSearchParams(location.search).get('model');
    if (m) loadModel(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = (entry: Entry) => {
    selected?.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(0); });
    entry.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(0x1a4a80); });
    setSelected(entry);
    const box = new THREE.Box3().setFromObject(entry.group);
    if (!box.isEmpty()) {
      const s = box.getSize(new THREE.Vector3());
      setStatus(`${labelOf(entry)} — ${s.x.toFixed(1)} × ${s.y.toFixed(1)} × ${s.z.toFixed(1)}`);
    }
  };

  const toggleWire = () => {
    const next = !wire;
    setWire(next);
    three.current.model?.traverse((o) => { if ((o as THREE.Mesh).isMesh) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).wireframe = next; });
  };

  // Given (human-readable) name if there is one and the toggle is on, otherwise the part's ID.
  const labelOf = (e: Entry) => (showGiven && names[e.name]) || e.name;

  return (
    <div className="app">
      <header className="topbar">
        <Link className="btn icon-btn" href="/" title="Library" aria-label="Library">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v10h5v-6h4v6h5V10" />
          </svg>
        </Link>
        <span className="topbar-spacer" />
        <Link className="btn" href={currentModel ? `/naming?model=${encodeURIComponent(currentModel)}` : '/naming'}>Name parts →</Link>
        <button onClick={toggleWire}>Wireframe</button>
        <button onClick={() => setShowGiven(!showGiven)} title="Switch the assembly tree between given names and part IDs">
          Names: {showGiven ? 'given' : 'IDs'}
        </button>
      </header>
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
          {root && <TreeNode entry={root} depth={0} filter={filter.toLowerCase()} selected={selected} onSelect={select} onIsolate={setIsolated} labelOf={labelOf} />}
        </div>
      </aside>
      <main>
        <canvas ref={canvasRef} />
        {isolated && <IsolatedView entry={isolated} title={labelOf(isolated)} onClose={() => setIsolated(null)} />}
        <div className="status">{status}</div>
      </main>
    </div>
  );
}
