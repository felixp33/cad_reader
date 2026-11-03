export type Lang = 'en' | 'de';

const KEY = 'cad.lang';

// Preference only for now — nothing is translated yet.
export const getLang = (): Lang => {
  try { return localStorage.getItem(KEY) === 'de' ? 'de' : 'en'; } catch { return 'en'; }
};

export function setLang(l: Lang) {
  try { localStorage.setItem(KEY, l); } catch { /* no storage */ }
  document.documentElement.lang = l;
  dispatchEvent(new Event('cad-lang'));
}

export function subscribeLang(cb: () => void) {
  addEventListener('cad-lang', cb);
  return () => removeEventListener('cad-lang', cb);
}
