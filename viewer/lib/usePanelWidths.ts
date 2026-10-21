'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULTS = { left: 320, right: 300 };
const LIMITS = { left: [220, 560], right: [260, 640] } as const;
const MIN_CENTER = 320;
const KEY = 'cad.panels';

type Side = keyof typeof DEFAULTS;

// Widths of the side columns, draggable within limits and remembered per browser.
export function usePanelWidths() {
  const [w, setW] = useState(DEFAULTS);
  const latest = useRef(w);
  latest.current = w;

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      if (s && typeof s.left === 'number' && typeof s.right === 'number') setW(s);
    } catch { /* no storage */ }
  }, []);

  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(latest.current)); } catch { /* no storage */ } };

  const clamp = (side: Side, v: number) => {
    const other = latest.current[side === 'left' ? 'right' : 'left'];
    const [min, max] = LIMITS[side];
    return Math.round(Math.max(min, Math.min(v, max, window.innerWidth - other - MIN_CENTER)));
  };

  const startDrag = useCallback((side: Side) => (e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const x0 = e.clientX, w0 = latest.current[side];
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      setW((p) => ({ ...p, [side]: clamp(side, w0 + (side === 'left' ? dx : -dx)) }));
    };
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); persist(); };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = useCallback((side: Side) => { setW((p) => ({ ...p, [side]: DEFAULTS[side] })); setTimeout(persist); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { widths: w, startDrag, reset };
}
