'use client';

import { useState, type ReactNode } from 'react';
import type { Mention } from '@/lib/noteTypes';
import { Refs } from './References';

// Note text with the words that refer to parts turned into tappable terms. Terms with one candidate
// open it directly; ambiguous ones show a small menu of candidates first.
export default function LinkedText({ text, mentions, label, onOpen }: {
  text: string;
  mentions?: Mention[];
  label: (partId: string) => string;
  onOpen: (partId: string) => void;
}) {
  const [menu, setMenu] = useState<number | null>(null);
  const nodes: ReactNode[] = [];
  let pos = 0;
  const usable = (mentions ?? [])
    .filter((m) => m.parts.length > 0 && m.start >= 0 && m.start < m.end && m.end <= text.length)
    .sort((a, b) => a.start - b.start);

  usable.forEach((m, i) => {
    if (m.start < pos) return;
    nodes.push(<Refs key={`t${i}`} text={text.slice(pos, m.start)} />);
    nodes.push(
      <span key={i} className="term-wrap">
        <button
          className={`term${m.parts.length > 1 ? ' ambiguous' : ''}`}
          title={m.parts.map(label).join(' / ')}
          onClick={() => (m.parts.length === 1 ? onOpen(m.parts[0]) : setMenu(menu === i ? null : i))}
        >{text.slice(m.start, m.end)}</button>
        {menu === i && (
          <>
            <span className="term-backdrop" onClick={() => setMenu(null)} />
            <span className="term-menu" role="menu">
              {m.parts.map((p) => <button key={p} role="menuitem" onClick={() => { setMenu(null); onOpen(p); }}>{label(p)}</button>)}
            </span>
          </>
        )}
      </span>,
    );
    pos = m.end;
  });
  nodes.push(<Refs key="end" text={text.slice(pos)} />);
  return <>{nodes}</>;
}
