'use client';

import { useEffect, useRef, useState } from 'react';
import type { Entry } from '@/lib/scene';
import PartCanvas from './PartCanvas';

const MIN_W = 260, MIN_H = 200, MAX_W = 900, MAX_H = 800;

// Small overlay with its own renderer showing a single part/sub-assembly on its own.
export default function IsolatedView({ entry, title, onClose }: { entry: Entry; title?: string; onClose: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 380, h: 320 });
  const resetRef = useRef<() => void>(() => {});
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const host = () => bodyRef.current!.closest('main')!;
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  // Starts at the top-right of the 3D area.
  useEffect(() => {
    setPos({ x: Math.max(0, host().clientWidth - size.w - 10), y: 12 });
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
    if (!pos || (e.target as HTMLElement).closest('button')) return;
    const { x, y } = pos;
    const { clientWidth: hw, clientHeight: hh } = host();
    drag(e, (dx, dy) => setPos({ x: clamp(x + dx, 0, hw - size.w), y: clamp(y + dy, 0, hh - size.h) }));
  };

  // Grows right/down from the fixed top-left corner, up to the limits or the edge of the 3D area.
  const startResize = (e: React.PointerEvent) => {
    if (!pos) return;
    const { w, h } = size;
    const { clientWidth: hw, clientHeight: hh } = host();
    const maxW = Math.min(MAX_W, hw - pos.x), maxH = Math.min(MAX_H, hh - pos.y);
    drag(e, (dx, dy) => setSize({ w: clamp(w + dx, MIN_W, maxW), h: clamp(h + dy, MIN_H, maxH) }));
  };

  return (
    <div className="iso" style={{ width: size.w, height: size.h, left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
      <div className="iso-head" onPointerDown={startMove}>
        <span className="iso-title">{title ?? entry.name}</span>
        <span className="iso-actions">
          <button onClick={() => resetRef.current()} title="Recenter and fit (double-click also recenters)">⌖</button>
          <button onClick={onClose}>✕</button>
        </span>
      </div>
      <div className="iso-body" ref={bodyRef}><PartCanvas entry={entry} resetRef={resetRef} /></div>
      <div className="iso-resize" onPointerDown={startResize} title="Drag to resize" />
    </div>
  );
}
