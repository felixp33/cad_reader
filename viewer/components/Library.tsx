'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useMode } from '@/lib/mode';
import { fetchScene } from '@/lib/scene';
import { renderThumbnail } from '@/lib/thumbnail';
import { Boxes, Plus, Scale } from 'lucide-react';
import AddDialog from './AddDialog';
import Rules from './Rules';
import AskField from './AskField';
import Chat from './Chat';
import UploadZone, { MODEL_ACCEPT, uploadModels } from './UploadZone';
import { Skeleton, SkeletonCards } from './Skeleton';
import TopBar from './TopBar';

type ModelFile = { path: string; size: number };
type Preview = { url?: string; state: 'loading' | 'ready' | 'error'; message?: string };

// Left navigation of the home screen.
const NAV = [
  { id: 'inventory', label: 'Inventory', icon: Boxes },
  { id: 'rules', label: 'Global rules', icon: Scale },
] as const;
type Section = (typeof NAV)[number]['id'];

export default function Library() {
  const [models, setModels] = useState<ModelFile[] | null>(null);
  const [previews, setPreviews] = useState<Record<string, Preview>>({});

  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');
  const mode = useMode();
  const [section, setSection] = useState<Section>('inventory');
  const [adding, setAdding] = useState(false);
  const [ask, setAsk] = useState('');
  const [chat, setChat] = useState<string | null>(null); // question that opened the chat overlay
  const [summary, setSummary] = useState<Record<string, { title: string; notes: number; authors: string[]; named: number; buildYear: string; updatedAt: string }>>({});
  useEffect(() => { fetch('/api/summary').then((r) => r.json()).then(setSummary).catch(() => {}); }, [reload]);

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
    <div className={`library${chat !== null ? ' chat-open' : ''}`}>
      <TopBar home={false} search={{ value: query, onChange: setQuery, placeholder: section === 'rules' ? 'Search rules…' : 'Search machines…' }} actions={mode === 'creator' ? <button className="btn" onClick={() => setAdding(true)}><Plus className="ic" size={16} /> Add</button> : undefined}>
        <h1 className="topbar-title">{section === 'rules' ? 'Global rules' : 'Machines'}</h1>
        {section === 'inventory' && <span className="topbar-note">{models ? `${models.length} file${models.length === 1 ? '' : 's'}` : ''}</span>}
      </TopBar>
      <div className="home-body">
        <nav className="homenav" aria-label="Sections">
          {NAV.map((n) => (
            <button key={n.id} aria-current={n.id === section ? 'page' : undefined} onClick={() => setSection(n.id)}><n.icon className="ic" size={16} aria-hidden /> {n.label}</button>
          ))}
        </nav>
        <div className="home-main">
      {section === 'rules' ? <Rules query={query} adding={adding} onCloseAdd={() => setAdding(false)} /> : <>
      {adding && (
        <AddDialog title="Add 3D files" onClose={() => setAdding(false)}>
          <UploadZone upload={uploadModels} accept={MODEL_ACCEPT} hint="STEP, IGES, BREP, STL — drop files or a whole folder" onUploaded={() => { setReload((n) => n + 1); setAdding(false); }} />
        </AddDialog>
      )}
      {models === null && <SkeletonCards />}
      {models?.length === 0 && <div className="naming-empty">No 3D files found.{mode === 'creator' && ' Drop some above.'}</div>}
      {models && models.length > 0 && shown?.length === 0 && <div className="naming-empty">No machines match “{query}”.</div>}
      <div className="grid">
        {shown?.map((m) => {
          const pv = previews[m.path];
          const q = encodeURIComponent(m.path);
          return (
            <div key={m.path} className="card">
              <Link href={`/viewer?model=${q}`} className="card-preview">
                {pv?.url && <img src={pv.url} alt="" />}
                {pv?.state === 'loading' && <><Skeleton h="100%" w="100%" style={{ position: 'absolute', inset: 0, borderRadius: 0 }} /><span className="card-wait">Generating preview…<br /><small>first time takes a minute</small></span></>}
                {pv?.state === 'error' && <span title={pv.message}>Preview failed</span>}
              </Link>
              <div className="card-info">
                <div className="card-name" title={m.path}><span className="card-title">{summary[m.path]?.title || m.path.split('/').pop()}</span>{summary[m.path]?.buildYear && <span className="pill" title="Build year">{summary[m.path].buildYear}</span>}</div>
                <small>{(m.size / 1e6).toFixed(1)} MB · {m.path.split('/').pop()}</small>
                {summary[m.path] && (summary[m.path].notes > 0 || summary[m.path].updatedAt) ? (
                  <small className="card-contrib">
                    {summary[m.path].notes} note{summary[m.path].notes === 1 ? '' : 's'}
                    {summary[m.path].updatedAt && <> · edited {new Date(summary[m.path].updatedAt).toLocaleDateString()}</>}
                  </small>
                ) : mode === 'consumer' ? <small className="card-contrib">No information yet</small> : null}
              </div>
            </div>
          );
        })}
      </div>
      </>}
        </div>
      </div>
      {chat === null
        ? <AskField className="home-ask" value={ask} onChange={setAsk} placeholder="Ask about your machines…"
            onSubmit={() => { if (ask.trim()) { setChat(ask.trim()); setAsk(''); } }} />
        : <Chat initialQuestion={chat} onClose={() => setChat(null)} />}
    </div>
  );
}
