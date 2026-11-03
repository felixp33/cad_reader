'use client';

import { useState } from 'react';
import { KINDS, STATUSES, TOPICS, kindLabel, statusLabel, topicLabel, type KnowledgeItem, type Topic } from '@/lib/knowledgeTypes';
import type { KnowledgeInput } from '@/lib/useKnowledge';

export const KindBadge = ({ kind }: { kind: KnowledgeItem['kind'] }) => <span className={`kbadge k-${kind}`}>{kindLabel(kind)}</span>;

// Full detail of one item, with links to related ones.
export function ItemDetail({ item, all, onSelect, onEdit, onDelete }: {
  item: KnowledgeItem; all: KnowledgeItem[]; onSelect: (id: string) => void; onEdit?: () => void; onDelete?: () => void;
}) {
  const related = all.filter((i) => item.links.includes(i.id) || i.links.includes(item.id));
  return (
    <article className="kdetail">
      <div className="kmeta"><KindBadge kind={item.kind} /><span className={`kstatus s-${item.status}`}>{statusLabel(item.status)}</span>{item.region && <span className="chip">{item.region}</span>}</div>
      <h2>{item.title}</h2>
      {item.ref && <div className="kref">{item.ref}{item.year ? ` · ${item.year}` : ''}</div>}
      <p>{item.summary || <em>No summary yet.</em>}</p>
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
