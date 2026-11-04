'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';
import type { KnowledgeItem } from '@/lib/knowledgeTypes';
import { kindLabel } from '@/lib/knowledgeTypes';
import { referenceFinder, type RefSpan } from '@/lib/references';

type Ctx = {
  find: (text: string) => RefSpan[];
  open: (item: KnowledgeItem, from?: HTMLElement) => void; // `from`: the tapped reference, so the panel can line up with its note
  setAnchor: (px: number) => void; // how far from the right edge the panel sits (so it can stay clear of a column)
};
const Reference = createContext<Ctx>({ find: () => [], open: () => {}, setAnchor: () => {} });

const GAP = 16;
const MARGIN = 16; // from the top and bottom edge
const MIN_ROOM = 260; // the panel is moved up when less than this is left below it

// Knows the norms, rules and laws, finds references to them in text, and opens them: entries with a web link
// go to a new tab, entries with a provided document (or neither) open the reference panel next to the chat.
export function ReferenceProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [shown, setShown] = useState<KnowledgeItem | null>(null);
  const [top, setTop] = useState(MARGIN);
  const [anchor, setAnchor] = useState(GAP);
  useEffect(() => { fetch('/api/knowledge').then((r) => r.json()).then(setItems).catch(() => {}); }, []);
  const find = useMemo(() => referenceFinder(items), [items]);
  const current = shown && (items.find((i) => i.id === shown.id) ?? shown);

  const open = (item: KnowledgeItem, from?: HTMLElement) => {
    if (!item.doc && item.url) { window.open(item.url, '_blank', 'noopener,noreferrer'); return; }
    // Line the panel up with the note (or chat message) the reference is in.
    const y = (from?.closest('.kn-card, .ask-msg') ?? from)?.getBoundingClientRect().top ?? MARGIN;
    setTop(Math.round(Math.max(MARGIN, Math.min(y, innerHeight - MIN_ROOM))));
    setShown(item);
  };

  useEffect(() => {
    if (!shown) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShown(null); };
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [shown]);

  return (
    <Reference.Provider value={{ find, open, setAnchor }}>
      {children}
      {current && <ReferencePanel item={current} right={anchor} top={top} onClose={() => setShown(null)} />}
    </Reference.Provider>
  );
}

export const useReference = () => useContext(Reference);

// Keeps the reference panel clear of a column on the right of the screen of this width (plus its margins).
export function useReferenceAnchor(px: number | null) {
  const { setAnchor } = useContext(Reference);
  useEffect(() => {
    if (px === null) return;
    setAnchor(px + 2 * GAP);
    return () => setAnchor(GAP);
  }, [px, setAnchor]);
}

// Text in which references to norms/laws are tappable.
export function Refs({ text }: { text: string }) {
  const { find, open } = useContext(Reference);
  const spans = find(text);
  if (spans.length === 0) return <>{text}</>;
  const nodes: ReactNode[] = [];
  let pos = 0;
  spans.forEach((s, i) => {
    nodes.push(text.slice(pos, s.start));
    nodes.push(
      <button key={i} className="ref" title={`${s.item.ref ? s.item.ref + ' — ' : ''}${s.item.title}`} onClick={(e) => open(s.item, e.currentTarget)}>
        {text.slice(s.start, s.end)}
        {!s.item.doc && s.item.url && <ExternalLink size={11} aria-hidden />}
      </button>,
    );
    pos = s.end;
  });
  nodes.push(text.slice(pos));
  return <>{nodes}</>;
}

function ReferencePanel({ item, right, top, onClose }: { item: KnowledgeItem; right: number; top: number; onClose: () => void }) {
  const src = item.doc ? `/api/knowledge/doc?id=${encodeURIComponent(item.id)}` : null;
  return (
    <section className="ask ref-panel" style={{ right, top, maxHeight: `calc(100vh - ${top}px - ${MARGIN}px)` }} aria-label={item.title}>
      <header className="ask-head">
        <FileText className="ic" size={16} />
        <strong title={item.title}>{item.ref || item.title}</strong>
        {src && <a className="icon-btn" href={src} target="_blank" rel="noopener noreferrer" title="Open in a new tab" aria-label="Open in a new tab"><ExternalLink className="ic" size={16} /></a>}
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X className="ic" size={16} /></button>
      </header>
      {src ? <iframe className="ref-doc" src={src} title={item.doc!.name} /> : (
        <div className="ref-body">
          <div className="kmeta"><span className={`kbadge k-${item.kind}`}>{kindLabel(item.kind)}</span>{item.region && <span className="chip">{item.region}</span>}</div>
          <h2>{item.title}</h2>
          <p>{item.summary || 'No summary yet.'}</p>
          <p className="kn-hint">No document has been provided for this entry yet.</p>
        </div>
      )}
    </section>
  );
}
