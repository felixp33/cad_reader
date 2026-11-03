'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { Check, Settings as Gear, X } from 'lucide-react';
import { getLang, setLang, subscribeLang, type Lang } from '@/lib/lang';
import { CANVAS_BGS, getCanvasBg, getTheme, setCanvasBg, setTheme, subscribeTheme, type CanvasBg, type Theme } from '@/lib/theme';

const LANGS: { id: Lang; label: string }[] = [{ id: 'en', label: 'English' }, { id: 'de', label: 'Deutsch' }];
const THEMES: { id: Theme; label: string }[] = [{ id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }];

// Gear button for the top bar plus the settings pop-up it opens. Only appearance for now.
export default function Settings() {
  const [open, setOpen] = useState(false);
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => 'dark' as Theme);

  const canvasBg = useSyncExternalStore(subscribeTheme, getCanvasBg, () => 'gunmetal' as CanvasBg);
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
      {open && createPortal(
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
                <select className="setting-select" value={lang} aria-label="Language" onChange={(e) => setLang(e.target.value as Lang)}>
                  {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
              </div>
              <div className="setting">
                <span>3D background</span>
                <div className="swatches" role="radiogroup" aria-label="3D background">
                  {CANVAS_BGS.map((b) => (
                    <button key={b.id} role="radio" aria-checked={canvasBg === b.id} className="swatch" title={b.label} aria-label={b.label} style={{ background: b.color }} onClick={() => setCanvasBg(b.id)}>
                      {canvasBg === b.id && <Check size={14} color={b.id === 'faded' || b.id === 'steel' ? '#31343a' : '#fff'} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
