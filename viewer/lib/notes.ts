import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Note } from './noteTypes';

// Knowledge notes, stored as { [modelPath]: Note[] }. A JSON file is plenty while this is a playground.
const FILE = path.join(process.cwd(), 'data', 'notes.json');

type Store = Record<string, Note[]>;

function read(): Store {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}
function write(store: Store) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}

export const listNotes = (model: string): Note[] => read()[model] ?? [];

export function saveNote(model: string, input: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Note {
  const store = read();
  const notes = (store[model] ??= []);
  const now = new Date().toISOString();
  const existing = input.id ? notes.find((n) => n.id === input.id) : undefined;
  const note: Note = {
    ...input,
    id: existing?.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  if (existing) notes[notes.indexOf(existing)] = note; else notes.push(note);
  write(store);
  return note;
}

export function deleteNote(model: string, id: string) {
  const store = read();
  store[model] = (store[model] ?? []).filter((n) => n.id !== id);
  write(store);
}
