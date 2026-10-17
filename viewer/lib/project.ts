import fs from 'node:fs';
import path from 'node:path';

// The viewer lives in <project>/viewer; models are searched in the project root.
export const PROJECT_DIR = path.resolve(process.cwd(), '..');
const MODEL_EXTS = new Set(['.stp', '.step']);
const SKIP = new Set(['viewer', 'node_modules']);

export type ModelFile = { path: string; size: number };

export function listModels(dir = PROJECT_DIR, out: ModelFile[] = []): ModelFile[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name) || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listModels(p, out);
    else if (MODEL_EXTS.has(path.extname(e.name).toLowerCase())) {
      out.push({ path: path.relative(PROJECT_DIR, p), size: fs.statSync(p).size });
    }
  }
  return out;
}

export const CACHE_DIR = path.join(process.cwd(), '.cache');

// Resolves a project-relative model path to an absolute path, or null if it escapes the project.
export function resolveModel(rel: string): string | null {
  const file = path.resolve(PROJECT_DIR, rel);
  if (!file.startsWith(PROJECT_DIR + path.sep) || !MODEL_EXTS.has(path.extname(file).toLowerCase())) return null;
  return fs.existsSync(file) ? file : null;
}
