import { getAliases } from './aliases';
import { getNames } from './names';
import { listNotes, setNotes } from './notes';
import type { Mention, Note } from './noteTypes';
import { isStale } from './noteTypes';

// Background indexer: finds which parts a note's text talks about, by matching the words against the
// given names and aliases of the model's parts. Pure matching is in findMentions; reindexModel applies it.

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'-]*/gu;

// Lowercase and drop a plural "s" so "latches"/"latch" and "doors"/"door" meet.
const stem = (w: string) => {
  const l = w.toLowerCase();
  return l.length > 3 && l.endsWith('s') && !l.endsWith('ss') ? l.slice(0, -1) : l;
};
const tokenize = (s: string) => [...s.matchAll(WORD)].map((m) => ({ start: m.index!, end: m.index! + m[0].length, stem: stem(m[0]) }));

type Term = { stems: string[]; parts: Set<string> };
export type TermIndex = Map<string, Term[]>; // first stem -> terms starting with it, longest first

export function buildTermIndex(names: Record<string, string>, aliases: Record<string, string[]>): TermIndex {
  const byPhrase = new Map<string, Term>();
  const add = (phrase: string, id: string) => {
    const stems = tokenize(phrase).map((t) => t.stem);
    if (stems.length === 0 || stems.join('').length < 2) return;
    const key = stems.join(' ');
    const term = byPhrase.get(key) ?? { stems, parts: new Set<string>() };
    term.parts.add(id);
    byPhrase.set(key, term);
  };
  for (const [id, name] of Object.entries(names)) add(name, id);
  for (const [id, list] of Object.entries(aliases)) list.forEach((a) => add(a, id));
  const index: TermIndex = new Map();
  for (const t of byPhrase.values()) index.set(t.stems[0], [...(index.get(t.stems[0]) ?? []), t]);
  index.forEach((terms) => terms.sort((a, b) => b.stems.length - a.stems.length));
  return index;
}

// Longest-phrase-first, left-to-right, non-overlapping. When a phrase fits several parts, the ones the
// note is explicitly attached to win; otherwise all candidates are kept for the reader to choose from.
export function findMentions(text: string, index: TermIndex, noteParts: string[] = []): Mention[] {
  const tokens = tokenize(text);
  const out: Mention[] = [];
  for (let i = 0; i < tokens.length;) {
    let hit: { term: Term; len: number } | null = null;
    for (const term of index.get(tokens[i].stem) ?? []) {
      const len = term.stems.length;
      if (i + len > tokens.length) continue;
      let ok = true;
      for (let k = 0; k < len && ok; k++) {
        ok = tokens[i + k].stem === term.stems[k]
          && (k === 0 || /^[\s-]*$/.test(text.slice(tokens[i + k - 1].end, tokens[i + k].start)));
      }
      if (ok) { hit = { term, len }; break; }
    }
    if (!hit) { i++; continue; }
    const start = tokens[i].start, end = tokens[i + hit.len - 1].end;
    const all = [...hit.term.parts];
    const preferred = all.filter((p) => noteParts.includes(p));
    out.push({ start, end, text: text.slice(start, end), parts: preferred.length ? preferred : all });
    i += hit.len;
  }
  return out;
}

// Validates untrusted manual mentions against the text they were made for.
export function keepManual(text: string, mentions: unknown): Mention[] {
  if (!Array.isArray(mentions)) return [];
  return mentions.filter((m): m is Mention =>
    !!m && m.manual === true && Number.isInteger(m.start) && Number.isInteger(m.end)
    && m.start >= 0 && m.start < m.end && m.end <= text.length
    && Array.isArray(m.parts) && m.parts.every((p: unknown) => typeof p === 'string')
    && text.slice(m.start, m.end) === m.text,
  );
}

const overlaps = (a: Mention, b: Mention) => a.start < b.end && b.start < a.end;

export function indexNote(note: Note, index: TermIndex, indexedAt: string): Note {
  const manual = keepManual(note.text, note.mentions);
  const auto = findMentions(note.text, index, note.parts).filter((m) => !manual.some((x) => overlaps(m, x)));
  return { ...note, mentions: [...manual, ...auto].sort((a, b) => a.start - b.start), indexedAt };
}

// Synchronous on purpose: reading and writing the notes file in one tick means it can't interleave with a save.
export function reindexModel(model: string, onlyStale = false) {
  const notes = listNotes(model);
  if (!notes.some((n) => !onlyStale || isStale(n))) return;
  const index = buildTermIndex(getNames(model), getAliases(model));
  const now = new Date().toISOString();
  setNotes(model, notes.map((n) => (!onlyStale || isStale(n) ? indexNote(n, index, now) : n)));
}
