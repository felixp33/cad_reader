'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { createControls } from '@/lib/controls';
import { frameObject } from '@/lib/frame';
import { usePanelWidths } from '@/lib/usePanelWidths';
import { cssColor, subscribeTheme } from '@/lib/theme';
import TopBar from './TopBar';
import Link from 'next/link';
import { Box, RotateCcw, Slice, Tag, X } from 'lucide-react';
import { fetchScene, findMachine, firstGeneration, pathTo, type Entry } from '@/lib/scene';
import IsolatedView from './IsolatedView';
import { applySlice, placePlane } from '@/lib/slice';
import { useNotes } from '@/lib/useNotes';
import InfoPanel from './InfoPanel';
import Toggle from './Toggle';
import TreeNode from './TreeNode';
import { SkeletonRows } from './Skeleton';

type ModelFile = { path: string; size: number };

export default function Viewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const three = useRef<{ scene: THREE.Scene; camera: THREE.PerspectiveCamera; controls: TrackballControls; canvas: HTMLCanvasElement; model: THREE.Group | null }>(null!);
  const [models, setModels] = useState<ModelFile[]>([]);
  const [root, setRoot] = useState<Entry | null>(null);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [status, setStatus] = useState('');
  const [filter, setFilter] = useState('');
  const [wire, setWire] = useState(false);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const { notes, save: saveNote, remove: removeNote, refreshSoon } = useNotes(currentModel);
  const [title, setTitle] = useState('');
  const [names, setNames] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<(Entry | null)[]>([]); // selections we jumped away from by following links
  const { widths, startDrag, reset: resetWidth } = usePanelWidths();
  const [showGiven, setShowGiven] = useState(true);
  const [isolated, setIsolated] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(false);
  const [focusNote, setFocusNote] = useState<string | null>(null); // note whose parts are the only ones shown
  const [focusCount, setFocusCount] = useState(0);
  const [slicing, setSlicing] = useState(false);
  const [axis, setAxis] = useState(0);
  const [cutAt, setCutAt] = useState(0.5); // 0..1 along the machine's extent on the chosen axis
  const [flip, setFlip] = useState(false);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(1, 0, 0), 0), []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.localClippingEnabled = true; // for the slice tool
    renderer.setPixelRatio(devicePixelRatio);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(cssColor('--canvas-bg'));
    const unsubscribeTheme = subscribeTheme(() => { scene.background = new THREE.Color(cssColor('--canvas-bg')); });
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 1e6);
    const { controls, dispose: disposeControls } = createControls(camera, canvas);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x404858, 1.1));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(1, 1, 2);
    camera.add(sun);
    scene.add(camera);
    three.current = { scene, camera, controls, canvas, model: null };

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas.parentElement!;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      controls.handleResize();
      renderer.render(scene, camera); // resizing clears the canvas; repaint now to avoid a flash
    };
    resize();
    const observer = new ResizeObserver(resize); // also fires when a side column is dragged
    observer.observe(canvas.parentElement!);
    renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });

    fetch('/api/models').then((r) => r.json()).then(setModels);
    return () => { unsubscribeTheme(); observer.disconnect(); renderer.setAnimationLoop(null); disposeControls(); renderer.dispose(); };
  }, []);

  const fit = useCallback(() => {
    const { model, camera, controls, canvas } = three.current;
    if (!model) return;
    camera.up.set(0, 1, 0); // undo any roll from free rotation
    const { center, radius } = frameObject(camera, model, canvas.clientWidth / canvas.clientHeight);
    controls.target.copy(center);
    controls.minDistance = radius * 0.05;
    controls.maxDistance = radius * 20;
    controls.update();
  }, []);

  const loadModel = async (path: string) => {
    setLoading(true);
    try {
      const { name, holder, roots } = await fetchScene(path, setStatus);
      setCurrentModel(path);
      const q = '?model=' + encodeURIComponent(path);
      setNames(await fetch('/api/names' + q).then((r) => r.json()).catch(() => ({})));
      const t = three.current;
      if (t.model) t.scene.remove(t.model);
      t.scene.add(holder);
      t.model = holder;
      setRoot(roots.length === 1 ? roots[0] : { name: name, group: holder, children: roots });
      setSelected(null);
      setHistory([]);
      setIsolated(null);
      setFocusNote(null);
      fit();
      setStatus('');
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
  };

  // Flies the camera to an entry, keeping the current viewing direction.
  const focus = (entry: Entry) => {
    const { camera, controls, canvas, model } = three.current;
    const dir = camera.position.clone().sub(controls.target);
    if (dir.lengthSq() === 0) return;
    const { center, radius } = frameObject(camera, entry.group, canvas.clientWidth / canvas.clientHeight, dir.normalize());
    if (model) camera.far = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere()).radius * 40;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.minDistance = radius * 0.05;
    controls.update();
  };

  const entryById = useMemo(() => {
    const m = new Map<string, Entry>();
    const walk = (e: Entry) => { if (!m.has(e.name)) m.set(e.name, e); e.children.forEach(walk); };
    if (root) walk(root);
    return m;
  }, [root]);

  // A term in a note was tapped: show that part (remembering where we came from).
  const openPart = (id: string) => {
    const entry = entryById.get(id);
    if (!entry) return;
    setHistory((h) => [...h, selected]);
    select(entry);
    focus(entry);
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    if (prev) { select(prev); focus(prev); } else clearSelection();
  };

  // Shows only the given parts (by id) and frames them; null shows everything again.
  const showParts = (noteId: string | null, ids: string[]) => {
    const { model, camera, controls, canvas } = three.current;
    if (!model) return;
    const meshes: THREE.Mesh[] = [];
    model.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
    const entries = noteId ? ids.map((id) => entryById.get(id)).filter((e): e is Entry => !!e) : [];
    if (noteId && entries.length === 0) return;
    if (!noteId) { meshes.forEach((m) => { m.visible = true; }); setFocusNote(null); return; }
    const keep = new Set<THREE.Object3D>();
    entries.forEach((e) => e.group.traverse((o) => keep.add(o)));
    meshes.forEach((m) => { m.visible = keep.has(m); });
    const box = new THREE.Box3();
    entries.forEach((e) => { e.group.updateWorldMatrix(true, true); box.union(new THREE.Box3().setFromObject(e.group)); });
    const dir = camera.position.clone().sub(controls.target);
    const { center, radius } = frameObject(camera, box, canvas.clientWidth / canvas.clientHeight, dir.lengthSq() ? dir.normalize() : undefined);
    camera.far = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere()).radius * 40;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.minDistance = radius * 0.05;
    controls.update();
    setFocusNote(noteId);
    setFocusCount(entries.length);
  };

  // While slicing is on, clip the machine with the plane and paint the cut.
  useEffect(() => {
    const model = three.current.model;
    if (!slicing || !root || !model) return;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    placePlane(plane, box, axis, cutAt, flip);
    return applySlice(model, plane, new THREE.Color(cssColor('--accent')));
  }, [slicing, root, axis, cutAt, flip, plane]);

  // Look straight at the cut face, from the side that was removed.
  const faceCut = () => {
    const { model, camera, controls, canvas } = three.current;
    if (!model) return;
    camera.up.copy(axis === 1 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0));
    const dir = new THREE.Vector3().setComponent(axis, flip ? 1 : -1);
    const { center } = frameObject(camera, model, canvas.clientWidth / canvas.clientHeight, dir);
    controls.target.copy(center);
    controls.update();
  };

  // Face the cut whenever slicing starts or the cut's side changes (moving the plane keeps your view).
  useEffect(() => {
    if (slicing) faceCut();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slicing, axis, flip]);

  const savePartName = async (id: string, name: string) => {
    if ((names[id] ?? '') === name) return;
    setNames((n) => { const next = { ...n }; if (name) next[id] = name; else delete next[id]; return next; });
    await fetch('/api/names', { method: 'PUT', body: JSON.stringify({ model: currentModel, id, name }) });
    refreshSoon();
  };

  const setWireframe = (next: boolean) => {
    setWire(next);
    three.current.model?.traverse((o) => { if ((o as THREE.Mesh).isMesh) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).wireframe = next; });
  };

  // Number of notes attached directly to a part, for the badge in the tree.
  const noteCount = (e: Entry) => notes.filter((n) => n.parts.includes(e.name)).length;

  // Breadcrumb "machine / part / component / …" for the current selection.
  const machine = useMemo(() => (root ? findMachine([root]) : null), [root]);
  const crumbs = useMemo(() => (machine && selected ? pathTo(machine, selected) ?? [machine] : machine ? [machine] : []), [machine, selected]);

  const clearSelection = () => {
    selected?.group.traverse((o) => { if ((o as THREE.Mesh).isMesh) ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).emissive.setHex(0); });
    setSelected(null);
  };

  const mainIds = useMemo(() => (root ? firstGeneration([root]).map((e) => e.name) : []), [root]);

  // Given (human-readable) name if there is one and the toggle is on, otherwise the part's ID.
  const modelQuery = currentModel ? '?model=' + encodeURIComponent(currentModel) : '';

  const labelOf = (e: Entry) => (showGiven && names[e.name]) || e.name;

  return (
    <div className="app" style={{ '--left': `${widths.left}px`, '--right': `${widths.right}px` } as React.CSSProperties}>
      <TopBar search={{ value: filter, onChange: setFilter, placeholder: 'Search parts…' }} />
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
        {loading && !root && <SkeletonRows rows={9} />}
        <div className="tree">
          {root && <TreeNode entry={root} depth={0} filter={filter.toLowerCase()} selected={selected} onSelect={select} onIsolate={setIsolated} labelOf={labelOf} noteCount={noteCount} />}
        </div>
      </aside>
      <main>
        <div className="resizer left" onPointerDown={startDrag('left')} onDoubleClick={() => resetWidth('left')} role="separator" aria-orientation="vertical" aria-label="Resize assembly column" />
        <div className="resizer right" onPointerDown={startDrag('right')} onDoubleClick={() => resetWidth('right')} role="separator" aria-orientation="vertical" aria-label="Resize information column" />
        <canvas ref={canvasRef} />
        <div className="toolrow" role="toolbar" aria-label="View tools">
          <button className="btn" onClick={() => { clearSelection(); showParts(null, []); fit(); }} disabled={!root} title="Frame the whole machine"><RotateCcw className="ic" size={15} /> Reset view</button>
          <button className="btn icon-btn" aria-pressed={slicing} aria-label="Slice" onClick={() => setSlicing((s) => !s)} disabled={!root} title="Slice: cut through the machine"><Slice className="ic" size={16} /></button>
          <button className="btn icon-btn" aria-pressed={wire} aria-label="Wireframe" onClick={() => setWireframe(!wire)} title="Wireframe"><Box className="ic" size={16} /></button>
          <Toggle label="Given names" checked={showGiven} onChange={setShowGiven} title="Show given names in the assembly tree instead of part IDs" />
          <span className="toolrow-sep" aria-hidden />
          <Link className="btn" href={`/naming${modelQuery}`}><Tag className="ic" size={15} /> Name parts</Link>
        </div>
        {slicing && (
          <div className="slicebar" role="group" aria-label="Slice controls">
            <div className="segmented" role="group" aria-label="Cut axis">
              {(['X', 'Y', 'Z'] as const).map((a, i) => <button key={a} aria-pressed={axis === i} onClick={() => setAxis(i)}>{a}</button>)}
            </div>
            <input type="range" min={0} max={1000} value={Math.round(cutAt * 1000)} onChange={(e) => setCutAt(+e.target.value / 1000)} aria-label="Cut position" />
            <span className="slicebar-pct">{Math.round(cutAt * 100)}%</span>
            <button className="btn" onClick={() => setFlip((f) => !f)}>Flip side</button>
            <button className="btn" onClick={faceCut}>Face the cut</button>
            <button className="btn icon-btn" onClick={() => setSlicing(false)} aria-label="Close slice" title="Close"><X className="ic" size={16} /></button>
          </div>
        )}
        {crumbs.length > 0 && (
          <nav className="crumbs" aria-label="Selected part path">
            {crumbs.map((e, i) => (
              <span key={i} className="crumb-wrap">
                {i > 0 && <span className="crumb-sep">/</span>}
                <button
                  className={`crumb${i === crumbs.length - 1 ? ' current' : ''}`}
                  title={e.name}
                  onClick={() => (i === 0 ? clearSelection() : select(e))}
                >{i === 0 ? title || labelOf(e) : labelOf(e)}</button>
              </span>
            ))}
          </nav>
        )}
        {isolated && <IsolatedView entry={isolated} title={labelOf(isolated)} onClose={() => setIsolated(null)} />}
        {status && <div className={`status status-top${slicing ? ' below-slice' : ''}`}>{status}</div>}
        {focusNote && (
          <div className="focus-pill">
            Showing {focusCount} part{focusCount === 1 ? '' : 's'} from a note
            <button className="btn" onClick={() => showParts(null, [])}><X className="ic" size={14} /> Show all</button>
          </div>
        )}
      </main>
      <InfoPanel model={currentModel} root={root} mainIds={mainIds} selected={selected} label={labelOf} names={names} onPartName={savePartName} onOpenPart={openPart} focusNote={focusNote} onShowParts={showParts} backLabel={history.length ? (history[history.length - 1] ? labelOf(history[history.length - 1]!) : title || 'the machine') : null} onBack={goBack} onIsolate={setIsolated} title={title} onTitleChange={setTitle} notes={notes} onSaveNote={saveNote} onRemoveNote={removeNote} />
    </div>
  );
}
