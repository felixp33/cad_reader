'use client';

import { useState } from 'react';
import { Mic, Square, Trash2 } from 'lucide-react';
import { KINDS, type Kind } from '@/lib/knowledgeTypes';
import { useDictation } from '@/lib/useDictation';
import { useKnowledge } from '@/lib/useKnowledge';
import KnowledgeShell from './KnowledgeShell';

const titleOf = (text: string) => {
  const first = text.trim().split(/(?<=[.!?])\s|\n/)[0];
  return first.length > 70 ? first.slice(0, 67).trimEnd() + '…' : first;
};

// Version 5 — the capture emphasis: say or type what you know right now, sort it afterwards by dragging
// cards between the columns.
export default function Capture() {
  const { items, save, remove } = useKnowledge();
  const [text, setText] = useState('');
  const [over, setOver] = useState<Kind | null>(null);
  const dictation = useDictation((p) => setText((t) => (t.trim() ? t.trimEnd() + ' ' : '') + p));

  const add = async () => {
    if (!text.trim()) return;
    await save({ title: titleOf(text), summary: text.trim(), kind: 'unsorted' });
    setText('');
  };
  const move = (id: string, kind: Kind) => { const it = items?.find((i) => i.id === id); if (it && it.kind !== kind) save({ ...it, kind }); };

  return (
    <KnowledgeShell current="/knowledge/capture" title="Capture">
      <div className="kcapture">
        <div className="kcompose">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} aria-label="New knowledge" placeholder="“Guards need an interlock if they are opened more than once per shift…”" onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add(); }} />
          <div className="stage-buttons">
            {dictation.supported && <button className="btn" onClick={dictation.toggle} aria-pressed={dictation.listening}>{dictation.listening ? <><Square className="ic" size={13} /> Stop</> : <><Mic className="ic" size={15} /> Speak</>}</button>}
            <button className="btn primary" onClick={add} disabled={!text.trim()}>Save to Unsorted</button>
          </div>
          {dictation.interim && <small className="stage-help">{dictation.interim}…</small>}
          {dictation.error && <small className="stage-help">{dictation.error}</small>}
        </div>
        <div className="kboard">
          {KINDS.map((k) => (
            <div key={k.id} className={`kcolumn${over === k.id ? ' over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setOver(k.id); }} onDragLeave={() => setOver(null)}
              onDrop={(e) => { e.preventDefault(); setOver(null); move(e.dataTransfer.getData('text/plain'), k.id); }}>
              <h2>{k.label} <span>{items?.filter((i) => i.kind === k.id).length ?? 0}</span></h2>
              <small>{k.hint}</small>
              {items?.filter((i) => i.kind === k.id).map((i) => (
                <div key={i.id} className="kcard" draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', i.id)}>
                  <strong>{i.title}</strong>
                  {i.ref && <div className="kref">{i.ref}</div>}
                  {i.summary && i.summary !== i.title && <p>{i.summary}</p>}
                  <div className="kcard-foot">
                    <select aria-label="Move to" value={i.kind} onChange={(e) => move(i.id, e.target.value as Kind)}>{KINDS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
                    <button className="icon" aria-label="Delete" title="Delete" onClick={() => { if (confirm('Delete this entry?')) remove(i.id); }}><Trash2 className="ic" size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </KnowledgeShell>
  );
}
