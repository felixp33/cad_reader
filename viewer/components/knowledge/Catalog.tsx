'use client';

import { useMemo, useState } from 'react';
import { KINDS, TOPICS, type Kind, type Topic } from '@/lib/knowledgeTypes';
import { useMode } from '@/lib/mode';
import { useKnowledge } from '@/lib/useKnowledge';
import { ItemDetail, ItemForm, KindBadge } from './ItemParts';
import { SkeletonRows } from '../Skeleton';
import KnowledgeShell from './KnowledgeShell';

// Version 1 — the lookup emphasis: a searchable, filterable reference list with full detail.
export default function Catalog() {
  const { items, save, remove } = useKnowledge();
  const readOnly = useMode() === 'consumer';
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<Kind | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [form, setForm] = useState<'new' | 'edit' | null>(null);

  const shown = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (items ?? [])
      .filter((i) => (!kind || i.kind === kind) && (!topic || i.topics.includes(topic)))
      .filter((i) => !n || `${i.title} ${i.ref} ${i.summary} ${i.region}`.toLowerCase().includes(n))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [items, q, kind, topic]);
  const sel = items?.find((i) => i.id === selId) ?? null;

  return (
    <KnowledgeShell current="/knowledge/catalog" title="Knowledge catalog" search={{ value: q, onChange: setQ, placeholder: 'Search norms, rules, laws…' }}
      actions={readOnly ? undefined : <button className="btn" onClick={() => { setSelId(null); setForm('new'); }}>+ New entry</button>}>
      <div className="kcols">
        <aside className="kside">
          <h2>Type</h2>
          <div className="chips">{KINDS.map((k) => <button key={k.id} className="chip pick" aria-pressed={kind === k.id} onClick={() => setKind(kind === k.id ? null : k.id)}>{k.label}</button>)}</div>
          <h2>Applies to</h2>
          <div className="chips">{TOPICS.map((t) => <button key={t.id} className="chip pick" aria-pressed={topic === t.id} onClick={() => setTopic(topic === t.id ? null : t.id)}>{t.label}</button>)}</div>
        </aside>
        <section className="klistpane">
          {items === null && <SkeletonRows rows={8} />}
          {items && shown.length === 0 && <div className="naming-empty">Nothing matches.</div>}
          {shown.map((i) => (
            <button key={i.id} className={`krow-item${selId === i.id ? ' sel' : ''}`} onClick={() => { setSelId(i.id); setForm(null); }}>
              <span className="kref">{i.ref || '—'}</span>
              <span className="ktitle">{i.title}</span>
              <KindBadge kind={i.kind} />
            </button>
          ))}
        </section>
        <section className="kdetailpane">
          {form && items ? (
            <ItemForm initial={form === 'edit' ? sel ?? undefined : undefined} all={items} onCancel={() => setForm(null)}
              onSave={async (i) => { const s = await save(i); setSelId(s.id); setForm(null); }} />
          ) : sel && items ? (
            <ItemDetail item={sel} all={items} onSelect={setSelId} onEdit={readOnly ? undefined : () => setForm('edit')} onDelete={readOnly ? undefined : () => { remove(sel.id); setSelId(null); }} />
          ) : <div className="naming-empty">{readOnly ? 'Select an entry.' : 'Select an entry, or add a new one.'}</div>}
        </section>
      </div>
    </KnowledgeShell>
  );
}
