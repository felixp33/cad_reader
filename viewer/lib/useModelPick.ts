'use client';

import { useEffect, useState } from 'react';

export type ModelFile = { path: string; size: number };

// The machine a page works on: ?model=… from the URL, else the first one in the project.
export function useModelPick() {
  const [models, setModels] = useState<ModelFile[]>([]);
  const [model, setModel] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/models').then((r) => r.json()).then((m: ModelFile[]) => {
      setModels(m);
      const wanted = new URLSearchParams(location.search).get('model');
      setModel((m.find((f) => f.path === wanted) ?? m[0])?.path ?? null);
    });
  }, []);
  return { models, model, setModel };
}
