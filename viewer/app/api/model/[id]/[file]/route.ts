import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR } from '@/lib/project';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string; file: string }> }) {
  const { id, file } = await params;
  if (!/^[0-9a-f]+$/.test(id) || !['model.json', 'model.bin'].includes(file)) return new Response('Not found', { status: 404 });
  const p = path.join(CACHE_DIR, id, file);
  if (!fs.existsSync(p)) return new Response('Not found', { status: 404 });
  return new Response(fs.readFileSync(p), {
    headers: { 'Content-Type': file.endsWith('.json') ? 'application/json' : 'application/octet-stream' },
  });
}
