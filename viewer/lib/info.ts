import fs from 'node:fs';
import path from 'node:path';

// User-written info, stored as { [modelPath]: { title, description, buildYear, updatedAt, parts: { [partId]: description } } }.
const FILE = path.join(process.cwd(), 'data', 'info.json');

export type MachineInfo = { title: string; description: string; buildYear: string; updatedAt: string; parts: Record<string, string> };
type Store = Record<string, Partial<MachineInfo>>;

function read(): Store {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}

export function getInfo(model: string): MachineInfo {
  const i = read()[model] ?? {};
  return { title: i.title ?? '', description: i.description ?? '', buildYear: i.buildYear ?? '', updatedAt: i.updatedAt ?? '', parts: i.parts ?? {} };
}

// Patch semantics: title/description/buildYear replace; `parts` entries are merged, an empty description removes the entry.
export function setInfo(model: string, patch: Partial<Omit<MachineInfo, 'updatedAt'>>) {
  const store = read();
  const cur = getInfo(model);
  const parts = { ...cur.parts };
  for (const [id, text] of Object.entries(patch.parts ?? {})) {
    if (text.trim()) parts[id] = text; else delete parts[id];
  }
  store[model] = { title: patch.title ?? cur.title, description: patch.description ?? cur.description, buildYear: patch.buildYear ?? cur.buildYear, updatedAt: new Date().toISOString(), parts };
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}
