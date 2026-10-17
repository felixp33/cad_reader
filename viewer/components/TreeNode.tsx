'use client';

import { useState } from 'react';
import type * as THREE from 'three';

export type Entry = { name: string; group: THREE.Group; children: Entry[] };

// True if this entry or any descendant matches the filter.
const matches = (e: Entry, q: string): boolean => !q || e.name.toLowerCase().includes(q) || e.children.some((c) => matches(c, q));

export default function TreeNode({ entry, depth, filter, selected, onSelect, onIsolate }: {
  entry: Entry; depth: number; filter: string; selected: Entry | null; onSelect: (e: Entry) => void; onIsolate: (e: Entry) => void;
}) {
  const [open, setOpen] = useState(depth < 1);
  const [, force] = useState(0);
  if (!matches(entry, filter)) return null;
  const expanded = open || !!filter;
  const visible = entry.group.visible;

  return (
    <div>
      <div className={`node${selected === entry ? ' sel' : ''}${visible ? '' : ' off'}`} onClick={() => onSelect(entry)}>
        <span className="twist" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>
          {entry.children.length ? (expanded ? '▾' : '▸') : ''}
        </span>
        <span className="label">{entry.name}</span>
        <span className="eye iso-btn" title="View isolated" onClick={(e) => { e.stopPropagation(); onIsolate(entry); }}>⧉</span>
        <span className="eye" onClick={(e) => { e.stopPropagation(); entry.group.visible = !visible; force((n) => n + 1); }}>👁</span>
      </div>
      {expanded && entry.children.length > 0 && (
        <div className="children">
          {entry.children.map((c, i) => (
            <TreeNode key={i} entry={c} depth={depth + 1} filter={filter} selected={selected} onSelect={onSelect} onIsolate={onIsolate} />
          ))}
        </div>
      )}
    </div>
  );
}
