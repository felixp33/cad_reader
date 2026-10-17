import { deleteNote, listNotes, saveNote } from '@/lib/notes';
import { classifyNote } from '@/lib/classify';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const model = new URL(req.url).searchParams.get('model');
  if (!model) return new Response('model required', { status: 400 });
  return Response.json(listNotes(model));
}

// Create (no id) or update (with id). The category is assigned automatically; an edit that
// doesn't change the text keeps its existing category.
export async function PUT(req: Request) {
  const { model, note } = await req.json();
  const valid = typeof model === 'string' && note && typeof note.text === 'string' && note.text.trim()
    && Array.isArray(note.parts) && note.parts.every((p: unknown) => typeof p === 'string');
  if (!valid) return new Response('invalid note', { status: 400 });
  const text = note.text.trim();
  const existing = typeof note.id === 'string' ? listNotes(model).find((n) => n.id === note.id) : undefined;
  const type = existing && existing.text === text ? existing.type : await classifyNote(text);
  return Response.json(saveNote(model, {
    id: existing?.id, text, type, parts: note.parts, author: String(note.author ?? '').trim(),
  }));
}

export function DELETE(req: Request) {
  const q = new URL(req.url).searchParams;
  const model = q.get('model'), id = q.get('id');
  if (!model || !id) return new Response('model and id required', { status: 400 });
  deleteNote(model, id);
  return Response.json({ ok: true });
}
