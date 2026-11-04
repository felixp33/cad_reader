'use client';

import { useRef, useState } from 'react';
import { ExternalLink, FileText, Upload } from 'lucide-react';
import { useReference } from '../References';
import { KINDS, STATUSES, TOPICS, kindLabel, statusLabel, topicLabel, type KnowledgeItem, type Topic } from '@/lib/knowledgeTypes';
import type { KnowledgeInput } from '@/lib/useKnowledge';

export const KindBadge = ({ kind }: { kind: KnowledgeItem['kind'] }) => <span className={`kbadge k-${kind}`}>{kindLabel(kind)}</span>;

// Full detail of one item, with links to related ones.
export function ItemDetail({ item, all, onSelect, onEdit, onDelete, onUpload, onRemoveDoc }: {
  item: KnowledgeItem; all: KnowledgeItem[]; onSelect: (id: string) => void; onEdit?: () => void; onDelete?: () => void;
  onUpload?: (file: File) => Promise<void>; onRemoveDoc?: () => void;
}) {
  const { open } = useReference();
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');
  const related = all.filter((i) => item.links.includes(i.id) || i.links.includes(item.id));
  return (
    <article className="kdetail">
      <div className="kmeta"><KindBadge kind={item.kind} /><span className={`kstatus s-${item.status}`}>{statusLabel(item.status)}</span>{item.region && <span className="chip">{item.region}</span>}</div>
      <h2>{item.title}</h2>
      {item.ref && <div className="kref">{item.ref}{item.year ? ` · ${item.year}` : ''}</div>}
      <p>{item.summary || <em>No summary yet.</em>}</p>
      {(item.doc || item.url || onUpload) && (
        <div className="ksource">
          {item.doc && <button className="btn" onClick={() => open(item)}><FileText className="ic" size={14} /> {item.doc.name}</button>}
          {item.url && <a className="btn" href={item.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="ic" size={14} /> Open the text</a>}
          {onUpload && (<>
            <input ref={fileInput} type="file" hidden accept="application/pdf,text/html,text/plain,image/png,image/jpeg,image/svg+xml"
              onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) { setUploadError(''); try { await onUpload(f); } catch (err) { setUploadError((err as Error).message); } } }} />
            <button className="btn" onClick={() => fileInput.current?.click()}><Upload className="ic" size={14} /> {item.doc ? 'Replace document' : 'Provide a document'}</button>
            {item.doc && onRemoveDoc && <button className="btn" onClick={onRemoveDoc}>Remove document</button>}
          </>)}
          {uploadError && <span className="kn-error">{uploadError}</span>}
        </div>
      )}
      {item.topics.length > 0 && <div className="chips">{item.topics.map((t) => <span key={t} className="chip">{topicLabel(t)}</span>)}</div>}
      {related.length > 0 && (
        <>
          <h3>Related</h3>
          <ul className="klist">{related.map((r) => <li key={r.id}><button className="klink" onClick={() => onSelect(r.id)}>{r.ref ? `${r.ref} — ` : ''}{r.title}</button></li>)}</ul>
        </>
      )}
      {(onEdit || onDelete) && (
        <div className="stage-buttons">
          {onEdit && <button className="btn" onClick={onEdit}>Edit</button>}
          {onDelete && <button className="btn" onClick={() => { if (confirm('Delete this entry?')) onDelete(); }}>Delete</button>}
        </div>
      )}
    </article>
  );
}

// Add / edit form.
export function ItemForm({ initial, all, onSave, onCancel }: {
  initial?: KnowledgeItem; all: KnowledgeItem[]; onSave: (i: KnowledgeInput) => Promise<unknown>; onCancel: () => void;
}) {
  const [f, setF] = useState<KnowledgeInput>(initial ?? { title: '', kind: 'norm', status: 'in-force', topics: [], links: [] });
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof KnowledgeInput>(k: K, v: KnowledgeInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggle = <T extends string>(list: T[] | undefined, v: T) => ((list ?? []).includes(v) ? (list ?? []).filter((x) => x !== v) : [...(list ?? []), v]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    setBusy(true);
    try { await onSave(f); } finally { setBusy(false); }
  };
  return (
    <form className="kform" onSubmit={submit}>
      <h2>{initial ? 'Edit entry' : 'New entry'}</h2>
      <label>Title<input value={f.title} onChange={(e) => set('title', e.target.value)} autoFocus required /></label>
      <label>Reference<input value={f.ref ?? ''} onChange={(e) => set('ref', e.target.value)} placeholder="e.g. EN ISO 12100:2010" /></label>
      <div className="krow">
        <label>Type<select value={f.kind} onChange={(e) => set('kind', e.target.value as KnowledgeItem['kind'])}>{KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</select></label>
        <label>Status<select value={f.status} onChange={(e) => set('status', e.target.value as KnowledgeItem['status'])}>{STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></label>
        <label>Year<input type="number" value={f.year ?? ''} onChange={(e) => set('year', e.target.value ? +e.target.value : undefined)} /></label>
        <label>Region<input value={f.region ?? ''} onChange={(e) => set('region', e.target.value)} placeholder="EU, DE…" /></label>
      </div>
      <label>Link to the text<input type="url" value={f.url ?? ''} onChange={(e) => set('url', e.target.value)} placeholder="https://… (opens in a new tab)" /></label>
      <label>Also called<input value={(f.aliases ?? []).join(', ')} onChange={(e) => set('aliases', e.target.value.split(',').map((a) => a.trimStart()))} placeholder="other names used in notes, separated by commas" /></label>
      <label>Summary<textarea value={f.summary ?? ''} onChange={(e) => set('summary', e.target.value)} rows={4} /></label>
      <fieldset><legend>Applies to</legend>
        <div className="chips">{TOPICS.map((t) => <label key={t.id} className="chip check"><input type="checkbox" checked={(f.topics ?? []).includes(t.id as Topic)} onChange={() => set('topics', toggle(f.topics, t.id as Topic))} />{t.label}</label>)}</div>
      </fieldset>
      <fieldset><legend>Related entries</legend>
        <div className="chips">{all.filter((i) => i.id !== initial?.id).map((i) => <label key={i.id} className="chip check"><input type="checkbox" checked={(f.links ?? []).includes(i.id)} onChange={() => set('links', toggle(f.links, i.id))} />{i.ref || i.title}</label>)}</div>
      </fieldset>
      <div className="stage-buttons"><button className="btn primary" disabled={busy}>Save</button><button type="button" className="btn" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}
