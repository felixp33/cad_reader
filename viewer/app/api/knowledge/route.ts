import { deleteKnowledge, listKnowledge, saveKnowledge } from '@/lib/knowledge';
import { KINDS, STATUSES, TOPICS } from '@/lib/knowledgeTypes';

export const dynamic = 'force-dynamic';

export const GET = () => Response.json(listKnowledge());

const has = (list: readonly { id: string }[], v: unknown) => list.some((x) => x.id === v);

export async function PUT(req: Request) {
  const { item } = await req.json();
  if (!item || typeof item.title !== 'string' || !item.title.trim()) return new Response('title required', { status: 400 });
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : undefined);
  return Response.json(saveKnowledge({
    id: str(item.id) || undefined,
    title: item.title.trim(),
    ref: str(item.ref), summary: str(item.summary), region: str(item.region),
    kind: has(KINDS, item.kind) ? item.kind : undefined,
    status: has(STATUSES, item.status) ? item.status : undefined,
    year: Number.isInteger(item.year) ? item.year : undefined,
    topics: Array.isArray(item.topics) ? item.topics.filter((t: unknown) => has(TOPICS, t)) : undefined,
    links: Array.isArray(item.links) ? item.links.filter((l: unknown) => typeof l === 'string') : undefined,
    ...(typeof item.url === 'string' && { url: /^https?:\/\//i.test(item.url.trim()) ? item.url.trim() : undefined }),
    ...(Array.isArray(item.aliases) && { aliases: item.aliases.filter((a: unknown) => typeof a === 'string' && a.trim()).map((a: string) => a.trim()) }),
  }));
}

export function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return new Response('id required', { status: 400 });
  deleteKnowledge(id);
  return Response.json({ ok: true });
}
