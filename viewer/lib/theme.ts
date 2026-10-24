export type Theme = 'light' | 'dark';

const KEY = 'cad.theme';

// Runs before first paint (see layout) so a light-mode user doesn't get a dark flash.
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${KEY}');document.documentElement.dataset.theme=t==='light'?'light':'dark'}catch(e){document.documentElement.dataset.theme='dark'}`;

export const getTheme = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* no storage */ }
}

export function subscribeTheme(cb: () => void) {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => o.disconnect();
}

// A color token (e.g. '--canvas-bg') as currently themed, for the WebGL canvases.
export const cssColor = (token: string) => getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#14171c';
