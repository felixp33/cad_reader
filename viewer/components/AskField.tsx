'use client';

import { useLayoutEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';

// Pill-shaped question field: grows with its text up to three rows, Enter sends, Shift+Enter adds a line.
// `width` only matters for re-measuring when the container is resized.
export default function AskField({ value, onChange, onSubmit, placeholder, disabled, width, className = '' }: {
  value: string; onChange: (v: string) => void; onSubmit: () => void; placeholder: string; disabled?: boolean; width?: number; className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [value, width]);

  return (
    <form className={`ask-field ${className}`} onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <textarea ref={ref} rows={1} value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSubmit(); } }} />
      <button className="btn primary" disabled={disabled || !value.trim()} aria-label="Send"><ArrowUp className="ic" size={16} /></button>
    </form>
  );
}
