'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchScene, firstGeneration, type Entry } from '@/lib/scene';
import PartCanvas from './PartCanvas';
import TopBar from './TopBar';

type ModelFile = { path: string; size: number };

export default function Naming() {
  const [models, setModels] = useState<ModelFile[]>([]);
  const [modelPath, setModelPath] = useState<string | null>(null);
  const [parts, setParts] = useState<Entry[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('Loading…');
  const resetRef = useRef<() => void>(() => {});
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/models').then((r) => r.json()).then((m: ModelFile[]) => {
      setModels(m);
      const wanted = new URLSearchParams(location.search).get('model');
      const initial = m.find((f) => f.path === wanted) ?? m[0];
      if (initial) setModelPath(initial.path); else setStatus('No .stp/.step files found.');
    });
  }, []);

  useEffect(() => {
    if (!modelPath) return;
    let cancelled = false;
    setParts([]);
    (async () => {
      try {
        const [scene, saved] = await Promise.all([
          fetchScene(modelPath, setStatus),
          fetch('/api/names?model=' + encodeURIComponent(modelPath)).then((r) => r.json() as Promise<Record<string, string>>),
        ]);
        if (cancelled) return;
        const list = firstGeneration(scene.roots);
        setNames(saved);
        setParts(list);
        // Start at the first part that still needs a name.
        const firstOpen = list.findIndex((p) => !saved[p.name]);
        setIndex(Math.max(0, firstOpen));
      } catch (e) {
        if (!cancelled) setStatus(`Failed: ${(e as Error).message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [modelPath]);

  const current = parts[index] as Entry | undefined;
  useEffect(() => {
    setDraft(current ? names[current.name] ?? '' : '');
    inputRef.current?.focus();
    // names intentionally omitted: only reset the draft when the part changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const named = useMemo(() => parts.filter((p) => names[p.name]).length, [parts, names]);

  // Autosave: edits are written shortly after typing stops, and immediately when leaving a part.
  const pending = useRef<{ model: string; id: string; name: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [saved, setSaved] = useState(true);

  const flush = async () => {
    clearTimeout(timer.current);
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    await fetch('/api/names', { method: 'PUT', body: JSON.stringify(p) });
    if (!pending.current) setSaved(true);
  };
  useEffect(() => () => { flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (value: string) => {
    if (!current || !modelPath) return;
    setDraft(value);
    const trimmed = value.trim();
    setNames((n) => {
      const next = { ...n };
      if (trimmed) next[current.name] = trimmed; else delete next[current.name];
      return next;
    });
    pending.current = { model: modelPath, id: current.name, name: trimmed };
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  };

  const go = async (i: number) => {
    await flush();
    setIndex(Math.min(parts.length - 1, Math.max(0, i)));
  };

  return (
    <div className="naming">
      <TopBar actions={<span className="topbar-note">{parts.length ? `${named} / ${parts.length} named` : ''}</span>}>
        <h1 className="topbar-title">Name parts</h1>
        {models.length > 1 && (
          <select value={modelPath ?? ''} onChange={(e) => { flush(); setModelPath(e.target.value); }}>
            {models.map((m) => <option key={m.path} value={m.path}>{m.path.split('/').pop()}</option>)}
          </select>
        )}
      </TopBar>

      {parts.length === 0 ? (
        <div className="naming-empty">{status}</div>
      ) : (
        <div className="naming-body">
          <aside className="naming-list">
            {parts.map((p, i) => (
              <div key={p.name} className={`naming-item${i === index ? ' sel' : ''}`} onClick={() => go(i)}>
                <span className="naming-check">{names[p.name] ? '✓' : '○'}</span>
                <span className="naming-item-text">
                  <span>{names[p.name] ?? 'unnamed'}</span>
                  <small>{p.name}</small>
                </span>
              </div>
            ))}
          </aside>
          <section className="naming-main">
            <div className="naming-view">
              <PartCanvas entry={current!} resetRef={resetRef} />
              <button className="naming-reset" onClick={() => resetRef.current()} title="Recenter">⌖</button>
              <button className="naming-arrow left" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous part">←</button>
              <button className="naming-arrow right" onClick={() => go(index + 1)} disabled={index === parts.length - 1} aria-label="Next part">→</button>
              <div className="naming-count">{index + 1} / {parts.length}</div>
            </div>
            <div className="naming-form">
              <div className="naming-id">ID: <code>{current!.name}</code></div>
              <input
                ref={inputRef}
                value={draft}
                placeholder="What is this part called?"
                onChange={(e) => edit(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && index < parts.length - 1) go(index + 1); }}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
