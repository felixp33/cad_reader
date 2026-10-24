'use client';

import { useSyncExternalStore } from 'react';

// Mock accounts until there is real authentication; switch between them from the profile menu.
// Notes are attributed to the signed-in user's name.
export type User = { id: string; name: string; role: string };

export const USERS: User[] = [
  { id: 'mara', name: 'Mara Lindqvist', role: 'Design engineer' },
  { id: 'jonas', name: 'Jonas Okafor', role: 'Service technician' },
];

const KEY = 'cad.user';
const listeners = new Set<() => void>();
let current: User | null = null;

export function getUser(): User {
  if (!current) {
    let id: string | null = null;
    try { id = localStorage.getItem(KEY); } catch { /* no storage */ }
    current = USERS.find((u) => u.id === id) ?? USERS[0];
  }
  return current;
}

export function setUser(id: string) {
  current = USERS.find((u) => u.id === id) ?? USERS[0];
  try { localStorage.setItem(KEY, current.id); } catch { /* no storage */ }
  listeners.forEach((l) => l());
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

export const useUser = () => useSyncExternalStore(subscribe, getUser, () => USERS[0]);

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
