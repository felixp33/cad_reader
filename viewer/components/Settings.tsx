'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { getLang, setLang, subscribeLang, type Lang } from '@/lib/lang';
import { getTheme, setTheme, subscribeTheme, type Theme } from '@/lib/theme';

const LANGS: { id: Lang; label: string }[] = [{ id: 'en', label: 'English' }, { id: 'de', label: 'Deutsch' }];
const THEMES: { id: Theme; label: string }[] = [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }];

// Gear button for the top bar plus the settings pop-up it opens. Only appearance for now.
export default function Settings() {
  const [open, setOpen] = useState(false);
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'dark' as Theme);

  const lang = useSyncExternalStore(subscribeLang, getLang, () => 'en' as Lang);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button className="btn icon-btn" title="Settings" aria-label="Settings" onClick={() => setOpen(true)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 id="settings-title">Settings</h2>
              <button className="icon-btn" aria-label="Close settings" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="setting">
                <span>Appearance</span>
                <div className="segmented" role="group" aria-label="Appearance">
                  {THEMES.map((t) => <button key={t.id} aria-pressed={theme === t.id} onClick={() => setTheme(t.id)}>{t.label}</button>)}
                </div>
              </div>
              <div className="setting">
                <span>Language</span>
                <div className="segmented" role="group" aria-label="Language">
                  {LANGS.map((l) => <button key={l.id} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>{l.label}</button>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
