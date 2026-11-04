import { getInfo, setInfo } from '@/lib/info';

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const model = new URL(req.url).searchParams.get('model');
  if (!model) return new Response('model required', { status: 400 });
  return Response.json(getInfo(model));
}

export async function PUT(req: Request) {
  const { model, title, description, buildYear, parts } = await req.json();
  if (typeof model !== 'string') return new Response('model required', { status: 400 });
  setInfo(model, {
    ...(typeof title === 'string' && { title }),
    ...(typeof description === 'string' && { description }),
    ...(typeof buildYear === 'string' && /^(\d{4})?$/.test(buildYear.trim()) && { buildYear: buildYear.trim() }),
    ...(parts && typeof parts === 'object' && { parts }),
  });
  return Response.json({ ok: true });
}
