export type ThemePref = 'light' | 'dark' | 'system';
const KEY = 'az-theme';

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'light' || v === 'dark' || v === 'system') return v;
  } catch {
    // ignorado: sem armazenamento, segue o sistema
  }
  return 'system';
}

export function applyTheme(pref: ThemePref): void {
  const root = document.documentElement;
  if (pref === 'system') delete root.dataset.theme;
  else root.dataset.theme = pref;
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    // preferência vale só nesta aba
  }
}
