'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@/lib/user';
import type { Entry } from '@/lib/scene';
import { MACHINE, NOTE_TYPES, type Mention, type Note, type NoteType } from '@/lib/noteTypes';
import type { NoteInput } from '@/lib/useNotes';
import { useDictation } from '@/lib/useDictation';
import LinkedText from './LinkedText';

type Props = {
  notes: Note[];
  root: Entry | null;
  selected: Entry | null;
  label: (e: Entry) => string;
  names: Record<string, string>;
  onOpenPart: (id: string) => void;
  onSave: (n: NoteInput) => Promise<Note>;
  onRemove: (id: string) => Promise<void>;
};

const AUTOSAVE_MS = 800;

const typeLabel = (t: NoteType) => NOTE_TYPES.find((x) => x.id === t)?.label ?? t;

// Capture + list of expert knowledge for the machine or the selected part.
export default function KnowledgeNotes({ notes, root, selected, label, names, onOpenPart, onSave, onRemove }: Props) {
  const target = selected?.name ?? MACHINE;
  const [editing, setEditing] = useState<Note | null>(null);
  const [draft, setDraft] = useState(0); // bumped to start a fresh new-note form
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
      <p><LinkedText text={n.text} mentions={n.mentions} label={partLabel} onOpen={onOpenPart} /></p>
      {n.parts.filter((p) => p !== target).length > 0 && (
        <div className="kn-chips">
          {n.parts.filter((p) => p !== target).map((p) => <span key={p} className="kn-chip">{partLabel(p)}</span>)}
        </div>
      )}
      <div className="kn-foot">
        <small>{n.author || 'Unknown'} · {new Date(n.updatedAt).toLocaleDateString()}</small>
        {!from && (
          <span>
            <button className="icon" title="Edit note" aria-label="Edit note" onClick={() => setEditing(n)}><PencilIcon /></button>
            <button className="icon" title="Delete note" aria-label="Delete note" onClick={() => { if (confirm('Delete this note?')) onRemove(n.id); }}><TrashIcon /></button>
          </span>
        )}
      </div>
    </div>
  );

  return (
    <section className="kn">
      <h3>Knowledge notes <span>{direct.length}</span></h3>
      <NoteForm
        key={editing?.id ?? `new-${target}-${draft}`}
        target={target}
        initial={editing}
        names={names}
        onSave={onSave}
        onDone={() => { setEditing(null); setDraft((d) => d + 1); }}
      />
      {direct.map((n) => card(n))}
      {inherited.length > 0 && <h4>From the machine / parent assemblies</h4>}
      {inherited.map((n) => card(n, partLabel(n.parts.find((p) => inheritedFrom.includes(p))!)))}
    </section>
  );
}

const overlaps = (a: Mention, b: Mention) => a.start < b.end && b.start < a.end;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// Edits a new or existing note. Changes are saved automatically shortly after typing/dictation pauses,
// and on leaving the form; the first save of a new note creates it, later ones update it.
function NoteForm({ target, initial, names, onSave, onDone }: {
  target: string; initial: Note | null; names: Record<string, string>;
  onSave: (n: NoteInput) => Promise<Note>; onDone: () => void;
}) {
  const [text, setText] = useState(initial?.text ?? '');
  const links = initial?.parts ?? [target]; // a note is about what was selected when it was written
  const user = useUser();
  const author = initial?.author || user.name;
  const [saveState, setSaveState] = useState<SaveState>('idle');
  // Manual corrections to the automatically found links (null = untouched), only offered while the text is unchanged.
  const [overrides, setOverrides] = useState<Mention[] | null>(null);
  const textSame = !!initial && text.trim() === initial.text;
  const manual = overrides ?? (initial?.mentions ?? []).filter((m) => m.manual);
  const shown = [...manual, ...(initial?.mentions ?? []).filter((a) => !a.manual && !manual.some((m) => overlaps(a, m)))].sort((a, b) => a.start - b.start);
  const setMention = (m: Mention, parts: string[] | null) => {
    const rest = manual.filter((x) => !overlaps(x, m));
    setOverrides(parts ? [...rest, { start: m.start, end: m.end, text: m.text, parts, manual: true }] : rest);
  };
  const dictation = useDictation((t) => setText((prev) => (prev ? prev + ' ' : '') + t));

  // Saves run one after another so a new note is created once, and later saves reuse its id.
  const id = useRef(initial?.id);
  const queue = useRef(Promise.resolve());
  const lastSaved = useRef(initial ? JSON.stringify([initial.text, null]) : '');
  const latest = useRef<NoteInput | null>(null);
  latest.current = text.trim() && links.length ? { text, parts: links, author, overrides: textSame && overrides ? overrides : undefined } : null;

  const flush = useCallback(() => {
    queue.current = queue.current.then(async () => {
      const input = latest.current;
      const key = input && JSON.stringify([input.text.trim(), input.overrides ?? null]);
      if (!input || key === lastSaved.current) return;
      setSaveState('saving');
      try {
        const saved = await onSave({ ...input, id: id.current });
        id.current = saved.id;
        lastSaved.current = key!;
        setSaveState('saved');
      } catch { setSaveState('error'); }
    });
  }, [onSave]);

  useEffect(() => {
    const t = setTimeout(flush, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [text, overrides, flush]);
  useEffect(() => () => flush(), [flush]); // save pending changes when the form goes away

  const done = () => {
    if (dictation.listening) dictation.toggle();
    flush();
    onDone();
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
      {initial && (
        textSame ? shown.length > 0 && (
          <div className="kn-links">
            <span className="kn-label">Linked words — pick the right part, or unlink</span>
            {shown.map((m) => m.parts.length === 0 ? (
              <div key={m.start} className="kn-mention off"><s>{m.text}</s><button onClick={() => setMention(m, null)}>Link again</button></div>
            ) : (
              <div key={m.start} className="kn-mention">
                <strong>{m.text}</strong>
                <select value={m.parts.length === 1 ? m.parts[0] : ''} onChange={(e) => setMention(m, [e.target.value])}>
                  {m.parts.length > 1 && <option value="" disabled>Choose…</option>}
                  {[...new Set([...m.parts, ...Object.keys(names)])].map((p) => <option key={p} value={p}>{names[p] ?? p}</option>)}
                </select>
                <button title="Don't link this word" aria-label="Unlink" onClick={() => setMention(m, [])}>×</button>
              </div>
            ))}
          </div>
        ) : <div className="kn-hint">Links to parts are updated after saving.</div>
      )}
      <div className="kn-row">
        <span className={`kn-save${saveState === 'error' ? ' err' : ''}`}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? "Couldn't save — retrying on next change" : ''}
        </span>
        {(initial || saveState !== 'idle') && <button onClick={done}>{initial ? 'Done' : 'New note'}</button>}
      </div>
    </div>
  );
}

const PencilIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);
const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
  </svg>
);
const MicIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" />
  </svg>
);
const StopIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
);
