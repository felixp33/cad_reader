import { getInfo } from '@/lib/info';
import { getNames } from '@/lib/names';
import { listNotes } from '@/lib/notes';
import { listModels } from '@/lib/project';

export const dynamic = 'force-dynamic';

// What people have added to each machine: its title, how many notes, who wrote them, how many parts are named.
export function GET() {
  const out: Record<string, { title: string; notes: number; authors: string[]; named: number }> = {};
  for (const m of listModels()) {
    const notes = listNotes(m.path);
    out[m.path] = {
      title: getInfo(m.path).title,
      notes: notes.length,
      authors: [...new Set(notes.map((n) => n.author).filter(Boolean))],
      named: Object.keys(getNames(m.path)).length,
    };
  }
  return Response.json(out);
}
