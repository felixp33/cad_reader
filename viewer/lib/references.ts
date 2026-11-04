import type { KnowledgeItem } from './knowledgeTypes';

export type RefSpan = { start: number; end: number; item: KnowledgeItem };

// Names a text may use for an entry: its reference with and without edition year / "EN", its short title, and its aliases.
// A superseded edition is only found by its full reference, so it is not mistaken for the current one.
function namesOf(i: KnowledgeItem): string[] {
  const names = [i.ref, ...(i.aliases ?? [])];
  if (i.ref && i.status !== 'withdrawn') {
    const noYear = i.ref.replace(/:\d{4}$/, '');
    names.push(noYear, noYear.replace(/^EN\s+/, ''));
  }
  if (i.ref && i.title.length <= 40) names.push(i.title);
  return names.map((n) => n.trim()).filter((n) => n.length >= 4);
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Builds a finder for references to the given entries, longest names first so "EN 60204-1:2006" wins over "60204-1".
export function referenceFinder(items: KnowledgeItem[]): (text: string) => RefSpan[] {
  const byName = new Map<string, KnowledgeItem>();
  for (const i of items) for (const n of namesOf(i)) if (!byName.has(n.toLowerCase())) byName.set(n.toLowerCase(), i);
  if (byName.size === 0) return () => [];
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(?:${names.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  return (text) => [...text.matchAll(re)].map((m) => ({ start: m.index!, end: m.index! + m[0].length, item: byName.get(m[0].toLowerCase())! }));
}
