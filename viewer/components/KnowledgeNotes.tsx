'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Entry } from '@/lib/scene';
import { MACHINE, NOTE_TYPES, type Note, type NoteType } from '@/lib/noteTypes';
import type { NoteInput } from '@/lib/useNotes';
import { useDictation } from '@/lib/useDictation';

type Props = {
  notes: Note[];
  root: Entry | null;
  selected: Entry | null;
  label: (e: Entry) => string;
  onSave: (n: NoteInput) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
};

const typeLabel = (t: NoteType) => NOTE_TYPES.find((x) => x.id === t)?.label ?? t;

// Capture + list of expert knowledge for the machine or the selected part.
export default function KnowledgeNotes({ notes, root, selected, label, onSave, onRemove }: Props) {
  const target = selected?.name ?? MACHINE;
  const [editing, setEditing] = useState<Note | null>(null);
  useEffect(() => setEditing(null), [target]);

  // Entries by id, and each entry's ancestor ids (so notes on an assembly show up for its parts).
  const { byId, ancestors } = useMemo(() => {
    const byId = new Map<string, Entry>();
    const ancestors = new Map<string, string[]>();
    const walk = (e: Entry, path: string[]) => {
      if (!byId.has(e.name)) { byId.set(e.name, e); ancestors.set(e.name, path); }
      e.children.forEach((c) => walk(c, [...path, e.name]));
    };
    if (root) walk(root, []);
    return { byId, ancestors };
  }, [root]);

  const partLabel = (id: string) => (id === MACHINE ? 'Whole machine' : byId.has(id) ? label(byId.get(id)!) : id);

  const inheritedFrom = target === MACHINE ? [] : [MACHINE, ...(ancestors.get(target) ?? [])];
  const direct = notes.filter((n) => n.parts.includes(target));
  const inherited = notes.filter((n) => !n.parts.includes(target) && n.parts.some((p) => inheritedFrom.includes(p)));

  const card = (n: Note, from?: string) => (
    <div key={n.id} className={`kn-card${from ? ' inherited' : ''}`}>
      <div className="kn-meta">
        <span className={`kn-type t-${n.type}`}>{typeLabel(n.type)}</span>
        {from && <span className="kn-from">via {from}</span>}
      </div>
      <p>{n.text}</p>
      {n.parts.filter((p) => p !== target).length > 0 && (
        <div className="kn-chips">
          {n.parts.filter((p) => p !== target).map((p) => <span key={p} className="kn-chip">{partLabel(p)}</span>)}
        </div>
      )}
      <div className="kn-foot">
        <small>{n.author || 'Unknown'} · {new Date(n.updatedAt).toLocaleDateString()}</small>
        {!from && (
          <span>
            <button onClick={() => setEditing(n)}>Edit</button>
            <button onClick={() => { if (confirm('Delete this note?')) onRemove(n.id); }}>Delete</button>
          </span>
        )}
      </div>
    </div>
  );

  return (
    <section className="kn">
      <h3>Knowledge notes <span>{direct.length}</span></h3>
      <NoteForm
        key={editing?.id ?? `new-${target}`}
        target={target}
        initial={editing}
        onSave={async (n) => { await onSave(n); setEditing(null); }}
        onCancel={editing ? () => setEditing(null) : undefined}
      />
      {direct.map((n) => card(n))}
      {inherited.length > 0 && <h4>From the machine / parent assemblies</h4>}
      {inherited.map((n) => card(n, partLabel(n.parts.find((p) => inheritedFrom.includes(p))!)))}
    </section>
  );
}

function NoteForm({ target, initial, onSave, onCancel }: {
  target: string; initial: Note | null;
  onSave: (n: NoteInput) => Promise<void>; onCancel?: () => void;
}) {
  const [text, setText] = useState(initial?.text ?? '');
  const links = initial?.parts ?? [target]; // a note is about what was selected when it was written
  const [author, setAuthor] = useState('');
  const [busy, setBusy] = useState(false);
  const dictation = useDictation((t) => setText((prev) => (prev ? prev + ' ' : '') + t));

  useEffect(() => { try { setAuthor(localStorage.getItem('cad.author') ?? ''); } catch { /* no storage */ } }, []);

  const submit = async () => {
    if (!text.trim() || links.length === 0) return;
    if (dictation.listening) dictation.toggle();
    setBusy(true);
    try {
      try { localStorage.setItem('cad.author', author); } catch { /* no storage */ }
      await onSave({ id: initial?.id, text, parts: links, author });
      if (!initial) setText('');
    } finally { setBusy(false); }
  };

  return (
    <div className="kn-form">
      <div className="kn-textwrap">
        <textarea value={text} rows={5} placeholder="Why is it built this way? What changed from the predecessor? What didn't work?" onChange={(e) => setText(e.target.value)} />
        {dictation.supported && (
          <button className={`kn-mic${dictation.listening ? ' live' : ''}`} onClick={dictation.toggle} title={dictation.listening ? 'Stop dictation' : 'Dictate'} aria-label="Dictate">
            {dictation.listening ? <StopIcon /> : <MicIcon />}
          </button>
        )}
      </div>
      {dictation.listening && <div className="kn-live">Listening… {dictation.interim && <em>{dictation.interim}</em>}</div>}
      {dictation.error && <div className="kn-error">{dictation.error}</div>}
      {!dictation.supported && <div className="kn-hint">Dictation needs Chrome or Safari.</div>}
      <div className="kn-row">
        <input value={author} placeholder="Your name" onChange={(e) => setAuthor(e.target.value)} />
        {onCancel && <button onClick={onCancel}>Cancel</button>}
        <button className="primary" disabled={busy || !text.trim()} onClick={submit}>{busy ? 'Saving…' : initial ? 'Update note' : 'Save note'}</button>
      </div>
    </div>
  );
}

const MicIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" />
  </svg>
);
const StopIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
);
