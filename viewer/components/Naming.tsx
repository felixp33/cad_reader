'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchScene, type Entry } from '@/lib/scene';
import PartCanvas from './PartCanvas';

type ModelFile = { path: string; size: number };

// The machine is the first node that branches; its children are the parts to name.
// (STEP files often wrap the machine in single-child container nodes.)
function firstGeneration(roots: Entry[]): Entry[] {
  let level = roots;
  while (level.length === 1 && level[0].children.length > 0) level = level[0].children;
  return level;
}

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
      if (m.length) setModelPath(m[0].path); else setStatus('No .stp/.step files found.');
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

  const save = async (name: string) => {
    if (!current || !modelPath) return;
    const trimmed = name.trim();
    setNames((n) => {
      const next = { ...n };
      if (trimmed) next[current.name] = trimmed; else delete next[current.name];
      return next;
    });
    await fetch('/api/names', { method: 'PUT', body: JSON.stringify({ model: modelPath, id: current.name, name: trimmed }) });
  };

  const go = (i: number) => setIndex(Math.min(parts.length - 1, Math.max(0, i)));

  const saveAndNext = async () => {
    await save(draft);
    go(index + 1);
  };

  return (
    <div className="naming">
      <header className="naming-head">
        <Link className="btn" href="/">← Viewer</Link>
        <h1>Name parts</h1>
        {models.length > 1 && (
          <select value={modelPath ?? ''} onChange={(e) => setModelPath(e.target.value)}>
            {models.map((m) => <option key={m.path} value={m.path}>{m.path.split('/').pop()}</option>)}
          </select>
        )}
        <span className="naming-progress">{parts.length ? `${named} / ${parts.length} named` : ''}</span>
      </header>

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
              <div className="naming-count">{index + 1} / {parts.length}</div>
            </div>
            <div className="naming-form">
              <div className="naming-id">ID: <code>{current!.name}</code></div>
              <input
                ref={inputRef}
                value={draft}
                placeholder="What is this part called?"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveAndNext(); }}
              />
              <div className="naming-actions">
                <button onClick={() => go(index - 1)} disabled={index === 0}>← Previous</button>
                <button onClick={() => go(index + 1)} disabled={index === parts.length - 1}>Skip →</button>
                <button className="primary" onClick={saveAndNext}>Save &amp; next ↵</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
