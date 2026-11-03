'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useDictation } from '@/lib/useDictation';
import { useModelPick } from '@/lib/useModelPick';
import { useModelScene } from '@/lib/useModelScene';
import type { Entry } from '@/lib/scene';
import Toggle from './Toggle';
import TopBar from './TopBar';

type Mention = { text: string; parts: string[] };

const meshesOf = (g: THREE.Object3D) => { const out: THREE.Mesh[] = []; g.traverse((o) => { if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh); }); return out; };

// Type or speak a description of the machine; only the parts it mentions stay visible.
export default function Describe() {
  const { models, model, setModel } = useModelPick();
  const { canvasRef, holder, roots, status, fit } = useModelScene(model);
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [ghost, setGhost] = useState(false);
  const textRef = useRef(text);
  textRef.current = text;
  const dictation = useDictation((phrase) => setText((t) => (t.trim() ? t.trimEnd() + ' ' : '') + phrase));

  useEffect(() => {
    if (!model) return;
    fetch('/api/names?model=' + encodeURIComponent(model)).then((r) => r.json()).then(setNames).catch(() => setNames({}));
  }, [model]);

  // Ask the server which parts the text names (debounced while typing / dictating).
  useEffect(() => {
    if (!model) return;
    if (!text.trim()) { setMentions([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch('/api/describe', { method: 'POST', body: JSON.stringify({ model, text }) });
      if (res.ok && textRef.current === text) setMentions((await res.json()).mentions);
    }, 350);
    return () => clearTimeout(t);
  }, [model, text]);

  const byId = useMemo(() => {
    const m = new Map<string, Entry>();
    const walk = (e: Entry) => { if (!m.has(e.name)) m.set(e.name, e); e.children.forEach(walk); };
    roots.forEach(walk);
    return m;
  }, [roots]);

  const matched = useMemo(() => {
    const ids = new Set(mentions.flatMap((m) => m.parts));
    return [...ids].map((id) => byId.get(id)).filter((e): e is Entry => !!e);
  }, [mentions, byId]);

  // Show only the matched parts (everything, if nothing is recognised).
  useEffect(() => {
    if (!holder) return;
    const keep = new Set<THREE.Mesh>(matched.flatMap((e) => meshesOf(e.group)));
    const filtering = keep.size > 0;
    for (const m of meshesOf(holder)) {
      const mat = m.material as THREE.MeshStandardMaterial;
      const off = filtering && !keep.has(m);
      m.visible = !off || ghost;
      mat.transparent = off && ghost;
      mat.opacity = off && ghost ? 0.07 : 1;
      mat.depthWrite = !(off && ghost);
    }
    if (filtering) {
      const box = new THREE.Box3();
      matched.forEach((e) => { e.group.updateWorldMatrix(true, true); box.union(new THREE.Box3().setFromObject(e.group)); });
      fit(box, undefined);
    } else fit(holder);
  }, [holder, matched, ghost, fit]);

  const label = (e: Entry) => names[e.name] || e.name;
  const unknown = text.trim() && mentions.length === 0;

  return (
    <div className="stage">
      <TopBar actions={<Toggle label="Ghost the rest" checked={ghost} onChange={setGhost} />}>
        <h1 className="topbar-title">Part finder</h1>
        <select value={model ?? ''} onChange={(e) => setModel(e.target.value)} aria-label="Machine">
          {models.map((m) => <option key={m.path} value={m.path}>{m.path.split('/').pop()}</option>)}
        </select>
      </TopBar>
      <aside className="stage-side">
        <h2>Describe the parts</h2>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. “The fuse box next to the display”"
          aria-label="Description"
        />
        <div className="stage-buttons">
          {dictation.supported && (
            <button className="btn" onClick={dictation.toggle} aria-pressed={dictation.listening}>{dictation.listening ? '■ Stop' : '🎙 Speak'}</button>
          )}
          <button className="btn" onClick={() => setText('')} disabled={!text}>Clear</button>
        </div>
        {dictation.interim && <small className="stage-help">{dictation.interim}…</small>}
        {dictation.error && <small className="stage-help">{dictation.error}</small>}
        {matched.length > 0 && (
          <>
            <h2>Showing {matched.length} part{matched.length === 1 ? '' : 's'}</h2>
            <div className="chips">{matched.map((e) => <span key={e.name} className="chip accent" title={e.name}>{label(e)}</span>)}</div>
          </>
        )}
        {unknown && <p className="stage-help">No parts recognised, so everything is shown. Parts are matched by their given names and aliases — add some under “Name parts”.</p>}
        {!text.trim() && <p className="stage-help">Mention parts by name, in a sentence or a list. Only those parts will be shown in 3D.</p>}
      </aside>
      <main className="stage-main">
        <canvas ref={canvasRef} />
        <div className="status">{status}</div>
      </main>
    </div>
  );
}
