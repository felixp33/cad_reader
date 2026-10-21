import { after } from 'next/server';
import { getAliases, setAliases } from '@/lib/aliases';
import { reindexModel } from '@/lib/mentions';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const model = new URL(req.url).searchParams.get('model');
  if (!model) return new Response('model required', { status: 400 });
  return Response.json(getAliases(model));
}

export async function PUT(req: Request) {
  const { model, id, aliases } = await req.json();
  if (typeof model !== 'string' || typeof id !== 'string' || !Array.isArray(aliases) || !aliases.every((a) => typeof a === 'string')) {
    return new Response('model, id and aliases required', { status: 400 });
  }
  setAliases(model, id, aliases);
  after(() => reindexModel(model));
  return Response.json({ ok: true });
}
