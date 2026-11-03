'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchScene } from '@/lib/scene';
import { renderThumbnail } from '@/lib/thumbnail';
import AddFilesDialog from './AddFilesDialog';
import TopBar from './TopBar';

const FEATURES = [
  { href: '/section', label: 'Section view', hint: 'Cut through a machine' },
  { href: '/describe', label: 'Part finder', hint: 'Type or speak, see only those parts' },
];
const KNOWLEDGE = [
  { href: '/knowledge/catalog', label: 'Catalog', hint: 'Look things up' },
  { href: '/knowledge/applicability', label: 'What applies?', hint: 'Answer a few questions' },
  { href: '/knowledge/timeline', label: 'Timeline', hint: 'What changes, and when' },
  { href: '/knowledge/graph', label: 'Relations', hint: 'How they connect' },
  { href: '/knowledge/capture', label: 'Capture', hint: 'Dictate now, sort later' },
];

type ModelFile = { path: string; size: number };
type Preview = { url?: string; state: 'loading' | 'ready' | 'error'; message?: string };

export default function Library() {
  const [models, setModels] = useState<ModelFile[] | null>(null);
  const [previews, setPreviews] = useState<Record<string, Preview>>({});

  const [reload, setReload] = useState(0);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');

  const setPreview = (path: string, p: Preview) => setPreviews((prev) => ({ ...prev, [path]: p }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list: ModelFile[] = await (await fetch('/api/models')).json();
      if (cancelled) return;
      setModels(list);

      // Cached previews first (cheap), then generate the missing ones one at a time —
      // each needs a conversion on the server, which is slow for a new machine.
      const missing: ModelFile[] = [];
      for (const m of list) {
        const url = '/api/thumb?path=' + encodeURIComponent(m.path);
        if ((await fetch(url)).ok) setPreview(m.path, { url: url + '&t=' + Date.now(), state: 'ready' });
        else { missing.push(m); setPreview(m.path, { state: 'loading' }); }
      }
      for (const m of missing) {
        if (cancelled) return;
        try {
          const { holder } = await fetchScene(m.path);
          const blob = await renderThumbnail(holder);
          await fetch('/api/thumb?path=' + encodeURIComponent(m.path), { method: 'PUT', body: blob });
          if (!cancelled) setPreview(m.path, { url: URL.createObjectURL(blob), state: 'ready' });
        } catch (e) {
          if (!cancelled) setPreview(m.path, { state: 'error', message: (e as Error).message });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const q = query.trim().toLowerCase();
  const shown = models?.filter((m) => !q || m.path.toLowerCase().includes(q));

  return (
    <div className="library">
      {adding && <AddFilesDialog onClose={() => setAdding(false)} onUploaded={() => setReload((n) => n + 1)} />}
      <TopBar search={{ value: query, onChange: setQuery, placeholder: 'Search machines…' }} actions={<button className="btn" onClick={() => setAdding(true)}>+ Add</button>}>
        <h1 className="topbar-title">Machines</h1>
        <span className="topbar-note">{models ? `${models.length} file${models.length === 1 ? '' : 's'}` : ''}</span>
      </TopBar>
      <nav className="feature-row" aria-label="Tools">
        {FEATURES.map((f) => <Link key={f.href} className="feature" href={f.href}><strong>{f.label}</strong><small>{f.hint}</small></Link>)}
        <span className="feature-sep" aria-hidden />
        <span className="feature-group">Knowledge</span>
        {KNOWLEDGE.map((f) => <Link key={f.href} className="feature" href={f.href}><strong>{f.label}</strong><small>{f.hint}</small></Link>)}
      </nav>
      {models === null && <div className="naming-empty">Loading…</div>}
      {models?.length === 0 && <div className="naming-empty">No 3D files found. Use “Add” to import some.</div>}
      {models && models.length > 0 && shown?.length === 0 && <div className="naming-empty">No machines match “{query}”.</div>}
      <div className="grid">
        {shown?.map((m) => {
          const pv = previews[m.path];
          const q = encodeURIComponent(m.path);
          return (
            <div key={m.path} className="card">
              <Link href={`/viewer?model=${q}`} className="card-preview">
                {pv?.url && <img src={pv.url} alt="" />}
                {pv?.state === 'loading' && <span>Generating preview…<br /><small>first time takes a minute</small></span>}
                {pv?.state === 'error' && <span title={pv.message}>Preview failed</span>}
              </Link>
              <div className="card-info">
                <div className="card-name" title={m.path}>{m.path.split('/').pop()}</div>
                <small>{(m.size / 1e6).toFixed(1)} MB · {m.path.split('/').slice(0, -1).join('/') || '/'}</small>
                <div className="card-actions">
                  <Link className="btn" href={`/viewer?model=${q}`}>Open</Link>
                  <Link className="btn" href={`/naming?model=${q}`}>Name parts</Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
