import fs from 'node:fs';
import path from 'node:path';

// Human-readable part names, stored as { [modelPath]: { [partId]: name } }.
const FILE = path.join(process.cwd(), 'data', 'names.json');

type Store = Record<string, Record<string, string>>;

function read(): Store {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}

export function getNames(model: string): Record<string, string> {
  return read()[model] ?? {};
}

// An empty name removes the entry.
export function setName(model: string, id: string, name: string) {
  const store = read();
  const names = (store[model] ??= {});
  if (name.trim()) names[id] = name.trim(); else delete names[id];
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}
