'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isStale, type Mention, type Note } from './noteTypes';

export type NoteInput = Pick<Note, 'text' | 'parts' | 'author'> & { id?: string; overrides?: Mention[] };

const POLL_MS = 800;
const MAX_POLLS = 10;

// Loads a model's notes and exposes save/remove that keep local state in sync with the server.
// Mentions are found by a background job on the server, so while any note is still waiting for it
// the list is re-fetched a few times.
export function useNotes(model: string | null) {
  const [notes, setNotes] = useState<Note[]>([]);
  const polls = useRef(0);

  const refresh = useCallback(async () => {
    if (!model) return;
    const n: Note[] = await fetch('/api/notes?model=' + encodeURIComponent(model)).then((r) => r.json());
    setNotes(n);
  }, [model]);

  useEffect(() => {
    polls.current = 0;
    if (!model) { setNotes([]); return; }
    let cancelled = false;
    fetch('/api/notes?model=' + encodeURIComponent(model)).then((r) => r.json()).then((n) => { if (!cancelled) setNotes(n); });
    return () => { cancelled = true; };
  }, [model]);

  useEffect(() => {
    if (!notes.some(isStale) || polls.current >= MAX_POLLS) return;
    const t = setTimeout(() => { polls.current++; refresh().catch(() => {}); }, POLL_MS);
    return () => clearTimeout(t);
  }, [notes, refresh]);

  const save = useCallback(async (input: NoteInput) => {
    if (!model) return;
    const res = await fetch('/api/notes', { method: 'PUT', body: JSON.stringify({ model, note: input }) });
    if (!res.ok) throw new Error(await res.text());
    const saved: Note = await res.json();
    polls.current = 0;
    setNotes((prev) => (prev.some((n) => n.id === saved.id) ? prev.map((n) => (n.id === saved.id ? saved : n)) : [...prev, saved]));
  }, [model]);

  const remove = useCallback(async (id: string) => {
    if (!model) return;
    await fetch(`/api/notes?model=${encodeURIComponent(model)}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, [model]);

  // Re-fetch after names/aliases changed (the server re-indexes in the background).
  const refreshSoon = useCallback(() => { polls.current = 0; setTimeout(() => refresh().catch(() => {}), 1000); }, [refresh]);

  return { notes, save, remove, refreshSoon };
}
