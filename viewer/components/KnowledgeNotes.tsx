'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Mic, Pencil, ScanSearch, Square, Trash2, X } from 'lucide-react';
import { useMode } from '@/lib/mode';
import { useUser } from '@/lib/user';
import type { Entry } from '@/lib/scene';
import { MACHINE, NOTE_TYPES, notePartIds, type Mention, type Note, type NoteType } from '@/lib/noteTypes';
import type { NoteInput } from '@/lib/useNotes';
import { useDictation } from '@/lib/useDictation';
import AuthorPopup from './AuthorPopup';
import LinkedText from './LinkedText';

type Props = {
  notes: Note[];
  root: Entry | null;
  selected: Entry | null;
  label: (e: Entry) => string;
  names: Record<string, string>;
  onOpenPart: (id: string) => void;
  focusNote: string | null; // note whose parts are currently the only ones shown in 3D
  onShowParts: (noteId: string | null, ids: string[]) => void;
  onSave: (n: NoteInput) => Promise<Note>;
  onRemove: (id: string) => Promise<void>;
};

const AUTOSAVE_MS = 800;

const typeLabel = (t: NoteType) => NOTE_TYPES.find((x) => x.id === t)?.label ?? t;

// Capture + list of expert knowledge for the machine or the selected part.
export default function KnowledgeNotes({ notes, root, selected, label, names, onOpenPart, focusNote, onShowParts, onSave, onRemove }: Props) {
  const readOnly = useMode() === 'consumer';
  const target = selected?.name ?? MACHINE;
  const [editing, setEditing] = useState<Note | null>(null);
  const [authorOpen, setAuthorOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState(0); // bumped to start a fresh new-note form
  const [activeId, setActiveId] = useState<string | null>(null); // id of a note created in the form, once saved
  useEffect(() => { setEditing(null); setActiveId(null); }, [target]);

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
  const beingEdited = editing?.id ?? activeId; // shown in the form, so not repeated in the list
  const direct = notes.filter((n) => n.parts.includes(target));
  const inherited = notes.filter((n) => !n.parts.includes(target) && n.parts.some((p) => inheritedFrom.includes(p)));

  const card = (n: Note, from?: string, skipType?: NoteType) => (
    <div key={n.id} className={`kn-card${from ? ' inherited' : ''}`}>
      <div className="kn-meta">
        {n.types.filter((t) => t !== skipType).map((t) => <span key={t} className={`kn-type t-${t}`}>{typeLabel(t)}</span>)}
        {from && <span className="kn-from">via {from}</span>}
      </div>
      <p><LinkedText text={n.text} mentions={n.mentions} label={partLabel} onOpen={onOpenPart} /></p>
      {n.parts.filter((p) => p !== target).length > 0 && (
        <div className="kn-chips">
          {n.parts.filter((p) => p !== target).map((p) => <span key={p} className="kn-chip">{partLabel(p)}</span>)}
        </div>
      )}
      <div className="kn-foot">
        <small>
          {n.author ? <button className="author-link" onClick={() => setAuthorOpen(n.author)}>{n.author}</button> : 'Unknown'} · {new Date(n.updatedAt).toLocaleDateString()}
        </small>
        <span>
          {notePartIds(n).length > 0 && (
            focusNote === n.id
              ? <button className="show-parts on" onClick={() => onShowParts(null, [])}><Eye size={13} /> Show all</button>
              : <button className="show-parts" title="Show only the parts this note is about" onClick={() => onShowParts(n.id, notePartIds(n))}><ScanSearch size={13} /> Show parts</button>
          )}
          {!from && !readOnly && (<>
            <button className="icon" title="Edit note" aria-label="Edit note" onClick={() => setEditing(n)}><Pencil size={14} /></button>
            <button className="icon" title="Delete note" aria-label="Delete note" onClick={() => { if (confirm('Delete this note?')) onRemove(n.id); }}><Trash2 size={14} /></button>
          </>)}
        </span>
      </div>
    </div>
  );

  // Consumers get a report card: the notes of the machine (or the selected part) sorted under the labels.
  // On the machine itself that is every note about any part.
  const report: { note: Note; from?: string }[] = readOnly
    ? target === MACHINE
      ? notes.map((note) => ({ note }))
      : [...direct.map((note) => ({ note })), ...inherited.map((note) => ({ note, from: partLabel(note.parts.find((p) => inheritedFrom.includes(p))!) }))]
    : [];

  if (readOnly) return (
    <section className="kn">
      <h3>Knowledge <span>{report.length}</span></h3>
      <div className="kn-target" title={target === MACHINE ? undefined : target}>{partLabel(target)}</div>
      {NOTE_TYPES.map((t) => {
        const items = report.filter((r) => r.note.types.includes(t.id));
        return (
          <div key={t.id} className="kn-sec">
            <h4><span className={`kn-type t-${t.id}`}>{t.label}</span> <span className="kn-count">{items.length}</span></h4>
            <p className="kn-hint">{t.hint}</p>
            {items.length === 0 ? <p className="kn-none">Nothing recorded yet.</p> : items.map((r) => card(r.note, r.from, t.id))}
          </div>
        );
      })}
      {authorOpen && <AuthorPopup name={authorOpen} onClose={() => setAuthorOpen(null)} />}
    </section>
  );

  return (
    <section className="kn">
      <h3>Knowledge notes <span>{direct.length}</span></h3>
      <div className="kn-target" title={target === MACHINE ? undefined : target}>{partLabel(target)}</div>
      <NoteForm
        key={editing?.id ?? `new-${target}-${draft}`}
        target={target}
        initial={editing}
        names={names}
        onSave={onSave}
        onCreated={setActiveId}
        onDone={() => { setEditing(null); setActiveId(null); setDraft((d) => d + 1); }}
      />
      {direct.filter((n) => n.id !== beingEdited).map((n) => card(n))}
      {inherited.length > 0 && <h4>From the machine / parent assemblies</h4>}
      {inherited.map((n) => card(n, partLabel(n.parts.find((p) => inheritedFrom.includes(p))!)))}
      {authorOpen && <AuthorPopup name={authorOpen} onClose={() => setAuthorOpen(null)} />}
    </section>
  );
}

const overlaps = (a: Mention, b: Mention) => a.start < b.end && b.start < a.end;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// Edits a new or existing note. A new note is only created when the user saves it; from then on
// (and for existing notes) changes are saved automatically shortly after typing/dictation pauses.
function NoteForm({ target, initial, names, onSave, onCreated, onDone }: {
  target: string; initial: Note | null; names: Record<string, string>;
  onSave: (n: NoteInput) => Promise<Note>; onCreated: (id: string) => void; onDone: () => void;
}) {
  const [text, setText] = useState(initial?.text ?? '');
  const [picked, setPicked] = useState<NoteType[] | null>(initial?.types ?? null); // null = let the server choose the labels
  const [auto, setAuto] = useState<NoteType[]>([]); // what it chose for a new note
  const shown = picked ?? auto;
  const toggle = (t: NoteType) => { const next = shown.includes(t) ? shown.filter((x) => x !== t) : [...shown, t]; setPicked(next.length ? next : null); };
  const links = initial?.parts ?? [target]; // a note is about what was selected when it was written
  const user = useUser();
  const author = initial?.author || user.name;
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [created, setCreated] = useState(!!initial); // autosave only starts after the first (manual) save
  const armed = useRef(!!initial);
  // Manual corrections to the automatically found links (null = untouched), only offered while the text is unchanged.
  const [overrides, setOverrides] = useState<Mention[] | null>(null);
  const textSame = !!initial && text.trim() === initial.text;
  const manual = overrides ?? (initial?.mentions ?? []).filter((m) => m.manual);
  const linked = [...manual, ...(initial?.mentions ?? []).filter((a) => !a.manual && !manual.some((m) => overlaps(a, m)))].sort((a, b) => a.start - b.start);
  const setMention = (m: Mention, parts: string[] | null) => {
    const rest = manual.filter((x) => !overlaps(x, m));
    setOverrides(parts ? [...rest, { start: m.start, end: m.end, text: m.text, parts, manual: true }] : rest);
  };
  const dictation = useDictation((t) => setText((prev) => (prev ? prev + ' ' : '') + t));

  // Saves run one after another so a new note is created once, and later saves reuse its id.
  const id = useRef(initial?.id);
  const queue = useRef(Promise.resolve());
  const lastSaved = useRef(initial ? JSON.stringify([initial.text, initial.types, null]) : '');
  const latest = useRef<NoteInput | null>(null);
  latest.current = text.trim() && links.length ? { text, parts: links, author, types: picked ?? undefined, overrides: textSame && overrides ? overrides : undefined } : null;

  const flush = useCallback(() => {
    queue.current = queue.current.then(async () => {
      const input = armed.current ? latest.current : null;
      const key = input && JSON.stringify([input.text.trim(), input.types ?? null, input.overrides ?? null]);
      if (!input || key === lastSaved.current) return;
      setSaveState('saving');
      try {
        const saved = await onSave({ ...input, id: id.current });
        id.current = saved.id;
        setAuto(saved.types);
        setCreated(true);
        onCreated(saved.id);
        lastSaved.current = key!;
        setSaveState('saved');
      } catch { setSaveState('error'); }
    });
  }, [onSave, onCreated]);

  useEffect(() => {
    const t = setTimeout(flush, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [text, picked, overrides, flush]);
  useEffect(() => () => flush(), [flush]); // save pending changes when the form goes away

  const create = () => { armed.current = true; flush(); };

  const done = () => {
    if (dictation.listening) dictation.toggle();
    flush();
    onDone();
  };

  return (
    <div className="kn-form">
      <div className="kn-types" role="group" aria-label="Labels">
        {NOTE_TYPES.map((t) => (
          <button key={t.id} type="button" aria-pressed={shown.includes(t.id)} title={t.hint}
            className={`kn-typebtn t-${t.id}${shown.includes(t.id) ? ' on' : ''}${picked === null && shown.includes(t.id) ? ' auto' : ''}`} onClick={() => toggle(t.id)}>{t.label}</button>
        ))}
      </div>
      <div className="kn-textwrap">
        <textarea value={text} rows={5} placeholder="Just write what you know: why it is built this way, what it has to fulfil, what went wrong, what to keep in mind. Labels are added for you — or pick your own above." onChange={(e) => setText(e.target.value)} />
        {dictation.supported && (
          <button className={`kn-mic${dictation.listening ? ' live' : ''}`} onClick={dictation.toggle} title={dictation.listening ? 'Stop dictation' : 'Dictate'} aria-label="Dictate">
            {dictation.listening ? <Square size={13} /> : <Mic size={15} />}
          </button>
        )}
      </div>
      {dictation.listening && <div className="kn-live">Listening… {dictation.interim && <em>{dictation.interim}</em>}</div>}
      {dictation.error && <div className="kn-error">{dictation.error}</div>}
      {!dictation.supported && <div className="kn-hint">Dictation needs Chrome or Safari.</div>}
      {initial && (
        textSame ? linked.length > 0 && (
          <div className="kn-links">
            <span className="kn-label">Linked words — pick the right part, or unlink</span>
            {linked.map((m) => m.parts.length === 0 ? (
              <div key={m.start} className="kn-mention off"><s>{m.text}</s><button onClick={() => setMention(m, null)}>Link again</button></div>
            ) : (
              <div key={m.start} className="kn-mention">
                <strong>{m.text}</strong>
                <select value={m.parts.length === 1 ? m.parts[0] : ''} onChange={(e) => setMention(m, [e.target.value])}>
                  {m.parts.length > 1 && <option value="" disabled>Choose…</option>}
                  {[...new Set([...m.parts, ...Object.keys(names)])].map((p) => <option key={p} value={p}>{names[p] ?? p}</option>)}
                </select>
                <button title="Don't link this word" aria-label="Unlink" onClick={() => setMention(m, [])}><X size={12} /></button>
              </div>
            ))}
          </div>
        ) : <div className="kn-hint">Links to parts are updated after saving.</div>
      )}
      <div className="kn-row">
        <span className={`kn-save${saveState === 'error' ? ' err' : ''}`}>
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? "Couldn't save — retrying on next change" : ''}
        </span>
        {created
          ? <button onClick={done}>Done</button>
          : <button onClick={create} disabled={!latest.current || saveState === 'saving'}>Save note</button>}
      </div>
    </div>
  );
}
