import fs from 'node:fs';
import path from 'node:path';
import { getAliases } from './aliases';
import { getInfo } from './info';
import { getNames } from './names';
import { listNotes } from './notes';
import { CACHE_DIR, cacheId, resolveModel } from './project';
import { MACHINE, NOTE_TYPES } from './noteTypes';

type TreeNode = { name: string; children?: TreeNode[] };

// Plain-text briefing about one machine for the assistant: what people have written about it, and its structure.
export function machineContext(model: string): string {
  const names = getNames(model);
  const aliases = getAliases(model);
  const info = getInfo(model);
  const label = (id: string) => (id === MACHINE ? 'the whole machine' : names[id] ?? id);
  const out: string[] = [];

  out.push(`MACHINE: ${info.title || path.basename(model)} (file ${path.basename(model)})`);
  if (info.description) out.push(`Description: ${info.description}`);

  // Assembly structure from the converted model, if it has been converted: top levels only.
  try {
    const file = resolveModel(model);
    if (file) {
      const tree: { roots: TreeNode[] } = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, cacheId(file), 'model.json'), 'utf8'));
      let level = tree.roots;
      while (level.length === 1 && level[0].children?.length) level = level[0].children;
      out.push('\nMAIN PARTS (id — given name):');
      for (const p of level.slice(0, 60)) {
        const subs = (p.children ?? []).slice(0, 12).map((c) => label(c.name)).join(', ');
        out.push(`- ${p.name} — ${names[p.name] ?? 'not named'}${aliases[p.name]?.length ? ` (also called: ${aliases[p.name].join(', ')})` : ''}${subs ? `; contains: ${subs}` : ''}`);
      }
    }
  } catch { /* not converted yet: the names below still help */ }

  const named = Object.entries(names).filter(([id]) => !out.some((l) => l.startsWith(`- ${id} `)));
  if (named.length) out.push('\nOTHER NAMED PARTS:\n' + named.map(([id, n]) => `- ${id} — ${n}`).join('\n'));
  const described = Object.entries(info.parts);
  if (described.length) out.push('\nPART DESCRIPTIONS:\n' + described.map(([id, d]) => `- ${label(id)}: ${d}`).join('\n'));

  const notes = listNotes(model);
  out.push(`\nKNOWLEDGE NOTES (${notes.length}), written by the people who designed, built or service the machine:`);
  for (const n of notes) {
    const type = NOTE_TYPES.find((t) => t.id === n.type)?.label ?? n.type;
    out.push(`- [${type}] about ${n.parts.map(label).join(', ')} — by ${n.author || 'an unknown author'} (${n.updatedAt.slice(0, 10)}): ${n.text}`);
  }
  if (notes.length === 0) out.push('(none yet)');
  return out.join('\n');
}
