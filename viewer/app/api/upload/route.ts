import fs from 'node:fs';
import path from 'node:path';
import { MODEL_EXTS, PROJECT_DIR, UPLOAD_DIR } from '@/lib/project';

export const dynamic = 'force-dynamic';

// Accepts files (optionally with a relative path from a dropped/selected folder) and stores
// the supported 3D formats under <project>/uploads, keeping the folder structure.
export async function POST(req: Request) {
  const form = await req.formData();
  const root = path.join(PROJECT_DIR, UPLOAD_DIR);
  const saved: string[] = [];
  let skipped = 0;
  const paths = form.getAll('paths');
  for (const [i, entry] of form.getAll('files').entries()) {
    if (typeof entry === 'string') continue;
    const rel = typeof paths[i] === 'string' && paths[i] ? (paths[i] as string) : entry.name;
    const target = path.resolve(root, rel.replace(/^[/\\]+/, ''));
    if (!target.startsWith(root + path.sep) || !MODEL_EXTS.has(path.extname(target).toLowerCase())) { skipped++; continue; }
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(await entry.arrayBuffer()));
    saved.push(path.relative(PROJECT_DIR, target));
  }
  return Response.json({ saved, skipped });
}
