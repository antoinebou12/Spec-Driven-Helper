import { useEffect, useState } from 'react';
import { useLocalStorage } from './state';

/**
 * Light or dark follows the system appearance, live, unless the person picks one. The earlier
 * `sdd-theme` key stored the system appearance of the first visit as if it were a choice, so the
 * app never followed the system again; the new key starts from "system".
 */
export type Appearance = 'system' | 'light' | 'dark';

const darkQuery = () => window.matchMedia?.('(prefers-color-scheme: dark)');

/**
 * Sets the theme on the page. A change (not the first paint) eases colours for a moment instead of a sudden
 * brightness jump; style.css limits the easing to people who have not asked for reduced motion.
 */
export function applyTheme(theme: 'light' | 'dark', root: HTMLElement = document.documentElement) {
  const before = root.dataset.theme;
  root.dataset.theme = theme;
  if (!before || before === theme) return;
  root.classList.add('theme-fade');
  setTimeout(() => root.classList.remove('theme-fade'), 300);
}

export function useAppearance() {
  const [choice, setChoice] = useLocalStorage<Appearance>('sdd-appearance', 'system');
  const [systemDark, setSystemDark] = useState(() => darkQuery()?.matches ?? false);
  useEffect(() => {
    const query = darkQuery();
    if (!query) return;
    const follow = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener?.('change', follow);
    return () => query.removeEventListener?.('change', follow);
  }, []);
  const theme: 'light' | 'dark' = choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;
  return { choice, setChoice, theme };
}
