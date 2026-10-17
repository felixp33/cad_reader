import { getNames, setName } from '@/lib/names';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const model = new URL(req.url).searchParams.get('model');
  if (!model) return new Response('model required', { status: 400 });
  return Response.json(getNames(model));
}

export async function PUT(req: Request) {
  const { model, id, name } = await req.json();
  if (typeof model !== 'string' || typeof id !== 'string' || typeof name !== 'string') {
    return new Response('model, id and name required', { status: 400 });
  }
  setName(model, id, name);
  return Response.json({ ok: true });
}
