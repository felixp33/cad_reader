export type Theme = 'light' | 'dark';

const KEY = 'cad.theme';
const CANVAS_KEY = 'cad.canvas';

// Background of the 3D views. Unset = follow the theme.
export const CANVAS_BGS = [
  { id: 'faded', label: 'Faded White', color: '#dfe2e4' },
  { id: 'steel', label: 'Silver Steel', color: '#9da5a8' },
  { id: 'camo', label: 'Dark Grey Camo', color: '#737a80' },
  { id: 'gunmetal', label: 'Gunmetal Gray', color: '#31343a' },
] as const;
export type CanvasBg = (typeof CANVAS_BGS)[number]['id'];

// Runs before first paint (see layout) so a light-mode user doesn't get a dark flash.
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem('${KEY}');document.documentElement.dataset.theme=t==='light'?'light':'dark';var c=localStorage.getItem('${CANVAS_KEY}');if(c)document.documentElement.dataset.canvas=c}catch(e){document.documentElement.dataset.theme='dark'}`;

export const getTheme = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

export function setTheme(t: Theme) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* no storage */ }
}

// The chosen background, or the theme's own (light theme: Faded White, dark theme: Gunmetal Gray).
export const getCanvasBg = (): CanvasBg => {
  const c = document.documentElement.dataset.canvas;
  return CANVAS_BGS.find((b) => b.id === c)?.id ?? (getTheme() === 'light' ? 'faded' : 'gunmetal');
};

export function setCanvasBg(c: CanvasBg) {
  document.documentElement.dataset.canvas = c;
  try { localStorage.setItem(CANVAS_KEY, c); } catch { /* no storage */ }
}

export function subscribeTheme(cb: () => void) {
  const o = new MutationObserver(cb);
  o.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-canvas'] });
  return () => o.disconnect();
}

// A color token (e.g. '--canvas-bg') as currently themed, for the WebGL canvases.
export const cssColor = (token: string) => getComputedStyle(document.documentElement).getPropertyValue(token).trim() || '#25282d';
