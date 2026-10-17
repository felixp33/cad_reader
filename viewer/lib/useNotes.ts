'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Note } from './noteTypes';

export type NoteInput = Pick<Note, 'text' | 'parts' | 'author'> & { id?: string };

// Loads a model's notes and exposes save/remove that keep local state in sync with the server.
export function useNotes(model: string | null) {
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (!model) { setNotes([]); return; }
    let cancelled = false;
    fetch('/api/notes?model=' + encodeURIComponent(model)).then((r) => r.json()).then((n) => { if (!cancelled) setNotes(n); });
    return () => { cancelled = true; };
  }, [model]);

  const save = useCallback(async (input: NoteInput) => {
    if (!model) return;
    const res = await fetch('/api/notes', { method: 'PUT', body: JSON.stringify({ model, note: input }) });
    if (!res.ok) throw new Error(await res.text());
    const saved: Note = await res.json();
    setNotes((prev) => (prev.some((n) => n.id === saved.id) ? prev.map((n) => (n.id === saved.id ? saved : n)) : [...prev, saved]));
  }, [model]);

  const remove = useCallback(async (id: string) => {
    if (!model) return;
    await fetch(`/api/notes?model=${encodeURIComponent(model)}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, [model]);

  return { notes, save, remove };
}
