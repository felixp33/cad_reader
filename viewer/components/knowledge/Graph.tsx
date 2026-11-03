'use client';

import { useMemo, useState } from 'react';
import type { KnowledgeItem } from '@/lib/knowledgeTypes';
import { useKnowledge } from '@/lib/useKnowledge';
import { ItemDetail } from './ItemParts';
import KnowledgeShell from './KnowledgeShell';

const W = 900, H = 640;

// A small force layout: links pull, everything repels, a weak pull keeps it centred. Deterministic start on a circle.
function layout(items: KnowledgeItem[]) {
  const pos = items.map((_, i) => ({ x: W / 2 + 240 * Math.cos((i / items.length) * 2 * Math.PI), y: H / 2 + 240 * Math.sin((i / items.length) * 2 * Math.PI) }));
  const idx = new Map(items.map((it, i) => [it.id, i]));
  const edges: [number, number][] = [];
  items.forEach((it, a) => it.links.forEach((l) => { const b = idx.get(l); if (b !== undefined && !edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) edges.push([a, b]); }));
  for (let step = 0; step < 300; step++) {
    const f = pos.map(() => ({ x: 0, y: 0 }));
    for (let a = 0; a < pos.length; a++) for (let b = a + 1; b < pos.length; b++) {
      const dx = pos[a].x - pos[b].x, dy = pos[a].y - pos[b].y, d2 = Math.max(dx * dx + dy * dy, 100), k = 9000 / d2, d = Math.sqrt(d2);
      f[a].x += (dx / d) * k; f[a].y += (dy / d) * k; f[b].x -= (dx / d) * k; f[b].y -= (dy / d) * k;
    }
    for (const [a, b] of edges) {
      const dx = pos[b].x - pos[a].x, dy = pos[b].y - pos[a].y, d = Math.max(Math.hypot(dx, dy), 1), k = (d - 130) * 0.02;
      f[a].x += (dx / d) * k * d / 10; f[a].y += (dy / d) * k * d / 10; f[b].x -= (dx / d) * k * d / 10; f[b].y -= (dy / d) * k * d / 10;
    }
    pos.forEach((p, i) => {
      f[i].x += (W / 2 - p.x) * 0.01; f[i].y += (H / 2 - p.y) * 0.01;
      p.x = Math.min(W - 60, Math.max(60, p.x + f[i].x * 0.5)); p.y = Math.min(H - 30, Math.max(30, p.y + f[i].y * 0.5));
    });
  }
  return { pos, edges };
}

// Version 4 — the connections emphasis: entries as a network, so you can see which ones belong together.
export default function Graph() {
  const { items } = useKnowledge();
  const [selId, setSelId] = useState<string | null>(null);
  const { pos, edges } = useMemo(() => (items ? layout(items) : { pos: [], edges: [] as [number, number][] }), [items]);
  const sel = items?.find((i) => i.id === selId) ?? null;
  const near = useMemo(() => {
    const s = new Set<number>();
    const si = items?.findIndex((i) => i.id === selId) ?? -1;
    if (si >= 0) { s.add(si); edges.forEach(([a, b]) => { if (a === si) s.add(b); if (b === si) s.add(a); }); }
    return s;
  }, [items, edges, selId]);

  return (
    <KnowledgeShell current="/knowledge/graph" title="Relations">
      <div className="kcols two">
        <section className="kgraph">
          {items === null && <div className="naming-empty">Loading…</div>}
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Network of related norms, rules and laws">
            {edges.map(([a, b], i) => {
              const hot = near.has(a) && near.has(b) && (items![a].id === selId || items![b].id === selId);
              return <line key={i} x1={pos[a].x} y1={pos[a].y} x2={pos[b].x} y2={pos[b].y} className={`kedge${hot ? ' hot' : ''}`} />;
            })}
            {items?.map((it, i) => (
              <g key={it.id} transform={`translate(${pos[i].x},${pos[i].y})`} className={`knode k-${it.kind}${it.status === 'withdrawn' ? ' old' : ''}${selId && !near.has(i) ? ' dim' : ''}${selId === it.id ? ' sel' : ''}`}
                onClick={() => setSelId(it.id)} tabIndex={0} role="button" aria-label={it.title} onKeyDown={(e) => { if (e.key === 'Enter') setSelId(it.id); }}>
                <circle r={10 + Math.min(it.links.length, 6)} />
                <text y={-16 - Math.min(it.links.length, 6)} textAnchor="middle">{it.ref || it.title}</text>
              </g>
            ))}
          </svg>
          <div className="klegend">
            <span><i className="k-norm" /> Norm</span><span><i className="k-law" /> Law</span><span><i className="k-rule" /> Rule</span><span><i className="k-unsorted" /> Unsorted</span>
          </div>
        </section>
        <section className="kdetailpane">
          {sel && items ? <ItemDetail item={sel} all={items} onSelect={setSelId} /> : <div className="naming-empty">Select a node to see what it connects to.</div>}
        </section>
      </div>
    </KnowledgeShell>
  );
}
