'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Entry } from '@/lib/scene';

type Info = { title: string; description: string; parts: Record<string, string> };
type Patch = { model: string; title?: string; description?: string; parts?: Record<string, string> };

// Right-hand column: user-written info for the machine, or for the selected part (autosaved),
// plus how many main / unique parts have a description.
export default function InfoPanel({ model, root, mainIds, selected, label, onBack }: {
  model: string | null;
  root: Entry | null;
  mainIds: string[];
  selected: Entry | null;
  label: (e: Entry) => string;
  onBack: () => void;
}) {
  const [info, setInfo] = useState<Info>({ title: '', description: '', parts: {} });
  const [saved, setSaved] = useState(true);
  const pending = useRef<Patch | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = async () => {
    clearTimeout(timer.current);
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    await fetch('/api/info', { method: 'PUT', body: JSON.stringify(p) });
    if (!pending.current) setSaved(true);
  };

  // Load on model change (saving anything still pending for the previous one first).
  useEffect(() => {
    if (!model) return;
    let cancelled = false;
    flush().then(() => fetch('/api/info?model=' + encodeURIComponent(model)))
      .then((r) => r.json())
      .then((i: Info) => { if (!cancelled) setInfo(i); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);
  useEffect(() => () => { flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (patch: Omit<Patch, 'model'>) => {
    if (!model) return;
    setInfo((i) => ({ ...i, ...patch, parts: { ...i.parts, ...patch.parts } }));
    pending.current = { ...pending.current, ...patch, parts: { ...pending.current?.parts, ...patch.parts }, model };
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };

  // Main parts = first generation; unique parts = distinct meshes (an entry's `proto`), counted once
  // if any instance of them has a description.
  const stats = useMemo(() => {
    const described = (id: string) => !!info.parts[id]?.trim();
    const protos = new Set<number>(), describedProtos = new Set<number>();
    const walk = (e: Entry) => {
      if (e.proto !== undefined) { protos.add(e.proto); if (described(e.name)) describedProtos.add(e.proto); }
      e.children.forEach(walk);
    };
    if (root) walk(root);
    return {
      main: mainIds.length,
      mainDescribed: mainIds.filter(described).length,
      unique: protos.size,
      uniqueDescribed: describedProtos.size,
    };
  }, [root, mainIds, info.parts]);

  if (!model) return <aside className="info"><h2>Information</h2><div className="info-empty">Load a model to see its information.</div></aside>;

  return (
    <aside className="info">
      <h2>{selected ? 'Part' : 'Machine'} {saved ? '' : '· saving…'}</h2>
      <div className="info-body">
        {selected ? (
          <>
            <button className="info-back" onClick={onBack}>← Machine info</button>
            <div className="info-part">
              <strong>{label(selected)}</strong>
              <code>{selected.name}</code>
            </div>
            <label>Description
              <textarea
                key={selected.name}
                value={info.parts[selected.name] ?? ''}
                placeholder="Describe this part…"
                rows={10}
                onChange={(e) => edit({ parts: { [selected.name]: e.target.value } })}
              />
            </label>
          </>
        ) : (
          <>
            <label>Name
              <input value={info.title} placeholder="Machine name" onChange={(e) => edit({ title: e.target.value })} />
            </label>
            <label>Description
              <textarea value={info.description} placeholder="Describe this machine…" rows={10} onChange={(e) => edit({ description: e.target.value })} />
            </label>
          </>
        )}
        <dl className="facts">
          <dt>Main parts</dt><dd>{stats.mainDescribed} / {stats.main} described</dd>
          <dt>Unique parts</dt><dd>{stats.uniqueDescribed} / {stats.unique} described</dd>
        </dl>
      </div>
    </aside>
  );
}
