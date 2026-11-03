'use client';

import { useMemo, useState } from 'react';
import { statusLabel } from '@/lib/knowledgeTypes';
import { useKnowledge } from '@/lib/useKnowledge';
import { ItemDetail, KindBadge } from './ItemParts';
import { SkeletonRows } from '../Skeleton';
import KnowledgeShell from './KnowledgeShell';

// Version 3 — the change-over-time emphasis: everything laid out by year, so you see what is new,
// what is coming and what has been replaced.
export default function Timeline() {
  const { items } = useKnowledge();
  const [selId, setSelId] = useState<string | null>(null);
  const years = useMemo(() => {
    const by = new Map<number | 'undated', typeof items>();
    for (const i of items ?? []) {
      const k = i.year ?? 'undated';
      by.set(k, [...(by.get(k) ?? []), i]);
    }
    const keys = [...by.keys()].filter((k): k is number => k !== 'undated').sort((a, b) => b - a);
    return [...keys, ...(by.has('undated') ? ['undated' as const] : [])].map((k) => ({ year: k, items: by.get(k)! }));
  }, [items]);
  const sel = items?.find((i) => i.id === selId) ?? null;

  return (
    <KnowledgeShell current="/knowledge/timeline" title="Timeline">
      <div className="kcols two">
        <section className="ktimeline">
          {items === null && <SkeletonRows rows={8} />}
          {years.map((y) => (
            <div key={y.year} className="kyear">
              <div className="kyear-label">{y.year === 'undated' ? 'No date' : y.year}</div>
              <div className="kyear-items">
                {y.items!.map((i) => (
                  <button key={i.id} className={`kevent s-${i.status}${selId === i.id ? ' sel' : ''}`} onClick={() => setSelId(i.id)}>
                    <span className="kdot" aria-hidden />
                    <span className="ktitle">{i.ref ? `${i.ref} — ` : ''}{i.title}</span>
                    <KindBadge kind={i.kind} />
                    {i.status !== 'in-force' && <span className={`kstatus s-${i.status}`}>{statusLabel(i.status)}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
        <section className="kdetailpane">
          {sel && items ? <ItemDetail item={sel} all={items} onSelect={setSelId} /> : <div className="naming-empty">Select an entry on the timeline.</div>}
        </section>
      </div>
    </KnowledgeShell>
  );
}
