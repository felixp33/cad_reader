'use client';

import { useMemo, useState } from 'react';
import { KINDS, topicLabel, type Topic } from '@/lib/knowledgeTypes';
import { useKnowledge } from '@/lib/useKnowledge';
import { ItemDetail } from './ItemParts';
import KnowledgeShell from './KnowledgeShell';

const QUESTIONS: { topic: Topic; q: string }[] = [
  { topic: 'electrical', q: 'Does it contain electrical equipment (mains supply, wiring, control cabinet)?' },
  { topic: 'controls', q: 'Do safety functions depend on the control system (e-stop, interlocks, light curtains)?' },
  { topic: 'guarding', q: 'Does it have guards, covers or an enclosure around hazardous areas?' },
  { topic: 'robot', q: 'Does it include or work with an industrial robot?' },
  { topic: 'emc', q: 'Does it contain drives, switching power supplies or radio parts?' },
  { topic: 'operation', q: 'Will it be operated and maintained by people at a workplace?' },
];

// Version 2 — the decision emphasis: answer a few plain questions about a machine, get the norms, rules
// and laws that are likely to matter, each with the reason it showed up.
export default function Applicability() {
  const { items } = useKnowledge();
  const [yes, setYes] = useState<Set<Topic>>(new Set());
  const [showOld, setShowOld] = useState(false);
  const [selId, setSelId] = useState<string | null>(null);

  const result = useMemo(() => (items ?? [])
    .filter((i) => showOld || i.status !== 'withdrawn')
    .map((i) => ({ item: i, why: i.topics.filter((t) => t !== 'general' && yes.has(t)), always: i.topics.includes('general') }))
    .filter((r) => r.always || r.why.length > 0), [items, yes, showOld]);
  const sel = items?.find((i) => i.id === selId) ?? null;
  const flip = (t: Topic) => setYes((p) => { const n = new Set(p); if (n.has(t)) n.delete(t); else n.add(t); return n; });

  return (
    <KnowledgeShell current="/knowledge/applicability" title="What applies?">
      <div className="kcols two">
        <aside className="kside wide">
          <h2>About the machine</h2>
          {QUESTIONS.map((x) => (
            <label key={x.topic} className="kquestion">
              <input type="checkbox" checked={yes.has(x.topic)} onChange={() => flip(x.topic)} />
              <span>{x.q}</span>
            </label>
          ))}
          <label className="kquestion"><input type="checkbox" checked={showOld} onChange={() => setShowOld((s) => !s)} /><span>Include superseded editions</span></label>
        </aside>
        <section className="klistpane">
          <h2 className="kh">{result.length} likely relevant</h2>
          {KINDS.filter((k) => result.some((r) => r.item.kind === k.id)).map((k) => (
            <div key={k.id}>
              <h3 className="kgroup">{k.label}s</h3>
              {result.filter((r) => r.item.kind === k.id).map(({ item, why, always }) => (
                <button key={item.id} className={`krow-item${selId === item.id ? ' sel' : ''}`} onClick={() => setSelId(item.id)}>
                  <span className="kref">{item.ref || '—'}</span>
                  <span className="ktitle">{item.title}</span>
                  <span className="chips">{always ? <span className="chip accent">every machine</span> : why.map((t) => <span key={t} className="chip accent">{topicLabel(t)}</span>)}</span>
                </button>
              ))}
            </div>
          ))}
          {sel && items && <div className="kinline"><ItemDetail item={sel} all={items} onSelect={setSelId} /></div>}
        </section>
      </div>
    </KnowledgeShell>
  );
}
