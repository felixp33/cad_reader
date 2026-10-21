// Shared (client + server) definitions for knowledge notes.
export const MACHINE = '__machine__'; // link target meaning "the machine as a whole"

export const NOTE_TYPES = [
  { id: 'decision', label: 'Design decision', hint: 'Why it is built this way' },
  { id: 'failed', label: 'Failed / lesson learned', hint: 'What did not work, and why' },
  { id: 'predecessor', label: 'Predecessor / related', hint: 'How earlier or similar machines differ' },
  { id: 'tip', label: 'Operating / maintenance tip', hint: 'Things to know when running or servicing it' },
  { id: 'constraint', label: 'Constraint', hint: 'Requirements or limits that shaped the design' },
  { id: 'other', label: 'Other', hint: '' },
] as const;
export type NoteType = (typeof NOTE_TYPES)[number]['id'];

// A span of a note's text that refers to one or more parts. Found by the background indexer, unless
// `manual` (set by a person); a manual mention with no parts means "do not link this word".
export type Mention = { start: number; end: number; text: string; parts: string[]; manual?: boolean };

export type Note = {
  id: string;
  text: string;
  type: NoteType;
  parts: string[]; // part ids (Entry.name) and/or MACHINE
  author: string;
  createdAt: string;
  updatedAt: string;
  mentions?: Mention[];
  indexedAt?: string; // when `mentions` were last computed; older than updatedAt means the indexer still has to run
};

export const isStale = (n: Note) => !n.indexedAt || n.indexedAt < n.updatedAt;
