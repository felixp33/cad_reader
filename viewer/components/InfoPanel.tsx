'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Entry } from '@/lib/scene';
import type { Note } from '@/lib/noteTypes';
import type { NoteInput } from '@/lib/useNotes';
import KnowledgeNotes from './KnowledgeNotes';

// Right-hand column: the machine's name (autosaved), the knowledge notes for the machine or the
// selected part, and how many main / unique parts have notes.
export default function InfoPanel({ model, root, mainIds, selected, label, title, onTitleChange, notes, onSaveNote, onRemoveNote }: {
  model: string | null;
  root: Entry | null;
  mainIds: string[];
  selected: Entry | null;
  label: (e: Entry) => string;
  title: string;
  onTitleChange: (t: string) => void;
  notes: Note[];
  onSaveNote: (n: NoteInput) => Promise<void>;
  onRemoveNote: (id: string) => Promise<void>;
}) {
  const [saved, setSaved] = useState(true);
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
      <div className="info-body">
        {selected ? (
          <>
            <div className="info-part">
              <strong>{label(selected)}</strong>
              <code>{selected.name}</code>
            </div>
          </>
        ) : (
          <label>Name
            <input value={title} placeholder="Machine name" onChange={(e) => editTitle(e.target.value)} />
          </label>
        )}
        <KnowledgeNotes notes={notes} root={root} selected={selected} label={label} onSave={onSaveNote} onRemove={onRemoveNote} />
        <dl className="facts">
          <dt>Main parts</dt><dd>{stats.mainNoted} / {stats.main} with notes</dd>
          <dt>Unique parts</dt><dd>{stats.uniqueNoted} / {stats.unique} with notes</dd>
        </dl>
      </div>
    </aside>
  );
}
