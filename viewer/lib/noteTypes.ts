// Shared (client + server) definitions for knowledge notes.
export const MACHINE = '__machine__'; // link target meaning "the machine as a whole"
export const ALL_MACHINES = '__all__'; // chat target meaning "every machine in the library"

export const NOTE_TYPES = [
  { id: 'lesson', label: 'Lessons learned', hint: 'What did not work or went wrong, and what we learned from it' },
  { id: 'requirement', label: 'Requirements', hint: 'What the machine has to do or comply with' },
  { id: 'consideration', label: 'Considerations', hint: 'Things to keep in mind, trade-offs, tips for operating or changing it' },
  { id: 'decision', label: 'Design decisions', hint: 'Why it is built this way, and what was chosen over what' },
] as const;
export type NoteType = (typeof NOTE_TYPES)[number]['id'];

export const isNoteType = (t: unknown): t is NoteType => NOTE_TYPES.some((x) => x.id === t);

// Categories used before the current set, mapped onto it (applied when notes are read).
const LEGACY: Record<string, NoteType> = { failed: 'lesson', constraint: 'requirement', predecessor: 'consideration', tip: 'consideration', other: 'consideration' };
export const normalizeType = (t: string): NoteType => (isNoteType(t) ? t : LEGACY[t] ?? 'consideration');

// A note can carry several labels; this keeps the valid ones, in the order of NOTE_TYPES, without repeats.
export const cleanTypes = (t: unknown): NoteType[] => (Array.isArray(t) ? NOTE_TYPES.map((x) => x.id).filter((id) => t.includes(id)) : []);

// A span of a note's text that refers to one or more parts. Found by the background indexer, unless
// `manual` (set by a person); a manual mention with no parts means "do not link this word".
export type Mention = { start: number; end: number; text: string; parts: string[]; manual?: boolean };

export type Note = {
  id: string;
  text: string;
  types: NoteType[]; // labels (at least one); notes saved before labels were multiple had a single `type`
  parts: string[]; // part ids (Entry.name) and/or MACHINE
  author: string;
  createdAt: string;
  updatedAt: string;
  mentions?: Mention[];
  indexedAt?: string; // when `mentions` were last computed; older than updatedAt means the indexer still has to run
};

// The parts a note is about: the ones it is attached to plus those its text clearly names (an ambiguous word is left out).
export const notePartIds = (n: Note): string[] => [...new Set([
  ...n.parts.filter((p) => p !== MACHINE),
  ...(n.mentions ?? []).filter((m) => m.parts.length === 1).map((m) => m.parts[0]),
])];

export const isStale = (n: Note) => !n.indexedAt || n.indexedAt < n.updatedAt;
