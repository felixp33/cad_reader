'use client';

import { useEffect, useRef, useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import ChatThread from './ChatThread';

// Size limits: roughly half to one-and-a-half times the default 400 × 520.
const DEFAULT = { w: 400, h: 520 };
const MIN_W = 200, MAX_W = 600, MIN_H = 260, MAX_H = 780;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const SUGGESTIONS = ['Give me a short overview of this machine.', 'Which design decisions or lessons learned are documented?', 'Who should I ask about the selected part?'];

// Chat overlay for consumers: ask questions about the machine and the information attached to it.
export default function AskPanel({ model, selected, onClose }: { model: string; selected: { id: string; label: string } | null; onClose: () => void }) {
  const rootRef = useRef<HTMLElement>(null);
  const [size, setSize] = useState(DEFAULT);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const host = () => rootRef.current!.closest('main')!;

  // Starts at the bottom-right of the 3D area, clear of the info column.
  useEffect(() => {
    const { clientWidth: hw, clientHeight: hh } = host();
    const right = parseFloat(getComputedStyle(host()).getPropertyValue('--right')) || 0;
    const w = Math.min(DEFAULT.w, hw - 24), h = Math.min(DEFAULT.h, hh - 88);
    setSize({ w, h });
    setPos({ x: Math.max(0, hw - w - right - 24), y: Math.max(0, hh - h - 24) });
  }, []);

  // Pointer-drag helper: calls onMove with the delta from where the drag started.
  const drag = (e: React.PointerEvent, onMove: (dx: number, dy: number) => void) => {
    e.preventDefault();
    const { clientX: x0, clientY: y0 } = e;
    const move = (ev: PointerEvent) => onMove(ev.clientX - x0, ev.clientY - y0);
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  };

  const startMove = (e: React.PointerEvent) => {
    if (!pos || (e.target as HTMLElement).closest('button')) return;
    const { x, y } = pos;
    const { clientWidth: hw, clientHeight: hh } = host();
    drag(e, (dx, dy) => setPos({ x: clamp(x + dx, 0, hw - size.w), y: clamp(y + dy, 0, hh - size.h) }));
  };

  // Resize from any edge or corner; the left/top edges also move the window so the opposite edge stays put.
  const startResize = (edge: string) => (e: React.PointerEvent) => {
    if (!pos) return;
    e.stopPropagation();
    const { x, y } = pos;
    const { w, h } = size;
    const { clientWidth: hw, clientHeight: hh } = host();
    drag(e, (dx, dy) => {
      let nx = x, ny = y, nw = w, nh = h;
      if (edge.includes('e')) nw = clamp(w + dx, MIN_W, Math.min(MAX_W, hw - x));
      if (edge.includes('w')) { nw = clamp(w - dx, MIN_W, Math.min(MAX_W, x + w)); nx = x + w - nw; }
      if (edge.includes('s')) nh = clamp(h + dy, MIN_H, Math.min(MAX_H, hh - y));
      if (edge.includes('n')) { nh = clamp(h - dy, MIN_H, Math.min(MAX_H, y + h)); ny = y + h - nh; }
      setSize({ w: nw, h: nh });
      setPos({ x: nx, y: ny });
    });
  };

  return (
    <section ref={rootRef} className="ask" aria-label="Ask about this machine" style={{ width: size.w, height: size.h, left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
      <header className="ask-head" onPointerDown={startMove}>
        <Sparkles className="ic" size={16} /> <strong>Ask about this machine</strong>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X className="ic" size={16} /></button>
      </header>
      <ChatThread model={model} selected={selected} suggestions={SUGGESTIONS} width={size.w}
        intro={<p>Ask anything about the machine, its parts and the notes people have left.{selected && <> The selected part (<b>{selected.label}</b>) is used as context.</>}</p>} />
      {['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((edge) => (
        <div key={edge} className={`iso-h iso-h-${edge}`} onPointerDown={startResize(edge)} />
      ))}
    </section>
  );
}
