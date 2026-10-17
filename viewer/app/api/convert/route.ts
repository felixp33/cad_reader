import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, cacheId, resolveModel } from '@/lib/project';

export const dynamic = 'force-dynamic';

const running = new Map<string, Promise<void>>();

// Converts a STEP file to mesh files (cached by path + mtime) and returns the cache id.
export async function POST(req: Request) {
  const { path: rel } = await req.json();
  const file = resolveModel(rel);
  if (!file) return new Response('Not found', { status: 404 });

  const id = cacheId(file);
  const out = path.join(CACHE_DIR, id);
  if (!fs.existsSync(path.join(out, 'model.json'))) {
    if (!running.has(id)) {
      const job = new Promise<void>((resolve, reject) => {
        const py = spawn(path.join(process.cwd(), '.venv/bin/python'), [path.join(process.cwd(), 'scripts/step_to_mesh.py'), file, out]);
        let err = '';
        py.stderr.on('data', (d) => (err += d));
        py.on('error', reject);
        py.on('close', (code) => (code === 0 ? resolve() : reject(new Error(err.slice(-500) || `exit ${code}`))));
      }).finally(() => running.delete(id));
      running.set(id, job);
    }
    try { await running.get(id); } catch (e) { return new Response((e as Error).message, { status: 500 }); }
  }
  return Response.json({ id });
}
