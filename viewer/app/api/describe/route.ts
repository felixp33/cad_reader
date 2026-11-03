import { getAliases } from '@/lib/aliases';
import { buildTermIndex, findMentions } from '@/lib/mentions';
import { getNames } from '@/lib/names';

export const dynamic = 'force-dynamic';

// Which parts of a machine does a piece of text talk about? Matches words against the given names and aliases.
export async function POST(req: Request) {
  const { model, text } = await req.json();
  if (typeof model !== 'string' || typeof text !== 'string') return new Response('model and text required', { status: 400 });
  const mentions = findMentions(text, buildTermIndex(getNames(model), getAliases(model)));
  return Response.json({ mentions: mentions.map((m) => ({ text: m.text, parts: m.parts })) });
}
