'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp, Sparkles, X } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };

// Size limits: roughly half to one-and-a-half times the default 400 × 520.
const DEFAULT = { w: 400, h: 520 };
const MIN_W = 200, MAX_W = 600, MIN_H = 260, MAX_H = 780;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const SUGGESTIONS = ['Give me a short overview of this machine.', 'Which design decisions or lessons learned are documented?', 'Who should I ask about the selected part?'];

// Chat overlay for consumers: ask questions about the machine and the information attached to it.
export default function AskPanel({ model, selected, onClose }: { model: string; selected: { id: string; label: string } | null; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [size, setSize] = useState(DEFAULT);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const host = () => rootRef.current!.closest('main')!;

  // The field grows with its text, up to three rows (the CSS max-height), then scrolls.
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [input, size.w]);

  // Starts at the bottom-right of the 3D area, clear of the info column and the path bar.
  useEffect(() => {
    const { clientWidth: hw, clientHeight: hh } = host();
    const right = parseFloat(getComputedStyle(host()).getPropertyValue('--right')) || 0;
    const w = Math.min(DEFAULT.w, hw - 24), h = Math.min(DEFAULT.h, hh - 120);
    setSize({ w, h });
    setPos({ x: Math.max(0, hw - w - right - 24), y: Math.max(0, hh - h - 56) });
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

  useEffect(() => { setMessages([]); }, [model]);
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [messages]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const history: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    const ctl = new AbortController();
    abort.current = ctl;
    const timeout = setTimeout(() => ctl.abort('timeout'), 60_000); // no answer at all within a minute
    const write = (content: string) => setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content }]);
    try {
      const res = await fetch('/api/chat', { method: 'POST', signal: ctl.signal, body: JSON.stringify({ model, messages: history, selected: selected && { id: selected.id, label: selected.label } }) });
      if (!res.ok || !res.body) { write(await res.text() || 'Something went wrong.'); return; }
      const reader = res.body.getReader(), decoder = new TextDecoder();
      let answer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        clearTimeout(timeout); // an answer has started, so it is no longer "no answer at all"
        answer += decoder.decode(value, { stream: true });
        write(answer);
      }
      if (!answer) write('No answer came back.');
    } catch (e) {
      if ((e as Error).name !== 'AbortError') write('The connection failed. Please try again.');
      else if (ctl.signal.reason === 'timeout') write('The assistant took too long to answer. Please try again.');
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  };

  return (
    <section ref={rootRef} className="ask" aria-label="Ask about this machine" style={{ width: size.w, height: size.h, left: pos?.x ?? 0, top: pos?.y ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
      <header className="ask-head" onPointerDown={startMove}>
        <Sparkles className="ic" size={16} /> <strong>Ask about this machine</strong>
        <button className="icon-btn" onClick={onClose} aria-label="Close"><X className="ic" size={16} /></button>
      </header>
      <div className="ask-log" aria-live="polite">
        {messages.length === 0 && (
          <div className="ask-empty">
            <p>Ask anything about the machine, its parts and the notes people have left.{selected && <> The selected part (<b>{selected.label}</b>) is used as context.</>}</p>
            {SUGGESTIONS.map((s) => <button key={s} className="ask-suggest" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ask-msg ${m.role}`}>{m.content || <span className="ask-dots" aria-label="Thinking"><i /><i /><i /></span>}</div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="ask-form" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <textarea ref={inputRef} rows={1} value={input} placeholder="Ask a question…" aria-label="Question" onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }} />
        <button className="btn primary icon-btn" disabled={busy || !input.trim()} aria-label="Send"><ArrowUp className="ic" size={16} /></button>
      </form>
      {['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map((edge) => (
        <div key={edge} className={`iso-h iso-h-${edge}`} onPointerDown={startResize(edge)} />
      ))}
    </section>
  );
}
