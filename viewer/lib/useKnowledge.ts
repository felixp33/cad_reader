'use client';

import { useCallback, useEffect, useState } from 'react';
import type { KnowledgeItem } from './knowledgeTypes';

export type KnowledgeInput = Partial<KnowledgeItem> & Pick<KnowledgeItem, 'title'>;

export function useKnowledge() {
  const [items, setItems] = useState<KnowledgeItem[] | null>(null);
  useEffect(() => { fetch('/api/knowledge').then((r) => r.json()).then(setItems); }, []);

  const save = useCallback(async (input: KnowledgeInput) => {
    const res = await fetch('/api/knowledge', { method: 'PUT', body: JSON.stringify({ item: input }) });
    if (!res.ok) throw new Error(await res.text());
    const saved: KnowledgeItem = await res.json();
    setItems((prev) => (prev ?? []).some((i) => i.id === saved.id) ? prev!.map((i) => (i.id === saved.id ? saved : i)) : [...(prev ?? []), saved]);
    return saved;
  }, []);

  const remove = useCallback(async (id: string) => {
    await fetch('/api/knowledge?id=' + encodeURIComponent(id), { method: 'DELETE' });
    setItems((prev) => (prev ?? []).filter((i) => i.id !== id).map((i) => ({ ...i, links: i.links.filter((l) => l !== id) })));
  }, []);

  return { items, save, remove };
}
