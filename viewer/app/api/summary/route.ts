import { getInfo } from '@/lib/info';
import { getNames } from '@/lib/names';
import { listNotes } from '@/lib/notes';
import { listModels } from '@/lib/project';

export const dynamic = 'force-dynamic';

// What people have added to each machine: its title, how many notes, who wrote them, how many parts are named, its build year and when it was last edited.
export function GET() {
  const out: Record<string, { title: string; notes: number; authors: string[]; named: number; buildYear: string; updatedAt: string }> = {};
  for (const m of listModels()) {
    const notes = listNotes(m.path);
    const info = getInfo(m.path);
    out[m.path] = {
      title: info.title,
      buildYear: info.buildYear,
      updatedAt: [info.updatedAt, ...notes.map((n) => n.updatedAt)].filter(Boolean).sort().at(-1) ?? '',
      notes: notes.length,
      authors: [...new Set(notes.map((n) => n.author).filter(Boolean))],
      named: Object.keys(getNames(m.path)).length,
    };
  }
  return Response.json(out);
}
