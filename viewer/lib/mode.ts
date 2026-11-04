'use client';

import { useSyncExternalStore } from 'react';

// Creator: adds and edits information (names, notes, knowledge). Consumer: browses what others have provided, read-only.
export type Mode = 'creator' | 'consumer';

const KEY = 'cad.mode';

export const getMode = (): Mode => {
  try { return localStorage.getItem(KEY) === 'consumer' ? 'consumer' : 'creator'; } catch { return 'creator'; }
};

export function setMode(m: Mode) {
  try { localStorage.setItem(KEY, m); } catch { /* no storage */ }
  dispatchEvent(new Event('cad-mode'));
}

const subscribe = (cb: () => void) => { addEventListener('cad-mode', cb); return () => removeEventListener('cad-mode', cb); };

export const useMode = (): Mode => useSyncExternalStore(subscribe, getMode, () => 'creator' as Mode);
