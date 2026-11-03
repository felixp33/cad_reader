'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Entry } from '@/lib/scene';
import type { Note } from '@/lib/noteTypes';
import type { NoteInput } from '@/lib/useNotes';
import { ArrowLeft, Maximize2 } from 'lucide-react';
import KnowledgeNotes from './KnowledgeNotes';

// Right-hand column: the machine's name (autosaved), the knowledge notes for the machine or the
// selected part, and how many main / unique parts have notes.
export default function InfoPanel({ model, root, mainIds, selected, label, names, onPartName, onOpenPart, backLabel, onBack, onIsolate, title, onTitleChange, notes, onSaveNote, onRemoveNote }: {
  model: string | null;
  root: Entry | null;
  mainIds: string[];
  selected: Entry | null;
  label: (e: Entry) => string;
  names: Record<string, string>;
  onPartName: (id: string, name: string) => void;
  onOpenPart: (id: string) => void;
  backLabel: string | null; // set when the selection was reached by following a link in a note
  onBack: () => void;
  onIsolate: (e: Entry) => void;
  title: string;
  onTitleChange: (t: string) => void;
  notes: Note[];
  onSaveNote: (n: NoteInput) => Promise<Note>;
  onRemoveNote: (id: string) => Promise<void>;
}) {
  const [saved, setSaved] = useState(true);
  const [tab, setTab] = useState<'info' | 'notes'>('info');
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = async () => {
    clearTimeout(timer.current);
    if (pending.current === null || !model) return;
    const t = pending.current;
    pending.current = null;
    await fetch('/api/info', { method: 'PUT', body: JSON.stringify({ model, title: t }) });
    if (pending.current === null) setSaved(true);
  };

  // Load on model change (saving anything still pending for the previous one first).
  useEffect(() => {
    if (!model) return;
    let cancelled = false;
    flush().then(() => fetch('/api/info?model=' + encodeURIComponent(model)))
      .then((r) => r.json())
      .then((i: { title: string }) => { if (!cancelled) onTitleChange(i.title); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);
  useEffect(() => () => { flush(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const editTitle = (value: string) => {
    onTitleChange(value);
    pending.current = value;
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };

  // Main parts = first generation; unique parts = distinct meshes (an entry's `proto`), counted once
  // if any instance of them has a note.
  const stats = useMemo(() => {
    const noted = new Set(notes.flatMap((n) => n.parts));
    const protos = new Set<number>(), notedProtos = new Set<number>();
    const walk = (e: Entry) => {
      if (e.proto !== undefined) { protos.add(e.proto); if (noted.has(e.name)) notedProtos.add(e.proto); }
      e.children.forEach(walk);
    };
    if (root) walk(root);
    return {
      main: mainIds.length,
      mainNoted: mainIds.filter((id) => noted.has(id)).length,
      unique: protos.size,
      uniqueNoted: notedProtos.size,
    };
  }, [root, mainIds, notes]);

  if (!model) return <aside className="info"><h2>Information</h2><div className="info-empty">Load a model to see its information.</div></aside>;

  return (
    <aside className="info">
      <h2>{selected ? 'Part' : 'Machine'} {saved ? '' : '· saving…'}</h2>
      <div className="info-tabs segmented" role="tablist" aria-label="Information sections">
        <button role="tab" aria-selected={tab === 'info'} aria-pressed={tab === 'info'} onClick={() => setTab('info')}>Details</button>
        <button role="tab" aria-selected={tab === 'notes'} aria-pressed={tab === 'notes'} onClick={() => setTab('notes')}>
          Knowledge notes{notes.length > 0 && <span className="info-count">{notes.length}</span>}
        </button>
      </div>
      <div className="info-body">
        {tab === 'info' && (selected ? (
          <>
            {backLabel !== null && <button className="info-back" onClick={onBack}><ArrowLeft className="ic" size={14} /> Back to {backLabel}</button>}
            <div className="info-part">
              <strong>{label(selected)}</strong>
              <code>{selected.name}</code>
              <button className="info-isolate" onClick={() => onIsolate(selected)}><Maximize2 className="ic" size={13} /> View isolated</button>
            </div>
            <PartNaming key={selected.name} id={selected.name} name={names[selected.name] ?? ''} onSave={onPartName} />
          </>
        ) : (
          <>
            <label>Name
              <input value={title} placeholder="Machine name" onChange={(e) => editTitle(e.target.value)} />
            </label>
            <dl className="facts">
              <dt>Main parts</dt><dd>{stats.main}</dd>
              <dt>Unique parts</dt><dd>{stats.unique}</dd>
            </dl>
          </>
        ))}
        {tab === 'notes' && (
          <KnowledgeNotes notes={notes} root={root} selected={selected} label={label} names={names} onOpenPart={onOpenPart} onSave={onSaveNote} onRemove={onRemoveNote} />
        )}
      </div>
      {tab === 'notes' && (
        <div className="info-foot">
          <dl className="facts">
            <dt>Main parts</dt><dd>{stats.mainNoted} / {stats.main} with notes</dd>
            <dt>Unique parts</dt><dd>{stats.uniqueNoted} / {stats.unique} with notes</dd>
          </dl>
        </div>
      )}
    </aside>
  );
}

// Name of the selected part. The notes' text is matched against it. Autosaves shortly after typing stops.
function PartNaming({ id, name, onSave }: { id: string; name: string; onSave: (id: string, name: string) => void }) {
  const [n, setN] = useState(name);
  const latest = useRef(n);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const save = useRef(onSave);
  save.current = onSave;

  const flush = () => {
    clearTimeout(timer.current);
    if (!dirty.current) return;
    dirty.current = false;
    save.current(id, latest.current.trim());
  };
  useEffect(() => flush, []); // eslint-disable-line react-hooks/exhaustive-deps

  const change = (value: string) => {
    setN(value);
    latest.current = value;
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 600);
  };

  return (
    <label>Name
      <input value={n} placeholder="What is this part called?" onChange={(e) => change(e.target.value)} onBlur={flush} />
    </label>
  );
}
