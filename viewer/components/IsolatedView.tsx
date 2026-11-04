'use client';

import { useEffect, useRef, useState } from 'react';
import type { Entry } from '@/lib/scene';
import PartCanvas from './PartCanvas';
import { Box, X } from 'lucide-react';

const MIN_W = 260, MIN_H = 200, MAX_W = 900, MAX_H = 800;

// Small overlay with its own renderer showing a single part/sub-assembly on its own.
export default function IsolatedView({ entry, title, onClose }: { entry: Entry; title?: string; onClose: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 380, h: 320 });
  const resetRef = useRef<() => void>(() => {});
  const [wireframe, setWireframe] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const host = () => bodyRef.current!.closest('main')!;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  // Starts at the top-right of the 3D area.
  useEffect(() => {
    const right = parseFloat(getComputedStyle(host()).getPropertyValue('--right')) || 0; // clear the floating info panel
    setPos({ x: Math.max(0, host().clientWidth - size.w - right - 24), y: 56 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!pos || (e.target as HTMLElement).closest('button, .toggle')) return;
    const { x, y } = pos;
    const { clientWidth: hw, clientHeight: hh } = host();
    drag(e, (dx, dy) => setPos({ x: clamp(x + dx, 0, hw - size.w), y: clamp(y + dy, 0, hh - size.h) }));
  };

  // Resize from any edge or corner. Dragging the left/top edge also moves the window so the opposite edge stays put.
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
    <div className="iso" style={{ width: size.w, height: size.h, left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
      <div className="iso-head" onPointerDown={startMove}>
        <span className="iso-title">{title ?? entry.name}</span>
        <span className="iso-actions">
          <button className="btn icon-btn" aria-pressed={wireframe} aria-label="Wireframe" title="Wireframe" onClick={() => setWireframe(!wireframe)}><Box className="ic" size={14} /></button>
          <button onClick={onClose} aria-label="Close"><X className="ic" size={14} /></button>
        </span>
      </div>
      <div className="iso-body" ref={bodyRef}><PartCanvas entry={entry} resetRef={resetRef} wireframe={wireframe} /></div>
      {['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((edge) => (
        <div key={edge} className={`iso-h iso-h-${edge}`} onPointerDown={startResize(edge)} />
      ))}
    </div>
  );
}
