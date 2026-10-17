import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, cacheId, resolveModel } from '@/lib/project';

export const dynamic = 'force-dynamic';

function thumbPath(rel: string | null) {
  const file = rel && resolveModel(rel);
  return file ? path.join(CACHE_DIR, cacheId(file), 'thumb.png') : null;
}

export function GET(req: Request) {
  const p = thumbPath(new URL(req.url).searchParams.get('path'));
  if (!p || !fs.existsSync(p)) return new Response('Not found', { status: 404 });
  return new Response(fs.readFileSync(p), { headers: { 'Content-Type': 'image/png' } });
}

// The client renders the preview (it already has a WebGL pipeline) and uploads it for caching.
export async function PUT(req: Request) {
  const p = thumbPath(new URL(req.url).searchParams.get('path'));
  if (!p) return new Response('Not found', { status: 404 });
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, Buffer.from(await req.arrayBuffer()));
  return Response.json({ ok: true });
}
