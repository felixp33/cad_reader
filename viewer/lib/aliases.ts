import fs from 'node:fs';
import path from 'node:path';

// Alternative spoken/written names for parts ("hatch" for the door), stored as { [modelPath]: { [partId]: string[] } }.
const FILE = path.join(process.cwd(), 'data', 'aliases.json');

type Store = Record<string, Record<string, string[]>>;

function read(): Store {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; }
}

export function getAliases(model: string): Record<string, string[]> {
  return read()[model] ?? {};
}

// An empty list removes the entry.
export function setAliases(model: string, id: string, aliases: string[]) {
  const store = read();
  const all = (store[model] ??= {});
  const clean = [...new Set(aliases.map((a) => a.trim()).filter(Boolean))];
  if (clean.length) all[id] = clean; else delete all[id];
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
}
