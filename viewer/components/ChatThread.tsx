'use client';

import { useEffect, useRef, useState } from 'react';
import AskField from './AskField';

type Msg = { role: 'user' | 'assistant'; content: string };

// Conversation about a machine (or all of them): message log, suggestions and the input form.
// `width` only matters for re-measuring the input when its container is resized.
export default function ChatThread({ model, selected, suggestions, intro, width, initialQuestion }: {
  initialQuestion?: string; model: string; selected: { id: string; label: string } | null; suggestions: string[]; intro: React.ReactNode; width?: number;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMessages([]); }, [model]);
  const asked = useRef(false);
  useEffect(() => () => { abort.current?.abort(); asked.current = false; }, []); // also on dev double-mount, so the first question is sent again
  useEffect(() => { // a question handed over from the home screen is sent once
    if (initialQuestion && !asked.current) { asked.current = true; send(initialQuestion); }
  }, [initialQuestion]); // eslint-disable-line react-hooks/exhaustive-deps
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
    <>
      <div className="ask-log" aria-live="polite">
        {messages.length === 0 && (
          <div className="ask-empty">
            {intro}
            {suggestions.map((s) => <button key={s} className="ask-suggest" onClick={() => send(s)}>{s}</button>)}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`ask-msg ${m.role}`}>{m.content || <span className="ask-dots" aria-label="Thinking"><i /><i /><i /></span>}</div>
        ))}
        <div ref={endRef} />
      </div>
      <AskField className="ask-form" value={input} onChange={setInput} onSubmit={() => send(input)} placeholder="Ask a question…" disabled={busy} width={width} />
    </>
  );
}
