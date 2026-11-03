'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Settings as Gear, X } from 'lucide-react';
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
        <Gear className="ic" size={16} aria-hidden />
      </button>
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2 id="settings-title">Settings</h2>
              <button className="icon-btn" aria-label="Close settings" onClick={() => setOpen(false)}><X className="ic" size={16} /></button>
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
